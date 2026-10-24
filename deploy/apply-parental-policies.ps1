# Aplica o filtro parental por politica de maquina (Chrome + Edge).
# Correr como Administrador. Idempotente: pode correr varias vezes.
#
# Porque politica e nao extensao: as politicas valem para TODOS os perfis do
# browser, aplicam-se antes de qualquer perfil carregar, e o utilizador nao as
# consegue desligar. Uma extensao e por perfil e pode ser removida.
#
#   .\apply-parental-policies.ps1                        -> aplica tudo; pagina de extensoes livre
#   .\apply-parental-policies.ps1 -LockExtensionsPage    -> tranca tambem a pagina de extensoes
#                                                           para TODA a gente (nem com PIN abre)
#   .\apply-parental-policies.ps1 -DisableIncognito      -> desliga as janelas anonimas/InPrivate
#
# A pagina de extensoes fica livre por omissao: desde a v1.3.0 o proprio
# ShieldBlock pede o PIN para a abrir, e quem sabe o PIN pode gerir as outras
# extensoes. O trancamento por politica so faz sentido num PC sem PIN definido.

param([switch]$LockExtensionsPage, [switch]$DisableIncognito)

#Requires -RunAsAdministrator

$adultDomains = @(
  'adultfriendfinder.com','amateurporn.com','ashleymadison.com','bangbros.com','beeg.com',
  'bongacams.com','brazzers.com','cam4.com','camsoda.com','chaturbate.com','coomer.party',
  'digitalplayground.com','drtuber.com','e621.net','empflix.com','erome.com','fapello.com',
  'faphouse.com','flirt4free.com','fotospeladas.net','gatasnuas.com','hanime.tv',
  'hardsextube.com','hentaihaven.xxx','hustler.com','imagefap.com','imlive.com',
  'kemono.party','kink.com','kushub.com','livejasmin.com','metart.com','mofos.com',
  'motherless.com','musasbrasil.com','myfreecams.com','naijared.com','naughtyamerica.com',
  'nhentai.net','onlyfans.com','peladas.com','penthouse.com','playboy.com','porn.com',
  'porndig.com','porndoe.com','pornhub.com','pornmd.com','pornone.com','porntrex.com',
  'pornyub.com','realitykings.com','redgifs.com','redtube.com','rule34.xxx','sex.com',
  'sexlog.com.br','sexolog.com.br','spankbang.com','streamate.com','stripchat.com',
  'thothub.to','tnaflix.com','tube8.com','twistys.com','txxx.com','wankz.com','xcams.com',
  'xhamster.com','xnxx.com','xvideos.com','youporn.com'
)

# YouTube bloqueado por completo: o Modo Restrito sozinho ainda deixa passar
# conteudo sugestivo nas pesquisas.
$youtubeDomains = @(
  'youtube.com','youtu.be','youtube-nocookie.com'
)

# Redes sociais bloqueadas por completo (tambem no anonimo, ao contrario da
# extensao, que so la corre se tiver permissao).
$socialDomains = @(
  'kwai.com','kwai.net','kuaishou.com',
  'pinterest.com','pinterest.pt','pinterest.com.br','pin.it'
)

# youtubekids.com fica DE FORA de proposito. googlevideo.com tambem, para nao
# partir video incorporado noutros sites -- acrescentar se quiseres bloquear isso.

# Pagina de gestao de extensoes: sem ela nao ha interruptor para desligar o
# ShieldBlock. Os dois esquemas valem nos dois browsers (o Edge aceita chrome://).
$extensionPages = @(
  'chrome://extensions','chrome://extensions/*','chrome://settings/extensions',
  'edge://extensions','edge://extensions/*','edge://settings/extensions'
)

# Cada browser instala o Abrigo da sua loja: o Edge fora de dominio ignora o
# forcelist com o URL da Chrome Web Store, so aceita o do Edge Add-ons.
$abrigo = @{
  'Chrome' = @{ Id = 'hpacahhegipipgmpiihbohdbjoecnlli'; Update = 'https://clients2.google.com/service/update2/crx' }
  'Edge'   = @{ Id = 'mgnpemfmkngonkkfmdjhbcgcnnokbhbb'; Update = 'https://edge.microsoft.com/extensionwebstorebase/v1/crx' }
}

$browsers = @{
  'Chrome' = 'HKLM:\SOFTWARE\Policies\Google\Chrome'
  'Edge'   = 'HKLM:\SOFTWARE\Policies\Microsoft\Edge'
}

foreach ($name in $browsers.Keys) {
  $root = $browsers[$name]
  if (-not (Test-Path $root)) { New-Item -Path $root -Force | Out-Null }

  # --- SafeSearch travado (o utilizador nao consegue desligar) ---
  New-ItemProperty -Path $root -Name 'ForceGoogleSafeSearch' -Value 1 -PropertyType DWord -Force | Out-Null
  New-ItemProperty -Path $root -Name 'ForceYouTubeRestrict'  -Value 2 -PropertyType DWord -Force | Out-Null
  if ($name -eq 'Edge') {
    New-ItemProperty -Path $root -Name 'ForceBingSafeSearch' -Value 1 -PropertyType DWord -Force | Out-Null
  }

  # --- Filtro de conteudo adulto por classificacao (Safe Sites) ---
  # O URLBlocklist abaixo e uma lista fixa de dominios: qualquer site que nao
  # esteja nela passa. SafeSitesFilterBehavior=1 usa o classificador de
  # conteudo do Google/Microsoft para bloquear sites adultos dinamicamente,
  # cobrindo o que a lista fixa nao apanha.
  New-ItemProperty -Path $root -Name 'SafeSitesFilterBehavior' -Value 1 -PropertyType DWord -Force | Out-Null

  # --- Janelas anonimas ---
  # Ficam disponiveis por omissao. As politicas deste script (SafeSearch,
  # SafeSites, URLBlocklist) valem tambem no anonimo; o Abrigo so corre la
  # depois de ligar "Permitir no modo anonimo" nos detalhes da extensao; para
  # ninguem o desligar, usar -LockExtensionsPage.
  # -DisableIncognito desliga-as de todo. Valores: Chrome 0 = disponivel,
  # 1 = desativado; Edge igual.
  $incognito = if ($DisableIncognito) { 1 } else { 0 }
  if ($name -eq 'Chrome') {
    New-ItemProperty -Path $root -Name 'IncognitoModeAvailability' -Value $incognito -PropertyType DWord -Force | Out-Null
  } else {
    New-ItemProperty -Path $root -Name 'InPrivateModeAvailability' -Value $incognito -PropertyType DWord -Force | Out-Null
  }

  # --- URLBlocklist: preserva o que ja la estiver, acrescenta o resto ---
  $blk = Join-Path $root 'URLBlocklist'
  if (-not (Test-Path $blk)) { New-Item -Path $blk -Force | Out-Null }

  $all = @()
  $existing = Get-ItemProperty -Path $blk -ErrorAction SilentlyContinue
  if ($existing) {
    $existing.PSObject.Properties |
      Where-Object { $_.Name -notlike 'PS*' } |
      ForEach-Object { $all += [string]$_.Value }
  }

  foreach ($d in ($adultDomains + $youtubeDomains + $socialDomains)) {
    if ($all -notcontains $d)     { $all += $d }
    if ($all -notcontains "*.$d") { $all += "*.$d" }
  }

  if ($LockExtensionsPage) {
    foreach ($p in $extensionPages) { if ($all -notcontains $p) { $all += $p } }
  } else {
    $all = @($all | Where-Object { $extensionPages -notcontains $_ })
  }

  # Reescreve a lista numerada 1..N (o formato que o Chrome/Edge esperam)
  if ($existing) {
    $existing.PSObject.Properties |
      Where-Object { $_.Name -notlike 'PS*' } |
      ForEach-Object { Remove-ItemProperty -Path $blk -Name $_.Name -Force -ErrorAction SilentlyContinue }
  }
  $i = 1
  foreach ($v in $all) {
    New-ItemProperty -Path $blk -Name "$i" -Value $v -PropertyType String -Force | Out-Null
    $i++
  }

  # --- Abrigo instalado a forca a partir da loja do browser ---
  # Extensao instalada por politica nao tem botao "Remover" nem se pode
  # desligar. Entradas do Abrigo com o ID da outra loja sao retiradas.
  $abrigoId    = $abrigo[$name].Id
  $abrigoForce = "$abrigoId;$($abrigo[$name].Update)"
  $otherIds    = @($abrigo.Values | ForEach-Object { $_.Id } | Where-Object { $_ -ne $abrigoId })
  $fl = Join-Path $root 'ExtensionInstallForcelist'
  if (-not (Test-Path $fl)) { New-Item -Path $fl -Force | Out-Null }
  $flProps = @((Get-ItemProperty -Path $fl -ErrorAction SilentlyContinue).PSObject.Properties |
    Where-Object { $_.Name -notlike 'PS*' })
  foreach ($p in $flProps) {
    if ($otherIds | Where-Object { ([string]$p.Value) -like "$_;*" }) {
      Remove-ItemProperty -Path $fl -Name $p.Name -Force
    }
  }
  $flProps = @((Get-ItemProperty -Path $fl -ErrorAction SilentlyContinue).PSObject.Properties |
    Where-Object { $_.Name -notlike 'PS*' })
  if (-not ($flProps | Where-Object { ([string]$_.Value) -like "$abrigoId;*" })) {
    $n = 1
    while ($flProps | Where-Object { $_.Name -eq "$n" }) { $n++ }
    New-ItemProperty -Path $fl -Name "$n" -Value $abrigoForce -PropertyType String -Force | Out-Null
  }

  # A copia do Abrigo da outra loja e bloqueada, para nao correrem duas.
  $bl = Join-Path $root 'ExtensionInstallBlocklist'
  if (-not (Test-Path $bl)) { New-Item -Path $bl -Force | Out-Null }
  $blProps = @((Get-ItemProperty -Path $bl -ErrorAction SilentlyContinue).PSObject.Properties |
    Where-Object { $_.Name -notlike 'PS*' })
  foreach ($id in $otherIds) {
    if (-not ($blProps | Where-Object { ([string]$_.Value) -eq $id })) {
      $n = 1
      while ($blProps | Where-Object { $_.Name -eq "$n" }) { $n++ }
      New-ItemProperty -Path $bl -Name "$n" -Value $id -PropertyType String -Force | Out-Null
      $blProps = @((Get-ItemProperty -Path $bl).PSObject.Properties | Where-Object { $_.Name -notlike 'PS*' })
    }
  }

  Write-Host "$name -> $($all.Count) entradas em URLBlocklist, SafeSearch travado, Abrigo instalado por politica" -ForegroundColor Green
}

Write-Host ""
if ($LockExtensionsPage) {
  Write-Host "Pagina de extensoes trancada para toda a gente (chrome://extensions / edge://extensions)." -ForegroundColor Yellow
} else {
  Write-Host "Pagina de extensoes livre -- protegida pelo PIN do ShieldBlock (definir o PIN em cada perfil)." -ForegroundColor Green
}
Write-Host "Feito. Fecha e reabre os browsers." -ForegroundColor Cyan
Write-Host "Verificar em: chrome://policy  /  edge://policy" -ForegroundColor Cyan

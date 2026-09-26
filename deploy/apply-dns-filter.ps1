# Filtro de DNS para o Windows inteiro: Cloudflare for Families (bloqueia
# adultos + malware). Vale para QUALQUER browser, perfil ou programa, com ou
# sem a extensao ShieldBlock.
# Correr como Administrador. Idempotente.
#
#   .\apply-dns-filter.ps1         -> aplica
#   .\apply-dns-filter.ps1 -Undo   -> repoe DNS automatico (DHCP) e remove as politicas de DNS
#
# Tres pecas, porque cada uma sozinha tem uma fuga:
#   1. DNS das placas de rede -> 1.1.1.3 / 1.0.0.3 (familia)
#   2. O Windows passa a falar com esses servidores por DoH cifrado (o router/ISP
#      nao consegue trocar as respostas)
#   3. Chrome/Edge obrigados a usar DoH da Cloudflare Familia -- sem isto, o
#      "DNS seguro" dos browsers pode ser posto a apontar para outro servidor
#      (8.8.8.8, 1.1.1.1) e salta o filtro

param([switch]$Undo)

#Requires -RunAsAdministrator

$v4  = @('1.1.1.3', '1.0.0.3')
$v6  = @('2606:4700:4700::1113', '2606:4700:4700::1003')
$doh = 'https://family.cloudflare-dns.com/dns-query'

# So placas fisicas (Wi-Fi/Ethernet). As VPN (Fortinet, Check Point, Tailscale)
# ficam como estao para nao partir o trabalho.
$adapters = Get-NetAdapter -Physical | Where-Object { $_.InterfaceDescription -notmatch 'Virtual|VPN|Tailscale' }

$policyRoots = @('HKLM:\SOFTWARE\Policies\Google\Chrome', 'HKLM:\SOFTWARE\Policies\Microsoft\Edge')

if ($Undo) {
  foreach ($a in $adapters) {
    Set-DnsClientServerAddress -InterfaceIndex $a.ifIndex -ResetServerAddresses
    Write-Host "$($a.Name): DNS automatico (DHCP)" -ForegroundColor Yellow
  }
  foreach ($root in $policyRoots) {
    Remove-ItemProperty -Path $root -Name 'DnsOverHttpsMode','DnsOverHttpsTemplates' -ErrorAction SilentlyContinue
  }
  Clear-DnsClientCache
  Write-Host "Filtro de DNS removido. Reinicia os browsers." -ForegroundColor Yellow
  return
}

# 1 + 2. DNS das placas e DoH do Windows
foreach ($ip in $v4 + $v6) {
  if (-not (Get-DnsClientDohServerAddress -ServerAddress $ip -ErrorAction SilentlyContinue)) {
    Add-DnsClientDohServerAddress -ServerAddress $ip -DohTemplate $doh -AllowFallbackToUdp $false -AutoUpgrade $true | Out-Null
  } else {
    Set-DnsClientDohServerAddress -ServerAddress $ip -DohTemplate $doh -AllowFallbackToUdp $false -AutoUpgrade $true | Out-Null
  }
}
foreach ($a in $adapters) {
  Set-DnsClientServerAddress -InterfaceIndex $a.ifIndex -ServerAddresses ($v4 + $v6)
  Write-Host "$($a.Name): DNS -> Cloudflare Familia" -ForegroundColor Green
}

# 3. Browsers presos ao DoH de familia
foreach ($root in $policyRoots) {
  if (-not (Test-Path $root)) { New-Item -Path $root -Force | Out-Null }
  New-ItemProperty -Path $root -Name 'DnsOverHttpsMode'      -Value 'secure' -PropertyType String -Force | Out-Null
  New-ItemProperty -Path $root -Name 'DnsOverHttpsTemplates' -Value $doh     -PropertyType String -Force | Out-Null
}

Clear-DnsClientCache

# Verificacao: a Cloudflare Familia responde 0.0.0.0 para sites adultos
$test = Resolve-DnsName 'pornhub.com' -Type A -DnsOnly -ErrorAction SilentlyContinue | Where-Object Type -eq 'A'
if ($test -and ($test.IPAddress -contains '0.0.0.0')) {
  Write-Host "Teste OK: pornhub.com -> 0.0.0.0 (bloqueado pelo DNS)" -ForegroundColor Green
} else {
  Write-Host "ATENCAO: pornhub.com resolveu para $($test.IPAddress -join ', ') -- verificar" -ForegroundColor Red
}
Write-Host "Feito. Reinicia os browsers. Verificar em chrome://policy e edge://policy." -ForegroundColor Cyan

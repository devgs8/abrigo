# Abrigo

**Bloqueio gratuito de conteúdo adulto para Chrome e Edge.** Sem anúncios, sem contas, sem recolha de dados — tudo funciona no próprio computador.

*Free adult content blocker for Chrome and Edge. No ads, no accounts, no data collection — everything runs on your computer. [English below](#english).*

---

## O que faz

- **Bloqueia ~477 mil sites adultos**, incluindo vídeos e imagens desses sites embutidos noutras páginas.
- **Apanha sites novos** que ainda não estão em lista nenhuma: pelo nome do domínio e por um detetor que analisa a página (título, texto, imagens).
- **Bloqueia pesquisas explícitas** no Google, Bing, DuckDuckGo, Yahoo, Brave Search, Startpage, Ecosia e Qwant, e força o filtro seguro de cada motor. Reconhece variações como `p0rn` ou `p o r n`.
- **Categorias opcionais:** apostas, redes sociais, jogos online.
- **YouTube:** livre, modo restrito forçado, ou bloqueado.
- **PIN de proteção:** impede que alguém desligue a proteção ou mude as definições do Abrigo. Para impedir também a remoção da extensão, o Windows pode instalá-la por política de administrador (a partir da versão da Chrome Web Store).
- **"Trancar de vez":** gera um PIN que ninguém conhece — para quem se quer proteger a si próprio sem possibilidade de voltar atrás.

Interface em português, inglês, espanhol e francês.

## Privacidade

O Abrigo não faz nenhum pedido à internet. Não recolhe, não guarda fora do browser e não envia o histórico de navegação, as pesquisas ou qualquer outro dado. Ver [PRIVACY.md](PRIVACY.md).

## Instalar

- **Chrome Web Store:** [instalar o Abrigo](https://chromewebstore.google.com/detail/abrigo/hpacahhegipipgmpiihbohdbjoecnlli) (funciona também no Edge)
- **A partir do código:** `chrome://extensions` → ativar *Modo de programador* → *Carregar expandida* → escolher esta pasta.

### Proteção extra no Windows (opcional)

A pasta [`deploy/`](deploy/) tem scripts PowerShell para correr como administrador:

- `apply-dns-filter.ps1` — põe o Windows inteiro a usar o DNS da Cloudflare for Families (bloqueia sites adultos em qualquer browser ou programa, com ou sem a extensão). `-Undo` reverte.
- `apply-parental-policies.ps1` — políticas do Chrome/Edge: SafeSearch forçado, janelas anónimas desligadas, filtro SafeSites, e uma lista curta de sites adultos **e o YouTube** bloqueados por completo (editar `$youtubeDomains` no script para o deixar de fora).

## Desenvolvimento

```bash
node tools/build-adult-rules.mjs     # descarrega as listas e gera rules/adult.json
node tools/pack.mjs                  # gera dist/abrigo-<versão>.zip para a loja
node tools/validate.mjs dist/abrigo-<versão>.zip   # verifica as regras da loja antes de submeter
```

A lista de domínios em `rules/adult.json` é gerada — não editar à mão.

## Créditos

As listas de domínios adultos vêm de dois projetos, ambos GPLv3:

- [oisd nsfw](https://oisd.nl) — © sjhgvr
- [HaGeZi's NSFW](https://github.com/hagezi/dns-blocklists) — © HaGeZi

## Licença

[GPL-3.0](LICENSE) © 2026 Geraldo Silva

---

## English

**Abrigo** ("shelter" in Portuguese) blocks adult content in Chrome and Edge.

- Blocks ~477k adult sites, including their videos and images embedded elsewhere.
- Catches new sites by domain name and by an on-page detector.
- Blocks explicit searches on 8 search engines and forces their safe-search mode.
- Optional categories: gambling, social media, online games. YouTube: open, restricted, or blocked.
- PIN protection for settings, plus a "lock for good" mode with a PIN nobody knows.

**Install:** [Chrome Web Store](https://chromewebstore.google.com/detail/abrigo/hpacahhegipipgmpiihbohdbjoecnlli) (also works in Edge).

**Privacy:** Abrigo makes no network requests and never collects or sends your browsing history. See [PRIVACY.md](PRIVACY.md).

Licensed under [GPL-3.0](LICENSE). Domain lists by [oisd](https://oisd.nl) and [HaGeZi](https://github.com/hagezi/dns-blocklists) (GPL-3.0).

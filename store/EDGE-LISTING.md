# Abrigo: textos para a loja Edge Add-ons (Partner Center)

Por ordem dos separadores do Partner Center. Os textos são os da Chrome Web Store
(`LISTING.md`) com "Chrome" trocado por "Edge". Continua a não se poder enumerar
marcas na descrição.

---

## Availability

- **Visibility:** Hidden (só quem tem o link, como o "Não listado" da Chrome Web Store). A instalação forçada por política funciona na mesma.
- **Markets:** todos.

## Properties

- **Category:** Productivity (o Edge não tem "Well-being").
- **Privacy policy requirements:** Yes, com o URL https://github.com/devgs8/abrigo/blob/main/PRIVACY.md
- **Website URL:** https://github.com/devgs8/abrigo
- **Support contact details:** https://github.com/devgs8/abrigo/issues
- **Mature content:** No (a extensão não mostra conteúdo adulto, só contém a lista a bloquear).

## Privacy

- **Single purpose / justificação das permissões / código remoto:** usar os mesmos textos em inglês da secção 3 de `LISTING.md`.

## Store listings

Idiomas: **English** primeiro (idioma por omissão do pacote), depois Portuguese (Portugal), Portuguese (Brazil), Spanish e French, se o painel pedir cada um.

### English

**Short description:**

> Blocks adult sites and explicit searches in Edge. Free, no ads and fully private: nothing ever leaves your computer.

**Description:**

> Abrigo blocks adult content in Edge seriously, without collecting any data.
>
> WHAT IT BLOCKS
> • About 477,000 adult sites, including their videos and images embedded in other pages.
> • New sites not on any list yet, recognised by their domain name and by an on-page content detector.
> • Explicit searches on the major search engines, including words disguised with numbers or spaces. Each search engine's safe-search mode is always on.
>
> OPTIONAL CATEGORIES
> • Gambling
> • Social media
> • Online games
> • YouTube: open, forced Restricted Mode, or blocked
>
> PIN PROTECTION (OPTIONAL)
> With a PIN set, the PIN is needed to turn protection off or change settings. Great for protecting your kids, or yourself.
> For a firm commitment, "Lock for good" creates a PIN nobody knows.
>
> PRIVATE BY DESIGN
> Everything runs on your computer. Abrigo makes no network requests, has no accounts, no ads, and never collects or sends your browsing history.
>
> FREE AND OPEN SOURCE
> Built for the community, open source (GPL-3.0). Domain lists by the oisd and HaGeZi projects.
>
> Available in Portuguese, English, Spanish and French.

### Português (pt-PT e pt-BR)

**Descrição curta:**

> Bloqueia sites e pesquisas de conteúdo adulto no Edge. Gratuito, sem anúncios e 100% privado: nada sai do seu computador.

**Descrição:** a de `LISTING.md`, trocando "no Chrome" por "no Edge" na primeira linha.

### Imagens (`store/images/`)

| Campo | Ficheiro |
|---|---|
| Extension logo | `store-icon-128.png` |
| Small promotional tile (440×280) | `<idioma>/promo-440x280.<idioma>.png` |
| Screenshots (1280×800) | `<idioma>/1-popup` … `4-settings` |
| Large promotional tile (1400×560) | `<idioma>/marquee-1400x560.<idioma>.png` |

YouTube video URL: opcional, o mesmo da Chrome Web Store quando existir.

## Notes for certification

> Abrigo is a content blocker. Its source contains lists of explicit keywords and adult domains only so it can recognise and block them; none of this content is ever displayed to the user. All filtering happens locally; the extension makes no network requests. The optional PIN only protects Abrigo's own settings. The same version (1.5.2) is already published on the Chrome Web Store: https://chromewebstore.google.com/detail/abrigo/hpacahhegipipgmpiihbohdbjoecnlli

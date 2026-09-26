# Abrigo — textos para a Chrome Web Store

Tudo o que o painel de programador pede, pela ordem dos separadores. Copiar e colar.

---

## 1. Pacote

Gerar e validar antes de carregar:

```
node tools/pack.mjs
node tools/validate.mjs dist/abrigo-<versão>.zip
```

Só carregar se o validador disser **OK**.

---

## 2. Ficha da loja (Store listing)

O idioma por omissão do pacote é o **inglês** (`default_locale: en`), por isso o painel abre a ficha em inglês.
Preencher primeiro o inglês e depois, em **Adicionar idioma**, acrescentar **Português (Portugal)** e **Português (Brasil)** com os mesmos textos em português (servem os dois).

### Português — para pt-PT e pt-BR

**Nome** (vem do manifest): Abrigo

**Resumo** (máx. 132 caracteres):

> Bloqueia sites e pesquisas de conteúdo adulto no Chrome. Gratuito, sem anúncios e 100% privado: nada sai do seu computador.

**Descrição:**

> O Abrigo bloqueia conteúdo adulto no Chrome de forma séria — e sem recolher nenhum dado.
>
> O QUE BLOQUEIA
> • Cerca de 477 mil sites adultos, incluindo vídeos e imagens desses sites embutidos noutras páginas.
> • Sites novos que ainda não estão em lista nenhuma, reconhecidos pelo nome do domínio e por um detetor que analisa o conteúdo da página.
> • Pesquisas explícitas no Google, Bing, DuckDuckGo, Yahoo, Brave Search, Startpage, Ecosia e Qwant — incluindo palavras escritas com números ou espaços para enganar o filtro. O filtro seguro de cada motor de pesquisa fica sempre ligado.
>
> CATEGORIAS OPCIONAIS
> • Apostas e jogos de azar
> • Redes sociais
> • Jogos online
> • YouTube: livre, modo restrito forçado, ou bloqueado
>
> PROTEÇÃO COM PIN (OPCIONAL)
> Com um PIN definido, é preciso o PIN para desligar a proteção ou mudar as definições. Ideal para proteger os filhos — ou para se proteger a si próprio.
> Para quem quer um compromisso firme, a opção "Trancar de vez" gera um PIN que ninguém conhece.
>
> PRIVADO POR DESENHO
> Tudo funciona no seu computador. O Abrigo não faz nenhum pedido à internet, não tem contas, não tem anúncios e não recolhe nem envia o seu histórico de navegação.
>
> GRATUITO E DE CÓDIGO ABERTO
> Feito para a comunidade, com código aberto (GPL-3.0). Listas de domínios dos projetos oisd e HaGeZi.
>
> Disponível em português, inglês, espanhol e francês.

### English

**Summary:**

> Blocks adult sites and explicit searches in Chrome. Free, no ads and fully private: nothing ever leaves your computer.

**Description:**

> Abrigo blocks adult content in Chrome seriously — without collecting any data.
>
> WHAT IT BLOCKS
> • About 477,000 adult sites, including their videos and images embedded in other pages.
> • New sites not on any list yet, recognised by their domain name and by an on-page content detector.
> • Explicit searches on Google, Bing, DuckDuckGo, Yahoo, Brave Search, Startpage, Ecosia and Qwant — including words disguised with numbers or spaces. Each search engine's safe-search mode is always on.
>
> OPTIONAL CATEGORIES
> • Gambling
> • Social media
> • Online games
> • YouTube: open, forced Restricted Mode, or blocked
>
> PIN PROTECTION (OPTIONAL)
> With a PIN set, the PIN is needed to turn protection off or change settings. Great for protecting your kids — or yourself.
> For a firm commitment, "Lock for good" creates a PIN nobody knows.
>
> PRIVATE BY DESIGN
> Everything runs on your computer. Abrigo makes no network requests, has no accounts, no ads, and never collects or sends your browsing history.
>
> FREE AND OPEN SOURCE
> Built for the community, open source (GPL-3.0). Domain lists by the oisd and HaGeZi projects.
>
> Available in Portuguese, English, Spanish and French.

**Categoria:** Bem-estar (*Well-being*). Alternativa: Privacidade e segurança.

**Imagens** (`store/images/`):
- Ícone da loja: `icons/icon128.png`
- Capturas 1280×800: `pt-1-popup.png` … `pt-4-settings.png` (e as `en-*` na ficha em inglês)
- Imagem promocional pequena 440×280: `pt-promo-440x280.png` / `en-promo-440x280.png`

**Site oficial / suporte:** https://github.com/devgs8/abrigo

---

## 3. Práticas de privacidade (Privacy practices)

**Finalidade única (Single purpose):**

> O Abrigo tem uma única finalidade: impedir o acesso a conteúdo adulto e, opcionalmente, a outras categorias escolhidas pelo utilizador (apostas, redes sociais, jogos, YouTube), bloqueando sites e pesquisas no browser.
>
> *EN: Abrigo has a single purpose: preventing access to adult content and, optionally, to other categories the user chooses (gambling, social media, games, YouTube) by blocking sites and searches in the browser.*

**Justificação das permissões** (colar em inglês, a revisão é em inglês):

| Permissão | Justificação |
|---|---|
| `declarativeNetRequest` | Blocks the ~477k adult domains bundled in the extension (static rulesets) before the page loads, and blocks their embedded media on other sites. |
| `webNavigation` | Detects searches on search engines so explicit queries can be blocked (the tab is sent to the extension's block page) and each engine's safe-search parameter can be enforced. |
| `storage` | Saves the user's settings (enabled categories, YouTube mode, PIN hash) locally. |
| Host permission `<all_urls>` | The block rules and the on-page adult content detector must work on any site, since adult content can be on any domain. All analysis is local; nothing is sent anywhere. |

**Código remoto:** Não, não uso código remoto. *(No, I am not using remote code.)*

**Utilização de dados:** não marcar nenhuma categoria de dados recolhidos. Marcar as três certificações:
- Não vendo nem transfiro dados de utilizadores a terceiros…
- Não uso nem transfiro dados para fins não relacionados com a finalidade única…
- Não uso nem transfiro dados para determinar capacidade de crédito…

**Política de privacidade (URL):** https://github.com/devgs8/abrigo/blob/main/PRIVACY.md

---

## 4. Distribuição

- **Visibilidade:** começar em **Não listada** (só quem tem o link). Passar a **Pública** depois dos primeiros testes.
- **Regiões:** todas.
- **Conteúdo para adultos:** Não — a extensão não mostra conteúdo adulto; só contém a lista de domínios a bloquear.

---

## Nota para a revisão (campo opcional "notas para o revisor")

> Abrigo is a content blocker. Its source contains lists of explicit keywords and adult domains only so it can recognise and block them — none of this content is ever displayed to the user. All filtering happens locally; the extension makes no network requests. The optional PIN only protects Abrigo's own settings; the extension never interferes with chrome://extensions or with uninstalling.

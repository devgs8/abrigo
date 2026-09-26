# Política de privacidade — Abrigo

*Última atualização: 26 de setembro de 2026 · [English below](#privacy-policy--abrigo)*

O Abrigo é uma extensão gratuita que bloqueia conteúdo adulto no browser. Foi feita para funcionar inteiramente no seu computador.

## Que dados o Abrigo recolhe

**Nenhuns.** O Abrigo não recolhe, não transmite, não vende e não partilha dados pessoais nem dados de navegação.

## Como funciona sem recolher dados

Para decidir se uma página deve ser bloqueada, o Abrigo precisa de ver o endereço das páginas abertas, as pesquisas feitas nos motores de pesquisa e, no caso do detetor de conteúdo, o título e o texto da página. **Essa análise acontece localmente, no próprio browser**, e o resultado nunca sai do computador:

- A lista de sites bloqueados vem dentro da extensão. Não há consultas a servidores.
- O Abrigo não faz nenhum pedido à internet — nem para análise, nem para estatísticas, nem para atualizações de listas.
- Não há contas, registos, identificadores nem publicidade.

## O que fica guardado no seu browser

Apenas as definições da própria extensão, no armazenamento local do browser (`chrome.storage`):

- as categorias ativas e o modo do YouTube;
- o PIN, guardado apenas como *hash* (nunca o PIN em si);
- uma lista local dos últimos sites bloqueados pelo detetor (até 100 entradas), usada só para o funcionamento da extensão.

Estes dados nunca são enviados para lado nenhum e são apagados quando a extensão é removida.

## Permissões

| Permissão | Para quê |
|---|---|
| Acesso a todos os sites | Aplicar o bloqueio e o detetor de conteúdo em qualquer página. |
| `declarativeNetRequest` | Bloquear os sites da lista antes de carregarem. |
| `webNavigation` | Verificar as pesquisas, mostrar a página de bloqueio e forçar o filtro seguro dos motores de pesquisa. |
| `storage` | Guardar as definições no próprio browser. |

## Contacto

Dúvidas sobre privacidade: abra uma *issue* em https://github.com/devgs8/abrigo/issues

---

# Privacy Policy — Abrigo

*Last updated: September 26, 2026*

Abrigo is a free browser extension that blocks adult content. It is designed to work entirely on your computer.

**What data Abrigo collects: none.** Abrigo does not collect, transmit, sell or share any personal or browsing data.

To decide whether to block a page, Abrigo looks at the addresses of pages you open, the searches you make on search engines and, for the content detector, the page's title and text. **This analysis happens locally in your browser** and the result never leaves your computer. The blocklist ships inside the extension; Abrigo makes no network requests of any kind — no analytics, no telemetry, no remote list updates. There are no accounts, identifiers or ads.

**Stored in your browser only** (`chrome.storage`): the enabled categories and YouTube mode, the PIN as a hash (never the PIN itself), and a local list of up to 100 sites recently blocked by the detector. This data is never sent anywhere and is deleted when you remove the extension.

**Contact:** open an issue at https://github.com/devgs8/abrigo/issues

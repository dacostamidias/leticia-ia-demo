# Empresas na Planta S.A. — novo site

Redesign completo do site público da Empresas na Planta S.A., feito a partir da auditoria em **[AUDITORIA.md](./AUDITORIA.md)** (diagnóstico, notas, matriz P0–P3 e plano de execução).

- **14 páginas** estáticas, prontas para o servidor LiteSpeed atual.
- **Zero dependências** de runtime. O build usa apenas Node.js ≥ 18.
- Lighthouse: **99** (mobile) e **100** (desktop) em desempenho; **100** em acessibilidade, boas práticas e SEO.
- **0 violações** do axe-core (WCAG 2.2 AA) e **98/98** verificações de layout (14 rotas × 7 larguras).
- Textos estratégicos **preservados**: apartamento na planta, participação nos resultados e a comparação Tesla/Amazon.

## Rodando localmente

```bash
cd empresas-na-planta
npm run dev        # build + servidor em http://localhost:4173
```

O servidor local aplica os mesmos cabeçalhos de segurança da produção. Ele também **simula** o `/api/contato.php` para testar os estados do formulário. Para forçar um erro, escreva `#erro` na mensagem.

## Páginas

| Rota | Conteúdo |
|---|---|
| `/` | Home: proposta de valor, condições, Tesla/Amazon, simulador, empresa em destaque, FAQ |
| `/como-funciona/` | Passo a passo, linha do tempo do acionista, condições, simulador |
| `/oportunidades/` | Empresas abertas a acionistas |
| `/oportunidades/champions-sports/` | Página da empresa em destaque |
| `/nossa-historia/` | Convicção e linha do tempo de 1997 a 2025 |
| `/nossos-projetos/` | Instituto Incratec e projetos sociais |
| `/faq/` | 12 perguntas em 3 categorias, com busca e links diretos (`/faq/#token`) |
| `/contato/` | Canais e formulário (mesmo endpoint e mesmo JSON do site atual) |
| `/aviso-de-risco/`, `/politica-de-privacidade/`, `/termos-de-servico/` | Textos originais com índice lateral |
| `/404.html` | Página de erro com a marca |
| `/prototipo/area-do-acionista/` | Protótipo da área do acionista, sem dados (`noindex`) |
| `/design-system/` | Referência viva de tokens e componentes (`noindex`) |

## Estrutura

```
site.config.mjs        ← fonte única: CNPJ, endereço, telefones, URLs do portal, condições da oferta
build.mjs              ← build estático (partials, hash de assets, sitemap, robots, JSON-LD, checagem de links)
server.mjs             ← pré-visualização local com cabeçalhos de produção
src/
  pages/               ← uma página por arquivo, com bloco <!--meta {…} -->
  partials/            ← layout, header, footer, ícones, simulador, CTA, 12 respostas da FAQ
  assets/css/          ← tokens → base → components → sections → pages
  assets/js/site.js    ← menu, simulador, FAQ, formulário, abas (sem framework)
  assets/{img,fonts}/  ← imagens da marca (WebP) e fontes auto-hospedadas (Inter, Playfair Display — OFL)
  static/              ← .htaccess, favicon, manifest
scripts/qa.mjs         ← QA de layout + axe-core em 7 larguras
scripts/e2e.cjs        ← testes funcionais (22 verificações)
dist/                  ← saída do build (versionada, pronta para upload)
```

**Para mudar o preço da ação, o lote mínimo, os telefones ou o CNPJ**, edite só o `site.config.mjs` e rode `npm run build`. Home, ficha de condições, simulador, páginas de condições e da empresa se atualizam juntos.

## Qualidade

```bash
npm start                                   # em um terminal
node scripts/e2e.cjs                        # testes funcionais
AXE_PATH=/caminho/axe.min.js node scripts/qa.mjs   # layout + acessibilidade
```

Os scripts usam o Playwright (`npm i -D playwright` caso não esteja instalado). O build falha se houver link interno quebrado.

## Publicação

1. `npm run build`
2. Enviar o **conteúdo** de `dist/` para a raiz de `empresasnaplanta.com.br`, **mantendo a pasta `/api/`** existente (o formulário de contato continua usando `/api/contato.php`).
3. Conferir: envio do formulário em `/contato/`, cabeçalhos (`curl -I`) e uma URL inexistente (deve mostrar o 404 da marca).

O portal `ia.empresasnaplanta.com.br` **não foi alterado**. Os botões "Entrar" e "Quero ser acionista" apontam para o login e o cadastro atuais.

## Decisões pendentes do cliente (antes de publicar)

| # | Decisão | Onde |
|---|---|---|
| 1 | Qual regra vale para o primeiro resgate de dividendos: **6 ou 12 meses**? O site atual se contradiz; o novo segue a FAQ (direito aos lucros a partir de 6 meses, primeiro saque com 12) | AUDITORIA §6.2, P0-03 |
| 2 | Manter "Baixíssimo risco e altíssima rentabilidade." (preservado, como pedido) ou adotar a alternativa sugerida, após parecer jurídico | AUDITORIA §10.3 J2 |
| 3 | Confirmar os papéis dos dois WhatsApps: atendimento (41) 99823-0937 e especialistas (41) 99875-5323 | `site.config.mjs` |
| 4 | Fonte e data-base dos valores Tesla/Amazon | AUDITORIA §10.3 J4 |

# Empresas na Planta S.A. — novo site

Redesign completo do site público da Empresas na Planta S.A., feito a partir da auditoria em **[AUDITORIA.md](./AUDITORIA.md)** (diagnóstico, notas, matriz P0–P3 e plano de execução).

- **18 páginas** estáticas, prontas para o servidor LiteSpeed atual, incluindo **páginas de levantamento de capital** no estilo das plataformas de investimento (Kria, EqSeed).
- **Zero dependências** de runtime. O build usa apenas Node.js ≥ 18.
- Lighthouse: **99** (mobile) e **100** (desktop) em desempenho; **100** em acessibilidade, boas práticas e SEO.
- **0 violações** do axe-core (WCAG 2.2 AA) e **126/126** verificações de layout (18 rotas × 7 larguras).
- **Área do acionista:** especificação completa em **[AREA-DO-ACIONISTA.md](./AREA-DO-ACIONISTA.md)** (regras de cálculo, API, 18 requisitos de segurança com critério de aceite, LGPD, prioridades).
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
| `/oportunidades/` | Ofertas abertas: cards com meta, captado, progresso e mínimo, além de filtro por situação |
| `/oportunidades/champions-sports/` | Oferta da Champions Sports: painel de investimento, produto, receitas, termos, documentos, riscos e dúvidas |
| `/oportunidades/escolas-jesus-para-as-criancas/` | Oferta da Rede de Escolas Jesus Para As Crianças (mesmo modelo) |
| `/nossa-historia/` | Convicção e linha do tempo de 1997 a 2025 |
| `/nossos-projetos/` | Instituto Incratec e projetos sociais |
| `/faq/` | 12 perguntas em 3 categorias, com busca e links diretos (`/faq/#token`) |
| `/contato/` | Canais e formulário (mesmo endpoint e mesmo JSON do site atual) |
| `/aviso-de-risco/`, `/politica-de-privacidade/`, `/termos-de-servico/` | Textos originais com índice lateral |
| `/404.html` | Página de erro com a marca |
| `/prototipo/area-do-acionista/` | **Área do acionista** (protótipo navegável): visão geral, participações, pagamentos, resultados, documentos, relatórios, comunicados, suporte, perfil e segurança. Modos "Exemplo ilustrativo" e "Conta nova" |
| `/prototipo/entrar/` | Login com verificação em duas etapas e bloqueio após tentativas repetidas |
| `/prototipo/cadastro/` | Cadastro em 5 etapas, com confirmação de e-mail e SMS, validação de CPF e aceites separados |
| `/prototipo/recuperar-senha/` | Recuperação de senha com resposta neutra e senha forte |
| `/design-system/` | Referência viva de tokens e componentes (`noindex`) |

## Estrutura

```
site.config.mjs        ← fonte única: CNPJ, endereço, telefones, URLs do portal, condições da oferta
src/data/ofertas.json  ← fonte única das ofertas (meta, captado, investidores, status…)
src/components/ofertas.mjs ← card, carrossel e painel de oferta gerados no build
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
scripts/e2e-ofertas.cjs← testes das ofertas (15 verificações, com dados de teste injetados só no navegador)
scripts/e2e-acionista.cjs ← testes da área do acionista, login, cadastro e recuperação (43 verificações)
scripts/axe-acionista.cjs ← axe-core em todas as seções do painel e etapas do cadastro
src/assets/js/acionista.js ← painel: contrato de dados → cálculos puros → telas
src/assets/js/acesso.js   ← login (2 etapas), recuperação e cadastro em etapas
src/static/prototipo/dados/ ← contrato de dados do painel (exemplo fictício e conta nova)
dist/                  ← saída do build (versionada, pronta para upload)
```

**Para mudar o preço da ação, o lote mínimo, os telefones ou o CNPJ**, edite só o `site.config.mjs` e rode `npm run build`. Home, ficha de condições, simulador, páginas de condições e da empresa se atualizam juntos.

## Ofertas (levantamento de capital)

As ofertas ficam em **`src/data/ofertas.json`**. Cada uma gera automaticamente:
- o **card** (listagem e carrossel da home): nome, situação, tipo, setor, meta de captação, retorno, investimento mínimo, barra de progresso e botões "Investir" e "Ver oferta";
- o **painel de investimento** da página da oferta: total captado, progresso, investidores, condições, "Investir", "Falar com especialista" e "Compartilhar".

**Atualizar a captação sem novo build:** o site lê `/dados/ofertas.json` a cada visita. Basta o portal (ou alguém da equipe) atualizar `meta`, `captado` e `investidores` nesse arquivo publicado, e cards e painéis se atualizam: percentual, barra e valores.

**Regra:** campo `null` aparece como "A divulgar", e a barra fica em estado neutro (tracejada). **Nunca** preencha com estimativas. O build também recusa `captado` sem `meta`.

Para criar uma nova oferta: adicione um objeto em `ofertas.json` e crie `src/pages/oportunidades/<slug>.html` usando uma das duas páginas existentes como modelo. Os partials `{{> oferta-painel-<slug>}}` e `{{> oferta-card-<slug>}}` passam a existir automaticamente.

## Qualidade

```bash
npm start                                   # em um terminal
node scripts/e2e.cjs                        # testes funcionais
node scripts/e2e-ofertas.cjs                # testes das ofertas
node scripts/e2e-acionista.cjs              # área do acionista
node scripts/axe-acionista.cjs /caminho/axe.min.js  # acessibilidade de todas as seções
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
| 5 | **Meta de captação, valor captado, nº de investidores e prazo** de cada oferta (hoje "A divulgar") | `src/data/ofertas.json` |
| 6 | Escolas: como o plano de **R$ 50,00/mês** se relaciona com o mínimo de R$ 5.000 da plataforma, e qual é a empresa emissora e o CNPJ | AUDITORIA §22 |

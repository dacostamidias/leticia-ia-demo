/* Área do acionista — protótipo navegável.
   Arquitetura: um único contrato de dados (JSON) → funções puras de cálculo → renderização.
   Em produção, `carregar()` passa a chamar a API do portal (ver AREA-DO-ACIONISTA.md §4);
   nenhuma outra parte do código precisa mudar.

   Regras de integridade (ver AREA-DO-ACIONISTA.md §3):
   • Totais NUNCA são armazenados: são somados a partir de lançamentos confirmados.
   • "Disponível para resgate" só inclui valores creditados e liberados; nada estimado ou a receber.
   • Todo indicador exibe sua origem. */
(() => {
  'use strict';
  const root = document.querySelector('[data-acionista]');
  if (!root) return;
  // Caminhos: em producao a raiz e "/"; no link de teste (artefato) o build troca por caminhos relativos.
  const meta = (n) => document.querySelector('meta[name="' + n + '"]')?.content;
  const ROOT = meta('site-root') ?? '/';
  const IDX = meta('site-index') ?? '';
  const DEMO = meta('site-demo') === '1';
  const url = (p) => {
    const [caminho, ancora] = p.split('#');
    const base = ROOT + caminho.replace(/^\//, '') + (caminho.endsWith('/') ? IDX : '');
    // No link de teste, páginas abrem pela âncora #topo: o visualizador só respeita rolagem por âncora.
    const frag = ancora ?? (DEMO && caminho.endsWith('/') ? 'topo' : '');
    return frag ? `${base}#${frag}` : base;
  };

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const brl = (n) => (n == null ? '—' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
  const num = (n, d = 0) => (n == null ? '—' : n.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }));
  const acoes = (n) => (n == null ? '—' : `${num(n, Number.isInteger(n) ? 0 : 1)} ${n === 1 ? 'ação' : 'ações'}`);
  const data = (iso) => (iso ? new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR') : '—');
  const dias = (a, b) => Math.round((new Date(`${b}T12:00:00`) - new Date(`${a}T12:00:00`)) / 86400000);
  const addDias = (iso, n) => { const d = new Date(`${iso}T12:00:00`); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
  const icon = (id, extra = '') => `<svg class="icon ${extra}" aria-hidden="true"><use href="#i-${id}"/></svg>`;
  const toast = (msg) => { const t = $('[data-toast]'); if (!t) return; t.textContent = msg; t.dataset.show = 'true'; clearTimeout(toast.t); toast.t = setTimeout(() => { t.dataset.show = 'false'; }, 3200); };

  const BONUS = 0.02;
  const LIMITE_ATRASO = 60;
  let D = null; // dados carregados

  /* ======================================================================
     1. DADOS
     ====================================================================== */
  async function carregar(modo) {
    const res = await fetch(url(`/prototipo/dados/${modo}.json`), { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  /* ======================================================================
     2. CÁLCULOS (funções puras sobre os lançamentos)
     ====================================================================== */
  function situacaoParcela(p, ref) {
    if (p.status === 'paga') return { k: 'paga', label: 'Paga', cls: 'badge--success' };
    const atraso = dias(p.vencimento, ref);
    if (atraso > 0) {
      const limite = addDias(p.vencimento, LIMITE_ATRASO);
      return { k: 'vencida', label: `Vencida há ${atraso} ${atraso === 1 ? 'dia' : 'dias'}`, cls: 'badge--danger', atraso, limite, restam: LIMITE_ATRASO - atraso };
    }
    if (atraso === 0) return { k: 'hoje', label: 'Vence hoje', cls: 'badge--warning' };
    return { k: 'aberta', label: `Vence em ${-atraso} ${-atraso === 1 ? 'dia' : 'dias'}`, cls: '' };
  }

  function calcular(d) {
    const ref = d.referencia;
    const porEmpresa = {};
    const garantir = (slug) => (porEmpresa[slug] ||= { slug, ...d.empresas[slug], pago: 0, integralizadas: 0, aIntegralizar: 0, bonificacao: 0, compras: [] });
    const pendencias = [];

    d.compras.forEach((c) => {
      const e = garantir(c.empresa);
      e.compras.push(c);
      const pagas = c.parcelas.filter((p) => p.status === 'paga');
      const pago = pagas.reduce((s, p) => s + p.valor, 0);
      e.pago += pago;
      if (c.acoes != null && c.valor) {
        // Regra da FAQ: ações de compras parceladas passam a contar à medida que são pagas.
        const integ = Math.round((c.acoes * pago) / c.valor);
        e.integralizadas += integ;
        e.aIntegralizar += c.acoes - integ;
      }
      c.parcelas.forEach((p) => {
        const s = situacaoParcela(p, ref);
        if (s.k === 'vencida' || s.k === 'hoje') pendencias.push({ compra: c, parcela: p, sit: s, empresa: e.nome });
      });
    });
    d.bonificacoes.forEach((b) => { garantir(b.empresa).bonificacao += b.acoes; });

    const empresas = Object.values(porEmpresa);
    const totalPago = empresas.reduce((s, e) => s + e.pago, 0);
    const disponivel = d.distribuicoes.filter((x) => x.status === 'liberado').reduce((s, x) => s + x.valor, 0);
    const proximas = d.compras.flatMap((c) => c.parcelas.filter((p) => p.status !== 'paga').map((p) => ({ c, p, sit: situacaoParcela(p, ref) })))
      .sort((a, b) => a.p.vencimento.localeCompare(b.p.vencimento));
    return { ref, empresas, totalPago, disponivel, pendencias, proximas,
      integralizadas: empresas.reduce((s, e) => s + e.integralizadas, 0),
      bonificacao: empresas.reduce((s, e) => s + e.bonificacao, 0),
      naoLidos: d.comunicados.filter((c) => !c.lido).length };
  }

  /* ======================================================================
     3. COMPONENTES
     ====================================================================== */
  const vazio = (ic, titulo, texto, acao = '') => `
    <div class="empty">${icon(ic)}<p class="small"><strong>${esc(titulo)}</strong></p><p class="tiny muted">${texto}</p>${acao}</div>`;

  const kpi = (label, valor, def, origem, extra = '') => `
    <li class="kpi card">
      <p class="kpi__label">${esc(label)}</p>
      <p class="kpi__value num">${valor}</p>
      <p class="kpi__def">${def} <span class="kpi__src">${icon('info')} Origem: ${esc(origem)}</span></p>${extra}
    </li>`;

  const faseBadge = (f) => (f === 'operacao'
    ? '<span class="badge badge--success"><span class="dot"></span>Em operação</span>'
    : '<span class="badge badge--warning"><span class="dot"></span>Pré-operacional</span>');

  // Composição por empresa: barra empilhada horizontal (2px de espaço entre segmentos),
  // legenda sempre presente, rótulos em cor de texto, tabela equivalente logo abaixo.
  function composicao(c) {
    const base = c.empresas.filter((e) => e.pago > 0);
    if (!base.length) return '';
    const total = base.reduce((s, e) => s + e.pago, 0);
    const segs = base.map((e) => {
      const p = (e.pago / total) * 100;
      return `<span class="stackbar__seg" role="img" style="--w:${p.toFixed(2)}%;--c:${esc(e.cor)}" tabindex="0" data-tip="${esc(e.nome)} · ${brl(e.pago)} · ${num(p, 1)}%" aria-label="${esc(e.nome)}: ${brl(e.pago)}, ${num(p, 1)}% do total pago"></span>`;
    }).join('');
    const legenda = base.map((e) => `<li><span class="swatch-dot" style="--c:${esc(e.cor)}"></span><span>${esc(e.nome)}</span><strong class="num">${num((e.pago / total) * 100, 1)}%</strong></li>`).join('');
    return `
      <figure class="stack-chart" aria-labelledby="comp-cap">
        <figcaption id="comp-cap" class="stack-chart__cap"><span class="t-sans-title">Composição por empresa</span><span class="tiny muted">pelo valor efetivamente pago</span></figcaption>
        <div class="stackbar" role="group" aria-label="Composição do valor pago por empresa">${segs}</div>
        <ul class="stack-legend" role="list">${legenda}</ul>
        <div class="chart-tip" role="tooltip" hidden></div>
      </figure>`;
  }

  function tabelaParticipacoes(c) {
    if (!c.empresas.length) {
      return vazio('building', 'Você ainda não tem participações.', 'Quando você investir, cada empresa aparece aqui com fase, ações e valor pago.', `<a class="btn btn--primary btn--sm" href="${url('/oportunidades/')}">Ver oportunidades</a>`);
    }
    const linhas = c.empresas.map((e) => `
      <tr>
        <th scope="row"><span class="swatch-dot" style="--c:${esc(e.cor)}"></span>${esc(e.nome)}</th>
        <td data-label="Fase">${faseBadge(e.fase)}</td>
        <td class="num" data-label="Integralizadas">${e.integralizadas || e.aIntegralizar ? acoes(e.integralizadas) : '<span class="muted" title="Regra do plano mensal a definir">conforme contrato</span>'}</td>
        <td class="num" data-label="A integralizar">${e.aIntegralizar ? acoes(e.aIntegralizar) : '—'}</td>
        <td class="num" data-label="Bonificação">${e.bonificacao ? acoes(e.bonificacao) : '—'}</td>
        <td class="num" data-label="Valor pago">${brl(e.pago)}</td>
        <td class="cell-action"><button class="btn btn--outline btn--sm" type="button" data-detalhe="${esc(e.slug)}">Detalhes</button></td>
      </tr>`).join('');
    return `
      <div class="table-wrap">
        <table class="table table--stack">
          <caption class="sr-only">Participações por empresa</caption>
          <thead><tr><th scope="col">Empresa</th><th scope="col">Fase</th><th scope="col" class="num">Integralizadas</th><th scope="col" class="num">A integralizar</th><th scope="col" class="num">Bonificação</th><th scope="col" class="num">Valor pago</th><th scope="col"><span class="sr-only">Ações</span></th></tr></thead>
          <tbody>${linhas}</tbody>
          <tfoot><tr><th scope="row">Total</th><td></td><td class="num" data-label="Integralizadas">${acoes(c.integralizadas)}</td><td></td><td class="num" data-label="Bonificação">${c.bonificacao ? acoes(c.bonificacao) : '—'}</td><td class="num" data-label="Valor pago">${brl(c.totalPago)}</td><td></td></tr></tfoot>
        </table>
      </div>`;
  }

  function alertaPendencias(c) {
    return c.pendencias.map(({ compra, parcela, sit, empresa }) => (sit.k === 'vencida' ? `
      <div class="notice notice--danger" role="alert">
        ${icon('alert')}
        <div><p><strong>Parcela ${parcela.n} da compra ${esc(compra.id)} (${esc(empresa)}) vencida há ${sit.atraso} dias.</strong> Se não for paga até <strong>${data(sit.limite)}</strong> (faltam ${sit.restam} dias), a compra é cancelada automaticamente, conforme a regra de 60 dias.</p>
        <p class="cluster" style="margin-top:var(--s-3)"><button class="btn btn--secondary btn--sm" type="button" data-pagar="${esc(compra.id)}-${parcela.n}">Pagar ${brl(parcela.valor)}</button><a class="link-arrow small" href="#pagamentos" data-ir="pagamentos">Ver pagamentos ${icon('arrow')}</a></p></div>
      </div>` : `
      <div class="notice notice--warning" role="status">${icon('clock')}<p><strong>Parcela ${parcela.n} da compra ${esc(compra.id)} vence hoje</strong> (${brl(parcela.valor)}).</p></div>`)).join('');
  }

  /* ======================================================================
     4. TELAS
     ====================================================================== */
  const telas = {
    'visao-geral': (d, c) => `
      <header class="app__head">
        <div><h2 class="t-2xl">Olá, ${esc(d.acionista.nome.split(' ')[0])}</h2><p class="small muted">Situação em ${data(c.ref)}. Valores calculados a partir dos lançamentos confirmados.</p></div>
        <a class="btn btn--primary btn--sm" href="${url('/oportunidades/')}">${icon('plus')}Investir em uma empresa</a>
      </header>
      ${!d.acionista.identidadeVerificada ? `<div class="notice" role="note">${icon('shield')}<div><p><strong>Próximo passo: confirme sua identidade e gere seu token de segurança.</strong> Ele é a sua assinatura digital nos contratos.</p><p style="margin-top:var(--s-3)"><button class="btn btn--secondary btn--sm" type="button" data-ir="seguranca">Confirmar identidade</button></p></div></div>` : ''}
      ${alertaPendencias(c)}
      <ul class="kpi-grid" role="list">
        ${kpi('Valor pago', brl(c.totalPago), 'Soma das parcelas e compras com pagamento confirmado.', 'pagamentos compensados')}
        ${kpi('Ações integralizadas', c.integralizadas ? acoes(c.integralizadas) : '—', 'Ações já pagas. Em compras parceladas, contam à medida que cada parcela é paga.', 'contratos + pagamentos')}
        ${kpi('Bonificação em ações', c.bonificacao ? acoes(c.bonificacao) : '—', `${Math.round(BONUS * 100)}% ao mês sobre o valor integralizado, só na fase pré-operacional (até 6 meses).`, 'lançamentos de bonificação')}
        ${kpi('Disponível para resgate', brl(c.disponivel), 'Somente dividendos creditados e liberados. Primeiro saque com 12 meses.', 'distribuições liberadas')}
      </ul>
      <div class="notice" role="note">${icon('info')}<p><strong>Integridade:</strong> este painel nunca soma valores estimados, projetados ou a receber ao que é seu de fato. Não existe aqui “patrimônio estimado”.</p></div>
      <div class="app__cols">
        <section class="card stack" aria-labelledby="h-comp">
          <h3 id="h-comp" class="sr-only">Composição</h3>
          ${composicao(c) || vazio('chart', 'Sem participações ainda.', 'A composição por empresa aparece depois do primeiro pagamento confirmado.')}
        </section>
        <section class="card stack" aria-labelledby="h-prox">
          <h3 id="h-prox" class="card__title">Próximos vencimentos</h3>
          ${c.proximas.length ? `<ul class="timeline-list" role="list">${c.proximas.slice(0, 4).map(({ c: compra, p, sit }) => `
            <li><span class="timeline-list__date num">${data(p.vencimento)}</span><span>${esc(D.empresas[compra.empresa]?.nome || '')} · parcela ${p.n} · <strong class="num">${brl(p.valor)}</strong></span><span class="badge ${sit.cls}">${esc(sit.label)}</span></li>`).join('')}</ul>`
            : vazio('calendar', 'Nada a pagar.', 'Vencimentos de parcelas aparecem aqui com antecedência.')}
        </section>
      </div>
      <section aria-labelledby="h-part-resumo" class="stack">
        <div class="list-head"><h3 id="h-part-resumo" class="card__title">Suas participações</h3><button class="link-arrow small" type="button" data-ir="participacoes" style="background:none;border:0;padding:0">Ver detalhes ${icon('arrow')}</button></div>
        ${tabelaParticipacoes(c)}
      </section>`,

    participacoes: (d, c) => `
      <header class="app__head"><div><h2 class="t-2xl">Participações</h2><p class="small muted">Por empresa: fase, ações, contratos e situação de cada compra.</p></div><a class="btn btn--primary btn--sm" href="${url('/oportunidades/')}">${icon('plus')}Investir</a></header>
      ${tabelaParticipacoes(c)}
      <dl class="legend-defs">
        <div><dt>Integralizadas</dt><dd>ações com pagamento confirmado.</dd></div>
        <div><dt>A integralizar</dt><dd>ações de compras parceladas ainda não pagas.</dd></div>
        <div><dt>Pré-operacional</dt><dd>a empresa ainda não opera; vale a bonificação mensal em ações (até 6 meses).</dd></div>
      </dl>`,

    pagamentos: (d, c) => {
      const compras = d.compras.map((cp) => `
        <article class="purchase card">
          <header class="purchase__head">
            <div><p class="t-sans-title">${esc(D.empresas[cp.empresa]?.nome || '')}</p><p class="tiny muted">Compra ${esc(cp.id)} · ${data(cp.data)} · ${esc(cp.forma)}${cp.acoes ? ` · ${acoes(cp.acoes)}` : ''}</p></div>
            <span class="num"><strong>${cp.valor ? brl(cp.valor) : `${brl(cp.parcelas[0].valor)}/mês`}</strong></span>
          </header>
          <div class="table-wrap table-wrap--flat"><table class="table table--stack">
            <caption class="sr-only">Parcelas da compra ${esc(cp.id)}</caption>
            <thead><tr><th scope="col">Parcela</th><th scope="col">Vencimento</th><th scope="col" class="num">Valor</th><th scope="col">Situação</th><th scope="col">Pago em</th></tr></thead>
            <tbody>${cp.parcelas.map((p) => { const s = situacaoParcela(p, c.ref); return `<tr><th scope="row">Parcela ${p.n}${cp.tipo === 'parcelada' ? `/${cp.parcelas.length}` : ''}</th><td class="num" data-label="Vencimento">${data(p.vencimento)}</td><td class="num" data-label="Valor">${brl(p.valor)}</td><td data-label="Situação"><span class="badge ${s.cls}">${esc(s.label)}</span></td><td class="num" data-label="Pago em">${data(p.pagaEm)}</td></tr>`; }).join('')}</tbody>
          </table></div>
        </article>`).join('');
      return `
        <header class="app__head"><div><h2 class="t-2xl">Pagamentos</h2><p class="small muted">Cada compra, cada parcela e a situação de compensação.</p></div></header>
        ${alertaPendencias(c)}
        ${compras || vazio('cash', 'Nenhum pagamento registrado.', 'Depois de gerar e assinar um contrato, as parcelas aparecem aqui.')}
        <p class="tiny muted">Regra: atraso superior a ${LIMITE_ATRASO} dias cancela automaticamente a compra parcelada. O sistema avisa por e-mail e notificação a partir do 1º dia de atraso.</p>`;
    },

    resultados: (d, c) => `
      <header class="app__head">
        <div><h2 class="t-2xl">Resultados</h2><p class="small muted">Bonificações em ações e distribuições de lucro (dividendos).</p></div>
        <div class="cluster" style="--cluster:var(--s-2)"><button class="btn btn--outline btn--sm" type="button" ${c.disponivel ? '' : 'disabled'}>Reinvestir</button><button class="btn btn--secondary btn--sm" type="button" ${c.disponivel ? '' : 'disabled'}>Solicitar resgate</button></div>
      </header>
      <div class="notice" role="note">${icon('info')}<p>Os botões de resgate e reinvestimento ficam ativos apenas quando houver saldo <strong>creditado e liberado</strong>. Saldo disponível agora: <strong class="num">${brl(c.disponivel)}</strong>.</p></div>
      <section class="stack" aria-labelledby="h-dist">
        <h3 id="h-dist" class="card__title">Distribuições de lucro</h3>
        ${d.distribuicoes.length ? '' : vazio('trend', 'Nenhuma distribuição ainda.', 'As empresas das suas participações estão em fase pré-operacional. Depois que entram em operação, o primeiro saque ocorre com 12 meses e, a partir daí, os dividendos são trimestrais.')}
      </section>
      <section class="stack" aria-labelledby="h-bon">
        <h3 id="h-bon" class="card__title">Bonificações em ações</h3>
        ${d.bonificacoes.length ? `<div class="table-wrap"><table class="table table--stack">
          <caption class="sr-only">Bonificações recebidas</caption>
          <thead><tr><th scope="col">Data</th><th scope="col">Empresa</th><th scope="col" class="num">Base (valor integralizado)</th><th scope="col" class="num">${Math.round(BONUS * 100)}% da base</th><th scope="col" class="num">Ações creditadas</th></tr></thead>
          <tbody>${d.bonificacoes.map((b) => `<tr><th scope="row">${data(b.data)}</th><td data-label="Empresa">${esc(D.empresas[b.empresa]?.nome || '')}</td><td class="num" data-label="Base">${brl(b.base)}</td><td class="num" data-label="${Math.round(BONUS * 100)}% da base">${brl(b.base * BONUS)}</td><td class="num" data-label="Ações">${acoes(b.acoes)}</td></tr>`).join('')}</tbody>
          <tfoot><tr><th scope="row" colspan="4">Total</th><td class="num" data-label="Ações">${acoes(c.bonificacao)}</td></tr></tfoot>
        </table></div><p class="tiny muted">Cálculo: ${Math.round(BONUS * 100)}% da base ÷ preço da ação (R$ 50,00). Cada linha mostra a base usada, para conferência.</p>`
          : vazio('award', 'Nenhuma bonificação ainda.', 'Na fase pré-operacional, a bonificação é creditada mensalmente sobre o valor integralizado.')}
      </section>`,

    documentos: (d) => {
      const tipos = { contrato: ['pen', 'Contrato'], certificado: ['award', 'Certificado'], informe: ['file', 'Informe'], comprovante: ['cash', 'Comprovante'] };
      const itens = d.documentos.map((doc) => `
        <li data-doc-tipo="${esc(doc.tipo)}">
          ${icon(tipos[doc.tipo]?.[0] || 'file')}
          <div><span class="doclist__title">${esc(doc.titulo)}</span>
          <p class="small muted">${doc.status === 'disponivel' ? `Emitido em ${data(doc.data)}${doc.assinatura ? ` · ${esc(doc.assinatura)}` : ''}` : esc(doc.motivo)}</p></div>
          ${doc.status === 'disponivel' ? `<button class="btn btn--outline btn--sm" type="button" data-baixar="${esc(doc.id)}">${icon('download')}Baixar</button>` : '<span class="badge">Pendente</span>'}
        </li>`).join('');
      return `
        <header class="app__head"><div><h2 class="t-2xl">Documentos</h2><p class="small muted">Contratos assinados, certificados e informes, sempre disponíveis.</p></div></header>
        ${d.documentos.length ? `
          <div class="filter" role="group" aria-label="Filtrar documentos" data-doc-filter>
            <button type="button" data-f="todos" aria-pressed="true">Todos</button>
            <button type="button" data-f="contrato" aria-pressed="false">Contratos</button>
            <button type="button" data-f="certificado" aria-pressed="false">Certificados</button>
            <button type="button" data-f="informe" aria-pressed="false">Informes</button>
          </div>
          <ul class="doclist" role="list">${itens}</ul>
          <p class="tiny muted">Cada contrato mostra data, hora e o resumo criptográfico (hash) da assinatura feita com o seu token, para conferência de integridade.</p>`
          : vazio('file', 'Nenhum documento ainda.', 'Seus contratos, certificados e informes de rendimentos aparecerão aqui.')}`;
    },

    relatorios: (d) => `
      <header class="app__head"><div><h2 class="t-2xl">Relatórios e atualizações</h2><p class="small muted">Relatório contábil (atualizado diariamente) e comunicados de cada empresa.</p></div></header>
      <section class="stack" aria-labelledby="h-rel">
        <h3 id="h-rel" class="card__title">Relatórios contábeis</h3>
        ${d.relatorios.length ? `<ul class="doclist" role="list">${d.relatorios.map((r) => `<li>${icon('chart')}<div><span class="doclist__title">${esc(D.empresas[r.empresa]?.nome || '')} · ${esc(r.titulo)} · ${esc(r.periodo)}</span><p class="small muted">Publicado em ${data(r.publicadoEm)} · acesso de auditoria ao Painel Contábil</p></div><button class="btn btn--outline btn--sm" type="button" data-painel>Abrir</button></li>`).join('')}</ul>`
          : vazio('chart', 'Nenhum relatório disponível.', 'Disponível para as empresas em que você é acionista.')}
      </section>
      <section class="stack" aria-labelledby="h-upd">
        <h3 id="h-upd" class="card__title">Atualizações dos projetos</h3>
        ${d.atualizacoes.length ? `<ol class="feed" role="list">${d.atualizacoes.map((u) => `<li><p class="tiny muted"><span class="num">${data(u.data)}</span> · ${esc(D.empresas[u.empresa]?.nome || '')}</p><p class="t-sans-title">${esc(u.titulo)}</p><p class="small muted">${esc(u.texto)}</p></li>`).join('')}</ol>`
          : vazio('bell', 'Nenhuma atualização publicada.', 'Comunicados oficiais das empresas: andamento, cronograma, resultados e assembleias.')}
      </section>`,

    comunicados: (d) => `
      <header class="app__head"><div><h2 class="t-2xl">Comunicados</h2><p class="small muted">Avisos importantes sobre sua conta e suas participações.</p></div>
      ${d.comunicados.some((x) => !x.lido) ? '<button class="btn btn--outline btn--sm" type="button" data-ler-todos>Marcar todos como lidos</button>' : ''}</header>
      <ul class="inbox" role="list">${d.comunicados.map((m) => `
        <li class="inbox__item${m.lido ? '' : ' is-unread'}${m.prioridade === 'alta' ? ' is-high' : ''}">
          <span class="inbox__dot" aria-hidden="true"></span>
          <div><p class="tiny muted"><span class="num">${data(m.data)}</span>${m.prioridade === 'alta' ? ' · <strong style="color:var(--danger)">Prioridade alta</strong>' : ''}${m.lido ? '' : ' · <span class="sr-only">Não lido</span><strong>Novo</strong>'}</p>
          <p class="t-sans-title">${esc(m.titulo)}</p><p class="small muted">${esc(m.texto)}</p></div>
        </li>`).join('')}</ul>`,

    suporte: (d) => `
      <header class="app__head"><div><h2 class="t-2xl">Suporte</h2><p class="small muted">Fale com quem cuida das suas participações.</p></div></header>
      <div class="app__cols">
        <a class="channel card card--interactive" href="https://wa.me/5541998230937" rel="noopener" target="_blank">${'<span class="icon-badge">' + icon('whatsapp') + '</span>'}<span><span class="channel__label">WhatsApp</span><span class="channel__value">(41) 99823-0937</span><span class="small muted">Atendimento ao acionista</span></span></a>
        <a class="channel card card--interactive" href="mailto:contato@empresasnaplanta.com.br">${'<span class="icon-badge">' + icon('mail') + '</span>'}<span><span class="channel__label">E-mail</span><span class="channel__value" style="font-size:var(--fs-base)">contato@empresasnaplanta.com.br</span></span></a>
      </div>
      <section class="stack" aria-labelledby="h-cham">
        <h3 id="h-cham" class="card__title">Seus chamados</h3>
        ${d.chamados.length ? `<div class="table-wrap"><table class="table table--stack"><caption class="sr-only">Chamados</caption><thead><tr><th scope="col">Número</th><th scope="col">Assunto</th><th scope="col">Situação</th><th scope="col">Atualizado em</th></tr></thead><tbody>${d.chamados.map((t) => `<tr><th scope="row">${esc(t.id)}</th><td data-label="Assunto">${esc(t.assunto)}</td><td data-label="Situação"><span class="badge ${t.status === 'Aberto' ? 'badge--blue' : 'badge--success'}">${esc(t.status)}</span></td><td class="num" data-label="Atualizado">${data(t.atualizadoEm)}</td></tr>`).join('')}</tbody></table></div>` : vazio('support', 'Nenhum chamado aberto.', 'Use o formulário abaixo para abrir o primeiro.')}
      </section>
      <form class="card stack" data-chamado novalidate aria-labelledby="h-novo">
        <h3 id="h-novo" class="card__title">Abrir chamado</h3>
        <div class="field"><label for="ch-assunto">Assunto</label><select class="select" id="ch-assunto" required><option value="">Escolha um assunto</option><option>Pagamentos e parcelas</option><option>Bonificação e dividendos</option><option>Documentos e certificados</option><option>Token e segurança da conta</option><option>Outro</option></select><p class="error" id="ch-assunto-err">${icon('alert')}<span>Escolha um assunto.</span></p></div>
        <div class="field"><label for="ch-msg">Mensagem</label><textarea class="textarea" id="ch-msg" rows="4" required minlength="10"></textarea><p class="error" id="ch-msg-err">${icon('alert')}<span>Descreva sua dúvida em pelo menos 10 caracteres.</span></p></div>
        <button class="btn btn--secondary" type="submit">Enviar chamado</button>
      </form>`,

    seguranca: (d) => `
      <header class="app__head"><div><h2 class="t-2xl">Perfil e segurança</h2><p class="small muted">Seus dados, verificação em duas etapas, sessões e privacidade.</p></div></header>
      <div class="app__cols">
        <section class="card stack" aria-labelledby="h-2fa">
          <h3 id="h-2fa" class="card__title">Verificação em duas etapas</h3>
          <p class="small muted">Exige um código do aplicativo autenticador além da senha. Obrigatória para resgates, alteração de dados bancários e troca de e-mail.</p>
          <p data-2fa-status>${d.acionista.doisFatores ? '<span class="badge badge--success"><span class="dot"></span>Ativada</span>' : '<span class="badge badge--warning"><span class="dot"></span>Desativada</span>'}</p>
          ${d.acionista.doisFatores ? '' : '<button class="btn btn--secondary btn--sm" type="button" data-2fa-ativar>Ativar agora</button>'}
          <div class="twofa" data-2fa-fluxo hidden>
            <ol class="small" style="padding-left:1.2rem;display:grid;gap:var(--s-2)">
              <li>Abra seu aplicativo autenticador (Google Authenticator, Microsoft Authenticator ou similar).</li>
              <li>Leia o QR code que aparecerá aqui na plataforma real, ou digite a chave manual.</li>
              <li>Digite o código de 6 dígitos gerado.</li>
            </ol>
            <div class="field"><label for="otp-2fa">Código de 6 dígitos</label><input class="input otp" id="otp-2fa" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}" aria-describedby="otp-2fa-hint"><p class="hint" id="otp-2fa-hint">No protótipo, use 123456.</p><p class="error">${icon('alert')}<span>Código inválido. Confira o horário do seu celular e tente de novo.</span></p></div>
            <button class="btn btn--primary btn--sm" type="button" data-2fa-confirmar>Confirmar e ativar</button>
          </div>
        </section>
        <section class="card stack" aria-labelledby="h-dados">
          <h3 id="h-dados" class="card__title">Dados pessoais</h3>
          <dl class="facts">
            <div><dt>Nome</dt><dd>${esc(d.acionista.nome)}</dd></div>
            <div><dt>CPF</dt><dd>${esc(d.acionista.cpf)}</dd></div>
            <div><dt>E-mail</dt><dd>${esc(d.acionista.email)}</dd></div>
            <div><dt>Celular</dt><dd>${esc(d.acionista.celular)}</dd></div>
            <div><dt>Identidade</dt><dd>${d.acionista.identidadeVerificada ? '<span class="badge badge--success">Verificada</span>' : '<span class="badge badge--warning">Pendente</span>'}</dd></div>
            <div><dt>Token de assinatura</dt><dd>${d.acionista.token === 'ativo' ? '<span class="badge badge--success">Ativo</span>' : '<span class="badge badge--warning">Não gerado</span>'}</dd></div>
          </dl>
          <p class="tiny muted">Dados sensíveis aparecem mascarados. Alterar e-mail ou celular exige confirmação no contato antigo e no novo.</p>
        </section>
        <section class="card stack" aria-labelledby="h-sess">
          <h3 id="h-sess" class="card__title">Sessões ativas</h3>
          <ul class="session-list" role="list">${d.sessoes.map((s, i) => `<li><div><p class="small"><strong>${esc(s.dispositivo)}</strong>${s.atual ? ' <span class="badge badge--blue">Esta sessão</span>' : ''}</p><p class="tiny muted">${esc(s.local)} · desde ${esc(s.inicio)}</p></div>${s.atual ? '' : `<button class="btn btn--outline btn--sm" type="button" data-encerrar="${i}">Encerrar</button>`}</li>`).join('')}</ul>
        </section>
        <section class="card stack" aria-labelledby="h-acess">
          <h3 id="h-acess" class="card__title">Atividade recente</h3>
          <ul class="session-list" role="list">${d.acessos.map((a) => `<li${a.alerta ? ' class="is-alert"' : ''}><div><p class="small">${a.alerta ? icon('alert', 'alert-ic') : ''}<strong>${esc(a.evento)}</strong></p><p class="tiny muted">${esc(a.data)} · ${esc(a.dispositivo)}</p></div></li>`).join('')}</ul>
          <p class="tiny muted">Não reconhece alguma atividade? Troque sua senha e fale com o suporte.</p>
        </section>
        <section class="card stack" aria-labelledby="h-lgpd">
          <h3 id="h-lgpd" class="card__title">Privacidade (LGPD)</h3>
          <div class="consent"><div><p class="small"><strong>Comunicações de marketing</strong></p><p class="tiny muted">Ofertas e novidades das empresas. Você pode mudar quando quiser.</p></div>
            <label class="switch"><input type="checkbox" data-marketing ${d.acionista.consentimentos.marketing ? 'checked' : ''}><span class="switch__ui" aria-hidden="true"></span><span class="sr-only">Receber comunicações de marketing</span></label></div>
          <p class="tiny muted">Termos aceitos em ${data(d.acionista.consentimentos.termos)} · Política de Privacidade aceita em ${data(d.acionista.consentimentos.privacidade)}.</p>
          <div class="cluster"><button class="btn btn--outline btn--sm" type="button" data-exportar>${icon('download')}Baixar meus dados</button><a class="btn btn--outline btn--sm" href="mailto:contato@empresasnaplanta.com.br?subject=Solicita%C3%A7%C3%A3o%20LGPD">Falar com o encarregado de dados</a></div>
        </section>
        <section class="card stack" aria-labelledby="h-senha">
          <h3 id="h-senha" class="card__title">Senha</h3>
          <p class="small muted">Use pelo menos 10 caracteres. Senhas vazadas em incidentes públicos são recusadas.</p>
          <a class="btn btn--outline btn--sm" href="${url('/prototipo/recuperar-senha/')}">Alterar senha</a>
        </section>
      </div>`,
  };

  /* ======================================================================
     5. RENDERIZAÇÃO, NAVEGAÇÃO E EVENTOS
     ====================================================================== */
  const tabs = $$('[role="tab"]', root);
  const panel = $('[data-painel-conteudo]', root);
  const badgeComunicados = $('[data-badge-comunicados]', root);
  let atual = 'visao-geral';
  let C = null;

  function render(id, focar = false) {
    if (!telas[id]) id = 'visao-geral';
    atual = id;
    tabs.forEach((t) => { const on = t.dataset.tela === id; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; if (on) panel.setAttribute('aria-labelledby', t.id); });
    panel.innerHTML = telas[id](D, C);
    if (badgeComunicados) { badgeComunicados.textContent = C.naoLidos; badgeComunicados.hidden = !C.naoLidos; }
    if (focar) panel.focus({ preventScroll: false });
    ligar();
  }

  function ir(id, focar = true) {
    if (location.hash !== `#${id}`) history.pushState(null, '', `#${id}`);
    render(id, focar);
  }

  tabs.forEach((t, i) => {
    t.addEventListener('click', () => ir(t.dataset.tela));
    t.addEventListener('keydown', (e) => {
      const map = { ArrowDown: i + 1, ArrowRight: i + 1, ArrowUp: i - 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 };
      if (!(e.key in map)) return;
      e.preventDefault();
      const n = tabs[(map[e.key] + tabs.length) % tabs.length];
      n.focus(); ir(n.dataset.tela, false);
    });
  });
  window.addEventListener('popstate', () => render(location.hash.slice(1) || 'visao-geral'));

  // Tabelas que rolam na horizontal (celular) viram regiões focáveis e rotuladas (WCAG 2.1.1).
  function regioesRolaveis() {
    $$('.table-wrap', panel).forEach((w) => {
      const rola = w.scrollWidth > w.clientWidth + 1;
      if (rola) {
        w.tabIndex = 0;
        w.setAttribute('role', 'region');
        w.setAttribute('aria-label', `${$('caption', w)?.textContent || 'Tabela'} (role para ver todas as colunas)`);
      } else {
        w.removeAttribute('tabindex'); w.removeAttribute('role'); w.removeAttribute('aria-label');
      }
    });
  }
  window.addEventListener('resize', () => { if (C) regioesRolaveis(); });

  function ligar() {
    regioesRolaveis();
    $$('[data-ir]', panel).forEach((b) => b.addEventListener('click', (e) => { e.preventDefault(); ir(b.dataset.ir); }));
    $$('[data-detalhe]', panel).forEach((b) => b.addEventListener('click', () => abrirDetalhe(b.dataset.detalhe, b)));
    $$('[data-pagar]', panel).forEach((b) => b.addEventListener('click', () => toast('No portal real, aqui abre o PIX ou o boleto da parcela.')));
    $$('[data-baixar]', panel).forEach((b) => b.addEventListener('click', () => toast('No portal real, o PDF assinado é baixado aqui.')));
    $$('[data-painel]', panel).forEach((b) => b.addEventListener('click', () => toast('No portal real, abre o Painel Contábil em modo auditoria (somente leitura).')));
    $$('[data-encerrar]', panel).forEach((b) => b.addEventListener('click', () => { b.closest('li').remove(); toast('Sessão encerrada.'); }));
    const lerTodos = $('[data-ler-todos]', panel);
    if (lerTodos) lerTodos.addEventListener('click', () => { D.comunicados.forEach((m) => { m.lido = true; }); C.naoLidos = 0; render('comunicados'); toast('Comunicados marcados como lidos.'); });

    // Filtro de documentos
    const fd = $('[data-doc-filter]', panel);
    if (fd) $$('button', fd).forEach((b) => b.addEventListener('click', () => {
      $$('button', fd).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      $$('[data-doc-tipo]', panel).forEach((li) => { li.hidden = b.dataset.f !== 'todos' && li.dataset.docTipo !== b.dataset.f; });
    }));

    // Tooltip da composição
    const fig = $('.stack-chart', panel);
    if (fig) {
      const tip = $('.chart-tip', fig);
      const show = (seg) => { tip.textContent = seg.dataset.tip; tip.hidden = false; const r = seg.getBoundingClientRect(); const f = fig.getBoundingClientRect(); tip.style.left = `${Math.max(0, Math.min(r.left - f.left + r.width / 2, f.width))}px`; };
      $$('.stackbar__seg', fig).forEach((s) => { s.addEventListener('mouseenter', () => show(s)); s.addEventListener('focus', () => show(s)); s.addEventListener('mouseleave', () => { tip.hidden = true; }); s.addEventListener('blur', () => { tip.hidden = true; }); });
    }

    // 2FA
    const ativar = $('[data-2fa-ativar]', panel);
    if (ativar) ativar.addEventListener('click', () => { $('[data-2fa-fluxo]', panel).hidden = false; ativar.hidden = true; $('#otp-2fa', panel).focus(); });
    const conf = $('[data-2fa-confirmar]', panel);
    if (conf) conf.addEventListener('click', () => {
      const inp = $('#otp-2fa', panel); const field = inp.closest('.field');
      if (inp.value !== '123456') { field.dataset.invalid = 'true'; inp.setAttribute('aria-invalid', 'true'); inp.focus(); return; }
      D.acionista.doisFatores = true; D.comunicados = D.comunicados.filter((m) => !/duas etapas/i.test(m.titulo)); C = calcular(D);
      render('seguranca'); toast('Verificação em duas etapas ativada.');
    });

    // Consentimento de marketing
    const mk = $('[data-marketing]', panel);
    if (mk) mk.addEventListener('change', () => { D.acionista.consentimentos.marketing = mk.checked; toast(mk.checked ? 'Você vai receber comunicações de marketing.' : 'Consentimento de marketing revogado.'); });

    // Exportação LGPD (portabilidade): baixa os dados exibidos em JSON
    const ex = $('[data-exportar]', panel);
    if (ex) ex.addEventListener('click', () => {
      if (DEMO) { toast('Neste link de teste o navegador bloqueia downloads. No portal, o arquivo é baixado.'); return; }
      const blob = new Blob([JSON.stringify(D, null, 2)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'meus-dados-empresas-na-planta.json';
      document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      toast('Arquivo com seus dados gerado.');
    });

    // Chamado
    const ch = $('[data-chamado]', panel);
    if (ch) ch.addEventListener('submit', (e) => {
      e.preventDefault();
      const assunto = $('#ch-assunto', ch); const msg = $('#ch-msg', ch);
      const okA = !!assunto.value; const okM = msg.value.trim().length >= 10;
      assunto.closest('.field').dataset.invalid = String(!okA); msg.closest('.field').dataset.invalid = String(!okM);
      assunto.setAttribute('aria-invalid', String(!okA)); msg.setAttribute('aria-invalid', String(!okM));
      if (!okA) return assunto.focus();
      if (!okM) return msg.focus();
      D.chamados.unshift({ id: `#${1043 + D.chamados.length}`, assunto: assunto.value, status: 'Aberto', atualizadoEm: D.referencia });
      render('suporte'); toast('Chamado aberto. Você recebe a resposta por e-mail e aqui.');
    });
  }

  // Detalhe da participação em <dialog> nativo (foco preso e ESC pelo navegador)
  const dlg = $('[data-dialog-detalhe]');
  function abrirDetalhe(slug, origem) {
    const e = C.empresas.find((x) => x.slug === slug);
    if (!e || !dlg) return;
    const pendente = '<span class="badge badge--warning">Pendente de definição jurídica</span>';
    $('[data-dialog-titulo]', dlg).textContent = e.nome;
    $('[data-dialog-corpo]', dlg).innerHTML = `
      <p>${faseBadge(e.fase)}</p>
      <dl class="facts">
        <div><dt>Valor pago</dt><dd>${brl(e.pago)}</dd></div>
        <div><dt>Ações integralizadas</dt><dd>${e.integralizadas || e.aIntegralizar ? acoes(e.integralizadas) : 'conforme contrato'}</dd></div>
        <div><dt>Ações a integralizar</dt><dd>${e.aIntegralizar ? acoes(e.aIntegralizar) : '—'}</dd></div>
        <div><dt>Bonificação recebida</dt><dd>${e.bonificacao ? acoes(e.bonificacao) : '—'}</dd></div>
        <div><dt>Compras</dt><dd>${e.compras.map((c) => esc(c.id)).join(', ')}</dd></div>
      </dl>
      <h3 class="t-sans-title">Natureza da participação</h3>
      <dl class="facts">
        <div><dt>Empresa emissora</dt><dd>${e.emissora ? esc(e.emissora) : pendente}</dd></div>
        <div><dt>Natureza jurídica</dt><dd>${e.natureza ? esc(e.natureza) : pendente}</dd></div>
        <div><dt>Saída ou transferência</dt><dd>${e.saida ? esc(e.saida) : pendente}</dd></div>
      </dl>
      ${e.precoAcao == null ? '<p class="tiny muted">A regra de conversão do plano mensal em ações ainda será definida pela empresa (AUDITORIA §22, C1).</p>' : ''}
      <p class="cluster"><a class="link-arrow small" href="${url(`/oportunidades/${esc(slug)}/#oferta`)}">Página da oferta ${icon('arrow')}</a><button class="link-arrow small" type="button" style="background:none;border:0;padding:0" data-ir-dlg="documentos">Documentos ${icon('arrow')}</button></p>`;
    $('[data-ir-dlg]', dlg).addEventListener('click', () => { dlg.close(); ir('documentos'); });
    dlg.showModal();
    dlg.addEventListener('close', () => origem.focus(), { once: true });
  }
  if (dlg) $('[data-dialog-fechar]', dlg).addEventListener('click', () => dlg.close());

  // Troca de modo: exemplo ilustrativo × conta nova
  const modoBtns = $$('[data-modo]');
  async function iniciar(modo) {
    try {
      panel.setAttribute('aria-busy', 'true');
      D = await carregar(modo);
      C = calcular(D);
      $('[data-nome]').textContent = D.acionista.nome;
      $('[data-exemplo-aviso]').hidden = D.modo !== 'exemplo';
      modoBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.modo === modo)));
      try { localStorage.setItem('enp-proto-modo', modo); } catch { /* armazenamento indisponível */ }
      render(location.hash.slice(1) || 'visao-geral');
    } catch (err) {
      panel.innerHTML = `<div class="notice notice--danger" role="alert">${icon('alert')}<p><strong>Não foi possível carregar seus dados.</strong> Verifique sua conexão e tente novamente. Se persistir, fale com o suporte. <span class="tiny">(${esc(err.message)})</span></p></div>`;
    } finally {
      panel.removeAttribute('aria-busy');
    }
  }
  modoBtns.forEach((b) => b.addEventListener('click', () => iniciar(b.dataset.modo)));
  let inicial = 'exemplo';
  try { inicial = localStorage.getItem('enp-proto-modo') || 'exemplo'; } catch { /* sem armazenamento */ }
  iniciar(inicial === 'conta-nova' ? 'conta-nova' : 'exemplo');

  // Exposto apenas para testes automatizados do protótipo
  window.__enpAcionista = { calcular, situacaoParcela };
})();

// Componentes de oferta (levantamento de capital), renderizados no build a partir de src/data/ofertas.json.
// Princípios:
//  • Nenhum número é inventado: campo null → "A divulgar" e a barra de progresso entra em estado neutro.
//  • Moeda formatada uma única vez (evita "R$R$" e "%%", vistos em plataformas de referência).
//  • O mesmo HTML recebe atualização ao vivo de /dados/ofertas.json (data-oferta / data-live).

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const brl = (n, cents = true) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 });
const pct = (o) => (o.meta && o.captado != null ? Math.min(100, (o.captado / o.meta) * 100) : null);
const fmtPct = (p) => `${p.toLocaleString('pt-BR', { maximumFractionDigits: p < 10 ? 1 : 0 })}%`;

const STATUS = {
  aberta: { label: 'Captação aberta', cls: 'badge--success' },
  'em-breve': { label: 'Em breve', cls: 'badge--blue' },
  encerrada: { label: 'Captação encerrada', cls: '' },
};

export const entrada = (o) => `${brl(o.entradaValor, o.entradaValor % 1 !== 0 || o.entradaValor < 1000)}${o.entradaSufixo || ''}`;

function progress(o, size = 'md') {
  const p = pct(o);
  const known = p != null;
  return `
    <div class="progress progress--${size}" data-live="progress" ${known ? '' : 'data-empty="true"'}>
      <div class="progress__track" role="progressbar" aria-label="Percentual captado" aria-valuemin="0" aria-valuemax="100" ${known ? `aria-valuenow="${p.toFixed(1)}"` : 'aria-valuetext="Ainda não divulgado"'}>
        <span class="progress__bar" style="--p:${known ? p.toFixed(2) : 0}%"></span>
      </div>
      <div class="progress__meta">
        <span data-live="pct">${known ? `${fmtPct(p)} captado` : 'Captação em andamento'}</span>
        <span class="num" data-live="captado">${o.captado != null ? brl(o.captado) : 'Valores a divulgar'}</span>
      </div>
    </div>`;
}

export function card(o) {
  const st = STATUS[o.status] || STATUS.aberta;
  return `
<article class="offer card" data-oferta="${esc(o.slug)}" data-status="${esc(o.status)}" data-categoria="${esc(o.categoria)}">
  <header class="offer__head">
    <div class="offer__title">
      <h3 class="offer__name"><a href="/oportunidades/${esc(o.slug)}/" class="stretched">${esc(o.nome)}</a></h3>
      <p class="offer__status"><span class="badge ${st.cls}"><span class="dot"></span>${st.label}</span>${o.destaque ? ' <span class="badge badge--gold">Em destaque</span>' : ''}</p>
    </div>
    <span class="offer__logo" style="--logo-bg:${esc(o.logoFundo)}"><img src="${esc(o.logo)}" alt="" width="${o.logoW}" height="${o.logoH}" loading="lazy" decoding="async"></span>
  </header>
  <ul class="offer__tags" role="list">
    <li><span class="tag tag--blue"><svg class="icon" aria-hidden="true"><use href="#i-trend"/></svg>${esc(o.tipo)}</span></li>
    <li><span class="tag">${esc(o.setor)}</span></li>
  </ul>
  <p class="offer__pitch">${esc(o.chamada)}.</p>
  <dl class="offer__kpis">
    <div><dt>Meta de captação</dt><dd class="num" data-live="meta">${o.meta != null ? brl(o.meta, false) : 'A divulgar'}</dd></div>
    <div><dt>Retorno</dt><dd>${esc(o.retorno)}</dd></div>
  </dl>
  <dl class="offer__min">
    <div><dt>${esc(o.entradaRotulo)}</dt><dd class="num">${entrada(o)}</dd></div>
  </dl>
  ${progress(o)}
  <div class="offer__cta">
    <a class="btn btn--outline offer__invest" href="{{site.portal.cadastro}}" aria-label="Investir em ${esc(o.nome)}">Investir</a>
    <span class="link-arrow" aria-hidden="true">Ver oferta <svg class="icon"><use href="#i-arrow"/></svg></span>
  </div>
</article>`;
}

export function grid(list) {
  return `<div class="offers-grid" data-offers>${list.map(card).join('\n')}</div>`;
}

// Carrossel horizontal (home): rolagem com snap + botões anterior/próximo, como nas plataformas de referência.
export function carousel(list) {
  return `
<div class="offers-carousel" data-carousel>
  <div class="offers-carousel__nav">
    <button class="carousel-btn" type="button" data-carousel-prev aria-label="Oferta anterior"><svg class="icon" aria-hidden="true"><use href="#i-arrow-left"/></svg></button>
    <button class="carousel-btn" type="button" data-carousel-next aria-label="Próxima oferta"><svg class="icon" aria-hidden="true"><use href="#i-arrow"/></svg></button>
  </div>
  <div class="offers-carousel__track" data-carousel-track tabindex="0" role="region" aria-label="Oportunidades abertas (role para ver mais)">
    ${list.map(card).join('\n')}
  </div>
</div>`;
}

export function painel(o, site) {
  const st = STATUS[o.status] || STATUS.aberta;
  const rows = [
    ['Meta de captação', o.meta != null ? brl(o.meta, false) : 'A divulgar', 'meta'],
    ['Investidores', o.investidores != null ? o.investidores.toLocaleString('pt-BR') : '—', 'investidores'],
    [o.entradaRotulo, entrada(o)],
    o.precoAcao != null ? ['Preço por ação', brl(o.precoAcao)] : null,
    o.loteMinimo != null ? ['Primeira compra', `${o.loteMinimo} ações`] : null,
    o.parcelasMax != null ? ['Parcelamento', `até ${o.parcelasMax}× (pacote inicial)`] : null,
    ['Retorno', o.retorno],
    ['Encerramento', o.encerramento || 'A divulgar'],
  ].filter(Boolean);
  const wa = `https://wa.me/${o.whatsapp.e164}?text=${encodeURIComponent(o.whatsapp.texto)}`;
  return `
<div class="offer-panel card" data-oferta="${esc(o.slug)}" role="group" aria-labelledby="painel-${esc(o.slug)}">
  <div class="offer-panel__head">
    <p id="painel-${esc(o.slug)}" class="t-sans-title">Resumo da oferta</p>
    <span class="badge ${st.cls}"><span class="dot"></span>${st.label}</span>
  </div>
  <div class="offer-panel__total">
    <span class="small muted">Total captado</span>
    <span class="offer-panel__big num${o.captado == null ? ' offer-panel__big--empty' : ''}" data-live="captado-big">${o.captado != null ? brl(o.captado, false) : 'A divulgar'}</span>
  </div>
  ${progress(o, 'lg')}
  <dl class="facts">
    ${rows.map(([k, v, live]) => `<div><dt>${esc(k)}</dt><dd${live ? ` data-live="${live}"` : ''}>${esc(v)}</dd></div>`).join('\n    ')}
  </dl>
  <a class="btn btn--primary btn--lg btn--block" href="${esc(site.portal.cadastro)}">Investir <svg class="icon icon--arrow" aria-hidden="true"><use href="#i-arrow"/></svg></a>
  <a class="btn btn--whats btn--block" href="${esc(wa)}" rel="noopener" target="_blank"><svg class="icon" aria-hidden="true"><use href="#i-whatsapp"/></svg>Falar com especialista<span class="sr-only"> (abre em nova aba)</span></a>
  <div class="offer-panel__foot">
    <button class="share-btn" type="button" data-share data-share-title="${esc(o.nome)} · Empresas na Planta"><svg class="icon" aria-hidden="true"><use href="#i-share"/></svg>Compartilhar oferta</button>
    <a class="small" href="/aviso-de-risco/">Aviso de risco</a>
  </div>
</div>`;
}

/* Empresas na Planta — interações do site.
   Sem dependências. Melhoria progressiva: todo o conteúdo funciona sem JS;
   o script só adiciona comportamento. */
(() => {
  'use strict';
  const root = document.documentElement;
  root.classList.add('js');

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const brl = (n) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const fmt = (n, d = 0) => n.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });

  /* ---- Toast ----------------------------------------------------------- */
  const toastEl = $('[data-toast]');
  let toastTimer;
  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.dataset.show = 'true';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastEl.dataset.show = 'false'; }, 3200);
  }

  /* ---- Menu mobile: diálogo com foco preso, ESC e retorno de foco ------- */
  const menu = $('[data-menu]');
  const openBtn = $('[data-menu-open]');
  const closeBtn = $('[data-menu-close]');
  if (menu && openBtn && closeBtn) {
    const focusables = () => $$('a[href], button:not([disabled])', menu);
    const open = () => {
      menu.removeAttribute('inert');
      menu.dataset.open = 'true';
      openBtn.setAttribute('aria-expanded', 'true');
      document.body.classList.add('menu-open');
      requestAnimationFrame(() => closeBtn.focus());
    };
    const close = () => {
      menu.dataset.open = 'false';
      menu.setAttribute('inert', '');
      openBtn.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('menu-open');
      openBtn.focus();
    };
    openBtn.addEventListener('click', open);
    closeBtn.addEventListener('click', close);
    menu.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); close(); return; }
      if (e.key !== 'Tab') return;
      const f = focusables();
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    window.matchMedia('(min-width: 64rem)').addEventListener('change', (m) => { if (m.matches && menu.dataset.open === 'true') close(); });
  }

  /* ---- Barra de CTA no mobile: aparece depois do primeiro bloco --------- */
  const bar = $('[data-mobile-cta]');
  const firstSection = $('main > section, main > header');
  if (bar && firstSection && 'IntersectionObserver' in window) {
    const links = $$('a', bar);
    new IntersectionObserver(([entry]) => {
      const show = !entry.isIntersecting && entry.boundingClientRect.top < 0;
      bar.dataset.show = String(show);
      bar.setAttribute('aria-hidden', String(!show));
      links.forEach((a) => (show ? a.removeAttribute('tabindex') : a.setAttribute('tabindex', '-1')));
    }).observe(firstSection);
  }

  /* ---- Revelação das barras de crescimento ------------------------------ */
  $$('.growth').forEach((el) => {
    if (!('IntersectionObserver' in window)) { el.classList.add('is-visible'); return; }
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { el.classList.add('is-visible'); io.disconnect(); }
    }, { threshold: 0.35 });
    io.observe(el);
  });

  /* ---- Simulador de participação ---------------------------------------- */
  $$('[data-sim]').forEach((form) => {
    const preco = Number(form.dataset.preco);
    const lote = Number(form.dataset.lote);
    const bonus = Number(form.dataset.bonus);
    const meses = Number(form.dataset.meses);
    const qtd = $('input[name="qtd"]', form);
    const range = $('[data-sim-range]', form);
    const out = (k) => $(`[data-out="${k}"]`, form);
    const extraRow = $('[data-row="extra"]', form);

    function clamp(v) {
      const n = Math.round(Number(String(v).replace(/\D/g, '')) || 0);
      return Math.min(Math.max(n, lote), Number(qtd.max));
    }

    function update(fromRange = false) {
      const n = clamp(fromRange ? range.value : qtd.value);
      if (!fromRange || Number(qtd.value) !== n) qtd.value = n;
      range.value = Math.min(n, Number(range.max));
      const parc = Number($('input[name="parc"]:checked', form).value);
      const total = n * preco;
      const pacote = lote * preco;
      const extra = (n - lote) * preco;
      out('total').textContent = brl(total);
      out('pacote').textContent = parc === 1 ? `${brl(pacote)} à vista` : `${parc}× de ${brl(pacote / parc)}`;
      extraRow.hidden = extra <= 0;
      out('extra').textContent = `${fmt(n - lote)} ações · ${brl(extra)}`;
      const bonusAcoesMes = n * bonus; // 2% do valor investido, convertido em ações de mesmo preço
      const digits = Number.isInteger(bonusAcoesMes) ? 0 : 2;
      out('bonus').textContent = `até ${fmt(bonusAcoesMes, digits)} ${bonusAcoesMes === 1 ? 'ação' : 'ações'}/mês · máx. ${meses} meses`;
    }

    qtd.addEventListener('change', () => update());
    qtd.addEventListener('blur', () => update());
    qtd.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); update(); } });
    range.addEventListener('input', () => update(true));
    $$('[data-step]', form).forEach((b) => b.addEventListener('click', () => {
      qtd.value = clamp(Number(qtd.value) + Number(b.dataset.step));
      update();
    }));
    $$('input[name="parc"]', form).forEach((r) => r.addEventListener('change', () => update()));
    form.addEventListener('submit', (e) => e.preventDefault());
    update();
  });

  /* ---- FAQ: abre a pergunta indicada na URL e filtra por texto --------- */
  function openFromHash() {
    const id = decodeURIComponent(location.hash.slice(1));
    if (!id) return;
    const d = document.getElementById(id);
    if (d && d.tagName === 'DETAILS') { d.open = true; d.querySelector('summary').focus({ preventScroll: true }); }
  }
  window.addEventListener('hashchange', openFromHash);
  openFromHash();

  const faqSearch = $('[data-faq-search]');
  if (faqSearch) {
    const items = $$('[data-q]');
    const groups = $$('[data-faq-group]');
    const empty = $('[data-faq-empty]');
    const count = $('[data-faq-count]');
    const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const index = items.map((el) => norm(el.textContent));
    faqSearch.addEventListener('input', () => {
      const q = norm(faqSearch.value.trim());
      let visible = 0;
      items.forEach((el, i) => {
        const hit = !q || index[i].includes(q);
        el.hidden = !hit;
        if (hit) visible++;
        if (q && hit) el.open = true;
      });
      groups.forEach((g) => { g.hidden = !$$('[data-q]', g).some((el) => !el.hidden); });
      empty.hidden = visible > 0;
      count.textContent = q ? `${visible} ${visible === 1 ? 'resposta encontrada' : 'respostas encontradas'}` : '';
    });
  }

  /* ---- Copiar para a área de transferência -------------------------- */
  $$('[data-copy]').forEach((b) => b.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(b.dataset.copy); toast('Copiado para a área de transferência'); }
    catch { toast('Não foi possível copiar'); }
  }));

  /* ---- Formulário de contato (contrato compatível com /api/contato.php) --- */
  const contact = $('[data-contact]');
  if (contact) {
    const status = $('[data-contact-status]', contact);
    const submit = $('button[type="submit"]', contact);
    const messages = {
      valueMissing: 'Preencha este campo.',
      typeMismatch: 'Informe um e-mail válido, como nome@exemplo.com.',
      tooShort: (el) => `Use pelo menos ${el.minLength} caracteres.`,
    };
    const validate = (el) => {
      const field = el.closest('.field');
      if (!field) return true;
      const err = $('.error span', field);
      let msg = '';
      if (el.validity.valueMissing) msg = messages.valueMissing;
      else if (el.validity.typeMismatch) msg = messages.typeMismatch;
      else if (el.validity.tooShort) msg = messages.tooShort(el);
      field.dataset.invalid = String(Boolean(msg));
      el.setAttribute('aria-invalid', String(Boolean(msg)));
      if (err) err.textContent = msg;
      return !msg;
    };
    const fields = $$('input:not(.hp input), textarea', contact).filter((el) => el.name !== 'site');
    fields.forEach((el) => {
      el.addEventListener('blur', () => { if (el.value) validate(el); });
      el.addEventListener('input', () => { if (el.closest('.field')?.dataset.invalid === 'true') validate(el); });
    });
    const counter = $('[data-count-for]', contact);
    if (counter) {
      const ta = document.getElementById(counter.dataset.countFor);
      const upd = () => { counter.textContent = `${ta.value.length.toLocaleString('pt-BR')} / ${Number(ta.maxLength).toLocaleString('pt-BR')}`; };
      ta.addEventListener('input', upd); upd();
    }

    contact.addEventListener('submit', async (e) => {
      e.preventDefault();
      const invalid = fields.filter((el) => !validate(el));
      if (invalid.length) { invalid[0].focus(); status.className = 'form-status form-status--error'; status.textContent = 'Revise os campos destacados.'; return; }
      submit.disabled = true;
      submit.dataset.label = submit.dataset.label || submit.textContent.trim();
      submit.textContent = 'Enviando…';
      contact.setAttribute('aria-busy', 'true');
      status.className = 'form-status'; status.textContent = '';
      try {
        const res = await fetch(contact.action, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(Object.fromEntries(new FormData(contact))),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.erro || 'Não foi possível enviar agora. Tente novamente em instantes.');
        contact.reset();
        if (counter) counter.textContent = counter.textContent.replace(/^[\d.]+/, '0');
        status.className = 'form-status form-status--ok';
        status.textContent = 'Mensagem enviada! Entraremos em contato em breve pelo e-mail informado.';
        status.focus();
      } catch (err) {
        status.className = 'form-status form-status--error';
        status.textContent = `${err instanceof Error ? err.message : 'Falha no envio.'} Se preferir, fale conosco pelo WhatsApp.`;
        status.focus();
      } finally {
        submit.disabled = false;
        submit.textContent = submit.dataset.label;
        contact.removeAttribute('aria-busy');
      }
    });
  }

  /* ---- Abas acessíveis (padrão WAI-ARIA, setas do teclado) -------------- */
  $$('[data-tabs]').forEach((wrap) => {
    const tabs = $$('[role="tab"]', wrap);
    const select = (t, focus = true) => {
      tabs.forEach((x) => {
        const on = x === t;
        x.setAttribute('aria-selected', String(on));
        x.tabIndex = on ? 0 : -1;
        document.getElementById(x.getAttribute('aria-controls')).hidden = !on;
      });
      if (focus) t.focus();
      if (wrap.dataset.tabsHash !== undefined) history.replaceState(null, '', `#${t.id.replace(/^tab-/, '')}`);
    };
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => select(t));
      t.addEventListener('keydown', (e) => {
        const map = { ArrowRight: i + 1, ArrowDown: i + 1, ArrowLeft: i - 1, ArrowUp: i - 1, Home: 0, End: tabs.length - 1 };
        if (!(e.key in map)) return;
        e.preventDefault();
        select(tabs[(map[e.key] + tabs.length) % tabs.length]);
      });
    });
    const syncHash = () => {
      const t = tabs.find((x) => x.id === `tab-${location.hash.slice(1)}`);
      if (t) select(t, false);
    };
    window.addEventListener('hashchange', syncHash);
    syncHash();
  });

  $$('[data-print]').forEach((b) => { b.hidden = false; b.addEventListener('click', () => window.print()); });

  document.querySelectorAll('[data-goto]').forEach((a) => a.addEventListener('click', (e) => {
    const t = document.getElementById(a.dataset.goto);
    if (t) { e.preventDefault(); t.click(); }
  }));

  /* ---- Navegação lateral com destaque da seção atual (páginas legais) -- */
  const toc = $('[data-toc]');
  if (toc && 'IntersectionObserver' in window) {
    const links = $$('a[href^="#"]', toc);
    const map = new Map(links.map((a) => [a.getAttribute('href').slice(1), a]));
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        links.forEach((a) => a.removeAttribute('aria-current'));
        map.get(en.target.id)?.setAttribute('aria-current', 'true');
      });
    }, { rootMargin: '-20% 0px -70% 0px' });
    map.forEach((_, id) => { const s = document.getElementById(id); if (s) io.observe(s); });
  }
})();

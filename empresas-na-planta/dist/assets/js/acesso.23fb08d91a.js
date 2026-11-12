/* Acesso — protótipo de login (com 2 etapas), recuperação de senha e cadastro em etapas.
   Nenhum dado sai do navegador. As validações são as mesmas que o servidor deve repetir
   (a validação no cliente é conveniência; a do servidor é a que protege). */
(() => {
  'use strict';
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
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
  const digitos = (v) => String(v || '').replace(/\D/g, '');

  /* ---------------- Validadores (espelham as regras do servidor) ---------------- */
  const V = {
    email: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) || 'Informe um e-mail válido, como nome@exemplo.com.',
    nome: (v) => (v.trim().split(/\s+/).length >= 2 && v.trim().length >= 5) || 'Informe nome e sobrenome, como no documento.',
    celular: (v) => { const d = digitos(v); return (d.length === 11 && d[2] === '9') || 'Informe o celular com DDD: (41) 91234-5678.'; },
    cpf: (v) => {
      const d = digitos(v);
      if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return 'CPF inválido. Confira os 11 números.';
      const dv = (n) => { let s = 0; for (let i = 0; i < n; i++) s += Number(d[i]) * (n + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
      return (dv(9) === Number(d[9]) && dv(10) === Number(d[10])) || 'CPF inválido. Confira os dígitos verificadores.';
    },
    nascimento: (v) => {
      if (!v) return 'Informe sua data de nascimento.';
      const n = new Date(`${v}T12:00:00`); const hoje = new Date();
      let idade = hoje.getFullYear() - n.getFullYear();
      if (hoje < new Date(hoje.getFullYear(), n.getMonth(), n.getDate())) idade--;
      if (Number.isNaN(idade) || idade > 120) return 'Data de nascimento inválida.';
      return idade >= 18 || 'É preciso ter 18 anos ou mais para investir.';
    },
    cep: (v) => digitos(v).length === 8 || 'Informe o CEP com 8 números.',
    obrigatorio: (v) => v.trim().length > 0 || 'Preencha este campo.',
    uf: (v) => !!v || 'Escolha o estado.',
    senha: (v) => forcaSenha(v).ok || 'A senha não atende aos requisitos abaixo.',
    codigo: (v) => /^\d{6}$/.test(v) || 'Digite os 6 números do código.',
  };

  const COMUNS = ['123456', 'senha', 'password', 'qwerty', 'empresasnaplanta', 'abc123', '12345678', 'brasil'];
  function forcaSenha(v) {
    const r = {
      tamanho: v.length >= 10,
      letras: /[a-zà-ú]/i.test(v),
      numero: /\d/.test(v),
      comum: v.length > 0 && !COMUNS.some((c) => v.toLowerCase().includes(c)),
    };
    const pontos = Object.values(r).filter(Boolean).length + (v.length >= 14 ? 1 : 0) + (/[^a-z0-9]/i.test(v) ? 1 : 0);
    return { ...r, ok: r.tamanho && r.letras && r.numero && r.comum, nivel: Math.min(4, Math.max(0, pontos - 2)) };
  }

  /* ---------------- Máscaras ---------------- */
  const MASK = {
    cpf: (d) => d.slice(0, 11).replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2'),
    celular: (d) => d.slice(0, 11).replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d{1,4})$/, '$1-$2'),
    cep: (d) => d.slice(0, 8).replace(/^(\d{5})(\d)/, '$1-$2'),
    codigo: (d) => d.slice(0, 6),
  };
  $$('[data-mask]').forEach((el) => el.addEventListener('input', () => {
    const pos = el.value.length;
    el.value = MASK[el.dataset.mask](digitos(el.value));
    if (pos === el.value.length) return;
  }));

  /* ---------------- Campo: validar e exibir erro ---------------- */
  function validar(el) {
    const regra = el.dataset.v;
    if (!regra) return true;
    const field = el.closest('.field');
    let res = true;
    if (regra === 'igual') res = el.value === $(`#${el.dataset.igual}`).value || el.dataset.msg;
    else if (el.type === 'checkbox') res = el.checked || el.dataset.msg;
    else res = V[regra](el.value);
    const ok = res === true;
    if (field) {
      field.dataset.invalid = String(!ok);
      const span = $('.error span', field);
      if (span && !ok) span.textContent = res;
    }
    el.setAttribute('aria-invalid', String(!ok));
    return ok;
  }
  function validarGrupo(scope) {
    const els = $$('[data-v]', scope).filter((el) => !el.closest('[hidden]'));
    const invalidos = els.filter((el) => !validar(el));
    if (invalidos.length) invalidos[0].focus();
    return !invalidos.length;
  }
  $$('[data-v]').forEach((el) => {
    el.addEventListener('blur', () => { if (el.value || el.type === 'checkbox') validar(el); });
    el.addEventListener('input', () => { if (el.getAttribute('aria-invalid') === 'true') validar(el); });
    el.addEventListener('change', () => { if (el.type === 'checkbox') validar(el); });
  });

  /* ---------------- Mostrar/ocultar senha e medidor de força ---------------- */
  $$('[data-mostrar]').forEach((b) => b.addEventListener('click', () => {
    const inp = $(`#${b.dataset.mostrar}`);
    const mostrar = inp.type === 'password';
    inp.type = mostrar ? 'text' : 'password';
    b.setAttribute('aria-pressed', String(mostrar));
    b.textContent = mostrar ? 'Ocultar' : 'Mostrar';
  }));
  $$('[data-forca]').forEach((meter) => {
    const inp = $(`#${meter.dataset.forca}`);
    const labels = ['Muito fraca', 'Fraca', 'Razoável', 'Boa', 'Forte'];
    const upd = () => {
      const f = forcaSenha(inp.value);
      meter.dataset.nivel = inp.value ? f.nivel : '';
      $('[data-forca-label]', meter).textContent = inp.value ? labels[f.nivel] : '';
      ['tamanho', 'letras', 'numero', 'comum'].forEach((k) => { const li = $(`[data-req="${k}"]`, meter.parentElement); if (li) li.dataset.ok = String(f[k]); });
    };
    inp.addEventListener('input', upd); upd();
  });

  const status = (el, tipo, msg) => { el.className = `form-status form-status--${tipo}`; el.textContent = msg; el.focus(); };
  const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
  async function ocupado(btn, fn) {
    const label = btn.textContent; btn.disabled = true; btn.textContent = 'Aguarde…';
    try { await fn(); } finally { btn.disabled = false; btn.textContent = label; }
  }

  /* ======================= LOGIN ======================= */
  const login = $('[data-login]');
  if (login) {
    const etapa1 = $('[data-etapa="credenciais"]', login);
    const etapa2 = $('[data-etapa="2fa"]', login);
    const st1 = $('[data-status-1]', login);
    const st2 = $('[data-status-2]', login);
    let falhas = 0;
    let bloqueadoAte = 0;
    etapa1.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!validarGrupo(etapa1)) return;
      ocupado($('button[type="submit"]', etapa1), async () => {
        await esperar(500);
        if (Date.now() < bloqueadoAte) { status(st1, 'error', 'Muitas tentativas. Por segurança, o acesso foi bloqueado por 15 minutos. Você pode redefinir sua senha agora.'); return; }
        if ($('#senha', etapa1).value === 'errada') {
          falhas++;
          if (falhas >= 5) { bloqueadoAte = Date.now() + 15 * 60 * 1000; status(st1, 'error', 'Muitas tentativas. Por segurança, o acesso foi bloqueado por 15 minutos. Você pode redefinir sua senha agora.'); return; }
          // Mensagem genérica: não revela se o e-mail existe (evita enumeração de contas).
          status(st1, 'error', `E-mail ou senha incorretos. Tentativas restantes antes do bloqueio temporário: ${5 - falhas}.`);
          return;
        }
        etapa1.hidden = true; etapa2.hidden = false;
        $('[data-email-mascarado]', etapa2).textContent = $('#email', etapa1).value.replace(/^(.{2}).*(@.*)$/, '$1***$2');
        $('#codigo-2fa', etapa2).focus();
      });
    });
    etapa2.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!validarGrupo(etapa2)) return;
      ocupado($('button[type="submit"]', etapa2), async () => {
        await esperar(500);
        if ($('#codigo-2fa', etapa2).value !== '123456') { status(st2, 'error', 'Código incorreto ou expirado. Os códigos mudam a cada 30 segundos.'); $('#codigo-2fa', etapa2).select(); return; }
        status(st2, 'ok', 'Acesso confirmado. Abrindo sua área do acionista…');
        await esperar(700);
        location.href = url('/prototipo/area-do-acionista/');
      });
    });
    $('[data-voltar-1]', login)?.addEventListener('click', () => { etapa2.hidden = true; etapa1.hidden = false; $('#senha', etapa1).focus(); });
  }

  /* ======================= RECUPERAÇÃO DE SENHA ======================= */
  const rec = $('[data-recuperar]');
  if (rec) {
    const pedir = $('[data-etapa="pedir"]', rec);
    const enviado = $('[data-etapa="enviado"]', rec);
    const nova = $('[data-etapa="nova"]', rec);
    const feito = $('[data-etapa="feito"]', rec);
    pedir.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!validarGrupo(pedir)) return;
      ocupado($('button[type="submit"]', pedir), async () => { await esperar(500); pedir.hidden = true; enviado.hidden = false; $('h2', enviado).focus(); });
    });
    $('[data-simular-link]', rec).addEventListener('click', () => { enviado.hidden = true; nova.hidden = false; $('#nova-senha', nova).focus(); });
    nova.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!validarGrupo(nova)) return;
      ocupado($('button[type="submit"]', nova), async () => { await esperar(500); nova.hidden = true; feito.hidden = false; $('h2', feito).focus(); });
    });
  }

  /* ======================= CADASTRO EM ETAPAS ======================= */
  const cad = $('[data-cadastro]');
  if (cad) {
    const etapas = $$('[data-passo]', cad);
    const itens = $$('[data-stepper] li', cad);
    const progresso = $('[data-progresso]', cad);
    const CHAVE = 'enp-proto-cadastro';
    const persistir = ['nome', 'email', 'celular', 'nacionalidade', 'nascimento', 'cep', 'logradouro', 'numero', 'complemento', 'bairro', 'cidade', 'uf'];
    let atual = 0;

    // Retoma o que já foi preenchido (exceto senha e CPF, que nunca são guardados no navegador).
    try {
      const salvo = JSON.parse(sessionStorage.getItem(CHAVE) || '{}');
      persistir.forEach((k) => { const el = $(`#${k}`, cad); if (el && salvo[k]) el.value = salvo[k]; });
      // Retoma na etapa 1 com os campos já preenchidos: a senha precisa ser digitada de novo.
    } catch { /* sem armazenamento: começa do zero */ }
    const salvar = () => {
      try {
        const obj = { passo: atual };
        persistir.forEach((k) => { const el = $(`#${k}`, cad); if (el) obj[k] = el.value; });
        sessionStorage.setItem(CHAVE, JSON.stringify(obj));
      } catch { /* ignora */ }
    };

    function mostrar(i, focar = true) {
      atual = i;
      etapas.forEach((s, n) => { s.hidden = n !== i; });
      itens.forEach((li, n) => {
        li.dataset.estado = n < i ? 'feito' : n === i ? 'atual' : 'futuro';
        if (n === i) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
      });
      progresso.textContent = `Etapa ${i + 1} de ${etapas.length}`;
      if (etapas[i].dataset.passo === 'revisao') montarRevisao();
      if (focar) $('h2', etapas[i]).focus();
      salvar();
    }

    // Nacionalidade: CPF para brasileiros; documento estrangeiro para os demais
    const nac = $('#nacionalidade', cad);
    const sincNac = () => { const br = nac.value !== 'estrangeira'; $('[data-bloco="cpf"]', cad).hidden = !br; $('[data-bloco="doc-estrangeiro"]', cad).hidden = br; };
    nac.addEventListener('change', sincNac); sincNac();

    etapas.forEach((s, i) => {
      s.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!validarGrupo(s)) return;
        if (s.dataset.passo === 'confirmacao') {
          const ok = $('#cod-email', s).value === '123456' && $('#cod-sms', s).value === '123456';
          if (!ok) { status($('[data-status]', s), 'error', 'Algum código não confere. No protótipo, os dois códigos são 123456.'); return; }
        }
        if (s.dataset.passo === 'revisao') {
          ocupado($('button[type="submit"]', s), async () => {
            await esperar(700);
            try { sessionStorage.removeItem(CHAVE); } catch { /* ignora */ }
            etapas.forEach((x) => { x.hidden = true; });
            $('[data-stepper]', cad).hidden = true; progresso.hidden = true;
            const fim = $('[data-concluido]', cad); fim.hidden = false; $('h2', fim).focus();
          });
          return;
        }
        if (s.dataset.passo === 'acesso') $('[data-contato-email]', cad).textContent = $('#email', cad).value;
        if (s.dataset.passo === 'acesso') $('[data-contato-cel]', cad).textContent = $('#celular', cad).value;
        mostrar(i + 1);
      });
      $('[data-anterior]', s)?.addEventListener('click', () => mostrar(i - 1));
    });

    $$('[data-reenviar]', cad).forEach((b) => b.addEventListener('click', () => {
      b.disabled = true; let t = 30;
      const label = b.dataset.reenviar;
      b.textContent = `Reenviar em ${t}s`;
      const iv = setInterval(() => { t--; b.textContent = `Reenviar em ${t}s`; if (t <= 0) { clearInterval(iv); b.disabled = false; b.textContent = label; } }, 1000);
    }));

    function montarRevisao() {
      const v = (id) => ($(`#${id}`, cad)?.value || '—');
      const cpf = digitos(v('cpf'));
      const linhas = [
        ['Nome', v('nome'), 0], ['E-mail', v('email'), 0], ['Celular', v('celular'), 0],
        ['Nacionalidade', nac.value === 'estrangeira' ? 'Estrangeira' : 'Brasileira', 2],
        nac.value === 'estrangeira' ? ['Documento', v('doc-estrangeiro'), 2] : ['CPF', cpf ? `***.***.${cpf.slice(6, 9)}-${cpf.slice(9)}` : '—', 2],
        ['Nascimento', v('nascimento') !== '—' ? new Date(`${v('nascimento')}T12:00:00`).toLocaleDateString('pt-BR') : '—', 2],
        ['Endereço', `${v('logradouro')}, ${v('numero')}${$('#complemento', cad).value ? ` – ${v('complemento')}` : ''} · ${v('bairro')} · ${v('cidade')}/${v('uf')} · CEP ${v('cep')}`, 3],
      ];
      $('[data-revisao]', cad).innerHTML = linhas.map(([k, val, passo]) => `<div><dt>${k}</dt><dd>${val.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])} <button type="button" class="edit-link" data-editar="${passo}">Editar<span class="sr-only"> ${k}</span></button></dd></div>`).join('');
      $$('[data-editar]', cad).forEach((b) => b.addEventListener('click', () => mostrar(Number(b.dataset.editar))));
    }

    mostrar(atual, false);
  }
})();

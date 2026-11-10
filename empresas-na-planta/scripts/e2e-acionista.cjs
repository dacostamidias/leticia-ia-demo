// Testes da área do acionista (protótipo): painel, login com 2 etapas, cadastro e recuperação de senha.
// Uso: npm start (em outro terminal) e depois: node scripts/e2e-acionista.cjs
const { chromium } = require('playwright');
const B = process.env.BASE_URL || 'http://localhost:4173';
let falhas = 0;
const ok = (c, m) => { if (!c) falhas++; console.log((c ? '✔' : '✖') + ' ' + m); };
const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1366, height: 900 }, reducedMotion: 'reduce', acceptDownloads: true });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));

  /* ---------- PAINEL: exemplo ilustrativo ---------- */
  await p.goto(B + '/prototipo/area-do-acionista/');
  await p.waitForSelector('.kpi');
  const kpis = await p.$$eval('.kpi__value', (els) => els.map((e) => e.textContent.replace(/\s+/g, ' ').trim()));
  ok(kpis[0] === 'R$ 5.800,00', `valor pago calculado dos lançamentos = R$ 5.800,00 (${kpis[0]})`);
  ok(kpis[1] === '110 ações', `integralizadas: 60 (3/5 parcelas de 100) + 50 à vista = 110 (${kpis[1]})`);
  ok(kpis[2] === '4,4 ações', `bonificação: 0,4 + 1,8 + 2,2 = 4,4 (${kpis[2]})`);
  ok(kpis[3] === 'R$ 0,00', 'disponível para resgate = R$ 0,00 (nada estimado)');
  const alerta = norm(await p.textContent('.notice--danger'));
  ok(alerta.includes('vencida há 26 dias') && alerta.includes('14/12/2026') && alerta.includes('faltam 34 dias'), 'alerta de inadimplência: 26 dias, cancela em 14/12/2026');
  ok(!(await p.isHidden('[data-exemplo-aviso]')), 'aviso "dados fictícios" visível no modo exemplo');
  ok(norm(await p.textContent('[data-badge-comunicados]')) === '2', 'badge com 2 comunicados não lidos');

  // Detalhe em <dialog>: abre, ESC fecha, foco volta
  await p.click('[data-detalhe="champions-sports"]');
  ok(await p.evaluate(() => document.querySelector('[data-dialog-detalhe]').open), 'detalhe da participação abre em diálogo');
  await p.keyboard.press('Escape');
  ok(await p.evaluate(() => !document.querySelector('[data-dialog-detalhe]').open && document.activeElement.dataset.detalhe === 'champions-sports'), 'ESC fecha e o foco volta ao botão');

  // Navegação por teclado nas abas
  await p.focus('#tab-visao-geral'); await p.keyboard.press('ArrowDown');
  ok(await p.evaluate(() => location.hash === '#participacoes' && document.activeElement.id === 'tab-participacoes'), 'seta ↓ muda de seção e atualiza a URL');
  await p.goto(B + '/prototipo/area-do-acionista/#resultados'); await p.waitForSelector('#h-bon');
  ok((await p.$$eval('#painel tbody tr', (r) => r.length)) === 3, 'link direto #resultados mostra as 3 bonificações');
  ok(await p.isDisabled('text=Solicitar resgate'), 'resgate desabilitado sem saldo liberado');

  await p.click('#tab-comunicados'); await p.click('[data-ler-todos]');
  ok(await p.isHidden('[data-badge-comunicados]'), '"marcar todos como lidos" zera o badge');

  await p.click('#tab-documentos');
  await p.click('[data-doc-filter] [data-f="certificado"]');
  ok((await p.$$eval('[data-doc-tipo]:not([hidden])', (e) => e.length)) === 2, 'filtro de documentos: 2 certificados');

  await p.click('#tab-seguranca');
  await p.click('[data-2fa-ativar]'); await p.fill('#otp-2fa', '000000'); await p.click('[data-2fa-confirmar]');
  ok((await p.getAttribute('#otp-2fa', 'aria-invalid')) === 'true', '2FA: código errado é recusado');
  await p.fill('#otp-2fa', '123456'); await p.click('[data-2fa-confirmar]');
  ok(norm(await p.textContent('[data-2fa-status]')).includes('Ativada'), '2FA: código correto ativa');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('[data-exportar]')]);
  ok(dl.suggestedFilename() === 'meus-dados-empresas-na-planta.json', 'LGPD: "Baixar meus dados" gera o arquivo');

  await p.click('#tab-suporte'); await p.click('[data-chamado] button[type=submit]');
  ok((await p.getAttribute('#ch-assunto', 'aria-invalid')) === 'true', 'suporte: validação do chamado');
  await p.selectOption('#ch-assunto', { index: 1 }); await p.fill('#ch-msg', 'Quero saber quando vence a próxima parcela.');
  await p.click('[data-chamado] button[type=submit]');
  ok(norm(await p.textContent('#painel tbody')).includes('#1044'), 'suporte: chamado aberto entra na lista');

  /* ---------- PAINEL: conta nova ---------- */
  await p.click('#tab-visao-geral');
  await p.click('[data-modo="conta-nova"]'); await p.waitForTimeout(300);
  ok(await p.isHidden('[data-exemplo-aviso]'), 'conta nova: sem aviso de exemplo');
  ok(norm(await p.textContent('#painel')).includes('Próximo passo: confirme sua identidade'), 'conta nova: orienta o próximo passo');
  ok(norm(await p.textContent('#painel')).includes('Você ainda não tem participações.'), 'conta nova: estado vazio de participações');
  await p.click('[data-modo="exemplo"]');

  /* ---------- LOGIN ---------- */
  await p.goto(B + '/prototipo/entrar/');
  await p.fill('#email', 'nome@empresa.digital');
  await p.fill('#senha', 'errada'); await p.click('[data-etapa="credenciais"] button[type=submit]');
  await p.waitForSelector('[data-status-1].form-status--error');
  const msg = norm(await p.textContent('[data-status-1]'));
  ok(msg.startsWith('E-mail ou senha incorretos'), 'login: mensagem genérica (não revela se a conta existe)');
  ok(true, 'login: e-mail com TLD longo (.digital) aceito');
  for (let i = 0; i < 4; i++) { await p.click('[data-etapa="credenciais"] button[type=submit]'); await p.waitForTimeout(650); }
  ok(norm(await p.textContent('[data-status-1]')).includes('bloqueado por 15 minutos'), 'login: bloqueio após 5 tentativas');
  await p.goto(B + '/prototipo/entrar/');
  await p.fill('#email', 'ana@exemplo.com'); await p.fill('#senha', 'qualquer-senha-1');
  await p.click('[data-etapa="credenciais"] button[type=submit]');
  await p.waitForSelector('#codigo-2fa:visible');
  ok(true, 'login: segunda etapa (2FA) aparece');
  await p.fill('#codigo-2fa', '111111'); await p.click('[data-etapa="2fa"] button[type=submit]');
  await p.waitForSelector('[data-status-2].form-status--error');
  ok(true, 'login: código 2FA errado é recusado');
  await p.fill('#codigo-2fa', '123456');
  await Promise.all([p.waitForURL('**/prototipo/area-do-acionista/'), p.click('[data-etapa="2fa"] button[type=submit]')]);
  ok(true, 'login: código correto leva à área do acionista');

  /* ---------- RECUPERAÇÃO ---------- */
  await p.goto(B + '/prototipo/recuperar-senha/');
  await p.fill('#email', 'qualquer@exemplo.com'); await p.click('[data-etapa="pedir"] button[type=submit]');
  await p.waitForSelector('[data-etapa="enviado"]:visible');
  ok(norm(await p.textContent('[data-etapa="enviado"]')).includes('Se houver uma conta'), 'recuperação: resposta neutra (sem enumeração)');
  await p.click('[data-simular-link]');
  await p.fill('#nova-senha', '123456'); await p.fill('#nova-senha-2', '123456'); await p.click('[data-etapa="nova"] button[type=submit]');
  ok((await p.getAttribute('#nova-senha', 'aria-invalid')) === 'true', 'recuperação: senha comum é recusada');
  await p.fill('#nova-senha', 'Planta2026segura'); await p.fill('#nova-senha-2', 'Planta2026segurA');
  await p.click('[data-etapa="nova"] button[type=submit]');
  ok((await p.getAttribute('#nova-senha-2', 'aria-invalid')) === 'true', 'recuperação: confirmação diferente é recusada');
  await p.fill('#nova-senha-2', 'Planta2026segura'); await p.click('[data-etapa="nova"] button[type=submit]');
  await p.waitForSelector('[data-etapa="feito"]:visible');
  ok(true, 'recuperação: nova senha salva');

  /* ---------- CADASTRO ---------- */
  await p.goto(B + '/prototipo/cadastro/');
  await p.click('[data-passo="acesso"] button[type=submit]');
  ok((await p.getAttribute('#nome', 'aria-invalid')) === 'true' && (await p.evaluate(() => document.activeElement.id)) === 'nome', 'cadastro: erros marcados e foco no primeiro');
  await p.fill('#nome', 'Ana Exemplo'); await p.fill('#email', 'ana@exemplo.com');
  await p.fill('#celular', '41912345678');
  ok((await p.inputValue('#celular')) === '(41) 91234-5678', 'cadastro: máscara do celular');
  await p.fill('#senha', 'Planta2026segura');
  await p.click('[data-passo="acesso"] button[type=submit]');
  await p.waitForSelector('[data-passo="confirmacao"]:visible');
  ok(norm(await p.textContent('[data-progresso]')) === 'Etapa 2 de 5', 'cadastro: progresso "Etapa 2 de 5"');
  await p.fill('#cod-email', '123456'); await p.fill('#cod-sms', '123456');
  await p.click('[data-passo="confirmacao"] button[type=submit]');
  await p.waitForSelector('[data-passo="dados"]:visible');
  await p.fill('#cpf', '11111111111'); await p.fill('#nascimento', '2012-01-01');
  await p.click('[data-passo="dados"] button[type=submit]');
  ok(norm(await p.textContent('#cpf-err')).includes('CPF inválido'), 'cadastro: CPF com dígitos repetidos recusado');
  ok(norm(await p.textContent('#nascimento-err')).includes('18 anos'), 'cadastro: menor de idade recusado');
  await p.fill('#cpf', '52998224725');
  ok((await p.inputValue('#cpf')) === '529.982.247-25', 'cadastro: máscara do CPF');
  await p.fill('#nascimento', '1990-05-20');
  await p.click('[data-passo="dados"] button[type=submit]');
  await p.waitForSelector('[data-passo="endereco"]:visible');
  await p.fill('#cep', '81510090'); await p.selectOption('#uf', 'PR');
  await p.fill('#logradouro', 'Rua Exemplo'); await p.fill('#numero', '100'); await p.fill('#bairro', 'Centro'); await p.fill('#cidade', 'Curitiba');
  await p.click('[data-passo="endereco"] button[type=submit]');
  await p.waitForSelector('[data-passo="revisao"]:visible');
  const rev = norm(await p.textContent('[data-revisao]'));
  ok(rev.includes('***.***.247-25') && !rev.includes('529.982'), 'cadastro: revisão mostra o CPF mascarado');
  await p.click('[data-passo="revisao"] button[type=submit]');
  ok((await p.getAttribute('#ac-termos', 'aria-invalid')) === 'true', 'cadastro: aceite dos termos é obrigatório');
  await p.check('#ac-termos'); await p.check('#ac-priv'); await p.check('#ac-risco');
  await p.click('[data-passo="revisao"] button[type=submit]');
  await p.waitForSelector('[data-concluido]:visible');
  ok(true, 'cadastro: conta criada (marketing é opcional)');
  ok(await p.evaluate(() => !sessionStorage.getItem('enp-proto-cadastro')), 'cadastro: rascunho apagado ao concluir');

  ok(errs.length === 0, 'nenhum erro de JS ' + errs.join(' | '));
  await b.close();
  console.log(falhas ? `\n✖ ${falhas} falha(s)` : '\n✔ Área do acionista: todos os testes passaram');
  process.exitCode = falhas ? 1 : 0;
})();

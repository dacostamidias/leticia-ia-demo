// Testes funcionais de ponta a ponta (menu, simulador, FAQ, contato, abas).
// Uso: npm start (em outro terminal) e depois: node scripts/e2e.cjs
const { chromium } = require('playwright');
const B=process.env.BASE_URL||'http://localhost:4173';
let falhas=0;
const ok=(c,m)=>{ if(!c) falhas++; console.log((c?'✔':'✖')+' '+m); };
(async()=>{
 const b=await chromium.launch(); const p=await b.newPage({viewport:{width:390,height:844}});
 const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto(B+'/');
 // menu
 await p.click('[data-menu-open]'); await p.waitForTimeout(400);
 ok(await p.getAttribute('[data-menu]','data-open')==='true','menu abre');
 ok(await p.evaluate(()=>document.activeElement.matches('[data-menu-close]')),'foco vai para o botão fechar');
 await p.keyboard.press('Escape'); await p.waitForTimeout(400);
 ok(await p.getAttribute('[data-menu]','data-open')==='false','ESC fecha o menu');
 ok(await p.evaluate(()=>document.activeElement.matches('[data-menu-open]')),'foco retorna ao botão abrir');
 // sticky cta
 await p.evaluate(()=>window.scrollTo({top:1500,behavior:'instant'})); await p.waitForTimeout(500);
 ok(await p.getAttribute('[data-mobile-cta]','data-show')==='true','barra de CTA aparece após rolar');
 // simulador
 const sim='#simulador';
 const total=()=>p.textContent(sim+' [data-out=total]');
 ok((await total()).includes('5.000,00'),'simulador inicia em R$ 5.000,00');
 await p.fill(sim+' input[name=qtd]','250'); await p.press(sim+' input[name=qtd]','Enter');
 ok((await total()).includes('12.500,00'),'250 ações = R$ 12.500,00');
 await p.click(sim+' label[for=p5]');
 ok((await p.textContent(sim+' [data-out=pacote]')).replace(/\s/g,' ').includes('5× de R$ 1.000,00'),'pacote em 5× de R$ 1.000,00');
 ok((await p.textContent(sim+' [data-out=extra]')).replace(/\s/g,' ').includes('150 ações · R$ 7.500,00'),'adicionais 150 ações à vista');
 ok((await p.textContent(sim+' [data-out=bonus]')).includes('até 5 ações/mês'),'bonificação 2% = 5 ações/mês');
 await p.fill(sim+' input[name=qtd]','12'); await p.press(sim+' input[name=qtd]','Enter');
 ok((await p.inputValue(sim+' input[name=qtd]'))==='100','mínimo de 100 ações é imposto');
 await p.click(sim+' [data-step="10"]');
 ok((await total()).includes('5.500,00'),'botão +10 funciona');
 // FAQ
 await p.goto(B+'/faq/');
 await p.fill('[data-faq-search]','token');
 const vis=await p.$$eval('[data-q]',els=>els.filter(e=>!e.hidden).length);
 ok(vis===2,'busca "token" filtra para as 2 respostas que citam token ('+vis+')');
 await p.fill('[data-faq-search]','xyzxyz');
 ok(!(await p.isHidden('[data-faq-empty]')),'estado vazio aparece');
 await p.goto(B+'/faq/#atraso'); await p.waitForTimeout(200);
 ok(await p.evaluate(()=>document.getElementById('atraso').open),'âncora #atraso abre a pergunta');
 // contato
 await p.goto(B+'/contato/');
 await p.click('[data-contact] button[type=submit]');
 ok(await p.getAttribute('#c-email','aria-invalid')==='true','validação: e-mail obrigatório');
 ok(await p.evaluate(()=>document.activeElement.id)==='c-email','foco vai para o primeiro campo inválido');
 await p.fill('#c-email','nome@exemplo.com'); await p.fill('#c-assunto','Dúvida'); await p.fill('#c-msg','Olá, gostaria de saber mais.');
 await p.click('[data-contact] button[type=submit]'); await p.waitForSelector('.form-status--ok');
 ok(true,'envio com sucesso mostra confirmação');
 await p.fill('#c-email','nome@exemplo.com'); await p.fill('#c-assunto','Dúvida'); await p.fill('#c-msg','teste #erro do servidor');
 await p.click('[data-contact] button[type=submit]'); await p.waitForSelector('.form-status--error');
 ok(true,'falha do servidor mostra erro com alternativa (WhatsApp)');
 // tabs
 await p.goto(B+'/prototipo/area-do-acionista/');
 await p.focus('#tab-visao-geral'); await p.keyboard.press('ArrowRight');
 ok(await p.evaluate(()=>!document.getElementById('p-part').hidden && document.activeElement.id==='tab-participacoes'),'abas: seta → muda de painel');
 await p.goto(B+'/prototipo/area-do-acionista/#dividendos');
 ok(await p.evaluate(()=>!document.getElementById('p-div').hidden),'abas: hash #dividendos abre o painel');
 ok(errs.length===0,'nenhum erro de JS '+errs.join('|'));
 await b.close();
 console.log(falhas ? `\n✖ ${falhas} teste(s) falharam` : '\n✔ Todos os testes funcionais passaram');
 process.exitCode = falhas ? 1 : 0;
})();

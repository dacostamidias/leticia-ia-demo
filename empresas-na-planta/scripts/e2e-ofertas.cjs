const { chromium } = require('playwright');
const B=process.env.BASE_URL||'http://localhost:4173';
let falhas=0; const ok=(c,m)=>{ if(!c) falhas++; console.log((c?'✔':'✖')+' '+m); };
(async()=>{
 const b=await chromium.launch(); const p=await b.newPage({viewport:{width:390,height:844}});
 const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 // dados de TESTE injetados apenas nesta sessão do navegador (não alteram nenhum arquivo)
 await p.route('**/dados/ofertas.json', r=>r.fulfill({contentType:'application/json', body: JSON.stringify({ofertas:[{slug:'champions-sports',status:'aberta',meta:1000000,captado:92800,investidores:37}]})}));
 await p.goto(B+'/oportunidades/champions-sports/'); await p.waitForTimeout(400);
 const panel='.offer-panel[data-oferta="champions-sports"]';
 const t=async s=>(await p.textContent(panel+' '+s)).replace(/\s/g,' ');
 ok((await t('[data-live="pct"]')).includes('9,3% captado'),'percentual calculado: 9,3%');
 ok((await t('[data-live="captado-big"]')).includes('R$ 92.800'),'total captado atualizado ao vivo');
 ok((await t('[data-live="meta"]')).includes('R$ 1.000.000'),'meta atualizada');
 ok((await t('[data-live="investidores"]')).trim()==='37','investidores atualizados');
 ok(!(await t('[data-live="pct"]')).includes('%%') && !(await t('[data-live="captado-big"]')).includes('R$R$'),'sem "%%" nem "R$R$" (erros vistos na referência)');
 ok(await p.getAttribute(panel+' .progress__track','aria-valuenow')==='9.3','barra acessível: aria-valuenow=9.3');
 // sem dados: estado neutro
 const p2=await b.newPage({viewport:{width:1366,height:900}, reducedMotion:'reduce'});
 await p2.goto(B+'/oportunidades/'); await p2.waitForTimeout(300);
 ok((await p2.$$eval('[data-offers] [data-oferta]',e=>e.length))===2,'listagem mostra 2 ofertas');
 ok((await p2.textContent('[data-oferta="escolas-jesus-para-as-criancas"] [data-live="meta"]')).includes('A divulgar'),'sem meta publicada → "A divulgar" (nada inventado)');
 await p2.click('button[data-filter="encerrada"]');
 ok(!(await p2.isHidden('[data-offers-empty]')),'filtro "Encerradas" mostra estado vazio');
 await p2.click('button[data-filter="todas"]');
 ok((await p2.$$eval('[data-offers] [data-oferta]:not([hidden])',e=>e.length))===2,'filtro "Todas" restaura');
 // clique no card leva à oferta; botão Investir leva ao cadastro
 const href=await p2.getAttribute('[data-oferta="champions-sports"] .offer__invest','href');
 ok(href.includes('/cadastro'),'botão Investir → cadastro');
 const pitch=await p2.$('[data-oferta="escolas-jesus-para-as-criancas"] .offer__pitch'); await pitch.scrollIntoViewIfNeeded(); const bb=await pitch.boundingBox();
 await Promise.all([p2.waitForNavigation(), p2.mouse.click(bb.x+bb.width/2, bb.y+bb.height/2)]);
 ok(p2.url().endsWith('/oportunidades/escolas-jesus-para-as-criancas/'),'card inteiro clicável → página da oferta');
 // carrossel na home (mobile)
 await p.goto(B+'/'); await p.waitForTimeout(300);
 ok(await p.isDisabled('[data-carousel-prev]'),'carrossel: "anterior" desabilitado no início');
 await p.click('[data-carousel-next]'); await p.waitForTimeout(700);
 ok(await p.evaluate(()=>document.querySelector('[data-carousel-track]').scrollLeft>100),'carrossel: "próxima" rola para o 2º card');
 ok(errs.length===0,'nenhum erro de JS '+errs.join('|'));
 await b.close();
 console.log(falhas?`\n✖ ${falhas} falha(s)`:'\n✔ Ofertas: todos os testes passaram'); process.exitCode=falhas?1:0;
})();

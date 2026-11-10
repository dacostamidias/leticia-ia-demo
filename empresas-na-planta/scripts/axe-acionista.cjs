const { chromium } = require('playwright'); const fs=require('fs');
const axe=fs.readFileSync(process.argv[2],'utf8');
(async()=>{const b=await chromium.launch(); let total=0;
const run=async(p,label)=>{await p.addScriptTag({content:axe});const v=await p.evaluate(async()=>(await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa','best-practice']}})).violations.map(v=>v.impact+' '+v.id+' '+v.nodes.slice(0,2).map(n=>n.target.join(' ')).join(';')));total+=v.length;console.log((v.length?'✖ ':'✔ ')+label+(v.length?' → '+v.join(' | '):''));};
for (const w of [390,1366]) for (const modo of ['exemplo','conta-nova']) {
 const p=await b.newPage({viewport:{width:w,height:900},bypassCSP:true});
 await p.goto('http://localhost:4173/prototipo/area-do-acionista/'); await p.waitForSelector('.kpi');
 if(modo==='conta-nova'){await p.click('[data-modo="conta-nova"]');await p.waitForTimeout(300);}
 for (const t of ['visao-geral','participacoes','pagamentos','resultados','documentos','relatorios','comunicados','suporte','seguranca']) { await p.click('#tab-'+t); await p.waitForTimeout(80); await run(p,`${w}px ${modo} ${t}`); }
 await p.click('#tab-participacoes'); if(modo==='exemplo'){await p.click('[data-detalhe="champions-sports"]'); await run(p,`${w}px diálogo`);} await p.close(); }
const p=await b.newPage({viewport:{width:390,height:900},bypassCSP:true}); await p.goto('http://localhost:4173/prototipo/cadastro/');
for (const passo of ['confirmacao','dados','endereco','revisao']) { await p.evaluate(ps=>{document.querySelectorAll('[data-passo]').forEach(f=>f.hidden=f.dataset.passo!==ps)},passo); await run(p,'cadastro '+passo); }
await b.close(); console.log(total?`\n✖ ${total} violações`:'\n✔ axe: 0 violações em todas as seções');})();

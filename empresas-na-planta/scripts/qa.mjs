// QA automatizado — roda contra o servidor local (npm start) depois do build.
// Verifica, em todas as páginas e nas 7 larguras da auditoria:
//   • rolagem horizontal (overflow)          • erros de console / JS
//   • exatamente um <h1>                      • imagens sem alt
//   • links target=_blank sem rel=noopener   • ids duplicados
//   • alvos de toque < 24×24 px (WCAG 2.5.8)  • acessibilidade com axe-core (WCAG 2.2 AA), se disponível
// Requisitos: Playwright instalado (npx playwright) e, opcionalmente, AXE_PATH apontando para axe.min.js.
import { createRequire } from 'node:module';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const BASE = process.env.BASE_URL || 'http://localhost:4173';
const WIDTHS = [360, 390, 430, 768, 1024, 1366, 1920];

async function routes(dir = path.join(ROOT, 'dist'), prefix = '/') {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (e.isDirectory() && e.name !== 'assets') out.push(...(await routes(path.join(dir, e.name), `${prefix}${e.name}/`)));
    else if (e.name === 'index.html') out.push(prefix);
  }
  return out;
}

const axeSrc = process.env.AXE_PATH ? await readFile(process.env.AXE_PATH, 'utf8') : null;
const pages = [...(await routes()), '/pagina-que-nao-existe/'];
const browser = await chromium.launch();
const problems = [];
const report = (route, w, msg) => problems.push(`${route} @${w}px — ${msg}`);

for (const route of pages) {
  for (const w of WIDTHS) {
    const page = await browser.newPage({ viewport: { width: w, height: 900 }, bypassCSP: Boolean(axeSrc) });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(BASE + route, { waitUntil: 'networkidle' });
    const r = await page.evaluate(() => {
      const W = document.documentElement.clientWidth;
      const vis = (el) => { const s = getComputedStyle(el); const b = el.getBoundingClientRect(); return s.visibility !== 'hidden' && s.display !== 'none' && b.width > 0 && b.height > 0 && !el.closest('[inert],[hidden],[aria-hidden="true"]'); };
      const ids = {}; document.querySelectorAll('[id]').forEach((e) => { ids[e.id] = (ids[e.id] || 0) + 1; });
      const small = [...document.querySelectorAll('a[href], button, input, select, textarea, summary')]
        .filter(vis)
        .filter((el) => getComputedStyle(el).opacity !== '0')
        .filter((el) => { const b = el.getBoundingClientRect(); const inline = getComputedStyle(el).display === 'inline'; return !inline && (b.width < 24 || b.height < 24); })
        .map((el) => `${el.tagName.toLowerCase()}「${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 30)}」`);
      return {
        overflow: document.documentElement.scrollWidth - W,
        h1: document.querySelectorAll('h1').length,
        noAlt: [...document.querySelectorAll('img:not([alt])')].map((i) => i.src),
        blank: [...document.querySelectorAll('a[target=_blank]:not([rel~=noopener])')].map((a) => a.href),
        dupIds: Object.entries(ids).filter(([, n]) => n > 1).map(([k]) => k),
        small,
      };
    });
    if (r.overflow > 0) report(route, w, `rolagem horizontal de ${r.overflow}px`);
    if (r.h1 !== 1) report(route, w, `${r.h1} elementos <h1>`);
    if (r.noAlt.length) report(route, w, `imagens sem alt: ${r.noAlt.join(', ')}`);
    if (r.blank.length) report(route, w, `target=_blank sem noopener: ${r.blank.join(', ')}`);
    if (r.dupIds.length) report(route, w, `ids duplicados: ${r.dupIds.join(', ')}`);
    if (r.small.length) report(route, w, `alvos de toque < 24px: ${r.small.join(', ')}`);
    if (errors.length && !(route.includes('nao-existe') && errors.every((e) => e.includes('404')))) report(route, w, `erros de console: ${errors.join(' | ')}`);

    if (axeSrc && (w === 390 || w === 1366)) {
      await page.addScriptTag({ content: axeSrc });
      const res = await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] } })).violations.map((v) => `${v.impact} · ${v.id} (${v.nodes.length}): ${v.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' ; ')}`));
      res.forEach((v) => report(route, w, `axe ${v}`));
    }
    await page.close();
  }
}
await browser.close();

console.log(`\nQA: ${pages.length} páginas × ${WIDTHS.length} larguras = ${pages.length * WIDTHS.length} verificações`);
if (problems.length) {
  console.log(`✖ ${problems.length} problema(s):\n` + problems.join('\n'));
  process.exit(1);
}
console.log('✔ Nenhum problema encontrado.');

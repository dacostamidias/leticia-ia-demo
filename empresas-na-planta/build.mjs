// Build estático sem dependências.
// src/pages/**.html  →  dist/<rota>/index.html
// Cada página começa com um bloco <!--meta { ...json... } --> e é envolvida por src/partials/layout.html.
// Sintaxe de template (propositalmente mínima):
//   {{> nome}}           inclui src/partials/nome.html (recursivo)
//   {{chave.sub}}        valor de site.config.mjs ou do meta da página
//   {{active:chave}}     vira aria-current="page" quando meta.nav === chave
import { readFile, writeFile, mkdir, readdir, rm, cp, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { site } from './site.config.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(ROOT, 'src');
const DIST = path.join(ROOT, 'dist');

const CSS_ORDER = ['tokens.css', 'base.css', 'components.css', 'sections.css', 'pages.css'];

async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else out.push(p);
  }
  return out;
}

const hash = (s) => createHash('sha256').update(s).digest('hex').slice(0, 10);

function minifyCss(css) {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*([{}:;,>])\s*/g, '$1')
    .replace(/;}/g, '}')
    .trim();
}

function get(obj, key) {
  return key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

const partialCache = new Map();
async function partial(name) {
  if (!partialCache.has(name)) {
    partialCache.set(name, await readFile(path.join(SRC, 'partials', `${name}.html`), 'utf8'));
  }
  return partialCache.get(name);
}

async function render(tpl, ctx, depth = 0) {
  if (depth > 10) throw new Error('Inclusão recursiva de partials');
  // includes
  const incs = [...tpl.matchAll(/\{\{>\s*([\w-]+)\s*\}\}/g)];
  for (const m of incs) {
    tpl = tpl.replace(m[0], await render(await partial(m[1]), ctx, depth + 1));
  }
  tpl = tpl.replace(/\{\{active:([\w-]+)\}\}/g, (_, k) => (ctx.page.nav === k ? 'aria-current="page"' : ''));
  tpl = tpl.replace(/\{\{([\w.]+)\}\}/g, (m, k) => {
    const v = get(ctx, k);
    if (v === undefined) throw new Error(`Variável de template não definida: ${k} (${ctx.page.route})`);
    return String(v);
  });
  return tpl;
}

function routeFor(file) {
  const rel = path.relative(path.join(SRC, 'pages'), file).replace(/\\/g, '/').replace(/\.html$/, '');
  if (rel === 'index') return '/';
  if (rel === '404') return '/404.html';
  return `/${rel.replace(/\/index$/, '')}/`;
}

function outFor(route) {
  if (route === '/') return path.join(DIST, 'index.html');
  if (route.endsWith('.html')) return path.join(DIST, route);
  return path.join(DIST, route, 'index.html');
}

const brl = (n) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

async function main() {
  await rm(DIST, { recursive: true, force: true });
  await mkdir(DIST, { recursive: true });

  // Assets estáticos
  await cp(path.join(SRC, 'assets', 'img'), path.join(DIST, 'assets', 'img'), { recursive: true });
  await cp(path.join(SRC, 'assets', 'fonts'), path.join(DIST, 'assets', 'fonts'), { recursive: true });
  await cp(path.join(SRC, 'static'), DIST, { recursive: true });

  // CSS e JS com hash no nome (cache imutável)
  let css = '';
  for (const f of CSS_ORDER) css += `${await readFile(path.join(SRC, 'assets', 'css', f), 'utf8')}\n`;
  css = minifyCss(css);
  const cssName = `site.${hash(css)}.css`;
  await mkdir(path.join(DIST, 'assets', 'css'), { recursive: true });
  await writeFile(path.join(DIST, 'assets', 'css', cssName), css);

  const js = await readFile(path.join(SRC, 'assets', 'js', 'site.js'), 'utf8');
  const jsName = `site.${hash(js)}.js`;
  await mkdir(path.join(DIST, 'assets', 'js'), { recursive: true });
  await writeFile(path.join(DIST, 'assets', 'js', jsName), js);

  const o = site.oferta;
  const derived = {
    investimentoMinimo: brl(o.precoAcao * o.loteMinimo).replace(',00', ''),
    precoAcao: brl(o.precoAcao),
    parcelaMinima: brl((o.precoAcao * o.loteMinimo) / o.parcelasMax),
    bonificacaoPct: `${Math.round(o.bonificacaoMensal * 100)}%`,
  };

  const layout = await readFile(path.join(SRC, 'partials', 'layout.html'), 'utf8');
  const pages = (await walk(path.join(SRC, 'pages'))).filter((f) => f.endsWith('.html'));
  const sitemap = [];

  for (const file of pages) {
    const raw = await readFile(file, 'utf8');
    const m = raw.match(/^<!--meta\s*([\s\S]*?)-->\s*/);
    if (!m) throw new Error(`Página sem bloco meta: ${file}`);
    const meta = JSON.parse(m[1]);
    const route = routeFor(file);
    const page = {
      nav: '',
      noindex: false,
      bodyClass: '',
      ogImage: `${site.url}/assets/img/og.jpg`,
      ...meta,
      route,
      canonical: `${site.url}${route === '/404.html' ? '/' : route}`,
    };
    if (!page.title || !page.description) throw new Error(`title/description obrigatórios: ${file}`);
    if (page.description.length > 165) console.warn(`⚠ description longa (${page.description.length}) em ${route}`);

    const jsonld = [...(page.jsonld || [])];
    if (route !== '/' && route !== '/404.html') {
      jsonld.push({
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Início', item: `${site.url}/` },
          ...(page.breadcrumb || []).map((b, i) => ({ '@type': 'ListItem', position: i + 2, name: b.name, item: `${site.url}${b.path}` })),
          { '@type': 'ListItem', position: (page.breadcrumb || []).length + 2, name: page.h1 || page.title, item: page.canonical },
        ],
      });
    }

    const ctx = {
      site,
      page: {
        ...page,
        robots: page.noindex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large',
        jsonld: jsonld.map((j) => `<script type="application/ld+json">${JSON.stringify(j)}</script>`).join('\n'),
      },
      asset: { css: `/assets/css/${cssName}`, js: `/assets/js/${jsName}` },
      d: derived,
    };
    const body = await render(raw.slice(m[0].length), ctx);
    if (page.faqSchema) {
      // Gera FAQPage JSON-LD a partir do próprio HTML renderizado — sem texto duplicado para manter.
      const strip = (h) => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      const qa = [...body.matchAll(/<details class="faq-item"[\s\S]*?<span class="q">([\s\S]*?)<\/span>[\s\S]*?<div class="answer">([\s\S]*?)<\/div>\s*<\/details>/g)];
      ctx.page.jsonld += `\n<script type="application/ld+json">${JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: qa.map(([, q, a]) => ({ '@type': 'Question', name: strip(q), acceptedAnswer: { '@type': 'Answer', text: strip(a) } })),
      })}</script>`;
    }
    const shell = await render(layout, { ...ctx, content: '<!--@@CONTENT@@-->' });
    const html = shell.replace('<!--@@CONTENT@@-->', () => body);
    const out = outFor(route);
    await mkdir(path.dirname(out), { recursive: true });
    await writeFile(out, html);
    if (!page.noindex && route !== '/404.html') sitemap.push({ route, priority: page.priority ?? 0.6 });
  }

  sitemap.sort((a, b) => b.priority - a.priority);
  const today = new Date().toISOString().slice(0, 10);
  await writeFile(
    path.join(DIST, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemap
      .map((s) => `  <url><loc>${site.url}${s.route}</loc><lastmod>${today}</lastmod><priority>${s.priority}</priority></url>`)
      .join('\n')}\n</urlset>\n`,
  );
  await writeFile(
    path.join(DIST, 'robots.txt'),
    `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /prototipo/\nDisallow: /design-system/\n\nSitemap: ${site.url}/sitemap.xml\n`,
  );

  // Verificação de links internos: o build falha se algum href/src local não existir.
  const htmlFiles = (await walk(DIST)).filter((f) => f.endsWith('.html'));
  const broken = [];
  for (const f of htmlFiles) {
    const html = await readFile(f, 'utf8');
    for (const [, url] of html.matchAll(/(?:href|src|srcset)="(\/[^"#?\s]*)/g)) {
      if (url.startsWith('/api/')) continue;
      let target = path.join(DIST, decodeURI(url));
      try {
        const s = await stat(target);
        if (s.isDirectory()) await stat(path.join(target, 'index.html'));
      } catch {
        broken.push(`${path.relative(DIST, f)} → ${url}`);
      }
    }
  }
  const uniq = [...new Set(broken)];
  if (uniq.length) {
    console.error(`✖ ${uniq.length} link(s) interno(s) quebrado(s):\n` + uniq.join('\n'));
    if (!process.argv.includes('--no-linkcheck')) process.exit(1);
  }
  console.log(`✔ ${pages.length} páginas · ${cssName} (${(css.length / 1024).toFixed(1)} kB) · ${jsName} (${(js.length / 1024).toFixed(1)} kB) · ${uniq.length} links quebrados`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

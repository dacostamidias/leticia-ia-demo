// Gera uma cópia de dist/ pronta para publicar como link de teste (artefato do Claude):
//  • todo caminho absoluto ("/x/") vira relativo à página ("../x/index.html");
//  • o CSS aponta as fontes com caminho relativo;
//  • as metas site-root/site-index/site-demo ativam o modo de demonstração nos scripts
//    (formulário não envia, download e impressão ficam desativados, com aviso);
//  • a home perde <html>/<head>/<body>, que a plataforma do artefato adiciona.
// Uso: node scripts/build-artifact.mjs <pasta-de-saída>
import { readFile, writeFile, mkdir, readdir, rm, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIST = path.join(ROOT, 'dist');
const OUT = path.resolve(process.argv[2] || path.join(ROOT, 'artifact'));
const PULAR = new Set(['.htaccess', '404.html', 'robots.txt', 'sitemap.xml']);

async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else out.push(p);
  }
  return out;
}

function relativo(valor, prefixo) {
  if (!valor.startsWith('/') || valor.startsWith('//')) return valor;
  const [caminho, frag = ''] = valor.split('#');
  let p = caminho.replace(/^\//, '');
  if (p === '' || p.endsWith('/')) p += 'index.html';
  return prefixo + p + (frag ? `#${frag}` : '');
}

await rm(OUT, { recursive: true, force: true });
const arquivos = [];
for (const f of await walk(DIST)) {
  const rel = path.relative(DIST, f).split(path.sep).join('/');
  if (PULAR.has(path.basename(rel))) continue;
  const destino = path.join(OUT, rel);
  await mkdir(path.dirname(destino), { recursive: true });

  if (rel.endsWith('.html')) {
    const prof = rel.split('/').length - 1;
    const prefixo = '../'.repeat(prof);
    let html = await readFile(f, 'utf8');
    html = html.replace(/\b(href|src|action)="([^"]*)"/g, (_, a, v) => `${a}="${relativo(v, prefixo)}"`);
    html = html.replace(/\bsrcset="([^"]*)"/g, (_, v) => `srcset="${v.split(',').map((x) => { const [u, d] = x.trim().split(/\s+/); return `${relativo(u, prefixo)}${d ? ` ${d}` : ''}`; }).join(', ')}"`);
    html = html
      .replace('<meta name="site-root" content="/">', `<meta name="site-root" content="${prefixo}">`)
      .replace('<meta name="site-index" content="">', '<meta name="site-index" content="index.html">')
      .replace('<meta name="site-demo" content="0">', '<meta name="site-demo" content="1">');
    if (rel === 'index.html') {
      // Página principal do artefato: a plataforma envolve o conteúdo num esqueleto próprio.
      html = html
        .replace(/<!doctype html>\s*/i, '')
        .replace(/<html[^>]*>\s*/i, '')
        .replace(/<\/?head>\s*/gi, '')
        .replace(/<body[^>]*>\s*/i, '')
        .replace(/<\/body>\s*<\/html>\s*$/i, '')
        .replace(/<title>[^<]*<\/title>/, '<title>Empresas na Planta</title>')
        .replace(/<meta charset="utf-8">\s*/i, '')
        .replace(/<meta name="viewport"[^>]*>\s*/i, '');
      html = html.replace('<title>Empresas na Planta</title>', '').replace(/^/, '<title>Empresas na Planta</title>\n');
    }
    await writeFile(destino, html);
  } else if (rel.endsWith('.css')) {
    const css = (await readFile(f, 'utf8')).replace(/url\((['"]?)\/assets\/fonts\//g, 'url($1../fonts/');
    await writeFile(destino, css);
  } else {
    await copyFile(f, destino);
  }
  arquivos.push(rel);
}
await writeFile(path.join(OUT, 'arquivos.json'), JSON.stringify(arquivos.filter((a) => a !== 'index.html'), null, 2));
console.log(`✔ ${arquivos.length} arquivos em ${OUT}`);

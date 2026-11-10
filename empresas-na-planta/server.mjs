// Servidor de pré-visualização local (sem dependências).
// Serve dist/ com os mesmos cabeçalhos de segurança e cache do .htaccess de produção.
// O endpoint /api/contato.php é SIMULADO aqui apenas para testar os estados do formulário;
// em produção ele continua sendo o PHP existente no servidor LiteSpeed.
import { createServer } from 'node:http';
import { gzipSync } from 'node:zlib';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST = path.join(path.dirname(fileURLToPath(import.meta.url)), 'dist');
const PORT = Number(process.env.PORT || 4173);

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
};

const SECURITY = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; form-action 'self' https://ia.empresasnaplanta.com.br; frame-ancestors 'none'; base-uri 'self'; object-src 'none'",
};

async function contatoMock(req, res) {
  let body = '';
  for await (const chunk of req) { body += chunk; if (body.length > 20_000) break; }
  let data = {};
  try { data = JSON.parse(body); } catch { /* corpo inválido */ }
  const send = (code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json', ...SECURITY }); res.end(JSON.stringify(obj)); };
  if (req.method !== 'POST') return send(405, { erro: 'Método não permitido.' });
  if (data.site) return send(200, { ok: true }); // honeypot preenchido: descarta em silêncio
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(data.email || '')) return send(422, { erro: 'Informe um e-mail válido.' });
  if ((data.mensagem || '').trim().length < 5) return send(422, { erro: 'Escreva uma mensagem um pouco maior.' });
  if ((data.mensagem || '').includes('#erro')) return send(500, { erro: 'Não foi possível enviar agora. Tente de novo em instantes.' });
  return send(200, { ok: true });
}

createServer(async (req, res) => {
  let url;
  let file;
  try {
    // Barras repetidas ("//") e escapes inválidos não podem derrubar o servidor.
    url = new URL(req.url.replace(/^\/+/, '/'), 'http://localhost');
    file = path.join(DIST, decodeURIComponent(url.pathname));
  } catch {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8', ...SECURITY });
    return res.end('Requisição inválida');
  }
  if (url.pathname === '/api/contato.php') return contatoMock(req, res);
  if (!file.startsWith(DIST)) { res.writeHead(400); return res.end(); }
  try {
    const s = await stat(file);
    if (s.isDirectory()) {
      if (!url.pathname.endsWith('/')) { res.writeHead(301, { Location: `${url.pathname}/` }); return res.end(); }
      file = path.join(file, 'index.html');
    }
    const ext = path.extname(file);
    const cache = /\.(css|js)$/.test(ext) ? 'public, max-age=31536000, immutable' : ext === '.html' ? 'no-cache' : 'public, max-age=2592000';
    let body = await readFile(file);
    const headers = { 'Content-Type': TYPES[ext] || 'application/octet-stream', 'Cache-Control': cache, Vary: 'Accept-Encoding', ...SECURITY };
    // Compressão equivalente ao mod_deflate de produção
    if (/\.(html|css|js|json|xml|svg|webmanifest|txt)$/.test(ext) && /gzip/.test(req.headers['accept-encoding'] || '')) {
      body = gzipSync(body);
      headers['Content-Encoding'] = 'gzip';
    }
    res.writeHead(200, headers);
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': TYPES['.html'], ...SECURITY });
    res.end(await readFile(path.join(DIST, '404.html')));
  }
}).listen(PORT, () => console.log(`Pré-visualização em http://localhost:${PORT}`));

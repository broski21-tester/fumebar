/** Dependency-free local server. Run: node tools/serve.js */
const http = require('http');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', 'public');
const MIME = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.ico':'image/x-icon','.webp':'image/webp','.woff2':'font/woff2'};
function handler(req, res) {
  let pathname;
  try { pathname = decodeURIComponent(req.url.split('?')[0]); } catch (_) { res.writeHead(400); return res.end('Invalid path'); }
  if (!['GET','HEAD'].includes(req.method)) { res.writeHead(405, {'Allow':'GET, HEAD'}); return res.end('Method not allowed'); }
  if (['/admin','/admin.html','/index.html/admin','/index.html/admin/'].includes(pathname)) { res.writeHead(302, {'Location':'/admin/'}); return res.end(); }
  if (pathname === '/') pathname = '/index.html';
  if (pathname === '/admin/') pathname = '/admin/index.html';
  const file = path.resolve(ROOT, '.' + pathname);
  if (!file.startsWith(ROOT + path.sep)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(file, (error, bytes) => {
    if (error) { res.writeHead(404, {'Content-Type':'text/plain'}); return res.end('Not found'); }
    res.writeHead(200, {'Content-Type':MIME[path.extname(file)] || 'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
    res.end(req.method === 'HEAD' ? undefined : bytes);
  });
}
if (require.main === module) http.createServer(handler).listen(process.env.PORT || 8080, () => console.log('Fume menu: http://localhost:' + (process.env.PORT || 8080) + ' | Admin: /admin/'));
module.exports = {handler};

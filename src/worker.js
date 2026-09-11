/** Cloudflare Worker: static guest/admin pages and optional Apps Script proxy. */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      if (!['GET','POST','HEAD'].includes(request.method)) return json({ok:false,error:'Method not allowed'},405);
      if (!env.MENU_API_URL) return json({ok:false,error:'MENU_API_URL is not configured.'},501);
      try {
        const target = new URL(env.MENU_API_URL);
        url.searchParams.forEach((value,key) => target.searchParams.set(key,value));
        const init = {method:request.method,headers:{'Content-Type':'text/plain;charset=utf-8'},redirect:'follow'};
        if (request.method === 'POST') init.body = await request.text();
        const upstream = await fetch(target.href,init);
        return new Response(await upstream.text(),{status:upstream.status,headers:{'Content-Type':'application/json;charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
      } catch (_) { return json({ok:false,error:'The menu service is temporarily unavailable.'},502); }
    }
    if (['/admin','/admin.html','/index.html/admin','/index.html/admin/'].includes(url.pathname)) {
      url.pathname = '/admin/'; return Response.redirect(url.href,302);
    }
    if (url.pathname === '/') url.pathname = '/index.html';
    if (url.pathname === '/admin/') url.pathname = '/admin/index.html';
    return env.ASSETS.fetch(new Request(url.href,request));
  }
};
function json(body,status) {
  return new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json;charset=utf-8','Cache-Control':'no-store'}});
}

/** Static guest/admin pages. Database calls go directly to Supabase. */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (['/admin','/admin.html','/index.html/admin','/index.html/admin/'].includes(url.pathname)) {
      url.pathname = '/admin/'; return Response.redirect(url.href,302);
    }
    if (url.pathname === '/') url.pathname = '/index.html';
    if (url.pathname === '/admin/') url.pathname = '/admin/index.html';
    return env.ASSETS.fetch(new Request(url.href,request));
  }
};

/* Shared menu data and safe rendering helpers. No credentials are persisted. */
(function () {
  'use strict';
  const config = window.FUME_CONFIG || {};
  const script = document.currentScript;
  const base = new URL('.', script ? script.src : location.href);
  const api = config.API_URL ? new URL(config.API_URL, base).href : '';
  const cacheKey = 'fume-menu-v3:' + api + ':' + (config.MENU_NAME || 'Fume Menu');
  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
  const storage = {
    get(key) { try { return localStorage.getItem(key); } catch (_) { return null; } },
    set(key, value) { try { localStorage.setItem(key, value); } catch (_) {} },
    remove(key) { try { localStorage.removeItem(key); } catch (_) {} }
  };
  async function request(url, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.REQUEST_TIMEOUT_MS || 12000);
    try {
      const res = await fetch(url, Object.assign({}, options, {signal: controller.signal, cache: 'no-store'}));
      if (!res.ok) throw new Error('The menu service returned HTTP ' + res.status + '.');
      let data;
      try { data = await res.json(); } catch (_) { throw new Error('The menu service returned an invalid response. Check the web app deployment.'); }
      if (!data || data.ok === false) throw new Error(data && data.error || 'The request could not be completed.');
      return data;
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('The request timed out. Please try again.');
      throw error;
    } finally { clearTimeout(timer); }
  }
  function validate(data) {
    if (!data || !data.menu || !Array.isArray(data.menu.sections)) throw new Error('Menu data is incomplete.');
    return data;
  }
  function cacheRead() {
    if (!config.CACHE_MINUTES) return null;
    try {
      const cached = JSON.parse(storage.get(cacheKey));
      if (!cached || Date.now() - cached.ts > config.CACHE_MINUTES * 60000) return null;
      return validate(cached.data);
    } catch (_) { return null; }
  }
  async function menu() {
    let data;
    if (api) {
      const url = new URL(api);
      url.searchParams.set('action', 'menu');
      url.searchParams.set('menu', config.MENU_NAME || 'Fume Menu');
      data = validate(await request(url.href));
    } else data = validate(await request(new URL(config.FALLBACK_URL || 'data/menu.json', base).href));
    if (config.CACHE_MINUTES) storage.set(cacheKey, JSON.stringify({ts: Date.now(), data}));
    return data;
  }
  async function post(action, payload, password) {
    if (!api) throw new Error('Connect your Google Apps Script URL in config.js to use the admin page.');
    return request(api, {
      method: 'POST', headers: {'Content-Type': 'text/plain;charset=utf-8'},
      body: JSON.stringify(Object.assign({}, payload, {action, menu: config.MENU_NAME || 'Fume Menu', password}))
    });
  }
  function money(value, currency = 'USD') {
    if (value === '' || value == null || !Number.isFinite(Number(value))) return '';
    const amount = Number(value).toFixed(2);
    return currency === 'USD' ? '$' + amount : amount + ' ' + currency;
  }
  function safeUrl(value) {
    if (!value) return '';
    try { const url = new URL(value, base); return /^https?:$/.test(url.protocol) ? url.href : ''; } catch (_) { return ''; }
  }
  function logo(value) {
    return safeUrl(value) || new URL('img/logo.jpg', base).href;
  }
  function applyLogo(img, value) {
    img.onerror = () => { img.onerror = null; img.src = new URL('img/logo.jpg', base).href; };
    img.src = logo(value);
  }
  function flat(data) {
    const rows = [];
    (data.menu.sections || []).forEach(section => {
      (section.items || []).forEach(item => rows.push(Object.assign({}, item, {section: section.name, sectionAr: section.nameAr || '', category: '.', categoryAr: ''})));
      (section.categories || []).forEach(category => (category.items || []).forEach(item => rows.push(Object.assign({}, item, {
        section: section.name, sectionAr: section.nameAr || '', category: category.name, categoryAr: category.nameAr || ''
      }))));
    });
    return rows;
  }
  window.Fume = {config, base, api, esc, storage, request, validate, cacheRead, menu, post, money, safeUrl, applyLogo, flat,
    clearCache() { storage.remove(cacheKey); }};
})();

/* Supabase REST and Auth client. Session tokens stay in page memory. */
(function () {
  'use strict';
  const config = window.FUME_CONFIG || {};
  const base = new URL('.', document.currentScript ? document.currentScript.src : location.href);
  const api = String(config.SUPABASE_URL || '').trim().replace(/\/$/, '');
  const publicKey = String(config.SUPABASE_PUBLISHABLE_KEY || '').trim();
  const menuName = config.MENU_NAME || 'Fume Menu';
  const cacheKey = 'fume-menu-supabase-v1:' + api + ':' + menuName;
  let session = null, refreshPromise = null;
  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
  const storage = {
    get(key) { try { return localStorage.getItem(key); } catch (_) { return null; } },
    set(key, value) { try { localStorage.setItem(key, value); } catch (_) {} },
    remove(key) { try { localStorage.removeItem(key); } catch (_) {} }
  };
  function requireConfig() {
    if (!api || !publicKey) throw new Error('Add your Supabase project URL and publishable key to public/config.js, then redeploy the website.');
    if (!/^https:\/\/[^/]+$/.test(api)) throw new Error('SUPABASE_URL must be the HTTPS project URL, without /rest/v1 or another path.');
    let secret = publicKey.startsWith('sb_secret_');
    if (publicKey.startsWith('eyJ')) {
      try { const part = publicKey.split('.')[1]; secret = secret || JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/'))).role === 'service_role'; } catch (_) {}
    }
    if (secret) throw new Error('Use the Supabase publishable or legacy anon key. Remove the private secret/service_role key from this website and rotate it in Supabase.');
  }
  async function request(url, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.REQUEST_TIMEOUT_MS || 15000);
    try {
      const response = await fetch(url, Object.assign({}, options, {signal:controller.signal, cache:'no-store'}));
      if (response.status === 204) return null;
      let result;
      try { result = await response.json(); } catch (_) { throw new Error('The server returned an invalid response. Check your Supabase project URL.'); }
      if (!response.ok) {
        const error = new Error(result.message || result.error_description || result.msg || result.error || 'Request failed: HTTP ' + response.status);
        error.status = response.status; throw error;
      }
      return result;
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('The request timed out. Check your connection and try again.');
      throw error;
    } finally { clearTimeout(timer); }
  }
  function headers(token) {
    const h = {apikey:publicKey, 'Content-Type':'application/json'};
    if (token) h.Authorization = 'Bearer ' + token;
    else if (publicKey.startsWith('eyJ')) h.Authorization = 'Bearer ' + publicKey;
    return h;
  }
  function acceptSession(result) {
    if (!result || !result.access_token || !result.refresh_token || !result.user || !result.user.id) throw new Error('Sign-in returned an invalid session.');
    session = {accessToken:result.access_token, refreshToken:result.refresh_token, user:result.user,
      expiresAt:Date.now() + (Number(result.expires_in) || 3600) * 1000};
  }
  async function freshToken() {
    if (!session) throw new Error('Please sign in again.');
    if (session.expiresAt > Date.now() + 30000) return session.accessToken;
    if (!refreshPromise) refreshPromise = (async () => {
      try {
        const result = await request(api + '/auth/v1/token?grant_type=refresh_token', {method:'POST', headers:headers(), body:JSON.stringify({refresh_token:session.refreshToken})});
        acceptSession(result); return session.accessToken;
      } catch (error) {
        session = null;
        window.dispatchEvent(new CustomEvent('fume-session-expired'));
        throw new Error('Your session expired. Please sign in again.');
      } finally { refreshPromise = null; }
    })();
    return refreshPromise;
  }
  async function rest(resource, params = {}, options = {}, authenticated = false) {
    requireConfig();
    const url = new URL(api + '/rest/v1/' + resource);
    Object.entries(params).forEach(([key,value]) => url.searchParams.set(key,value));
    const token = authenticated ? await freshToken() : null;
    return request(url.href, Object.assign({}, options, {headers:Object.assign(headers(token), options.headers || {})}));
  }
  async function signIn(email, password) {
    requireConfig(); session = null;
    const result = await request(api + '/auth/v1/token?grant_type=password', {
      method:'POST', headers:headers(), body:JSON.stringify({email:email.trim(),password})
    });
    acceptSession(result);
    try {
      const admins = await rest('menu_admins', {user_id:'eq.'+session.user.id,select:'user_id'}, {}, true);
      if (!Array.isArray(admins) || admins.length !== 1) throw new Error('This account has no menu admin access. Add its user ID to menu_admins using setup.md.');
    } catch (error) { await signOut(); throw error; }
  }
  async function signOut() {
    const old = session; session = null;
    if (old) { try { await request(api + '/auth/v1/logout?scope=local', {method:'POST',headers:headers(old.accessToken)}); } catch (_) {} }
  }
  function validate(data) {
    if (!data || !data.menu || !Array.isArray(data.menu.sections)) throw new Error('Menu data is incomplete.');
    return data;
  }
  function cacheRead() {
    if (!config.CACHE_MINUTES) return null;
    try { const cached = JSON.parse(storage.get(cacheKey)); return cached && Date.now()-cached.ts <= config.CACHE_MINUTES*60000 ? validate(cached.data) : null; } catch (_) { return null; }
  }
  function buildMenu(rows, settings) {
    const restaurant = {};
    const keys = {name:'name',tagline_en:'tagline',tagline_ar:'taglineAr',currency:'currency',phone:'phone',address:'address',address_ar:'addressAr',instagram:'instagram',facebook:'facebook',logoUrl:'logoUrl'};
    settings.forEach(row => { if (Object.hasOwn(keys,row.key)) restaurant[keys[row.key]] = row.value || ''; });
    const sections = [], index = new Map();
    rows.forEach(row => {
      const name = row.section || 'Menu';
      if (!index.has(name)) { const section={name,nameAr:row.section_ar || '',items:[],categories:[]};index.set(name,section);sections.push(section); }
      const section = index.get(name), item={id:row.id,nameEn:row.name_en,nameAr:row.name_ar || '',desc:row.desc_en || '',descAr:row.desc_ar || '',
        price:row.price,priceSmall:row.price_small,priceMedium:row.price_medium,priceLarge:row.price_large,sort:row.sort,calories:row.calories,available:row.available,category:row.category || '.'};
      if (!section.nameAr) section.nameAr = row.section_ar || '';
      if (!row.category || row.category === '.') section.items.push(item);
      else {
        let category=section.categories.find(c=>c.name===row.category);
        if (!category) { category={name:row.category,nameAr:row.category_ar || '',items:[]};section.categories.push(category); }
        if (!category.nameAr) category.nameAr = row.category_ar || '';
        category.items.push(item);
      }
    });
    return {restaurant,menu:{title:menuName,sections}};
  }
  async function loadDatabase(authenticated = false) {
    const settingsPromise = rest('restaurant_settings', {select:'key,value'});
    const rowsPromise = (async () => {
      const rows=[];
      for (let offset=0;;offset+=500) {
        const params={select:'*',menu:'eq.'+menuName,order:'sort.asc.nullslast,id.asc',limit:500,offset};
        if (!authenticated) params.available='eq.true';
        const batch=await rest('menu_items',params,{},authenticated);
        if (!Array.isArray(batch)) throw new Error('Invalid menu data. Run supabase/schema.sql first.');
        rows.push(...batch);if(batch.length<500) return rows;
      }
    })();
    const [rows,settings]=await Promise.all([rowsPromise,settingsPromise]);
    return validate(buildMenu(rows,settings));
  }
  async function menu() {
    requireConfig();
    const data=await loadDatabase(false);
    if(config.CACHE_MINUTES) storage.set(cacheKey,JSON.stringify({ts:Date.now(),data}));
    return data;
  }
  const fieldMap={nameEn:'name_en',nameAr:'name_ar',desc:'desc_en',descAr:'desc_ar',price:'price',priceSmall:'price_small',priceMedium:'price_medium',priceLarge:'price_large',sort:'sort',calories:'calories',available:'available',section:'section',category:'category',sectionAr:'section_ar',categoryAr:'category_ar'};
  function fieldsToRow(fields) {
    const row={};
    Object.entries(fields || {}).forEach(([key,value])=>{
      if(!Object.hasOwn(fieldMap,key) || value === undefined) return;
      row[fieldMap[key]]=['price','priceSmall','priceMedium','priceLarge','sort','calories'].includes(key) && value === '' ? null : value;
    });return row;
  }
  async function post(action,payload = {}) {
    if(!session) throw new Error('Please sign in to manage the menu.');
    if(action==='adminMenu') return loadDatabase(true);
    const body=Object.assign({},payload);
    if(action==='addItem') { body.fields=fieldsToRow(payload); }
    if(action==='updateItem') body.fields=fieldsToRow(payload.fields);
    return rest('rpc/manage_menu',{}, {method:'POST',body:JSON.stringify({action,menu_name:menuName,payload:body})},true);
  }
  function normalizeName(value) { return String(value || '').normalize('NFKD').replace(/[\u0300-\u036f\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06ed\u0640]/g,'').toLowerCase().trim().replace(/\s+/g,' '); }
  function matchesName(item,query) { const term=normalizeName(query);return !term || [item.nameEn,item.nameAr].some(name=>normalizeName(name).includes(term)); }
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
  window.Fume = {config,base,api,esc,storage,request,validate,cacheRead,menu,post,money,safeUrl,applyLogo,flat,signIn,signOut,matchesName,buildMenu,fieldsToRow,requireConfig,
    clearCache() { storage.remove(cacheKey); }};
})();

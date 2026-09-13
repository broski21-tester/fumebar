/* Guest menu. Editing and credentials live only on the separate admin page. */
(function () {
  'use strict';
  const F = window.Fume, $ = id => document.getElementById(id), e = F.esc;
  let lang = F.storage.get('fume-lang') === 'ar' ? 'ar' : 'en';
  let data = null, observer = null, loadNumber = 0, stale = false, query = '';
  const t = (en, ar) => lang === 'ar' ? (ar || en) : en;
  function translate() {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    $('langEn').setAttribute('aria-pressed', String(lang === 'en'));
    $('langAr').setAttribute('aria-pressed', String(lang === 'ar'));
    $('skipLink').textContent = t('Skip to menu', 'انتقل إلى القائمة');
    $('navLabel').textContent = t('Explore the menu', 'تصفح القائمة');
    $('menuTitle').textContent = t('The menu', 'قائمة الطعام');
    $('loadingText').textContent = t('Preparing your menu…', 'جارٍ تحميل القائمة…');
    $('errorTitle').textContent = t('The menu is taking a moment', 'تعذّر تحميل القائمة');
    $('errorDetail').textContent = t('Please ask your waiter for the menu, or try again in a moment.', 'يرجى التحقق من اتصالك وإعادة المحاولة.');
    $('btnRetry').textContent = t('Try again', 'حاول مجدداً');
    $('emptyText').textContent = query.trim() ? t('No items match this name. Try another name or clear your search.', 'لا توجد أصناف بهذا الاسم. جرّب اسماً آخر أو امسح البحث.') : t('The menu is being updated. Please check back shortly.', 'يتم تحديث القائمة. يرجى المحاولة لاحقاً.');
    $('searchLabel').textContent = t('Find a dish', 'ابحث عن طبق');
    $('menuSearch').placeholder = t('Search item names…', 'ابحث بأسماء الأصناف…');
    $('clearSearch').textContent = t('Clear', 'مسح');
    $('clearSearch').hidden = !query;

    $('menuNotice').hidden = !stale;
    $('menuNotice').textContent = t('Showing the last saved menu. Please confirm availability and prices with your waiter.', 'نعرض آخر قائمة محفوظة. يرجى تأكيد التوفر والأسعار مع النادل.');
  }
  function itemHtml(item, currency) {
    if (item.available === false) return '';
    const name = t(item.nameEn, item.nameAr);
    // The English view never renders the Arabic name underneath an item.
    const description = lang === 'ar' ? (item.descAr || item.desc || '') : (item.desc || '');
    const descriptionLang = lang === 'ar' && item.descAr ? 'ar' : 'en';
    const sizes = [['priceSmall', t('Small', 'صغير')], ['priceMedium', t('Medium', 'وسط')], ['priceLarge', t('Large', 'كبير')]]
      .filter(([key]) => item[key] != null && item[key] !== '');
    return '<li class="menu-item"><div class="item-line"><h4 class="item-name" dir="auto">' + e(name) + '</h4>' +
      (F.money(item.price, currency) ? '<span class="item-price" dir="ltr">' + e(F.money(item.price, currency)) + '</span>' : '') + '</div>' +
      (description ? '<p class="item-desc" lang="' + descriptionLang + '" dir="auto">' + e(description).replace(/ \| /g, ' · ') + '</p>' : '') +
      (sizes.length ? '<div class="item-sizes">' + sizes.map(([key, label]) => '<span>' + e(label) + ' <b dir="ltr">' + e(F.money(item[key], currency)) + '</b></span>').join('') + '</div>' : '') + '</li>';
  }
  function render() {
    translate();
    if (!data) return;
    const rest = data.restaurant || {}, currency = rest.currency || 'USD';
    document.title = (rest.name || 'Fume Bar') + ' | ' + t('Menu', 'قائمة الطعام');
    $('heroName').textContent = rest.name || 'Fume Bar';
    F.applyLogo($('heroLogo'), rest.logoUrl);
    $('heroTagline').textContent = t(rest.tagline || 'Restaurant · Lounge · Sushi', rest.taglineAr);
    $('heroMeta').textContent = t(rest.address || '', rest.addressAr);
    $('currencyNote').textContent = t('Prices in ', 'الأسعار بـ ') + currency;
    const sections = data.menu.sections.map(section => Object.assign({}, section, {
      items: (section.items || []).filter(i => i.available !== false && F.matchesName(i, query)),
      categories: (section.categories || []).map(c => Object.assign({}, c, {items: (c.items || []).filter(i => i.available !== false && F.matchesName(i, query))})).filter(c => c.items.length)
    })).filter(s => s.items.length || s.categories.length);
    $('catnav').innerHTML = sections.map((section, i) => '<a class="cat-link" href="#section-' + i + '"' + (i === 0 ? ' aria-current="location"' : '') + '><span>' + e(t(section.name, section.nameAr)) + '</span><span class="nav-number" aria-hidden="true">' + String(i + 1).padStart(2, '0') + '</span></a>').join('');
    $('menuSections').innerHTML = sections.map((section, i) => {
      const count = section.items.length + section.categories.reduce((n, c) => n + c.items.length, 0);
      return '<section class="menu-section" id="section-' + i + '" aria-labelledby="title-' + i + '"><div class="section-heading"><h3 id="title-' + i + '">' + e(t(section.name, section.nameAr)) + '</h3><span class="section-count">' + count + ' ' + t('items', 'أصناف') + '</span></div>' +
        (section.items.length ? '<ul class="items">' + section.items.map(it => itemHtml(it, currency)).join('') + '</ul>' : '') +
        section.categories.map(cat => '<div class="menu-category"><h4 class="category-title">' + e(t(cat.name, cat.nameAr)) + '</h4><ul class="items">' + cat.items.map(it => itemHtml(it, currency)).join('') + '</ul></div>').join('') + '</section>';
    }).join('');
    const resultCount = sections.reduce((n, section) => n + section.items.length + section.categories.reduce((total, c) => total + c.items.length, 0), 0);
    $('searchResults').hidden = !query.trim();
    $('searchResults').textContent = t(resultCount + (resultCount === 1 ? ' item found' : ' items found'), 'عدد الأصناف: ' + resultCount);
    $('stateEmpty').hidden = sections.length !== 0;
    $('stateLoading').hidden = true;
    $('stateError').hidden = true;
    const links = [];
    const phone = String(rest.phone || '').replace(/[^\d+]/g, '');
    if (phone) links.push('<a dir="ltr" href="tel:' + e(phone) + '">' + e(rest.phone) + '</a>');
    ['instagram', 'facebook'].forEach(key => { const url = F.safeUrl(rest[key]); if (url) links.push('<a href="' + e(url) + '" target="_blank" rel="noopener noreferrer">' + t(key === 'instagram' ? 'Instagram' : 'Facebook', key === 'instagram' ? 'إنستغرام' : 'فيسبوك') + '</a>'); });
    $('footerLinks').innerHTML = links.join('');
    $('footerNote').textContent = '© ' + new Date().getFullYear() + ' ' + (rest.name || 'Fume Bar') + ' · ' + t('All prices in ' + currency + ', inclusive of VAT.', 'جميع الأسعار بـ ' + currency + ' وتشمل ضريبة القيمة المضافة.');
    if (observer) observer.disconnect();
    if ('IntersectionObserver' in window) {
      observer = new IntersectionObserver(entries => {
        entries.forEach(entry => { if (entry.isIntersecting) activate('#' + entry.target.id); });
      }, {rootMargin: '-18% 0px -62% 0px'});
      document.querySelectorAll('.menu-section').forEach(section => observer.observe(section));
    }
  }
  function activate(hash) {
    document.querySelectorAll('.cat-link').forEach(link => {
      if (link.getAttribute('href') === hash) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  }
  async function load() {
    const current = ++loadNumber;
    if (!data) { $('stateLoading').hidden = false; $('stateError').hidden = true; }
    try {
      const fresh = await F.menu();
      if (current !== loadNumber) return;
      data = fresh; stale = false; render();
    } catch (_) {
      if (current !== loadNumber) return;
      let fallback = data || F.cacheRead();
      if (current !== loadNumber) return;
      data = fallback;
      stale = !!data;
      if (data) render();
      else { $('stateLoading').hidden = true; $('stateError').hidden = false; }
    }
  }
  ['en', 'ar'].forEach(value => $('lang' + (value === 'en' ? 'En' : 'Ar')).addEventListener('click', () => {
    if (lang === value) return;
    lang = value; F.storage.set('fume-lang', value); render();
  }));
  $('catnav').addEventListener('click', event => { const link = event.target.closest('a'); if (link) activate(link.getAttribute('href')); });
  function search() { query = $('menuSearch').value; render(); }
  $('menuSearch').addEventListener('input', search);
  $('menuSearch').addEventListener('search', search);
  $('clearSearch').addEventListener('click', () => { $('menuSearch').value = ''; query = ''; render(); $('menuSearch').focus(); });
  $('btnRetry').addEventListener('click', load);
  window.addEventListener('storage', event => { if (event.key && event.key.startsWith('fume-menu-supabase-v1:') && !event.newValue) load(); });
  window.addEventListener('focus', load);
  translate();
  data = F.cacheRead();
  if (data) { stale = true; render(); }
  load();
})();

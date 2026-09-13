(function () {
  'use strict';
  const F = window.Fume, $ = id => document.getElementById(id), e = F.esc;
  let data = null, selected = '', busy = false, epoch = 0, returnFocus = null;
  // Remove credentials left by the previous inline editor.
  try { sessionStorage.removeItem('fume-admin-pw'); } catch (_) {}
  const dialog = $('editor');
  const post = (action, payload = {}) => F.post(action, payload);
  function status(message, error = false) {
    $('adminStatus').hidden = !message;
    $('adminStatus').textContent = message;
    $('adminStatus').className = error ? 'error-message' : 'notice';
  }
  function lock(value) {
    busy = value;
    $('workspace').querySelectorAll('button, select').forEach(el => el.disabled = value);
    $('logout').disabled = value;
    if (!value && !data && !$('workspace').hidden) {
      $('addItem').disabled = true;
      $('sectionFilter').disabled = true;
    }
    if (dialog.open) dialog.querySelectorAll('button, fieldset').forEach(el => el.disabled = value);
  }
  function showLogin() {
    epoch++;
    data = null; selected = '';
    F.clearCache();
    $('adminItems').innerHTML = '';
    $('workspace').hidden = true;
    $('logout').hidden = true;
    $('loginPanel').hidden = false;
    $('password').value = '';
    if (dialog.open) dialog.close();
    lock(false);
    $('password').focus();
  }
  async function reload(message = '') {
    const current = epoch;
    $('adminLoading').hidden = false;
    $('adminItems').hidden = true;
    lock(true);
    try {
      const next = F.validate(await post('adminMenu'));
      if (current !== epoch) return;
      data = next;
      render();
      status(message);
    } catch (err) {
      if (current !== epoch) return;
      status((message ? message + ' ' : '') + 'Could not refresh the editor: ' + err.message + ' Use Refresh before making another change.', true);
      $('addItem').disabled = true;
      data = null;
    } finally {
      if (current === epoch) {
        $('adminLoading').hidden = true;
        lock(false);
        if (!data) {
          $('addItem').disabled = true;
          $('sectionFilter').disabled = true;
          $('renameSection').hidden = true;
          $('deleteSection').hidden = true;
        }
      }
    }
  }
  function render() {
    const sections = data.menu.sections || [], rows = F.flat(data), currency = (data.restaurant || {}).currency || 'USD';
    if (!sections.some(s => s.name === selected)) selected = '';
    $('totalCount').textContent = rows.length;
    $('visibleCount').textContent = rows.filter(i => i.available !== false).length;
    $('hiddenCount').textContent = rows.filter(i => i.available === false).length;
    $('sectionFilter').innerHTML = '<option value="">All sections</option>' + sections.map(s => '<option value="' + e(s.name) + '">' + e(s.name) + '</option>').join('');
    $('sectionFilter').value = selected;
    $('renameSection').hidden = !selected;
    $('deleteSection').hidden = !selected;
    $('sectionsList').innerHTML = sections.map(s => '<option value="' + e(s.name) + '"></option>').join('');
    $('categoriesList').innerHTML = [...new Set(rows.map(i => i.category).filter(c => c !== '.'))].map(c => '<option value="' + e(c) + '"></option>').join('');
    const groups = [];
    sections.filter(s => !selected || s.name === selected).forEach(section => {
      if ((section.items || []).length) groups.push({section, category: null, items: section.items});
      (section.categories || []).forEach(category => groups.push({section, category, items: category.items || []}));
    });
    $('adminItems').hidden = false;
    $('adminItems').innerHTML = groups.length ? groups.map(group => {
      const title = e(group.section.name) + (group.category ? ' <span>/ ' + e(group.category.name) + '</span>' : '');
      return '<section class="admin-group" data-section="' + e(group.section.name) + '" data-category="' + e(group.category ? group.category.name : '.') + '"><div class="group-header"><h2>' + title + '</h2><div class="group-actions"><button type="button" class="btn-text" data-action="add">Add item</button>' +
        (group.category ? '<button type="button" class="btn-text" data-action="rename-category">Rename</button><button type="button" class="btn-text danger" data-action="delete-category">Delete category</button>' : '') +
        '</div></div><div class="table-wrap"><table class="menu-table"><thead><tr><th scope="col">Item</th><th scope="col">Price</th><th scope="col">Visibility</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead><tbody>' +
        group.items.map(item => {
          const sizes = [['Small', item.priceSmall], ['Medium', item.priceMedium], ['Large', item.priceLarge]].filter(s => F.money(s[1], currency));
          return '<tr><td><div class="table-name">' + e(item.nameEn) + '</div><div class="table-meta">' + (item.sort != null ? 'Order ' + e(item.sort) : '') + '</div></td><td class="table-price">' + e(F.money(item.price, currency)) + (sizes.length ? '<div class="table-meta">' + sizes.map(s => e(s[0]) + ' ' + e(F.money(s[1], currency))).join('<br>') + '</div>' : '') + '</td><td><span class="visibility' + (item.available === false ? ' hidden-item' : '') + '">' + (item.available === false ? 'Hidden' : 'Visible') + '</span></td><td><button type="button" class="btn-secondary edit-button" data-edit="' + e(item.id) + '" aria-label="Edit ' + e(item.nameEn) + '">Edit</button></td></tr>';
        }).join('') + '</tbody></table></div></section>';
    }).join('') : '<div class="state"><h2>Your menu is ready for its first item.</h2><p>Choose Add item to create an item and its section.</p></div>';
  }
  function field(name, label, value = '', options = {}) {
    const attrs = ' id="edit-' + name + '" name="' + name + '"' + (options.required ? ' required' : '') + (options.ar ? ' lang="ar" dir="rtl"' : '') + (options.list ? ' list="' + options.list + '"' : '');
    return '<div class="field"><label for="edit-' + name + '">' + e(label) + '</label>' + (options.textarea ? '<textarea' + attrs + ' rows="2">' + e(value) + '</textarea>' : '<input' + attrs + ' type="' + (options.number ? 'number' : 'text') + '"' + (options.number ? ' min="0" step="' + (options.integer ? '1' : '0.01') + '"' : ' maxlength="500"') + ' value="' + e(value) + '">') + '</div>';
  }
  function open(title, subtitle, content, submitText, submit, remove) {
    if (!dialog.open) returnFocus = document.activeElement;
    $('dialogBody').innerHTML = '<div class="dialog-heading"><h2 id="dialogTitle">' + e(title) + '</h2><button type="button" class="btn-text" data-close aria-label="Close dialog">Close</button></div><p class="dialog-copy">' + e(subtitle) + '</p><fieldset class="editor-fields">' + content + '</fieldset><p class="error-message" id="dialogError" role="alert" hidden></p><div class="dialog-actions">' + (remove ? '<button type="button" class="btn-text danger delete-item" id="deleteItem">Delete item</button>' : '') + '<button type="button" class="btn-secondary" data-close>Cancel</button><button type="submit" class="btn-primary" id="dialogSubmit">' + e(submitText) + '</button></div>';
    $('editorForm').onsubmit = async event => {
      event.preventDefault();
      if (busy) return;
      lock(true); $('dialogError').hidden = true; $('dialogSubmit').textContent = 'Saving…';
      try {
        // Disabled fieldsets are excluded from FormData; read controls directly.
        const fields = {};
        $('editorForm').querySelectorAll('[name]').forEach(input => fields[input.name] = input.type === 'checkbox' ? input.checked : input.value);
        await submit(fields);
        F.clearCache();
        dialog.close();
        await reload('Changes saved. Your guest menu has been updated.');
      } catch (err) {
        $('dialogError').hidden = false; $('dialogError').textContent = err.message;
      } finally { lock(false); if ($('dialogSubmit')) $('dialogSubmit').textContent = submitText; }
    };
    $('dialogBody').querySelectorAll('[data-close]').forEach(btn => btn.addEventListener('click', () => { if (!busy) dialog.close(); }));
    if (remove) $('deleteItem').onclick = remove;
    if (!dialog.open) dialog.showModal();
    const first = $('dialogBody').querySelector('input, textarea');
    if (first) first.focus();
  }
  function numericFields(fields) {
    ['price', 'priceSmall', 'priceMedium', 'priceLarge', 'sort', 'calories'].forEach(key => fields[key] = fields[key] === '' ? '' : Number(fields[key]));
    return fields;
  }
  function edit(item, section = '', category = '.') {
    const isNew = !item;
    item = item || {section, category, available: true};
    const currency = (data.restaurant || {}).currency || 'USD';
    const form = '<div class="field-row">' + field('nameEn', 'Name in English', item.nameEn, {required: true}) + field('nameAr', 'Name in Arabic', item.nameAr, {ar: true}) + '</div>' +
      field('desc', 'Description in English', item.desc, {textarea: true}) + field('descAr', 'Description in Arabic (optional)', item.descAr, {textarea: true, ar: true}) +
      '<p class="dialog-section-title">Pricing · ' + e(currency) + '</p><div class="field-row">' + field('price', 'Standard price', item.price, {number: true}) + field('sort', 'Sort order', item.sort, {number: true, integer: true}) + '</div><div class="field-row three">' +
      field('priceSmall', 'Small price', item.priceSmall, {number: true}) + field('priceMedium', 'Medium price', item.priceMedium, {number: true}) + field('priceLarge', 'Large price', item.priceLarge, {number: true}) + '</div>' +
      '<p class="dialog-section-title">Organisation</p><div class="field-row">' + field('section', 'Section', item.section, {required: true, list: 'sectionsList'}) + field('category', 'Category (optional)', item.category === '.' ? '' : item.category, {list: 'categoriesList'}) + '</div><div class="field-row">' +
      field('sectionAr', 'Section in Arabic', item.sectionAr, {ar: true}) + field('categoryAr', 'Category in Arabic', item.categoryAr, {ar: true}) + '</div>' +
      field('calories', 'Calories (optional)', item.calories, {number: true, integer: true}) +
      '<label class="field-check"><input type="checkbox" name="available"' + (item.available !== false ? ' checked' : '') + '>Visible on the guest menu</label>';
    open(isNew ? 'Add a menu item' : 'Edit menu item', 'Changes save to your menu. Leave unused prices blank.', form, isNew ? 'Add item' : 'Save changes', fields => {
      numericFields(fields);
      fields.category = fields.category.trim() || '.';
      return isNew ? post('addItem', fields) : post('updateItem', {id: item.id, fields});
    }, isNew ? null : () => confirmDelete('Delete “' + item.nameEn + '”?', 'This permanently removes the item from your menu.', () => post('deleteItem', {id: item.id})));
    function fillGroupNames() {
      const section = data.menu.sections.find(s => s.name === $('edit-section').value.trim());
      const category = section && (section.categories || []).find(c => c.name === $('edit-category').value.trim());
      $('edit-sectionAr').value = section ? section.nameAr || '' : '';
      $('edit-categoryAr').value = category ? category.nameAr || '' : '';
    }
    $('edit-section').onchange = fillGroupNames;
    $('edit-category').onchange = fillGroupNames;
    if (isNew) fillGroupNames();
  }
  function confirmDelete(title, subtitle, action) {
    open(title, subtitle, '', 'Delete', action);
    $('dialogSubmit').classList.add('danger');
    $('dialogBody').querySelector('.dialog-actions [data-close]').focus();
  }
  function groupAction(kind, sectionName, categoryName, deleting) {
    const section = data.menu.sections.find(s => s.name === sectionName);
    if (!section) return;
    const group = kind === 'section' ? section : (section.categories || []).find(c => c.name === categoryName);
    if (!group) return;
    const payload = kind === 'section' ? {section: sectionName} : {category: categoryName, scopeSection: sectionName};
    if (deleting) {
      confirmDelete('Delete “' + group.name + '”?', 'This permanently removes all items in this ' + kind + ', including hidden items.', () => post(kind === 'section' ? 'deleteSection' : 'deleteCategory', payload));
    } else {
      open('Rename ' + kind, 'Updates the name for every item in this group.', field('name', 'Name in English', group.name, {required: true}) + field('nameAr', 'Name in Arabic', group.nameAr, {ar: true}), 'Save name', fields => post(kind === 'section' ? 'renameSection' : 'renameCategory', Object.assign({}, payload, fields)));
    }
  }
  $('loginForm').addEventListener('submit', async event => {
    event.preventDefault();
    $('loginSubmit').disabled = true; $('loginSubmit').textContent = 'Signing in…'; $('loginError').hidden = true;
    try {
      await F.signIn($('email').value, $('password').value);
      data = F.validate(await post('adminMenu'));
      epoch++;
      $('password').value = '';
      $('loginPanel').hidden = true; $('workspace').hidden = false; $('logout').hidden = false;
      render(); status(''); $('workspaceTitle').focus();
    } catch (err) {
      data = null; await F.signOut();
      $('loginError').textContent = err.message;
      $('loginError').hidden = false;
    } finally { $('loginSubmit').disabled = false; $('loginSubmit').textContent = 'Sign in'; }
  });
  $('logout').onclick = () => { F.signOut(); showLogin(); };
  window.addEventListener('fume-session-expired', () => { showLogin(); $('loginError').textContent = 'Your session expired. Please sign in again.'; $('loginError').hidden = false; });
  $('reload').onclick = () => reload();
  $('addItem').onclick = () => { if (data && !busy) edit(null, selected); };
  $('sectionFilter').onchange = () => { selected = $('sectionFilter').value; render(); };
  $('renameSection').onclick = () => groupAction('section', selected, '', false);
  $('deleteSection').onclick = () => groupAction('section', selected, '', true);
  $('adminItems').onclick = event => {
    if (busy || !data) return;
    const editButton = event.target.closest('[data-edit]');
    if (editButton) { const item = F.flat(data).find(it => it.id === editButton.dataset.edit); if (item) edit(item); return; }
    const button = event.target.closest('[data-action]'), group = button && button.closest('[data-section]');
    if (!group) return;
    if (button.dataset.action === 'add') edit(null, group.dataset.section, group.dataset.category);
    else groupAction('category', group.dataset.section, group.dataset.category, button.dataset.action === 'delete-category');
  };
  dialog.addEventListener('cancel', event => { if (busy) event.preventDefault(); });
  dialog.addEventListener('close', () => { if (returnFocus && returnFocus.isConnected) returnFocus.focus(); });
  dialog.addEventListener('click', event => { if (event.target === dialog && !busy) { const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close(); } });
  if (!F.api || !F.config.SUPABASE_PUBLISHABLE_KEY) { $('setupNotice').hidden = false; $('loginSubmit').disabled = true; $('password').disabled = true; }
})();

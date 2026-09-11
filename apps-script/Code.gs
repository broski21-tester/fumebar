/** Fume menu API v3. Public GET menu; authenticated POST admin actions. */
var SHEET_MENU = 'Menu';
var SHEET_ORDERS = 'Orders';
var SHEET_SETTINGS = 'Settings';
var DEFAULT_MENU = 'Fume Menu';
var MENU_HEADER_NAMES = ['id', 'sort', 'menu', 'section', 'section_ar', 'category', 'category_ar',
  'name_en', 'name_ar', 'desc_en', 'price', 'price_small', 'price_medium', 'price_large',
  'calories', 'available', 'desc_ar'];
var ITEM_FIELD_MAP = {nameEn:'name_en', nameAr:'name_ar', desc:'desc_en', descAr:'desc_ar',
  price:'price', priceSmall:'price_small', priceMedium:'price_medium', priceLarge:'price_large',
  available:'available', section:'section', category:'category', sectionAr:'section_ar',
  categoryAr:'category_ar', sort:'sort', calories:'calories'};

function doGet(e) {
  try {
    var params = e && e.parameter || {};
    var action = String(params.action || 'menu').toLowerCase();
    if (action === 'health') return jsonOut_({ok:true, service:'fume-menu-api', version:3, time:new Date().toISOString()});
    if (action === 'menu') return jsonOut_(buildMenuPayload_(params.menu || DEFAULT_MENU, false), params.pretty === '1');
    return jsonOut_({ok:false, error:'Unknown action: ' + action});
  } catch (err) { return jsonOut_({ok:false, error:err.message || String(err)}); }
}
function doPost(e) {
  var lock;
  try {
    var body = JSON.parse(e && e.postData && e.postData.contents || '{}');
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Invalid request.');
    var action = body.action || 'order';
    if (action === 'order') return handleOrder_(body);
    var auth = requireAdmin_(body.password);
    if (!auth.ok) return jsonOut_(auth);
    if (action === 'auth') return jsonOut_({ok:true, admin:true, version:3});
    lock = LockService.getScriptLock();
    if (!lock.tryLock(10000)) throw new Error('Another menu change is in progress. Please try again.');
    if (action === 'adminMenu') return jsonOut_(buildMenuPayload_(body.menu || DEFAULT_MENU, true));
    if (action === 'addItem') return adminAddItem_(body);
    if (action === 'updateItem') return adminUpdateItem_(body);
    if (action === 'deleteItem') return adminDeleteItem_(body);
    if (action === 'renameSection') return adminRename_(body, 'section');
    if (action === 'renameCategory') return adminRename_(body, 'category');
    if (action === 'deleteSection') return adminDeleteGroup_(body, 'section');
    if (action === 'deleteCategory') return adminDeleteGroup_(body, 'category');
    return jsonOut_({ok:false, error:'Unknown action: ' + action});
  } catch (err) { return jsonOut_({ok:false, error:err.message || String(err)}); }
  finally { if (lock && lock.hasLock()) { SpreadsheetApp.flush(); lock.releaseLock(); } }
}
function jsonOut_(obj, pretty) {
  return ContentService.createTextOutput(JSON.stringify(obj, null, pretty ? 2 : 0)).setMimeType(ContentService.MimeType.JSON);
}
function numOrNull_(v) {
  if (v === '' || v == null) return null;
  var n = Number(v);
  return isFinite(n) ? n : null;
}
function available_(v) { return v !== false && String(v).trim().toUpperCase() !== 'FALSE'; }
function rowMenuMatches_(row, idx, name) {
  return String(row[idx] || DEFAULT_MENU).trim().toLowerCase() === String(name || DEFAULT_MENU).trim().toLowerCase();
}
function buildMenuPayload_(menuName, includeHidden) {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), sheet = ss.getSheetByName(SHEET_MENU);
  if (!sheet) throw new Error('Menu sheet missing. Run setupWorkbook() first.');
  var values = sheet.getDataRange().getValues();
  var header = values[0].map(function (h) { return String(h).trim().toLowerCase(); }), idx = {};
  MENU_HEADER_NAMES.forEach(function (key) { idx[key] = header.indexOf(key); });
  ['menu','section','name_en','price'].forEach(function (key) { if (idx[key] < 0) throw new Error('Missing menu columns. Run upgradeWorkbook().'); });
  var rows = values.slice(1).map(function (row, order) { return {row:row, order:order}; });
  rows.sort(function (a, b) {
    var av = idx.sort < 0 ? null : numOrNull_(a.row[idx.sort]), bv = idx.sort < 0 ? null : numOrNull_(b.row[idx.sort]);
    return (av == null ? Infinity : av) - (bv == null ? Infinity : bv) || a.order - b.order;
  });
  var sections = [], sectionIndex = Object.create(null);
  rows.forEach(function (entry) {
    var row = entry.row;
    if (!rowMenuMatches_(row, idx.menu, menuName)) return;
    var available = idx.available < 0 || available_(row[idx.available]);
    if (!includeHidden && !available) return;
    function str(key) { return idx[key] < 0 ? '' : String(row[idx[key]] == null ? '' : row[idx[key]]).trim(); }
    function num(key) { return idx[key] < 0 ? null : numOrNull_(row[idx[key]]); }
    var name = str('name_en');
    if (!name) return;
    var item = {id:str('id'), nameEn:name, nameAr:str('name_ar'), desc:str('desc_en'), descAr:str('desc_ar'),
      price:num('price'), priceSmall:num('price_small'), priceMedium:num('price_medium'), priceLarge:num('price_large'),
      calories:num('calories'), sort:num('sort'), available:available, category:str('category') || '.'};
    if (includeHidden && !item.id) throw new Error('Some items have no ID. Run upgradeWorkbook() in Apps Script.');
    var nameSection = str('section') || 'Menu';
    if (!sectionIndex[nameSection]) {
      sectionIndex[nameSection] = {name:nameSection, nameAr:str('section_ar'), items:[], categories:[]};
      sections.push(sectionIndex[nameSection]);
    }
    var section = sectionIndex[nameSection];
    if (!section.nameAr) section.nameAr = str('section_ar');
    if (item.category === '.') section.items.push(item);
    else {
      var category = section.categories.filter(function (c) { return c.name === item.category; })[0];
      if (!category) { category = {name:item.category, nameAr:str('category_ar'), items:[]}; section.categories.push(category); }
      if (!category.nameAr) category.nameAr = str('category_ar');
      category.items.push(item);
    }
  });
  return {ok:true, version:3, restaurant:readSettings_(ss), menu:{title:menuName, sections:sections}};
}
function readSettings_(ss) {
  var defaults = typeof SEED_RESTAURANT !== 'undefined' ? SEED_RESTAURANT : {};
  var settings = {name:defaults.name || 'fume bar', tagline:defaults.tagline_en || '', taglineAr:defaults.tagline_ar || '',
    currency:defaults.currency || 'USD', phone:defaults.phone || '', address:defaults.address || '', addressAr:defaults.address_ar || '',
    instagram:defaults.instagram || '', facebook:defaults.facebook || '', logoUrl:defaults.logoUrl || ''};
  var map = {name:'name', tagline_en:'tagline', tagline_ar:'taglineAr', currency:'currency', phone:'phone', address:'address', address_ar:'addressAr', instagram:'instagram', facebook:'facebook', logoUrl:'logoUrl'};
  var sheet = ss.getSheetByName(SHEET_SETTINGS);
  if (sheet && sheet.getLastRow() > 1) sheet.getRange(2,1,sheet.getLastRow()-1,2).getValues().forEach(function (row) {
    var key = String(row[0] || '').trim();
    if (Object.prototype.hasOwnProperty.call(map,key)) settings[map[key]] = String(row[1] == null ? '' : row[1]);
  });
  return settings;
}
function requireAdmin_(password) {
  var expected = '', sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_SETTINGS);
  if (sheet && sheet.getLastRow() > 1) {
    sheet.getRange(2,1,sheet.getLastRow()-1,2).getValues().some(function (row) {
      if (String(row[0]).trim().toLowerCase() !== 'adminpassword') return false;
      expected = String(row[1] == null ? '' : row[1]); return true;
    });
  }
  if (!expected) return {ok:false, error:'Set adminPassword in the Settings sheet before signing in.'};
  if (typeof password !== 'string' || password !== expected) return {ok:false, error:'Incorrect admin password.'};
  return {ok:true};
}
function menuSheetCols_(ss) {
  var sheet = ss.getSheetByName(SHEET_MENU);
  if (!sheet) throw new Error('Menu sheet missing.');
  var lastCol = sheet.getLastColumn(), header = sheet.getRange(1,1,1,lastCol).getValues()[0].map(function (h) { return String(h).trim().toLowerCase(); }), cols = {};
  MENU_HEADER_NAMES.forEach(function (name) {
    cols[name] = header.indexOf(name) + 1;
    if (!cols[name]) throw new Error('Run upgradeWorkbook() to add the required ' + name + ' column.');
  });
  return {sheet:sheet, header:header, cols:cols, lastCol:lastCol};
}
function findRowById_(ms, id, menuName) {
  if (typeof id !== 'string' || !id.trim()) throw new Error('A valid item ID is required.');
  var values = ms.sheet.getDataRange().getValues(), found = -1;
  for (var r=1; r<values.length; r++) {
    if (String(values[r][ms.cols.id-1]).trim() !== id.trim() || !rowMenuMatches_(values[r],ms.cols.menu-1,menuName)) continue;
    if (found !== -1) throw new Error('Duplicate item IDs. Run upgradeWorkbook() first.');
    found = r+1;
  }
  if (found < 0) throw new Error('This item no longer exists. Refresh the menu.');
  return found;
}
function sheetText_(value) {
  var text = String(value == null ? '' : value).trim();
  // Store user text literally so names and descriptions cannot become formulas.
  return /^[=+@-]/.test(text) ? "'" + text : text;
}
function validateFields_(fields) {
  var clean = {};
  Object.keys(fields).forEach(function (key) {
    if (!Object.prototype.hasOwnProperty.call(ITEM_FIELD_MAP,key)) return;
    var value = fields[key];
    if (['price','priceSmall','priceMedium','priceLarge','sort','calories'].indexOf(key) >= 0) {
      if (value === '' || value == null) clean[key] = '';
      else {
        if (typeof value === 'boolean' || typeof value === 'object') throw new Error('Invalid ' + key + '.');
        var n = Number(value);
        if (!isFinite(n) || n < 0 || (['sort','calories'].indexOf(key) >= 0 && Math.floor(n) !== n)) throw new Error(key + ' must be a valid non-negative number.');
        clean[key] = n;
      }
    } else if (key === 'available') {
      if (typeof value !== 'boolean') throw new Error('Availability must be true or false.');
      clean[key] = value;
    } else {
      if (typeof value !== 'string') throw new Error('Invalid text for ' + key + '.');
      value = value.trim();
      if ((key === 'nameEn' || key === 'section') && !value) throw new Error('Section and English name are required.');
      if (value.length > (key === 'desc' || key === 'descAr' ? 5000 : 500)) throw new Error(key + ' is too long.');
      clean[key] = key === 'category' ? (value || '.') : value;
    }
  });
  return clean;
}
function cellValue_(value) { return typeof value === 'string' ? sheetText_(value) : value; }
function syncGroupNames_(ms, fields, menuName) {
  var values = ms.sheet.getDataRange().getValues();
  for (var r=1; r<values.length; r++) {
    var row = values[r];
    if (!rowMenuMatches_(row,ms.cols.menu-1,menuName) || String(row[ms.cols.section-1]).trim() !== fields.section) continue;
    if (fields.sectionAr !== undefined) ms.sheet.getRange(r+1,ms.cols.section_ar).setValue(sheetText_(fields.sectionAr));
    if (fields.categoryAr !== undefined && String(row[ms.cols.category-1] || '.').trim() === fields.category) ms.sheet.getRange(r+1,ms.cols.category_ar).setValue(sheetText_(fields.categoryAr));
  }
}
function adminUpdateItem_(body) {
  var ms = menuSheetCols_(SpreadsheetApp.getActiveSpreadsheet()), rowNum = findRowById_(ms,body.id,body.menu);
  if (!body.fields || typeof body.fields !== 'object' || Array.isArray(body.fields)) throw new Error('Missing item fields.');
  var fields = validateFields_(body.fields), keys = Object.keys(fields);
  // Validate the complete patch before changing any cells. Only touched columns are written.
  keys.forEach(function (key) { ms.sheet.getRange(rowNum,ms.cols[ITEM_FIELD_MAP[key]]).setValue(cellValue_(fields[key])); });
  if (fields.section) syncGroupNames_(ms,fields,body.menu);
  return jsonOut_({ok:true, id:body.id, updated:keys.length});
}
function adminAddItem_(body) {
  var fields = validateFields_(body);
  if (!fields.section || !fields.nameEn) throw new Error('Section and English name are required.');
  fields.category = fields.category || '.';
  var ms = menuSheetCols_(SpreadsheetApp.getActiveSpreadsheet()), values = ms.sheet.getDataRange().getValues(), maxSort = 0;
  for (var r=1; r<values.length; r++) {
    var row = values[r];
    if (!rowMenuMatches_(row,ms.cols.menu-1,body.menu)) continue;
    maxSort = Math.max(maxSort,Number(row[ms.cols.sort-1]) || 0);
    if (String(row[ms.cols.section-1]).trim() === fields.section) {
      if (fields.sectionAr === undefined) fields.sectionAr = String(row[ms.cols.section_ar-1] || '');
      if (fields.categoryAr === undefined && String(row[ms.cols.category-1] || '.').trim() === fields.category) fields.categoryAr = String(row[ms.cols.category_ar-1] || '');
    }
  }
  if (fields.sort === undefined || fields.sort === '') fields.sort = maxSort+1;
  if (fields.available === undefined) fields.available = true;
  var newRow = Array(ms.lastCol).fill(''), id = 'i' + Utilities.getUuid();
  newRow[ms.cols.id-1] = id;
  newRow[ms.cols.menu-1] = sheetText_(body.menu || DEFAULT_MENU);
  Object.keys(fields).forEach(function (key) { newRow[ms.cols[ITEM_FIELD_MAP[key]]-1] = cellValue_(fields[key]); });
  ms.sheet.appendRow(newRow);
  syncGroupNames_(ms,fields,body.menu);
  return jsonOut_({ok:true, id:id});
}
function adminDeleteItem_(body) {
  var ms = menuSheetCols_(SpreadsheetApp.getActiveSpreadsheet());
  ms.sheet.deleteRow(findRowById_(ms,body.id,body.menu));
  return jsonOut_({ok:true});
}
function groupRows_(ms, body, kind) {
  var name = String(kind === 'section' ? body.section || '' : body.category || '').trim();
  if (!name) throw new Error('A group name is required.');
  if (kind === 'category' && !body.scopeSection) throw new Error('A section is required for category changes.');
  var values = ms.sheet.getDataRange().getValues(), rows = [];
  for (var r=1; r<values.length; r++) {
    if (!rowMenuMatches_(values[r],ms.cols.menu-1,body.menu)) continue;
    if (String(values[r][ms.cols[kind]-1] || '').trim() !== name) continue;
    if (kind === 'category' && String(values[r][ms.cols.section-1]).trim() !== String(body.scopeSection).trim()) continue;
    rows.push(r+1);
  }
  if (!rows.length) throw new Error('This group no longer exists. Refresh the menu.');
  return rows;
}
function adminRename_(body, kind) {
  var name = String(body.name || '').trim(), nameAr = String(body.nameAr || '').trim();
  if (!name || name.length > 500 || nameAr.length > 500 || (kind === 'category' && name === '.')) throw new Error('Enter a valid group name.');
  var ms = menuSheetCols_(SpreadsheetApp.getActiveSpreadsheet()), rows = groupRows_(ms,body,kind);
  var old = String(kind === 'section' ? body.section : body.category).trim();
  var collision = ms.sheet.getDataRange().getValues().slice(1).some(function (row) {
    return rowMenuMatches_(row,ms.cols.menu-1,body.menu) && String(row[ms.cols[kind]-1]).trim() === name && name !== old &&
      (kind === 'section' || String(row[ms.cols.section-1]).trim() === String(body.scopeSection).trim());
  });
  if (collision) throw new Error('A ' + kind + ' with that name already exists. Choose a different name.');
  rows.forEach(function (r) {
    ms.sheet.getRange(r,ms.cols[kind]).setValue(sheetText_(name));
    ms.sheet.getRange(r,ms.cols[kind+'_ar']).setValue(sheetText_(nameAr));
  });
  return jsonOut_({ok:true, changed:rows.length});
}
function adminDeleteGroup_(body, kind) {
  var ms = menuSheetCols_(SpreadsheetApp.getActiveSpreadsheet()), rows = groupRows_(ms,body,kind);
  rows.reverse().forEach(function (r) { ms.sheet.deleteRow(r); });
  return jsonOut_({ok:true, deleted:rows.length});
}
/* Existing optional order endpoint. These totals are guest-submitted, not payment records. */
function handleOrder_(body) {
  var items = body.items;
  if (!Array.isArray(items) || !items.length || items.length > 100) throw new Error('An order must contain 1 to 100 items.');
  var total = 0, summary = [];
  items.forEach(function (it) {
    if (!it || typeof it.name !== 'string' || !it.name.trim()) throw new Error('Each order item needs a name.');
    var qty = it.qty == null ? 1 : Number(it.qty), price = Number(it.price || 0);
    if (!isFinite(qty) || qty < 1 || qty > 100 || Math.floor(qty) !== qty || !isFinite(price) || price < 0) throw new Error('Invalid order quantity or price.');
    total += qty*price;
    summary.push(qty+'x '+it.name+(it.notes ? ' ('+String(it.notes)+')' : ''));
  });
  var ss = SpreadsheetApp.getActiveSpreadsheet(), sheet = ss.getSheetByName(SHEET_ORDERS) || setupOrdersSheet_(ss);
  var customer = body.customer || {}, id = 'F-' + Utilities.getUuid();
  sheet.appendRow([new Date(),id,sheetText_(body.table),sheetText_(body.room),sheetText_(customer.name),sheetText_(customer.phone),
    sheetText_(customer.notes),sheetText_(summary.join(' | ')),Math.round(total*100)/100,sheetText_(body.menu || DEFAULT_MENU),'NEW']);
  return jsonOut_({ok:true,orderId:id,total:Math.round(total*100)/100});
}

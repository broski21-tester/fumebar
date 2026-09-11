/** Safe setup and upgrade. Existing rows, extra columns and settings are preserved. */
var MENU_HEADERS = MENU_HEADER_NAMES;
var ORDER_HEADERS = ['timestamp','order_id','table','room','customer_name','customer_phone','customer_notes','items','total','menu','status'];
var SETTINGS_HEADERS = ['key','value'];
function setupWorkbook() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = setupMenuSheet_(ss);
  setupOrdersSheet_(ss);
  setupSettingsSheet_(ss);
  if (sheet.getLastRow() < 2) importSeedData();
  upgradeWorkbook();
  SpreadsheetApp.getActive().toast('Menu and settings preserved. Publish a new web app version when ready.', 'Setup complete', 10);
}
function ensureHeaders_(ss, name, required) {
  var sheet = ss.getSheetByName(name) || ss.insertSheet(name);
  var headers = sheet.getLastRow() ? sheet.getRange(1,1,1,Math.max(sheet.getLastColumn(),1)).getValues()[0] : [];
  if (headers.length === 1 && !headers[0]) headers = [];
  var lower = headers.map(function (h) { return String(h).trim().toLowerCase(); });
  required.forEach(function (key) { if (lower.indexOf(key) < 0) { headers.push(key); lower.push(key); } });
  if (sheet.getMaxColumns() < headers.length) sheet.insertColumnsAfter(sheet.getMaxColumns(),headers.length-sheet.getMaxColumns());
  sheet.getRange(1,1,1,headers.length).setValues([headers]).setFontWeight('bold').setBackground('#181a1b').setFontColor('#f2eee5');
  sheet.setFrozenRows(1);
  return sheet;
}
function setupMenuSheet_(ss) { return ensureHeaders_(ss,SHEET_MENU,MENU_HEADER_NAMES); }
function setupOrdersSheet_(ss) { return ensureHeaders_(ss,SHEET_ORDERS,ORDER_HEADERS); }
function setupSettingsSheet_(ss) {
  var sheet = ensureHeaders_(ss,SHEET_SETTINGS,SETTINGS_HEADERS);
  var defaults = typeof SEED_RESTAURANT !== 'undefined' ? SEED_RESTAURANT : {};
  var known = sheet.getLastRow() > 1 ? sheet.getRange(2,1,sheet.getLastRow()-1,2).getValues().map(function (r) { return String(r[0]).trim().toLowerCase(); }) : [];
  ['name','tagline_en','tagline_ar','currency','phone','address','address_ar','instagram','facebook','logoUrl','adminPassword'].forEach(function (key) {
    if (known.indexOf(key.toLowerCase()) < 0) sheet.appendRow([key,key === 'adminPassword' ? '' : (defaults[key] || '')]);
  });
  return sheet;
}
/** Run this when updating an existing installation. It does not reseed your menu. */
function upgradeWorkbook() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  setupMenuSheet_(ss); setupSettingsSheet_(ss);
  var ms = menuSheetCols_(ss), values = ms.sheet.getDataRange().getValues(), seen = Object.create(null);
  for (var r=1; r<values.length; r++) {
    if (!String(values[r][ms.cols.name_en-1] || '').trim()) continue;
    var id = String(values[r][ms.cols.id-1] || '').trim();
    if (!id || seen[id]) { id = 'i' + Utilities.getUuid(); ms.sheet.getRange(r+1,ms.cols.id).setValue(id); }
    seen[id] = true;
  }
  ['price','price_small','price_medium','price_large'].forEach(function (key) {
    if (values.length > 1) ms.sheet.getRange(2,ms.cols[key],values.length-1,1).setNumberFormat('0.00');
  });
  SpreadsheetApp.getActive().toast('Existing items preserved. Columns and item IDs are ready.', 'Upgrade complete', 8);
}
/** Imports only into an empty Menu sheet. Refuses to overwrite existing menu rows. */
function importSeedData() {
  if (typeof SEED_ROWS === 'undefined') throw new Error('Add SeedData.gs first.');
  var ss = SpreadsheetApp.getActiveSpreadsheet(); setupMenuSheet_(ss);
  var ms = menuSheetCols_(ss);
  if (ms.sheet.getLastRow() > 1) throw new Error('Menu already contains rows. Import stopped to preserve your edits.');
  var rows = SEED_ROWS.map(function (r) {
    var data = {id:r[0],sort:r[1],menu:r[2],section:r[3],section_ar:r[10],category:r[4],category_ar:r[11],name_en:r[5],name_ar:r[6],desc_en:r[7],price:r[8],available:!!r[9]};
    var row = Array(ms.lastCol).fill('');
    Object.keys(data).forEach(function (key) { row[ms.cols[key]-1] = data[key] == null ? '' : data[key]; });
    return row;
  });
  if (rows.length) ms.sheet.getRange(2,1,rows.length,ms.lastCol).setValues(rows);
  return rows.length;
}
/** Explicit destructive utility, kept for compatibility. Never run during an upgrade. */
function resetMenuSheet() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_MENU);
  if (sheet && sheet.getLastRow() > 1) sheet.getRange(2,1,sheet.getLastRow()-1,sheet.getLastColumn()).clearContent();
}
function testBuildMenuPayload() {
  var payload = buildMenuPayload_(DEFAULT_MENU,false);
  Logger.log(JSON.stringify(payload,null,2).substring(0,3000));
}

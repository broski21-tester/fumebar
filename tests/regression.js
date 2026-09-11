/* Offline regression checks. No dependencies, browser, or live Google Sheet. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ROOT = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
let checks = 0;
function check(name, fn) { fn(); checks++; console.log('PASS ' + name); }
class Range {
  constructor(sheet, row, col, rows = 1, cols = 1) { Object.assign(this, {sheet,row,col,rows,cols}); }
  getValues() { return Array.from({length:this.rows},(_,r) => Array.from({length:this.cols},(_,c) => this.sheet.rows[this.row+r-1]?.[this.col+c-1] ?? '')); }
  setValues(values) { values.forEach((row,r) => row.forEach((value,c) => { while(this.sheet.rows.length<this.row+r) this.sheet.rows.push([]); this.sheet.rows[this.row+r-1][this.col+c-1]=value; })); return this; }
  setValue(value) { return this.setValues([[value]]); }
  clearContent() { return this.setValues(Array.from({length:this.rows},()=>Array(this.cols).fill(''))); }
  setFontWeight() { return this; } setBackground() { return this; } setFontColor() { return this; } setNumberFormat() { return this; }
}
class Sheet {
  constructor(rows = []) { this.rows = rows; this.maxCols = 26; }
  getLastRow() { let n=this.rows.length; while(n && this.rows[n-1].every(v=>v==='' || v==null)) n--; return n; }
  getLastColumn() { return Math.max(0,...this.rows.map(r=>r.length)); }
  getDataRange() { return this.getRange(1,1,Math.max(1,this.getLastRow()),Math.max(1,this.getLastColumn())); }
  getRange(...args) { return new Range(this,...args); }
  getMaxColumns() { return this.maxCols; }
  insertColumnsAfter(_, n) { this.maxCols+=n; }
  setFrozenRows() {}
  appendRow(row) { this.rows.splice(this.getLastRow(),0,Array.from(row)); }
  deleteRow(row) { this.rows.splice(row-1,1); }
}
let uuid=0, locked=false;
const sheets={};
const ss={getSheetByName:name=>sheets[name]||null,insertSheet:name=>(sheets[name]=new Sheet()),toast(){}};
const context=vm.createContext({console,SpreadsheetApp:{getActiveSpreadsheet:()=>ss,getActive:()=>ss,flush(){}},
  Utilities:{getUuid:()=> 'uuid-'+ ++uuid},LockService:{getScriptLock:()=>({tryLock(){locked=true;return true},hasLock:()=>locked,releaseLock(){locked=false}})},
  ContentService:{MimeType:{JSON:'json'},createTextOutput:body=>({body,setMimeType(){return this}})},Logger:{log(){}}});
for(const file of ['apps-script/Code.gs','apps-script/Setup.gs','apps-script/SeedData.gs']) vm.runInContext(read(file),context,{filename:file});
const headers=Array.from(context.MENU_HEADER_NAMES);
const row = values => headers.map(key=>values[key]??'');
function reset() {
  sheets.Menu=new Sheet([headers.slice(),row({id:'a',sort:20,menu:'Fume Menu',section:'Sushi',section_ar:'سوشي',category:'Rolls',category_ar:'رول',name_en:'Salmon roll',name_ar:'رول السلمون',price:12,available:true}),row({id:'b',sort:10,menu:'Fume Menu',section:'Sushi',section_ar:'سوشي',category:'Rolls',name_en:'Hidden roll',price:15,available:false}),row({id:'c',sort:2,menu:'Other Menu',section:'Sushi',category:'Rolls',name_en:'Other menu item',price:9,available:true})]);
  sheets.Settings=new Sheet([['key','value'],['name','Fume Bar'],['currency','USD'],['adminPassword','test-secret']]);
}
function post(action,payload={},password='test-secret') { return JSON.parse(context.doPost({postData:{contents:JSON.stringify({...payload,action,password,menu:payload.menu||'Fume Menu'})}}).body); }
function get() { return JSON.parse(context.doGet({parameter:{action:'menu'}}).body); }
reset();
check('Guest JSON excludes hidden items and admin credentials',()=>{
  const out=get();assert.equal(out.menu.sections[0].categories[0].items.length,1);assert(!JSON.stringify(out).includes('test-secret'));
});
check('All admin actions require the correct password',()=>{
  for(const action of ['auth','adminMenu','addItem','updateItem','deleteItem','renameSection','renameCategory','deleteSection','deleteCategory']) assert.equal(post(action,{},'wrong').ok,false);
  assert.equal(sheets.Menu.getLastRow(),4);assert.equal(post('auth').ok,true);
});
check('Admin sees hidden items sorted numerically with category metadata',()=>{
  const items=post('adminMenu').menu.sections[0].categories[0].items;
  assert.deepEqual(items.map(i=>i.id),['b','a']);assert.equal(items[0].available,false);assert.equal(items[0].category,'Rolls');assert.equal(items[0].sort,10);
});
check('Editing a category item preserves its group, size prices and zero price',()=>{
  assert.equal(post('updateItem',{id:'b',fields:{price:0,priceSmall:5,priceLarge:9,descAr:'وصف',available:true}}).ok,true);
  const items=get().menu.sections[0].categories[0].items;assert.equal(items.length,2);assert.equal(items[0].price,0);assert.equal(items[0].priceSmall,5);assert.equal(items[0].descAr,'وصف');
});
check('Invalid patches fail before any cell changes',()=>{
  const before=JSON.stringify(sheets.Menu.rows);
  assert.equal(post('updateItem',{id:'a',fields:{nameEn:'Changed',price:-3}}).ok,false);
  assert.equal(post('updateItem',{id:'a',fields:{available:'false'}}).ok,false);
  assert.equal(post('updateItem',{id:'a',fields:{sort:1.5}}).ok,false);
  assert.equal(JSON.stringify(sheets.Menu.rows),before);
});
check('Blank IDs and items from another menu cannot be edited',()=>{
  assert.equal(post('deleteItem',{id:''}).ok,false);assert.equal(post('updateItem',{id:'c',fields:{price:3}}).ok,false);
});
check('Group mutations stay inside their selected menu and section',()=>{
  assert.equal(post('renameCategory',{category:'Rolls',scopeSection:'Sushi',name:'Maki',nameAr:'ماكي'}).changed,2);
  assert.equal(sheets.Menu.rows[3][headers.indexOf('category')],'Rolls');
  assert.equal(post('deleteCategory',{category:'Maki'}).ok,false);
  assert.equal(post('deleteSection',{section:'Sushi'}).deleted,2);
  assert.equal(sheets.Menu.rows[1][headers.indexOf('id')],'c');assert.equal(get().menu.sections.length,0);
});
check('Add works on an empty menu with no standard price',()=>{
  const out=post('addItem',{section:'Breakfast',nameEn:'Coffee',price:'',priceSmall:3,available:false});assert.equal(out.ok,true);
  const item=post('adminMenu').menu.sections[0].items[0];assert.equal(item.price,null);assert.equal(item.priceSmall,3);assert.equal(item.available,false);
});
check('Text is stored literally rather than as a spreadsheet formula',()=>{
  assert.equal(post('addItem',{section:'Breakfast',nameEn:'=1+1',price:2}).ok,true);
  assert.equal(sheets.Menu.rows.at(-1)[headers.indexOf('name_en')],"'=1+1");
});
check('Upgrade preserves custom columns, reordered data and settings',()=>{
  sheets.Menu=new Sheet([['name_en','custom_note','menu','price','id'],['Saved item','Keep me','Fume Menu',7,'']]);
  const beforeSettings=JSON.stringify(sheets.Settings.rows);
  context.upgradeWorkbook();
  assert.equal(sheets.Menu.rows[1][0],'Saved item');assert.equal(sheets.Menu.rows[1][1],'Keep me');assert.equal(sheets.Menu.rows[1][3],7);assert(sheets.Menu.rows[1][4]);
  assert(sheets.Menu.rows[0].includes('desc_ar'));assert(sheets.Settings.rows.some(r=>r[0]==='adminPassword' && r[1]==='test-secret'));
  const existing=JSON.stringify(sheets.Menu.rows);context.setupWorkbook();assert.equal(JSON.stringify(sheets.Menu.rows),existing);
  assert.throws(()=>context.importSeedData(),/preserve/);assert.equal(JSON.stringify(sheets.Menu.rows),existing);
});
check('Fresh setup imports once and leaves the password unset',()=>{
  delete sheets.Menu;delete sheets.Settings;delete sheets.Orders;context.setupWorkbook();
  const count=sheets.Menu.getLastRow();assert.equal(count,107);context.setupWorkbook();assert.equal(sheets.Menu.getLastRow(),count);
  assert.equal(post('auth').ok,false);
});
check('Duplicate IDs are repaired by upgrade',()=>{
  const col=sheets.Menu.rows[0].indexOf('id');sheets.Menu.rows[2][col]=sheets.Menu.rows[1][col];context.upgradeWorkbook();
  const ids=sheets.Menu.rows.slice(1).map(r=>r[col]);assert.equal(new Set(ids).size,ids.length);
});
check('Group name collisions cannot merge sections accidentally',()=>{
  reset();assert.equal(post('addItem',{section:'Breakfast',nameEn:'Eggs',price:8}).ok,true);
  assert.equal(post('renameSection',{section:'Sushi',name:'Breakfast'}).ok,false);
});
check('Public optional orders reject invalid quantities and prices',()=>{
  assert.equal(post('order',{items:[{name:'Item',qty:-1,price:3}]}).ok,false);
  assert.equal(post('order',{items:[{name:'Item',qty:1,price:-3}]}).ok,false);
});
check('JavaScript and Apps Script files parse',()=>{
  for(const dir of ['public','apps-script','tools']) for(const file of fs.readdirSync(path.join(ROOT,dir))) if(/\.(js|gs)$/.test(file)) new vm.Script(read(dir+'/'+file),{filename:dir+'/'+file});
  new vm.Script(read('src/worker.js').replace('export default','globalThis.worker ='));
});
check('Guest and admin entrypoints reference existing assets',()=>{
  for(const file of ['public/index.html','public/admin/index.html']) {
    const html=read(file);for(const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
      const url=match[1];if(/^(?:https?:|#|data:)/.test(url))continue;
      const resolved=path.resolve(ROOT,path.dirname(file),url);assert(fs.existsSync(resolved),'Missing '+resolved);
    }
  }
  assert(!read('public/index.html').includes('admin.js'));assert(!read('public/index.html').includes('adminGear'));
});
async function checkAsync(name,fn) { await fn();checks++;console.log('PASS '+name); }
async function main() {
  const {handler}=require('../tools/serve.js');
  const invoke=(url,method='GET')=>new Promise(resolve=>{const result={};handler({url,method},{writeHead(status,headers){Object.assign(result,{status,headers})},end(body){resolve({...result,body:body?.toString()})}})});
  await checkAsync('Local routes serve both pages and admin aliases',async()=>{
    assert.equal((await invoke('/')).status,200);assert((await invoke('/admin/')).body.includes('loginPanel'));
    for(const route of ['/admin','/admin.html','/index.html/admin','/index.html/admin/']) assert.equal((await invoke(route)).headers.Location,'/admin/');
    assert.equal((await invoke('/does-not-exist')).status,404);assert.equal((await invoke('/%zz')).status,400);
    assert.equal((await invoke('/../public-secret/file')).status,403);assert.equal((await invoke('/','POST')).status,405);
  });
  await checkAsync('Worker routes guest/admin correctly and handles unavailable proxy',async()=>{
    const ctx=vm.createContext({URL,Request,Response,fetch:()=>Promise.reject(new Error('offline'))});vm.runInContext(read('src/worker.js').replace('export default','globalThis.worker ='),ctx);
    const env={ASSETS:{fetch:req=>new Response(new URL(req.url).pathname)}};
    assert.equal(await (await ctx.worker.fetch(new Request('https://test.example/admin/'),env)).text(),'/admin/index.html');
    assert.equal(await (await ctx.worker.fetch(new Request('https://test.example/'),env)).text(),'/index.html');
    assert.equal((await ctx.worker.fetch(new Request('https://test.example/index.html/admin'),env)).headers.get('location'),'https://test.example/admin/');
    assert.equal((await ctx.worker.fetch(new Request('https://test.example/api/menu'),env)).status,501);
    assert.equal((await ctx.worker.fetch(new Request('https://test.example/api/menu'),{...env,MENU_API_URL:'https://example.test/exec'})).status,502);
  });
  await checkAsync('Guest language switching renders a single item name and updates direction',async()=>{
    const elements=new Map();
    function element(id) {
      if(!elements.has(id)) elements.set(id,{id,hidden:false,textContent:'',innerHTML:'',listeners:{},attributes:{},addEventListener(name,fn){this.listeners[name]=fn},setAttribute(name,value){this.attributes[name]=value},querySelectorAll(){return[]}});
      return elements.get(id);
    }
    const storage=new Map(), sample={restaurant:{name:'Fume',currency:'USD',logoUrl:'img/logo.jpg'},menu:{sections:[{name:'Breakfast',nameAr:'الفطور',items:[{id:'1',nameEn:'Eggs',nameAr:'بيض',price:0,available:true},{id:'2',nameEn:'Hidden',nameAr:'مخفي',price:9,available:false}],categories:[]}]}};
    const document={currentScript:{src:'https://test.example/shared.js'},documentElement:{},getElementById:element,querySelectorAll:()=>[],title:''};
    const window={FUME_CONFIG:{API_URL:'',FALLBACK_URL:'data/menu.json',CACHE_MINUTES:5},addEventListener(){}};
    const ctx=vm.createContext({window,document,location:{href:'https://test.example/'},URL,AbortController,setTimeout,clearTimeout,localStorage:{getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)},fetch:async()=>({ok:true,json:async()=>JSON.parse(JSON.stringify(sample))})});
    vm.runInContext(read('public/shared.js'),ctx);vm.runInContext(read('public/app.js'),ctx);
    await new Promise(resolve=>setImmediate(resolve));
    assert(element('menuSections').innerHTML.includes('Eggs'));assert(!element('menuSections').innerHTML.includes('بيض'));assert(!element('menuSections').innerHTML.includes('Hidden'));assert(element('menuSections').innerHTML.includes('$0.00'));
    element('langAr').listeners.click();assert.equal(document.documentElement.lang,'ar');assert.equal(document.documentElement.dir,'rtl');assert(element('menuSections').innerHTML.includes('بيض'));assert(!element('menuSections').innerHTML.includes('Eggs'));assert.equal(element('langAr').attributes['aria-pressed'],'true');
    element('langEn').listeners.click();assert.equal(document.documentElement.dir,'ltr');assert.equal(element('langEn').attributes['aria-pressed'],'true');
    assert.equal(window.Fume.safeUrl('javascript:alert(1)'),'');assert.equal(window.Fume.money(''),'');
  });
  console.log('\n'+checks+' regression groups passed. No live services were changed.');
}
main().catch(error=>{console.error(error);process.exitCode=1});

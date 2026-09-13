/* Offline browser-client tests with a simulated Supabase HTTP service. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
let passed=0;
async function test(name,fn){await fn();passed++;console.log('PASS '+name)}
function fixture(options={}){
 const nodes=new Map(),store=new Map(),calls=[],events={};
 function el(id){if(!nodes.has(id))nodes.set(id,{id,value:'',hidden:false,textContent:'',innerHTML:'',attributes:{},listeners:{},focus(){},setAttribute(k,v){this.attributes[k]=v},addEventListener(k,fn){this.listeners[k]=fn},querySelectorAll(){return[]}});return nodes.get(id)}
 const config=options.config||{SUPABASE_URL:'https://unit.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_example',MENU_NAME:'Fume Menu',CACHE_MINUTES:5};
 const window={FUME_CONFIG:config,addEventListener:(name,fn)=>events[name]=fn,dispatchEvent:ev=>events[ev.type]?.(ev)};
 const document={currentScript:{src:'https://menu.example/shared.js'},getElementById:el,documentElement:{},querySelectorAll:()=>[]};
 const menu=options.rows||[{id:'a',name_en:'Crème Eggs',name_ar:'بَيْض',desc_en:'served with coriander',section:'Breakfast',section_ar:'الفطور',category:'.',price:0,available:true},
 {id:'b',name_en:'Tuna roll',name_ar:'رول التونة',desc_en:'sushi with avocado',section:'Sushi',category:'Rolls',price:8,available:true}];
 const state={admin:options.admin!==false,rows:menu,expire:options.expire||false,fail:options.fail||false};
 const fetch=async(url,init={})=>{
  const u=new URL(url);calls.push({u,init});let body,status=200;
  if(state.fail){body={message:'Network unavailable'};status=503}
  else if(u.pathname==='/auth/v1/token')body={access_token:'user-jwt',refresh_token:'refresh-secret',user:{id:'admin-id'},expires_in:state.expire?1:3600};
  else if(u.pathname==='/auth/v1/logout')return{status:204,ok:true};
  else if(u.pathname==='/rest/v1/menu_admins')body=state.admin?[{user_id:'admin-id'}]:[];
  else if(u.pathname==='/rest/v1/menu_items')body=state.rows;
  else if(u.pathname==='/rest/v1/restaurant_settings')body=[{key:'name',value:'Fume'},{key:'currency',value:'USD'}];
  else if(u.pathname==='/rest/v1/rpc/manage_menu')body={ok:true,id:'saved'};
  else throw new Error('Unexpected URL '+url);
  return{ok:status===200,status,json:async()=>body};
 };
 const ctx=vm.createContext({window,document,location:{href:'https://menu.example/'},URL,AbortController,setTimeout,clearTimeout,CustomEvent:class{constructor(type){this.type=type}},atob:s=>Buffer.from(s,'base64').toString(),fetch,localStorage:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)}});
 vm.runInContext(read('public/shared.js'),ctx);
 return{F:window.Fume,ctx,window,document,el,calls,store,state};
}
async function main(){
await test('All active JavaScript parses and HTML assets exist',()=>{
 for(const dir of ['public','tools'])for(const name of fs.readdirSync(path.join(root,dir)))if(name.endsWith('.js'))new vm.Script(read(dir+'/'+name));
 new vm.Script(read('src/worker.js').replace('export default','globalThis.worker='));
 for(const file of ['public/index.html','public/admin/index.html'])for(const match of read(file).matchAll(/(?:src|href)="([^"]+)"/g))if(!/^(https?:|#|data:)/.test(match[1]))assert(fs.existsSync(path.resolve(root,path.dirname(file),match[1])));
 for(const file of ['public/config.js','public/shared.js','public/admin.js'])assert(!/script.google.com|API_URL|checkAdminBackend/.test(read(file)));
});
await test('Supabase URL and public key are required; secret keys rejected',async()=>{
 assert.throws(()=>fixture({config:{}}).F.requireConfig(),/Supabase/);
 assert.throws(()=>fixture({config:{SUPABASE_URL:'https://unit.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_secret_bad'}}).F.requireConfig(),/private/);
 const key='eyJhbGciOiJIUzI1NiJ9.'+Buffer.from(JSON.stringify({role:'service_role'})).toString('base64url')+'.sig';
 assert.throws(()=>fixture({config:{SUPABASE_URL:'https://unit.supabase.co',SUPABASE_PUBLISHABLE_KEY:key}}).F.requireConfig(),/private/);
});
await test('Guest reads only available items directly from Supabase',async()=>{
 const f=fixture(),data=await f.F.menu();assert.equal(data.menu.sections.length,2);assert.equal(data.menu.sections[0].items[0].price,0);
 const req=f.calls.find(c=>c.u.pathname.endsWith('/menu_items'));assert.equal(req.u.searchParams.get('available'),'eq.true');assert.equal(req.init.headers.apikey,'sb_publishable_example');assert(!req.init.headers.Authorization);
 assert.equal(f.store.size,1);assert(f.F.cacheRead());
});
await test('Admin mutations require a session',async()=>{await assert.rejects(()=>fixture().F.post('deleteItem',{id:'a'}),/sign in/)});
await test('Email/password Auth verifies membership before editing',async()=>{
 const f=fixture();await f.F.signIn(' boss@example.com ','private-password');await f.F.post('updateItem',{id:'a',fields:{nameEn:'New',price:'',available:false}});
 const login=f.calls.find(c=>c.u.pathname==='/auth/v1/token');assert.equal(JSON.parse(login.init.body).email,'boss@example.com');
 const mutation=f.calls.find(c=>c.u.pathname.endsWith('/manage_menu'));assert.equal(mutation.init.headers.Authorization,'Bearer user-jwt');
 const payload=JSON.parse(mutation.init.body);assert.equal(payload.payload.fields.name_en,'New');assert.equal(payload.payload.fields.price,null);assert.equal(payload.payload.fields.available,false);assert(!mutation.init.body.includes('private-password'));assert.equal(f.store.size,0);
 await f.F.post('adminMenu');assert(!f.calls.filter(c=>c.u.pathname.endsWith('/menu_items')).at(-1).u.searchParams.has('available'));
 await f.F.signOut();await assert.rejects(()=>f.F.post('deleteItem',{id:'a'}),/sign in/);
});
await test('Non-admin login cannot keep a session or mutate',async()=>{
 const f=fixture({admin:false});await assert.rejects(()=>f.F.signIn('user@example.com','password'),/no menu admin access/);await assert.rejects(()=>f.F.post('deleteItem',{id:'a'}),/sign in/);
});
await test('Expiring tokens refresh without storing credentials',async()=>{
 const f=fixture({expire:true});await f.F.signIn('user@example.com','password');assert(f.calls.some(c=>c.u.searchParams.get('grant_type')==='refresh_token'));assert.equal(f.store.size,0);
});
await test('Name search ignores descriptions, sections and categories',()=>{
 const f=fixture();const item={nameEn:'Crème Eggs',nameAr:'بَيْض',desc:'coriander',section:'Breakfast',category:'Specials'};
 assert(f.F.matchesName(item,'CREME'));assert(f.F.matchesName(item,'بيض'));assert(f.F.matchesName(item,'  '));
 for(const term of ['coriander','Breakfast','Specials'])assert(!f.F.matchesName(item,term));
});
await test('Search, clear and language switching work in guest renderer',async()=>{
 const f=fixture();vm.runInContext(read('public/app.js'),f.ctx);await new Promise(r=>setImmediate(r));
 assert(f.el('menuSections').innerHTML.includes('Crème Eggs'));assert(!f.el('menuSections').innerHTML.includes('بَيْض'));
 f.el('menuSearch').value='EGGS';f.el('menuSearch').listeners.input();assert(!f.el('menuSections').innerHTML.includes('Tuna roll'));assert.equal(f.el('searchResults').textContent,'1 item found');
 f.el('langAr').listeners.click();assert.equal(f.document.documentElement.dir,'rtl');assert(f.el('menuSections').innerHTML.includes('بَيْض'));assert(!f.el('menuSections').innerHTML.includes('Crème Eggs'));
 f.el('menuSearch').value='coriander';f.el('menuSearch').listeners.input();assert.equal(f.el('menuSections').innerHTML,'');assert.equal(f.el('stateEmpty').hidden,false);
 f.el('clearSearch').listeners.click();assert(f.el('menuSections').innerHTML.includes('رول التونة'));assert.equal(f.el('stateEmpty').hidden,true);
});
await test('Connection failure does not fall back to the obsolete bundled menu',async()=>{
 const f=fixture({fail:true});vm.runInContext(read('public/app.js'),f.ctx);await new Promise(r=>setImmediate(r));assert.equal(f.el('stateError').hidden,false);assert(!f.calls.some(c=>c.u.pathname.includes('data/menu')));
});
await test('Local server has guest and admin routes',async()=>{
 const {handler}=require('../tools/serve.js');const invoke=url=>new Promise(resolve=>{const result={};handler({url,method:'GET'},{writeHead(status,headers){Object.assign(result,{status,headers})},end(body){resolve({...result,body:body?.toString()})}})});
 assert.equal((await invoke('/')).status,200);assert((await invoke('/admin/')).body.includes('Admin email'));assert.equal((await invoke('/index.html/admin')).headers.Location,'/admin/');assert.equal((await invoke('/missing')).status,404);
});
console.log(passed+' client checks passed.');
}
main().catch(error=>{console.error(error);process.exitCode=1});

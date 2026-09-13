/* Real PostgreSQL engine, local Supabase-role emulation. No live database used. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const {PGlite}=await import(process.env.PGLITE_MODULE ? pathToFileURL(process.env.PGLITE_MODULE).href : '@electric-sql/pglite');
const db=new PGlite();let passed=0;
async function check(name,fn){await fn();passed++;console.log('PASS '+name)}
const scalar=async sql=>(await db.query(sql)).rows[0];
async function as(role,uid=''){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[uid]);await db.exec('set role '+role);}
const admin='11111111-1111-4111-8111-111111111111', other='22222222-2222-4222-8222-222222222222';
const rpc=async(action,payload={},menu='Fume Menu')=>(await db.query('select public.manage_menu($1,$2,$3::jsonb) result',[action,menu,JSON.stringify(payload)])).rows[0].result;
try{
await db.exec(`create role anon; create role authenticated; create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant usage on schema auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;
insert into auth.users values ('${admin}'),('${other}');`);
await db.exec(fs.readFileSync(path.join(root,'supabase/schema.sql'),'utf8'));
await db.exec(fs.readFileSync(path.join(root,'supabase/seed.sql'),'utf8'));
await db.exec(`insert into public.menu_admins values ('${admin}')`);
await check('Schema and seed execute, rerun and retain 106 items',async()=>{
 assert.equal((await scalar('select count(*)::int n from public.menu_items')).n,106);
 await db.exec(fs.readFileSync(path.join(root,'supabase/schema.sql'),'utf8'));
 await db.exec(fs.readFileSync(path.join(root,'supabase/seed.sql'),'utf8'));
 assert.equal((await scalar('select count(*)::int n from public.menu_items')).n,106);
});
await db.exec("update public.menu_items set available=false where id='i001'");
await check('Visitors see 105 available items and public settings only',async()=>{
 await as('anon');assert.equal((await scalar('select count(*)::int n from public.menu_items')).n,105);
 assert((await db.query('select * from public.restaurant_settings')).rows.length>0);
 await assert.rejects(()=>db.query('select * from public.menu_admins'));
 await assert.rejects(()=>db.query('select * from public.orders'));
 await assert.rejects(()=>db.query("update public.menu_items set price=0"));
 await assert.rejects(()=>rpc('deleteSection',{section:'Breakfast'}));
});
await check('Signed-in non-admin cannot write, see hidden items or promote itself',async()=>{
 await as('authenticated',other);assert.equal((await scalar('select count(*)::int n from public.menu_items')).n,105);
 assert.equal((await scalar('select count(*)::int n from public.menu_admins')).n,0);
 await assert.rejects(()=>rpc('addItem',{fields:{name_en:'Bad',section:'Bad'}}));
 await assert.rejects(()=>db.query('insert into public.menu_admins values ($1)',[other]));
 assert.equal((await db.query("update public.menu_items set price=0 returning id")).rows.length,0);
});
await check('Approved admin sees hidden items and changes availability',async()=>{
 await as('authenticated',admin);assert.equal((await scalar('select count(*)::int n from public.menu_items')).n,106);
 await rpc('updateItem',{id:'i001',fields:{available:true}});assert.equal((await scalar("select available from public.menu_items where id='i001'")).available,true);
});
let id;
await check('Admin add/edit keeps zero, null, Arabic and size prices',async()=>{
 id=(await rpc('addItem',{fields:{name_en:'Test item',name_ar:'صنف',section:'Test',category:'Cat',price:null,price_small:3,available:false}})).id;
 await rpc('updateItem',{id,fields:{price:0,desc_ar:'وصف',price_large:9,sort:0}});
 const item=await scalar(`select * from public.menu_items where id='${id}'`);assert.equal(Number(item.price),0);assert.equal(Number(item.price_small),3);assert.equal(item.desc_ar,'وصف');assert.equal(item.category,'Cat');assert.equal(item.available,false);assert.equal(item.sort,0);
});
await check('Invalid update rolls back all fields',async()=>{
 await assert.rejects(()=>rpc('updateItem',{id,fields:{name_en:'Changed',price:-1}}));
 assert.equal((await scalar(`select name_en from public.menu_items where id='${id}'`)).name_en,'Test item');
 await assert.rejects(()=>rpc('updateItem',{id,fields:{id:'hijack'}}));
 await assert.rejects(()=>rpc('updateItem',{id,fields:{name_en:'  '}}));
});
let second;
await check('Group changes are scoped and transactional',async()=>{
 second=(await rpc('addItem',{fields:{name_en:'Other menu',section:'Test',category:'Cat'}},'Other Menu')).id;
 await rpc('renameCategory',{category:'Cat',scopeSection:'Test',name:'Renamed',nameAr:'جديد'});
 assert.equal((await scalar(`select category from public.menu_items where id='${second}'`)).category,'Cat');
 assert.equal((await scalar(`select category from public.menu_items where id='${id}'`)).category,'Renamed');
 await assert.rejects(()=>rpc('deleteCategory',{category:'Renamed'}));
 await assert.rejects(()=>rpc('updateItem',{id:second,fields:{price:1}}));
 await rpc('deleteSection',{section:'Test'});
 assert.equal((await scalar(`select count(*)::int n from public.menu_items where id='${id}'`)).n,0);
 assert.equal((await scalar(`select count(*)::int n from public.menu_items where id='${second}'`)).n,1);
});
await check('Group-name collision cannot accidentally merge sections',async()=>{
 await assert.rejects(()=>rpc('renameSection',{section:'Breakfast',name:'Sushi'}));
});
await check('Settings cannot hold or expose a password',async()=>{
 await assert.rejects(()=>db.query("insert into public.restaurant_settings values ('adminPassword','secret')"));
});
console.log(passed+' PostgreSQL checks passed.');
}finally{await db.close()}

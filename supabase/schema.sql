-- Fume Bar: run once in the Supabase SQL Editor. Safe to rerun on this schema.
begin;
create table if not exists public.menu_items (
  id text primary key default gen_random_uuid()::text,
  sort integer check (sort >= 0),
  menu text not null default 'Fume Menu' check (length(trim(menu)) between 1 and 200),
  section text not null check (length(trim(section)) between 1 and 500),
  section_ar text not null default '',
  category text not null default '.',
  category_ar text not null default '',
  name_en text not null check (length(trim(name_en)) between 1 and 500),
  name_ar text not null default '',
  desc_en text not null default '',
  desc_ar text not null default '',
  price numeric(12,2) check (price >= 0 and price <> 'NaN'::numeric),
  price_small numeric(12,2) check (price_small >= 0 and price_small <> 'NaN'::numeric),
  price_medium numeric(12,2) check (price_medium >= 0 and price_medium <> 'NaN'::numeric),
  price_large numeric(12,2) check (price_large >= 0 and price_large <> 'NaN'::numeric),
  calories integer check (calories >= 0),
  available boolean not null default true
);
create index if not exists menu_items_menu_sort on public.menu_items(menu,sort,id);
create table if not exists public.restaurant_settings (
  key text primary key check (key in ('name','tagline_en','tagline_ar','currency','phone','address','address_ar','instagram','facebook','logoUrl')),
  value text not null default ''
);
create table if not exists public.menu_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
-- Optional archive for any existing Orders sheet. No guest ordering UI is enabled.
create table if not exists public.orders (
  order_id text primary key default gen_random_uuid()::text,
  timestamp timestamptz,
  "table" text default '', room text default '', customer_name text default '',
  customer_phone text default '', customer_notes text default '', items text default '',
  total numeric(12,2), menu text default 'Fume Menu', status text default 'NEW'
);
alter table public.menu_items enable row level security;
alter table public.restaurant_settings enable row level security;
alter table public.menu_admins enable row level security;
alter table public.orders enable row level security;
revoke all on public.menu_items,public.restaurant_settings,public.menu_admins,public.orders from public,anon,authenticated;
grant select on public.menu_items,public.restaurant_settings to anon;
grant select,insert,update,delete on public.menu_items,public.restaurant_settings,public.orders to authenticated;
grant select on public.menu_admins to authenticated;
grant usage on schema public to anon,authenticated;

drop policy if exists "Read own admin membership" on public.menu_admins;
create policy "Read own admin membership" on public.menu_admins for select to authenticated using (user_id=(select auth.uid()));
create or replace function public.is_menu_admin() returns boolean
language sql stable security invoker set search_path = ''
as $$ select exists(select 1 from public.menu_admins where user_id=(select auth.uid())); $$;
revoke all on function public.is_menu_admin() from public,anon;
grant execute on function public.is_menu_admin() to authenticated;

drop policy if exists "Read available menu" on public.menu_items;
create policy "Read available menu" on public.menu_items for select to anon,authenticated using (available=true);
drop policy if exists "Admins manage menu" on public.menu_items;
create policy "Admins manage menu" on public.menu_items for all to authenticated using ((select public.is_menu_admin())) with check ((select public.is_menu_admin()));
drop policy if exists "Read restaurant settings" on public.restaurant_settings;
create policy "Read restaurant settings" on public.restaurant_settings for select to anon,authenticated using (true);
drop policy if exists "Admins manage restaurant settings" on public.restaurant_settings;
create policy "Admins manage restaurant settings" on public.restaurant_settings for all to authenticated using ((select public.is_menu_admin())) with check ((select public.is_menu_admin()));
drop policy if exists "Admins manage orders" on public.orders;
create policy "Admins manage orders" on public.orders for all to authenticated using ((select public.is_menu_admin())) with check ((select public.is_menu_admin()));

-- Each edit is one transaction; identity comes from Supabase Auth, never the payload.
create or replace function public.manage_menu(action text, menu_name text, payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security invoker set search_path = ''
as $$
declare
  item public.menu_items;
  fields jsonb;
  old_name text;
  new_name text;
  section_scope text;
  affected integer;
begin
  if not public.is_menu_admin() then raise exception 'Menu admin access required.' using errcode='42501'; end if;
  if menu_name is null or trim(menu_name)='' then raise exception 'Menu name is required.'; end if;
  if jsonb_typeof(payload) <> 'object' then raise exception 'Invalid request.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(menu_name,0));
  if action in ('addItem','updateItem') then
    fields := coalesce(payload->'fields','{}'::jsonb);
    if jsonb_typeof(fields) <> 'object' then raise exception 'Invalid item fields.'; end if;
    if exists(select 1 from jsonb_object_keys(fields) as f(key) where key not in
      ('sort','section','section_ar','category','category_ar','name_en','name_ar','desc_en','desc_ar','price','price_small','price_medium','price_large','calories','available')) then
      raise exception 'Unsupported item field.';
    end if;
    if action='addItem' then
      select * into item from jsonb_populate_record(null::public.menu_items,
        jsonb_build_object('id',gen_random_uuid()::text,'menu',menu_name,'sort',(select coalesce(max(m.sort),0)+1 from public.menu_items m where m.menu=menu_name),
          'section_ar','','category','.','category_ar','','name_ar','','desc_en','','desc_ar','','available',true) || fields);
      if item.sort is null then select coalesce(max(m.sort),0)+1 into item.sort from public.menu_items m where m.menu=menu_name; end if;
    else
      select m.* into item from public.menu_items m where m.id=payload->>'id' and m.menu=menu_name for update;
      if not found then raise exception 'Item no longer exists. Refresh the menu.'; end if;
      select * into item from jsonb_populate_record(item,fields);
    end if;
    item.name_en := trim(item.name_en);
    item.section := trim(item.section);
    item.category := coalesce(nullif(trim(item.category),''),'.');
    if action='addItem' then
      insert into public.menu_items select (item).*;
    else
      update public.menu_items set sort=item.sort,section=item.section,section_ar=item.section_ar,category=item.category,category_ar=item.category_ar,
        name_en=item.name_en,name_ar=item.name_ar,desc_en=item.desc_en,desc_ar=item.desc_ar,price=item.price,price_small=item.price_small,
        price_medium=item.price_medium,price_large=item.price_large,calories=item.calories,available=item.available
      where id=item.id and menu=menu_name;
    end if;
    if fields ? 'section_ar' then update public.menu_items set section_ar=item.section_ar where menu=menu_name and section=item.section; end if;
    if fields ? 'category_ar' then update public.menu_items set category_ar=item.category_ar where menu=menu_name and section=item.section and category=item.category; end if;
    return jsonb_build_object('ok',true,'id',item.id);
  elsif action='deleteItem' then
    delete from public.menu_items where menu=menu_name and id=payload->>'id';
    get diagnostics affected=row_count;
    if affected=0 then raise exception 'Item no longer exists. Refresh the menu.'; end if;
  elsif action in ('renameSection','deleteSection','renameCategory','deleteCategory') then
    old_name := trim(case when action in ('renameSection','deleteSection') then payload->>'section' else payload->>'category' end);
    section_scope := trim(payload->>'scopeSection');
    if old_name is null or old_name='' then raise exception 'Group name is required.'; end if;
    if action in ('renameCategory','deleteCategory') and (section_scope is null or section_scope='') then raise exception 'Category changes require a section.'; end if;
    if action in ('renameSection','renameCategory') then
      new_name := trim(payload->>'name');
      if new_name is null or new_name='' or length(new_name)>500 or (action='renameCategory' and new_name='.') then raise exception 'Enter a valid group name.'; end if;
      if new_name<>old_name and exists(select 1 from public.menu_items m where m.menu=menu_name and
        ((action='renameSection' and m.section=new_name) or (action='renameCategory' and m.section=section_scope and m.category=new_name))) then
        raise exception 'A group with that name already exists.';
      end if;
    end if;
    if action='renameSection' then update public.menu_items set section=new_name,section_ar=coalesce(payload->>'nameAr','') where menu=menu_name and section=old_name;
    elsif action='renameCategory' then update public.menu_items set category=new_name,category_ar=coalesce(payload->>'nameAr','') where menu=menu_name and section=section_scope and category=old_name;
    elsif action='deleteSection' then delete from public.menu_items where menu=menu_name and section=old_name;
    else delete from public.menu_items where menu=menu_name and section=section_scope and category=old_name;
    end if;
    get diagnostics affected=row_count;
    if affected=0 then raise exception 'Group no longer exists. Refresh the menu.'; end if;
  else raise exception 'Unknown menu action.';
  end if;
  return jsonb_build_object('ok',true,'changed',affected);
end;
$$;
revoke all on function public.manage_menu(text,text,jsonb) from public,anon;
grant execute on function public.manage_menu(text,text,jsonb) to authenticated;
commit;

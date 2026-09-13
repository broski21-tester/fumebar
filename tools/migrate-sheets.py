"""Convert Google Sheets CSV exports to a Supabase SQL migration. Python standard library only."""
import argparse, csv, decimal, pathlib, uuid

COLUMNS = ['id','sort','menu','section','section_ar','category','category_ar','name_en','name_ar','desc_en','price','price_small','price_medium','price_large','calories','available','desc_ar']
SETTINGS = {'name','tagline_en','tagline_ar','currency','phone','address','address_ar','instagram','facebook','logoUrl'}
NUMBERS = {'sort','price','price_small','price_medium','price_large','calories'}
def literal(value):
    if value is None: return 'NULL'
    if isinstance(value,bool): return 'true' if value else 'false'
    if isinstance(value,decimal.Decimal): return str(value)
    return "'" + str(value).replace("'","''") + "'"
def rows(file):
    with pathlib.Path(file).open(encoding='utf-8-sig',newline='') as f:
        reader=csv.DictReader(f)
        if reader.fieldnames is None: raise ValueError('CSV has no column headers.')
        reader.fieldnames=[h.strip() for h in reader.fieldnames]
        return list(reader)
def convert(menu, settings=None):
    statements=['-- Generated from CSV exports. Run after supabase/schema.sql.', 'begin;']
    seen=set(); count=0
    for number,source in enumerate(rows(menu),2):
        if not any(str(v or '').strip() for v in source.values() if not isinstance(v,list)): continue
        if not str(source.get('name_en') or '').strip(): raise ValueError(f'Menu row {number}: name_en is missing.')
        record={key:str(source.get(key) or '').strip() for key in COLUMNS}
        record['id']=record['id'] or str(uuid.uuid4())
        if record['id'] in seen: raise ValueError(f'Menu row {number}: duplicate ID {record["id"]}. Fix duplicate IDs before importing.')
        seen.add(record['id']); record['menu']=record['menu'] or 'Fume Menu'; record['section']=record['section'] or 'Menu';record['category']=record['category'] or '.'
        for key in NUMBERS:
            raw=record[key]
            if not raw: record[key]=None;continue
            try: value=decimal.Decimal(raw)
            except decimal.InvalidOperation: raise ValueError(f'Menu row {number}: {key} must contain a number, without a currency symbol.')
            if not value.is_finite() or value<0 or (key in {'sort','calories'} and value!=value.to_integral_value()): raise ValueError(f'Menu row {number}: invalid {key}.')
            record[key]=value
        availability=record['available'].lower()
        if availability not in {'','true','false','1','0'}: raise ValueError(f'Menu row {number}: available must be TRUE or FALSE.')
        record['available']=availability not in {'false','0'}
        values=','.join(literal(record[c]) for c in COLUMNS)
        updates=','.join(f'{c}=excluded.{c}' for c in COLUMNS if c!='id')
        statements.append(f'insert into public.menu_items ({",".join(COLUMNS)}) values ({values}) on conflict (id) do update set {updates};')
        count+=1
    if not count: raise ValueError('Menu CSV has no items.')
    if settings:
        for source in rows(settings):
            key=str(source.get('key') or '').strip()
            if key in SETTINGS:
                statements.append(f'insert into public.restaurant_settings (key,value) values ({literal(key)},{literal(source.get("value") or "")}) on conflict (key) do update set value=excluded.value;')
    statements.extend(['commit;',f'-- Imported {count} menu items. Admin passwords are excluded.'])
    return '\n'.join(statements)+'\n'
if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--menu',required=True,help='CSV export of the Menu sheet')
    parser.add_argument('--settings',help='CSV export of the Settings sheet')
    parser.add_argument('--output',default='migration.sql')
    args=parser.parse_args()
    try:
        result=convert(args.menu,args.settings)
        pathlib.Path(args.output).write_text(result,encoding='utf-8')
        print('Created '+args.output+'. Review and run it in the Supabase SQL Editor.')
    except (ValueError,OSError) as error: parser.exit(1,str(error)+'\n')

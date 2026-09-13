import csv,importlib.util,pathlib,tempfile,unittest
ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('migration',ROOT/'tools/migrate-sheets.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
class MigrationTests(unittest.TestCase):
 def test_preserves_data_and_excludes_password(self):
  with tempfile.TemporaryDirectory() as temp:
   menu=pathlib.Path(temp)/'Menu.csv'; settings=pathlib.Path(temp)/'Settings.csv'
   with menu.open('w',newline='',encoding='utf-8-sig') as f:
    w=csv.writer(f);w.writerow(['id','name_en','name_ar','section','price','available','desc_en']);w.writerow(['existing',"Chef's dish",'طبق','Food','0','FALSE','description'])
   with settings.open('w',newline='',encoding='utf-8') as f:
    w=csv.writer(f);w.writerow(['key','value']);w.writerow(['adminPassword','never-export-this']);w.writerow(['name','Fume'])
   sql=module.convert(menu,settings)
   self.assertIn("Chef''s dish",sql);self.assertIn('طبق',sql);self.assertIn('false',sql);self.assertIn("'existing'",sql);self.assertNotIn('never-export-this',sql)
 def test_saved_snapshot_count(self):
  sql=module.convert(ROOT/'data/fume-menu.csv',ROOT/'data/restaurant-settings.csv')
  self.assertEqual(sql.count('insert into public.menu_items'),106)
if __name__=='__main__':unittest.main()

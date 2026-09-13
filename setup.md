# Fume Bar: Supabase setup

## 1. Create the database
Create a Supabase project. Open **SQL Editor**, paste `supabase/schema.sql`, and run it.

## 2. Move your menu
For the 106 items saved in this project, run `supabase/seed.sql` in SQL Editor.

For your **latest Google Sheet edits**, use this instead:

* Download the Menu tab as `Menu.csv` and the Settings tab as `Settings.csv` using **File > Download > CSV** for each tab.
* Put both CSV files in the extracted `fumeBar` folder. With Python installed, run:

```sh
python tools/migrate-sheets.py --menu Menu.csv --settings Settings.csv --output migration.sql
```

* Paste `migration.sql` into Supabase SQL Editor and run it.

Choose one import path. The CSV migration preserves IDs, prices, Arabic names, order and availability. It excludes the old admin password. Your Google Sheet remains unchanged.

## 3. Create your admin login
In Supabase, open **Authentication > Users > Add user > Create new user**. Enter your email and password and enable **Auto Confirm User**. Copy the new user's UID.

In SQL Editor, run this after replacing the placeholder:

```sql
insert into public.menu_admins (user_id)
values ('PASTE-YOUR-USER-UID-HERE')
on conflict do nothing;
```

## 4. Connect the website
Get your **Project URL** from the project's **Connect** dialog or API settings. Get the **publishable key** from **Settings > API Keys**.

Edit `public/config.js`:

```js
SUPABASE_URL: "https://YOUR-PROJECT.supabase.co",
SUPABASE_PUBLISHABLE_KEY: "sb_publishable_YOUR_KEY",
```

A legacy `anon` key also works. Keep secret and `service_role` keys out of this file. The database policies protect editing; the publishable key is intended for the website.

## 5. Update Render
Upload this project's files to your GitHub repository and redeploy your **Static Site**:

* Build command: `true`
* Publish directory: `public`
* Root directory: blank, or `fumeBar` if that folder wraps the project in GitHub.

Open the site, then `/admin/index.html`. Sign in with the Supabase email/password from step 3. Test one edit and refresh the guest menu. Search matches item names only.

The site now uses Supabase directly. Google Apps Script URLs and the old Settings password are no longer used. To change the admin password, manage that user in Supabase Authentication.

If login succeeds but admin access is denied, check the UID in `menu_admins`. If tables or functions are missing, rerun `schema.sql` in the same project whose URL is in `config.js`.

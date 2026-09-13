# Fume Bar

Start with **setup.md**. This edition uses Supabase Postgres and Supabase Auth, with a static English/Arabic menu and a separate admin page. It retains the name-only search, frameless logo, responsive layout and menu editor.

## Files

* `public/`: deploy this folder to Render. `config.js` needs only your Supabase Project URL and publishable key.
* `supabase/schema.sql`: database tables, access policies and transactional menu editing function.
* `supabase/seed.sql`: optional original 106-item menu snapshot. Existing IDs are not overwritten by this seed.
* `tools/migrate-sheets.py`: converts your current Menu/Settings CSV exports into SQL. Existing matching IDs are updated; unrelated database items are preserved.
* `data/`: saved CSV snapshots. These are not the live website database.
* `tests/`: offline client tests and PostgreSQL permission/mutation tests.

The live Google Sheet was not accessed. Use the CSV path in setup.md to carry across changes made since the original archive. The migration only writes to Supabase after you run the generated SQL. Export backups before switching. Verify item counts and a test edit before retiring the old deployment.

## Local preview

Set `public/config.js`, then run `node tools/serve.js`. Open `http://localhost:8080/` and `http://localhost:8080/admin/`.

The guest page reads Supabase directly. A previously fetched public menu may appear from a five-minute local cache during a connection failure, with a warning. The old bundled JSON is not a live fallback, so it cannot silently reintroduce obsolete prices or hidden items. Language selection is stored on the device.

## Admin access

Each admin needs a Supabase Authentication account and its UID in `public.menu_admins`. Email/password sign-in obtains a user session. Tokens stay in page memory and refresh during an active session; reloading the page requires signing in again. Visitors and ordinary signed-in users can read only available menu items. Only listed admins can create, edit, hide, restore or delete items. The browser cannot grant admin membership.

Prices, sorting, names, descriptions and availability save through the `manage_menu` database function in one transaction. Group changes stay within the selected menu and section. Multiple size prices and optional Arabic descriptions are supported. The search examines English and Arabic item names, with case/diacritic normalization. Descriptions are excluded.

Restaurant contact/branding settings live in `restaurant_settings` and can be edited in Supabase Table Editor. Passwords are managed by Supabase Authentication.

The optional `orders` table can retain a CSV export of the old Orders sheet using Supabase Table Editor. Use timezone-qualified timestamps and review the imported dates. It is readable/writable only by approved admins. This project has no guest ordering interface or public order submission endpoint.

## Hosting

Render: Static Site, build `true`, publish `public`. There is no Node.js web service or package installation requirement. Cloudflare Pages can also serve `public/`. The included optional Worker serves static pages only; the old Apps Script proxy is removed. On hosts without the provided redirects, use `/admin/index.html` directly.

## Checks

Run `node tests/regression.js` for the dependency-free offline checks. To run the PostgreSQL tests, install `@electric-sql/pglite` into a temporary directory and point `PGLITE_MODULE` to its module entry, then run `node tests/database.mjs`. Those tests emulate Supabase's auth roles and auth.uid() locally; live Auth, CORS, deployment, and network behavior require checking against your own project after setup.

## References

[Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys), [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security), [Password authentication](https://supabase.com/docs/guides/auth/passwords).

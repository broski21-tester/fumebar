# Fume Bar menu, updated edition

A static English/Arabic guest menu and a separate, password-protected menu editor backed by your Google Sheet. The original menu data, prices, logo and configured Apps Script URL are retained.

## Update your existing installation

1. In the Google Sheet, open **Extensions > Apps Script**.
2. Replace **Code.gs** and **Setup.gs** with the versions in this folder. Keep your existing **SeedData.gs**. If it is missing, add the supplied copy.
3. Run **upgradeWorkbook** once. It adds missing columns, including `desc_ar`, and repairs missing or duplicate item IDs. It preserves your menu rows, prices, settings and extra columns. It does not import seed data.
4. In the **Settings** sheet, check the `adminPassword` value. Your existing password remains unchanged. Choose a private password if the value is blank.
5. Open **Deploy > Manage deployments**, edit the existing web app deployment, select **New version**, and deploy it. Saving the script alone does not update the deployed API. Keep execution as yourself and access available to anyone; the admin API verifies the password on every request.
6. Replace your hosted site's files with the entire **public/** folder. Keep its folder structure, including **admin/**. Your current Apps Script URL remains in **public/config.js**. If you create a different deployment, paste its `/exec` URL there.
7. Open your site for the guest menu. Open **/admin/** for the editor and sign in with the Settings password.

The new editor requires the updated backend. It shows an upgrade message if it detects the old API. No changes have been made to your live Google Sheet or hosted website by editing this archive.

## Start from a new Google Sheet

Copy the three supplied `.gs` files into the spreadsheet's Apps Script project, then run `setupWorkbook`. This creates Menu, Orders and Settings and seeds an empty menu. Set `adminPassword` in Settings yourself; fresh installations have no default password. Deploy a web app, then set `API_URL` in `public/config.js`.

Running setup again preserves existing rows. `importSeedData` now refuses to overwrite a populated menu. `resetMenuSheet` is an explicit destructive utility; never run it during an upgrade.

## Open locally

With Node.js installed, extract this archive, open a terminal in `fumeBar`, and run:

```sh
node tools/serve.js
```

Guest menu: `http://localhost:8080/`

Admin page: `http://localhost:8080/admin/`

The aliases `/admin.html` and `/index.html/admin` redirect to `/admin/` on the included server and configured hosts. The portable direct path is `/admin/index.html`. A plain file opened with a double-click cannot load JSON reliably; use the local server.

The existing `API_URL` connects to your live backend. To preview only the bundled menu data, temporarily set it to an empty string. Admin editing needs a connected, updated backend and cannot save to the bundled file.

## What changed

* The guest menu has its own script with no editor controls or login overlay.
* Admin lives on a separate page with server-verified login, item counts, section selection, and add/edit/delete controls.
* Hidden items remain visible in the editor and can be made available again.
* English shows English item names only. Arabic uses the Arabic names with right-to-left layout. If a translation is missing, the English text provides a fallback.
* Arabic descriptions use the optional `desc_ar` column. English descriptions remain the fallback until you supply translations; the code does not invent translations.
* The original logo displays without a border, card, shadow or rounded frame. CSS blends its black background into the site. The source logo is a small JPG; a higher-resolution original will improve sharpness further.
* Guest pages use clearer typography, a desktop section rail, mobile section tabs, readable prices and responsive spacing.
* The editor handles normal and size prices, descriptions, availability, categories and numeric sort order.
* Category edits preserve the correct category and use stable source identifiers. Group changes stay inside the selected menu and section.
* The backend validates values before applying an item patch, locks concurrent admin requests, and keeps passwords out of public JSON.
* Setup and upgrades preserve existing menu changes and additional spreadsheet columns.
* Public data refreshes on every page load and on window focus. A short-lived cache can render while fresh data loads. Failed requests use a clearly labelled saved or bundled menu. Admin responses never enter the guest cache.
* Empty menus, API failures, timeouts, sign-in failures, saves and reload failures have explicit states.

## Menu columns

The backend finds columns by header name, so existing columns can keep their order:

`id`, `sort`, `menu`, `section`, `section_ar`, `category`, `category_ar`, `name_en`, `name_ar`, `desc_en`, `price`, `price_small`, `price_medium`, `price_large`, `calories`, `available`, `desc_ar`.

Use an empty category or `.` for items directly under a section. Lower sort values appear first. A blank price stays blank; zero displays as 0.00. Hidden items have `available` set to `FALSE`.

Adding an item with a new section or category creates that group. Select a section to rename or delete it. Category controls appear beside each category heading. Deletions ask for confirmation.

The Arabic section/category name fields apply to the group, including its other items. Renaming a group to an existing group name is rejected to prevent accidental merging.

## Hosting

Upload **public/** as your static output. The project has no frontend build or package dependencies.

For Cloudflare Pages, keep `_redirects` and `_headers` in that output. For a Cloudflare Worker, keep the included `wrangler.toml` and `src/worker.js`; deploy the project using Wrangler. For Render, the included `render.yaml` supplies the admin route.

The optional Worker proxy uses the `MENU_API_URL` environment variable and `API_URL: "/api/menu"` in `config.js`. Direct Apps Script connections can keep the existing URL. Configure the Apps Script deployment to return accessible JSON, rather than a Google sign-in page.

On another static host, `/admin/index.html` works directly. Configure `/admin/` to serve that file and redirect `/index.html/admin` to `/admin/` if your host does not serve directory index files automatically.

## Configuration

`API_URL`: the Apps Script endpoint or `/api/menu` for the optional Worker proxy.

`MENU_NAME`: the value of the Menu sheet's `menu` column to display and edit.

`FALLBACK_URL`: bundled snapshot used for a disconnected guest preview or as the last fallback after a failed live request. It does not update automatically when the Google Sheet changes. If you use it in production, keep it current or remove outdated items from the snapshot.

`CACHE_MINUTES`: how long a stored public snapshot remains eligible for initial/offline display. The page still requests live data on load. Set to `0` to disable storage.

`REQUEST_TIMEOUT_MS`: timeout for each browser request.

Restaurant settings include name, tagline_en, tagline_ar, currency, phone, address, optional address_ar, instagram, facebook, logoUrl, and the private adminPassword. Relative logo URLs resolve from the guest site's root folder. External logo and social links accept HTTP or HTTPS only.

## Verification and limits

Run the included dependency-free regression checks with:

```sh
node tests/regression.js
```

These exercise the Apps Script logic with a simulated spreadsheet and check the public/admin entrypoints and route handler. They do not connect to your live Google Sheet. Live sign-in, saves and deployment behavior still need checking after you publish the updated Apps Script version.

The optional existing public order endpoint remains available, but there is no ordering UI in this project. It accepts guest-submitted prices and must not be used as an authoritative payment total.

Admin credentials stay in page memory only. Reloading or closing the admin page requires signing in again. This release retains the existing shared-password model.

## Regenerate bundled seed data

`node tools/generate-seed.js` rewrites the bundled `menu.json`, CSV and `SeedData.gs` from the original source menu. It does not fetch your live Google Sheet. It does not overwrite spreadsheet rows by itself, and `importSeedData` refuses to replace an existing menu.

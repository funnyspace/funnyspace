# BillNest: Inventory, Billing and Accounting

A clean, mobile-friendly starter website for a small shop, with product and stock tracking, customers, GST-aware invoicing, printable invoices and basic reports. **No npm install, database or paid server is needed to try it.**

## Open the website

1. Download the ZIP, extract the `billnest` folder, and **double-click `index.html`** in a modern browser. The included `app.bundle.js` works without a web server and does not need npm.
2. Choose **Billing** in the left sidebar. On phones, use the **Billing** tab in the fixed bottom navigation.
3. The dashboard offers one-click actions for **Billing**, **Add product**, and **Accounting**.
4. A clearly labelled **demo workspace** appears first. Click **Start with an empty store** to remove sample data, then add products in **Inventory** and create your own invoice.

If opening files is restricted by your browser, serve the folder using `python -m http.server 8000` and visit `http://localhost:8000`.

Direct page links work using URL hashes such as `index.html#dashboard`, `index.html#billing`, and `index.html#inventory`. The browser's Back and Forward navigation works with these links.

## Development

The editable source is split between `app.js` (screens and events) `logic.mjs` (billing arithmetic) and `accounting.mjs` (cashbook and financial summary). The website loads `app.bundle.js` to avoid browser module/CORS issues when opening the ZIP. **After editing app.js, logic.mjs or accounting.mjs, regenerate the bundle** with `node scripts/build.mjs`. Test with `node --test tests/*.test.mjs` (Node.js 18+).

## Features

- Overview dashboard with sales, stock value and low-stock alerts.
- Add or edit products with optional expiry dates, manage quantity and record stock adjustments.
- View **30-day expiry alerts** and **expired stock** on Dashboard and Inventory, with search/filter and CSV export.
- Simple point-of-sale cart with stock validation and percent discounts.
- GST-inclusive or GST-exclusive product pricing, calculating CGST/SGST for same-state supplies and IGST for interstate supplies when both states are configured.
- Customers, payment methods, fully/partially paid invoices, printing and browser **Save as PDF**.
- Sales history, basic reports, CSV exports, JSON backup and restore.
- Responsive layout for desktop, tablet and mobile.

## Important limitations

This is a **single-browser prototype**, not production-grade financial software. Records live in your browser's `localStorage`, not in GitHub or a cloud database. Clearing site data or switching devices may erase records. Download regular JSON backups in Settings. Anyone using the same browser profile can access the records. Avoid storing sensitive customer information on a shared device.

This does **not** claim GST invoicing compliance. Actual invoices can require HSN/SAC, place of supply, customer address, GSTIN validation, sequential invoice governance, tax rules for goods/services, exemptions, e-invoicing/e-way bill integration, credit notes, returns and other particulars depending on your business. Confirm requirements with a qualified tax professional and add proper authentication, a server-side database and audit controls before real business deployment.

## Deploy on GitHub Pages

1. Create a dedicated repository named `billnest` in your GitHub account.
2. Upload all files and the `tests` directory at the **root** of the repository.
3. Open **Settings → Pages** and select **Deploy from a branch**, `main`, `/ (root)`.
4. GitHub Pages will publish at `https://YOUR-USERNAME.github.io/billnest/` once deployment completes.

GitHub Pages hosts only the **website code**. It does not sync your products or invoices between devices.

The source is in the `billnest/` folder of the connected `funnyspace/funnyspace` repository. GitHub Pages must be enabled separately. With Pages set to `main` / `(root)`, the direct Billing URL will be `https://funnyspace.github.io/funnyspace/billnest/#billing`. GitHub source upload alone is not a live deployment. For a dedicated repository, use the steps above.

## Project files

- `index.html`: page shell, app loading and sidebar.
- `styles.css`: responsive application design and invoice print stylesheet.
- `logic.mjs`: tax arithmetic, gross profit, safe HTML text and CSV encoding.
- `accounting.mjs`: cashbook, invoice receivables, and estimated net-profit calculations.
- `app.js`: editable screens, interactions and local browser storage.
- `app.bundle.js`: browser-ready script, used by `index.html`.
- `scripts/build.mjs`: regenerate the portable bundle after editing the source.
- `tests/logic.test.mjs`: tests for billing calculations and stock validation.

Run all tests with `node --test tests/*.test.mjs` (Node.js 18+).

## Mobile barcode scanning (v4)

The Inventory and Billing screens include a **Scan barcode** button. On an HTTPS-hosted website, tap Scan and allow camera permission. The rear-facing camera is requested first. Use **Switch camera** if the wrong camera opens. The scanner reads product barcodes such as EAN-13, UPC, and Code 128, subject to the phone/browser's decoder support.

- **Inventory:** Scanning a saved barcode or SKU opens the existing product to edit. A new code opens the product form with the barcode and SKU prefilled. Enter the name, price, stock, and GST rate manually before saving.
- **Billing:** Scanning a known code adds one unit to the active invoice (up to available stock). Scanning an unknown code opens the product form, then returns to Billing and adds it automatically if its initial stock is positive.
- **Product form:** Scan to fill the barcode input, or type/paste a code. Each product barcode must be unique and previously saved SKU values still match.
- **Improved recognition:** The scanner starts with the browser native decoder where it supports retail barcodes, then automatically attempts to switch to the ZXing decoder if it repeatedly fails to read a code. Both decoders are browser-based, and a clear error is shown when a decoder cannot load.
- **Camera selection:** The ZXing reader explicitly requests the rear-facing camera instead of taking the device default (often the selfie camera). The **Switch camera**, **Retry**, and supported **Flashlight** controls are available.
- **Photo scanning:** Use **Scan from photo / camera** to take or select a clear barcode photograph, which can help with small or poorly focused labels. An image is read locally by the browser and is not uploaded by BillNest.
- **Manual entry:** Type the barcode, EAN, UPC, or SKU and tap **Use code** if recognition is unavailable.
- **Privacy:** Video is processed in the browser and not uploaded by this application. The initial fallback decoder script, if needed, is downloaded from the CDN. Camera tracks are stopped on close, navigation, and page exit; the camera is paused in background tabs and restarted when returning.
- **Important:** Camera access requires HTTPS (or another browser-trusted secure origin), explicit user permission, and an actual mobile camera. A locally opened `index.html` may only offer manual entry. For live camera access, deploy to an HTTPS host. This is still a browser-local storage app, not a multi-device synchronized inventory system.

### Build / tests

```bash
node scripts/build.mjs
node --test tests/*.mjs
```

After changing `app.js` or `logic.mjs`, always regenerate `app.bundle.js`. Deploy both `styles.css` and `app.bundle.js` with `index.html` together, and hard-refresh your mobile browser if the old version is cached.

### Troubleshooting a barcode that does not scan

1. Use the **published HTTPS website** in Chrome (Android) or Safari (iPhone), not a `file://` ZIP preview or GitHub source-code view. Allow camera permission in browser site settings.
2. Hold the printed barcode flat in good light, with the full barcode inside the guide. Tap **Switch camera** if the selfie camera opens. Avoid zooming so close that the lines blur.
3. Leave the camera pointed at the code for several seconds so the app can switch decoding engines when needed. The fallback decoder requires internet access to load its script.
4. Try **Scan from photo / camera**, then **manual entry** if the photo is unreadable.

Product information (price, tax, description) is *not* derived from a UPC/EAN barcode automatically. A new product must be saved first.


## Close-range live barcode scanning (10–20 cm)

- Uses the rear camera at up to 1080p when supported and requests continuous autofocus where the browser exposes it.
- Does **not** restart the video stream when switching from native recognition to ZXing, preventing an autofocus reset.
- Native recognition alternates full-frame and a high-resolution central region before trying the enhanced reader.
- If multiple camera lenses are exposed, use the **Camera lens** selector to select a **Macro** or close-focus lens.
- On supported phones, use the **Zoom** slider or **Refocus** button to improve framing. Zoom cannot fix a physically out-of-focus camera.
- **Scan from photo / camera** is retained for phones that cannot focus at 10–20 cm during a live browser video stream.
- Live camera access requires HTTPS or localhost; the external ZXing fallback requires internet access.

A web app cannot force an unsupported camera lens or guarantee that every phone's camera focuses at 10 cm. Keep the full bars and quiet zones visible; reduce reflections and ensure even lighting.

## Invoice Terms & Conditions

Open **Settings → Store settings → Invoice Terms & Conditions** and enter the terms you would like printed on customer bills. Click **Save settings**. The text is displayed on the **bottom-left of newly generated invoices**, alongside the totals on the right. Line breaks are preserved. Empty text hides this section. Terms are saved in the browser and included in JSON backups; each generated invoice keeps its original terms, even if you update your store settings later. Existing invoices created before this update continue to display without terms.

## Business logo and invoice footer customization

Go to **Settings → Business details** to upload a **PNG, JPG or WebP** shop logo (up to 4 MB). The image is resized within 360 × 180 px for quick local saving. Click **Save settings** after selecting or removing it. The logo appears at the top center of the bill above the business name, including print/PDF output. SVG files and remote image URLs are not accepted. The browser retains logo versions used on previously issued invoices, even when you remove your current logo. Logo image data is stored once per version in `logoAssets` rather than copied into every invoice, keeping invoices compact.

Under **Settings → Invoice footer message**, customise **Thank-you message** and **Second footer line**. Leave either field empty to hide that line. Both lines are centred at the bottom of new invoices. The existing **Invoice Terms & Conditions** field remains separate and prints at the lower-left beside the invoice totals. Past invoices retain their original logo, terms and footer text because they capture the settings active when the invoice was issued.

All settings, logo versions and invoices are saved only in this browser's local workspace. A **Download JSON** backup also contains the logo assets. Do not clear browser storage without backing up your store data.

## Profit and loss in Reports

The Reports page shows gross profit or loss for the last 7, 30 or 90 days, or all time. Search any product by name or SKU for its sales, cost, gross profit, margin and profit/loss status. Products with no sales show no realized gross profit.

- **Gross profit = net invoiced sales (excluding GST and after discounts) minus purchase cost for units sold.** This is not net business profit: rent, freight, wages, returns, fees and other operating costs are not included. Credit/unpaid invoices are counted as invoiced sales.
- On **new invoices**, purchase costs are saved with each invoice line in integer paise, so editing current product costs does not change the historical gross profit. Existing invoices are never mutated during display.
- On **older invoices** without cost snapshots, historical gross profit is **estimated from the product's current purchase cost**, and the Reports page warns about these estimates. If a product has been deleted and its cost cannot be found, its sales are included in the sales total but excluded from the partial gross profit calculation, with an explicit warning.
- Fill purchase cost for each product accurately, and use accounting software for financial net profit, tax reporting, and adjustments.


## Accounting and cashbook (Version 11)

Open **Accounting** from the sidebar or the **Accounts** tab at the bottom of the mobile website. The dashboard includes a 30-day estimated net-profit summary and a direct Accounting shortcut.

- **Cash and bank balances:** Set opening amounts once using **Opening balances**. BillNest adds existing paid invoices and recorded cash/bank movements on top. UPI, card and bank transfer receipts are treated as bank movements. When you enter opening balances, avoid counting money already reflected in BillNest paid invoices.
- **New transaction:** Enter an operating expense (rent, salary, transport, utilities), other income, inventory purchase payment, owner contribution, owner drawing or a cash/bank transfer. All values are entered in INR and stored internally in paise.
- **Customer credit:** Selecting **Credit** when creating an invoice keeps the invoice outstanding. Use **Receive payment** from Accounting or Invoices to record partial or full payments; receipts update cash/bank balances and customer outstanding. Full payment marks the invoice as paid.
- **Cashbook:** View dates, transaction descriptions, cash/bank movements, auto-collected paid invoices and manually entered transactions. Filter by date, search, export CSV or delete a mistaken manual entry with confirmation.
- **Profit or loss:** Uses **invoiced gross profit excluding GST** plus **other income** minus **operating expenses**. Inventory purchases, cash/bank transfers, and owner drawings are **not** operating expenses, and invoice receipts are **not** sales revenue again. Some older invoices lack historical cost snapshots; those values are estimates, and missing costs produce an incomplete profit report.
- **Backup compatibility:** Existing BillNest v1 browser data and JSON backups without accounting fields are read with empty accounting records. New backups include accounting entries and opening balances. The original data format stays at `version: 1` to preserve existing files.

**Scope and caveats:** This is a practical cashbook and management P/L, *not* a double-entry accounting system or audited balance sheet. The opening balance is an initial amount before the activity recorded in this workspace, not a dated bank reconciliation. Supplier payables, GST input-credit, purchase tax allocation, returns/refunds, asset depreciation, loan balances, bank statement reconciliation, and statutory accounting are not implemented. Inventory purchase payments do not automatically increase product quantity; update stock in **Inventory** as a separate operation. Browser local storage is not multi-device synchronized, so back up regularly.

Run `node --test tests/*.test.mjs` to test both billing and accounting calculations.

## Expiry dates and mobile shortcuts

- **Inventory → Add product / Edit product → Expiry date** stores an optional date (`YYYY-MM-DD`) per product. Older data without an expiry date remains compatible.
- From **30 calendar days before expiration**, stocked products receive an **Expiring** warning. The dashboard **Stock & expiry alerts** panel lists urgent products; Inventory includes **Expiring ≤30 days** and **Expired** filters.
- Expired items are visibly marked in red. This is an **in-app alert when you open or use BillNest**, not an OS push notification, email, or background reminder.
- **Important:** A product currently has only one expiry date, not individual batch/lot expiry tracking. If multiple batches of the same product have different expiry dates, use separate SKUs for now. The scanner and checkout otherwise work as before.
- On phones, Billing, Add product, and Accounting are three equal-width shortcuts on the same row. Raised vector icons render without downloading icon files.

## Reliable barcode scanning (v16)

Live scanning includes an offline EAN-13, EAN-8 and UPC-A decoder alongside the browser native detector and optional ZXing reader for Code 128, QR and other formats. Retail decodes are accepted only after the GTIN check digit validates; repeated reads use a cooldown to prevent accidental duplicate items. UPC-A and EAN-13-with-leading-zero match the same inventory product. Camera video is processed on the device and not uploaded. The photo/manual options remain available.

For a close-range barcode (10–20 cm), use the rear or macro camera in good light and keep the complete bars, including white margins, within the guide. Some devices cannot autofocus at 10 cm; moving back to 20–30 cm may be required.

## Camera auto-focus and auto-light (Version 17)

Live scanning keeps reading frames until it recognizes a barcode or you close the scanner. The phone's continuous autofocus is enabled when supported. Cameras offering only single-shot autofocus are periodically prompted to refocus while the scanner is searching. If the browser does not expose focus controls, the phone handles focus itself.

The scanner estimates light from camera pixels locally. On phones exposing torch control, sustained dark frames automatically enable the flashlight. It stays on during the session to prevent repeated flashing. The Light button cycles **Auto → On → Off → Auto**, so you can override automation. The light is turned off when scanning closes. Photo scanning and manual entry are unchanged. Actual focus distance and torch support still depend on phone hardware, the selected lens, and the browser.

## Full-width mobile barcode preview (Version 18)

On mobile phones, the live camera fills the full preview rather than appearing in a narrow letterboxed center column. The scanning guide spans almost the entire preview width. The offline retail decoder now examines the complete *visible* camera crop (matching CSS `object-fit: cover`) and samples rows from near the top to near the bottom, rather than using only a middle camera strip. Native and ZXing recognition, automatic focus and light, camera selection, photo scanning, manual entry, and stored inventory are unchanged. A tightly cropped view can hide labels outside the display; move the phone enough to keep the entire barcode including quiet zones in the visible camera view.

## UPI payment QR (Version 22)

1. Open **Settings > Store settings > UPI payment QR**, enter your receiving UPI ID (example: shop@upi), verify it, and save.
2. In **Billing**, select **UPI**, add products and generate the invoice. BillNest creates an exact-amount INR QR for the saved payee, with a distinct invoice reference.
3. The QR appears immediately after generation, on reopened invoices, and when printing unpaid UPI invoices.
4. Check the payment in your bank or UPI app, then select **Record verified payment** and save the receipt. Displaying or scanning the QR never confirms payment. Partial payments reduce outstanding dues.
5. The QR encoder is vendored locally from QRCode.js (davidshimjs, MIT license). See vendor-LICENSE-qrcodejs.txt. This is not a payment gateway or automatic bank-verification integration.

Previous invoices and backups remain compatible. Previously paid UPI invoices remain paid.

## Hindi / English interface and receipt printing

BillNest has an **EN / हिं** language switch in the top bar. Tap it to switch between
English and Hindi. The selection stays on this browser/device across reloads.
Main navigation, dashboards, billing, inventory, accounting, forms, settings,
and common actions are translated. Numbers, invoice values, product names and
customer details are not translated or changed. Some extended help/error text
and legacy invoice content may remain in English.

**Thermal receipt printing:**

1. Open **Settings > Receipt printer** and choose **58 mm** or **80 mm**.
2. On desktop or phone, pair/install your thermal printer using your operating
   system or the manufacturer's print service. Set the matching 58/80 mm paper
   size in the printer driver or browser's print dialog.
3. Create an invoice, or open a saved invoice from **Invoices & Sales**.
4. Click **Print thermal receipt** to open a compact receipt in a new tab,
   then choose the installed printer in the system print dialog. This route
   can work for **Bluetooth Classic, USB, and Wi-Fi** printers that are
   installed in the operating system. Allow pop-ups for BillNest if prompted.
5. An optional **Bluetooth LE** button can directly send ESC/POS bytes from
   supported HTTPS browsers to a *compatible* BLE GATT printer. It requests
   explicit device permission and tests a few common write characteristics.
   It will not work with every printer or Bluetooth Classic-only device.
   Direct ESC/POS output is ASCII-only, and blocks Hindi/Unicode product or
   shop names instead of silently replacing them. For Hindi receipts, use
   the system print route, which prints with the device's Unicode fonts.
6. **Test receipt** in Settings prints clearly marked sample data without
   recording any invoice or stock movement.

Receipts contain the stored invoice number/date, customer, items and
quantities, taxable amount, CGST/SGST or IGST, discount, total, payment
method, and any outstanding balance, plus shop details and footer text.
The original A4 **Print / Save as PDF** button remains available.

**Compatibility:** Browser permission and printer protocol support vary.
Web Bluetooth supports Bluetooth **Low Energy GATT**, not generic Bluetooth
Classic SPP connections. Chromium desktop browsers can support compatible
Bluetooth Classic serial devices using Web Serial; this BillNest implementation
currently uses the operating-system print route for Classic devices.
Bluetooth LE direct printing must be tested on the actual ESC/POS model.
A generic website cannot guarantee automatic cut, Hindi support, connection
stability, or silent printing on every thermal printer.

## Email and mobile OTP sign-in

BillNest now provides a **Sign in** button in the top bar. Users can sign up or sign in with
an **email address** or a **mobile number** by entering a one-time verification code.
The first successful verification creates the account if sign-ups are enabled in Supabase.
Existing users sign in to their account. No password is stored by BillNest.

**One-time setup for the website owner:**

1. Create a Supabase project or use the existing project configured for cloud backup.
2. In **Authentication > Providers**, enable Email and Phone.
3. In **Authentication > Email Templates**, change the Magic Link/OTP template to include
   `{{ .Token }}`, so email sign-in sends a numeric OTP instead of only a clickable link.
4. Configure an SMS sending provider under the Phone provider. SMS is generally not free.
   For India, confirm applicable TRAI/DLT requirements with your SMS provider.
5. Run `supabase-schema.sql` in the project's SQL Editor for private cloud backups with RLS.
6. Open `auth-config.js` and set `url` to your public Supabase project URL and `key`
   to the **public publishable/anon key**. **Never put a secret or service_role key in
   GitHub Pages.** This public config lets all users access the same authentication project.
   For private testing, it is also possible to leave the file blank and configure
   **Settings > Cloud backup** individually in a browser.
7. Deploy the updated files and test both flows with real email and phone numbers.

**How user data works:** Guest/offline billing remains available without signing in.
After sign-in, each account's **local browser workspace** is stored under its own key.
Switching accounts or signing out never deletes another workspace. To transfer an existing
offline store into a new account, select **My Account > Copy offline store to this account**.
This copy option is intentionally shown only when that account does not yet have local data.
Always download a JSON backup before any important migration.

**Security limits:** BillNest is still a client-side prototype. Account selection isolates
the UI's local data but does **not** encrypt localStorage or prevent someone with direct
browser/device access from inspecting it. Supabase RLS protects remote backups, not browser
files. A real multi-user production POS needs server-enforced authorization, device/session
controls, audit logging, and a database for protected invoice data. Cloud backup is not
automatic live multi-device synchronization. Email and phone credentials are not
automatically linked to the same Supabase account; account linking needs a separate verified flow.

## Cloud backup when online (Version 23)

BillNest now includes an optional automatic cloud backup panel in **Settings > Cloud backup**. Changes are saved in the browser first, then uploaded to the signed-in Supabase project while online. Offline changes are queued for the next connection. There is no automatic cross-device data merge.

**One-time setup is required.** Create a Supabase project, run `supabase-schema.sql` in its SQL Editor, enable email OTP (email template `{{ .Token }}`), and enter your project URL plus **public publishable/anon** key in BillNest. Sign in by emailed code. Never use a service_role/secret key.

Cloud backups are private per signed-in user through RLS, with one latest snapshot per device. The Cloud backup panel lists available devices and offers explicit **Restore** with confirmation. Save a JSON backup before restoring another device's data. The implementation is limited to about 8 MB per workspace. The website remains hosted by GitHub Pages, while the actual database is supplied by **your** Supabase project.

See [CLOUD_SETUP.md](CLOUD_SETUP.md) for complete instructions, security considerations, and limitations.

## BillNest brand identity (Version 24)

The website now uses the signature receipt-shaped **B** icon with a white upper half, emerald-green lower half and receipt-edge silhouette. The sidebar lockup retains the lowercase **billnest.** wordmark and **INVENTORY + BILLING** subtitle. The browser favicon uses the same B mark on a navy tile; the mobile header displays a compact mark where horizontal space allows. The vector master is `logo-mark.svg`. The rest of Billing, Inventory, Cloud Backup, and the saved business workspace remain unchanged.

## Install BillNest on Android (Version 25)

BillNest is now an installable **Progressive Web App (PWA)**. In Android Chrome, open the BillNest site and select **Install App** from the mobile banner, or Chrome's menu **Install app** / **Add to Home screen**. The installed app launches standalone with the receipt-shaped BillNest B icon and starts on the existing dashboard. The web app's shell, scanner code, styling, QR library and app icons are cached by `sw.js` for offline access. All customer/workspace data continues to be stored locally; cloud backup still requires optional Supabase configuration.

**Important:** An Android WebView APK stores browser data separately from Chrome. Before switching to an APK, export a BillNest JSON backup in Settings, then import it within the installed app. Never assume installation automatically migrates records.

See the Android APK source and build instructions under `android/`. A workflow provides downloadable test APK build artifacts when GitHub Actions is enabled. Public distribution and production updates should use an appropriately protected, persistent release signing key.

The built test APK is also hosted at `billnest/download/BillNest-Android-Test.apk` for a direct mobile download. This is a debug-signed preview only, not a production or Play Store release. A matching Download APK (test) link appears beside the PWA Install App option on mobile.

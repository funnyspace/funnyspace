# BillNest: Simple inventory and billing

A clean, mobile-friendly starter website for a small shop, with product and stock tracking, customers, GST-aware invoicing, printable invoices and basic reports. **No npm install, database or paid server is needed to try it.**

## Open the website

1. Download the ZIP, extract the `billnest` folder, and **double-click `index.html`** in a modern browser. The included `app.bundle.js` works without a web server and does not need npm.
2. Choose **Billing** in the left sidebar. On phones, use the **Billing** tab in the fixed bottom navigation.
3. The dashboard offers one-click actions for **Billing**, **Add product**, and **View invoices**.
4. A clearly labelled **demo workspace** appears first. Click **Start with an empty store** to remove sample data, then add products in **Inventory** and create your own invoice.

If opening files is restricted by your browser, serve the folder using `python -m http.server 8000` and visit `http://localhost:8000`.

Direct page links work using URL hashes such as `index.html#dashboard`, `index.html#billing`, and `index.html#inventory`. The browser's Back and Forward navigation works with these links.

## Development

The editable source is split between `app.js` (screens and events) and `logic.mjs` (calculations). The website loads `app.bundle.js` to avoid browser module/CORS issues when opening the ZIP. **After editing app.js or logic.mjs, regenerate the bundle** with `node scripts/build.mjs`. Test with `node --test tests/*.test.mjs` (Node.js 18+).

## Features

- Overview dashboard with sales, stock value and low-stock alerts.
- Add or edit products, manage quantity and record stock adjustments.
- Simple point-of-sale cart with stock validation and percent discounts.
- GST-inclusive or GST-exclusive product pricing, calculating CGST/SGST for same-state supplies and IGST for interstate supplies when both states are configured.
- Customers, payment methods, paid/unpaid invoices, printing and browser **Save as PDF**.
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
- `logic.mjs`: tax arithmetic, safe HTML text and CSV encoding.
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

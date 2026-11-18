# BillNest: Simple inventory and billing

A clean, mobile-friendly starter website for a small shop, with product and stock tracking, customers, GST-aware invoicing, printable invoices and basic reports. **No npm install, database or paid server is needed to try it.**

## Run locally

1. Download the ZIP and extract it.
2. Open `index.html` in Chrome or Edge, or run `python -m http.server 8000` inside the folder and open `http://localhost:8000`.
3. A clearly labelled **demo workspace** appears first. Click **Start with an empty store** to erase the sample records.
4. Enter your shop information in **Settings**, then add products, customers and create bills.

Note: Because the application uses ES modules, some browsers disallow opening `index.html` directly using `file://`. Use a local web server if the page is blank.

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

The source was also added under `billnest/` in the connected `funnyspace/funnyspace` repository. For that repository, enable Pages for `main` / `(root)`, then visit `https://funnyspace.github.io/funnyspace/billnest/` once GitHub reports a successful deployment. For a dedicated repository, use the steps above.

## Project files

- `index.html`: page shell, app loading and sidebar.
- `styles.css`: responsive application design and invoice print stylesheet.
- `logic.mjs`: tax arithmetic, safe HTML text and CSV encoding.
- `app.js`: screens, interactions and local browser storage.
- `tests/logic.test.mjs`: tests for billing calculations and stock validation.

Run all tests with `node --test tests/*.test.mjs` (Node.js 18+).

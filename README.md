# 🛍️ Shady Store POS

A fully-featured, offline-ready **Point of Sale** Progressive Web App built with Vanilla JS, Tailwind CSS, and LocalStorage.

## ✨ Features

- **📱 Mobile-First PWA** — Installable on Android/iOS, works offline via Service Worker
- **🌙 Dark / Light Mode** — Toggle with preference saved
- **🌍 Bilingual EN/AR + RTL** — Full Arabic support with automatic RTL layout flip
- **🛒 Smart Cart** — Bottom-sheet drawer on mobile, side panel on desktop
- **📷 Barcode Scanner** — Global keyboard listener for USB/Bluetooth barcode scanners
- **📊 Dashboard** — Daily revenue, profit, orders, and low-stock alerts
- **💰 Cost vs Selling Price** — Cost price hidden from POS & receipts, shown only in admin
- **🧾 Thermal Receipt Printing** — `@media print` optimized for 80mm thermal printers
- **📦 Category Management** — Full CRUD with emoji icons
- **🗂️ Product Management** — Full CRUD with bilingual names, barcode, stock tracking
- **📤 CSV Export** — Export full sales history

## 🚀 Deploy to GitHub Pages

1. Create a new GitHub repository
2. Upload all files:
   - `index.html`
   - `app.js`
   - `translations.js`
   - `manifest.json`
   - `sw.js`
3. Go to **Settings → Pages → Source → main branch → / (root)**
4. Your app will be live at `https://YOUR_USERNAME.github.io/YOUR_REPO/`

## 📁 File Structure

```
shady-store/
├── index.html        # App shell + all HTML views
├── app.js            # Full application logic
├── translations.js   # EN/AR i18n dictionary
├── manifest.json     # PWA manifest
├── sw.js             # Service Worker (offline caching)
└── README.md
```

## 🔑 Key Architecture Notes

| Concern | Solution |
|---|---|
| State | In-memory JS object, persisted via localStorage |
| Routing | Single-page, show/hide `.view-section` divs |
| i18n | `TRANSLATIONS[lang][key]`, `data-t` attributes auto-updated |
| RTL | `document.documentElement.dir`, Tailwind logical props (`ms-`, `me-`, `ps-`, `pe-`) |
| Print | `@media print` hides app, shows `#receipt-print` div |
| PWA | `manifest.json` + `sw.js` cache-first strategy |
| Barcode | `keydown` listener, 100ms timeout to detect scan vs typing |

## 🧾 Demo Data

On first load, the app seeds 4 categories and 9 products automatically. You can clear LocalStorage in DevTools to reset.

## 🔧 Customization

Edit `translations.js` to add more languages.  
Edit the `seedDemoData()` function in `app.js` to change initial products.  
Edit `state.settings` defaults in `app.js` to change currency, tax rate, etc.

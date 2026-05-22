// ============================================================
// app.js — Shady Store POS · Main Application Logic
// ============================================================
// Sections:
//   1. State & Constants
//   2. LocalStorage helpers
//   3. i18n / Language
//   4. Theme
//   5. Sidebar / Navigation
//   6. Products CRUD
//   7. POS / Cart
//   8. Barcode scanner listener
//   9. Checkout flow
//  10. Dashboard
//  11. History
//  12. Settings
//  13. Receipt / Print
//  14. Toast notifications
//  15. Init
// ============================================================

/* ─── 1. State & Constants ─────────────────────────────── */

const DEFAULT_TAX_RATE  = 14;   // percent
const LOW_STOCK_LIMIT   = 5;

let state = {
  lang:        'en',
  theme:       'dark',
  currentPage: 'pos',
  cart:        [],          // [{ product, qty }]
  products:    [],
  sales:       [],
  settings: {
    storeName:   'Shady Store',
    storeAddress: '123 Main Street, Cairo',
    storePhone:  '+20 100 000 0000',
    taxRate:     DEFAULT_TAX_RATE,
    currency:    'EGP',
    lang:        'en',
    theme:       'dark',
  },
  posSearch:   '',
  posCategory: 'All',
  barcodeBuffer: '',
  barcodeTimer:  null,
};

// Emoji icons for product categories (fallback)
const CATEGORY_ICONS = {
  Food:        '🍔',
  Drinks:      '🥤',
  Electronics: '📱',
  Clothing:    '👕',
  Health:      '💊',
  Stationery:  '✏️',
  Other:       '📦',
};

const CATEGORIES = ['Food', 'Drinks', 'Electronics', 'Clothing', 'Health', 'Stationery', 'Other'];

/* ─── 2. LocalStorage helpers ──────────────────────────── */

const DB = {
  // Products
  getProducts:  () => JSON.parse(localStorage.getItem('ss_products')  || '[]'),
  setProducts:  (d) => localStorage.setItem('ss_products',  JSON.stringify(d)),
  // Sales
  getSales:     () => JSON.parse(localStorage.getItem('ss_sales')     || '[]'),
  setSales:     (d) => localStorage.setItem('ss_sales',     JSON.stringify(d)),
  // Settings
  getSettings:  () => JSON.parse(localStorage.getItem('ss_settings')  || 'null'),
  setSettings:  (d) => localStorage.setItem('ss_settings',  JSON.stringify(d)),
};

/* ─── 3. i18n / Language ───────────────────────────────── */

function t(key) {
  return (translations[state.lang] || translations.en)[key] || key;
}

function applyLanguage(lang) {
  state.lang = lang;
  const html = document.documentElement;
  if (lang === 'ar') {
    html.setAttribute('dir', 'rtl');
    html.setAttribute('lang', 'ar');
  } else {
    html.setAttribute('dir', 'ltr');
    html.setAttribute('lang', 'en');
  }
  // Re-render current page with new language
  renderPage(state.currentPage);
  updateNavLabels();
  updateStaticI18n();
}

function updateStaticI18n() {
  // Update all elements with data-i18n attribute
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      el.placeholder = t(key);
    } else {
      el.textContent = t(key);
    }
  });
}

/* ─── 4. Theme ─────────────────────────────────────────── */

function applyTheme(theme) {
  state.theme = theme;
  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
  updateThemeToggleBtn();
}

function updateThemeToggleBtn() {
  const btn = document.getElementById('themeToggle');
  if (!btn) return;
  const isDark = state.theme === 'dark';
  btn.innerHTML = isDark
    ? `<i class="fa-solid fa-sun text-amber-400"></i>`
    : `<i class="fa-solid fa-moon text-indigo-500"></i>`;
  btn.title = isDark ? t('lightMode') : t('darkMode');
}

/* ─── 5. Sidebar / Navigation ──────────────────────────── */

const NAV_ITEMS = [
  { id: 'pos',       icon: 'fa-solid fa-cash-register',  key: 'nav_pos'       },
  { id: 'products',  icon: 'fa-solid fa-boxes-stacked',  key: 'nav_products'  },
  { id: 'dashboard', icon: 'fa-solid fa-chart-line',     key: 'nav_dashboard' },
  { id: 'history',   icon: 'fa-solid fa-clock-rotate-left', key: 'nav_history' },
  { id: 'settings',  icon: 'fa-solid fa-gear',           key: 'nav_settings'  },
];

function buildSidebar() {
  const nav = document.getElementById('sidebarNav');
  if (!nav) return;
  nav.innerHTML = NAV_ITEMS.map(item => `
    <button
      id="nav-${item.id}"
      onclick="navigateTo('${item.id}')"
      class="nav-btn w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200
             hover:bg-white/10 text-slate-400 hover:text-white group"
      aria-label="${t(item.key)}"
    >
      <i class="${item.icon} w-5 text-center text-lg"></i>
      <span class="nav-label sidebar-label">${t(item.key)}</span>
    </button>
  `).join('');
  highlightNav(state.currentPage);
}

function updateNavLabels() {
  NAV_ITEMS.forEach(item => {
    const btn = document.getElementById(`nav-${item.id}`);
    if (btn) {
      const label = btn.querySelector('.nav-label');
      if (label) label.textContent = t(item.key);
    }
  });
}

function highlightNav(pageId) {
  NAV_ITEMS.forEach(item => {
    const btn = document.getElementById(`nav-${item.id}`);
    if (!btn) return;
    if (item.id === pageId) {
      btn.classList.add('bg-indigo-600', 'text-white', '!text-white');
      btn.classList.remove('text-slate-400', 'hover:bg-white/10');
    } else {
      btn.classList.remove('bg-indigo-600', 'text-white', '!text-white');
      btn.classList.add('text-slate-400', 'hover:bg-white/10');
    }
  });
}

function navigateTo(pageId) {
  state.currentPage = pageId;
  highlightNav(pageId);
  renderPage(pageId);
  // Close mobile sidebar if open
  document.getElementById('sidebar')?.classList.remove('sidebar-open');
  document.getElementById('sidebarOverlay')?.classList.add('hidden');
}

function toggleSidebar() {
  const sidebar  = document.getElementById('sidebar');
  const overlay  = document.getElementById('sidebarOverlay');
  const isOpen   = sidebar?.classList.contains('sidebar-open');
  sidebar?.classList.toggle('sidebar-open', !isOpen);
  overlay?.classList.toggle('hidden', isOpen);
}

/* ─── 6. Products CRUD ─────────────────────────────────── */

function loadProducts() {
  state.products = DB.getProducts();
  if (state.products.length === 0) {
    // Seed with demo products
    state.products = [
      { id: genId(), name: 'Cola Can',       price: 25,   category: 'Drinks',      barcode: '1001', stock: 50, icon: '🥤' },
      { id: genId(), name: 'Burger Meal',    price: 120,  category: 'Food',        barcode: '1002', stock: 30, icon: '🍔' },
      { id: genId(), name: 'Water Bottle',   price: 10,   category: 'Drinks',      barcode: '1003', stock: 100,icon: '💧' },
      { id: genId(), name: 'Phone Charger',  price: 350,  category: 'Electronics', barcode: '1004', stock: 8,  icon: '🔌' },
      { id: genId(), name: 'Notebook',       price: 45,   category: 'Stationery',  barcode: '1005', stock: 25, icon: '📓' },
      { id: genId(), name: 'T-Shirt',        price: 180,  category: 'Clothing',    barcode: '1006', stock: 15, icon: '👕' },
      { id: genId(), name: 'Pain Relief',    price: 85,   category: 'Health',      barcode: '1007', stock: 4,  icon: '💊' },
      { id: genId(), name: 'Chips Bag',      price: 20,   category: 'Food',        barcode: '1008', stock: 60, icon: '🍟' },
    ];
    DB.setProducts(state.products);
  }
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function saveProducts() {
  DB.setProducts(state.products);
}

function renderProductsPage() {
  const content = document.getElementById('pageContent');
  content.innerHTML = `
    <div class="p-6 max-w-7xl mx-auto">
      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 class="text-2xl font-bold text-slate-900 dark:text-white">${t('productsTitle')}</h1>
        <button onclick="openProductModal()" class="btn-primary flex items-center gap-2">
          <i class="fa-solid fa-plus"></i> ${t('addProduct')}
        </button>
      </div>
      <!-- Search -->
      <div class="relative mb-4">
        <i class="fa-solid fa-magnifying-glass absolute top-1/2 -translate-y-1/2 start-3 text-slate-400"></i>
        <input id="prodSearch" type="text" placeholder="${t('search')}"
          class="input-field ps-10 w-full"
          oninput="filterProductsTable(this.value)" />
      </div>
      <!-- Table -->
      <div class="card overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400">
                <th class="text-start py-3 px-4">${t('productName')}</th>
                <th class="text-start py-3 px-4">${t('category')}</th>
                <th class="text-start py-3 px-4">${t('price')}</th>
                <th class="text-start py-3 px-4">${t('stock')}</th>
                <th class="text-start py-3 px-4">${t('productBarcode')}</th>
                <th class="text-start py-3 px-4">${t('actions')}</th>
              </tr>
            </thead>
            <tbody id="productsTableBody">
              ${renderProductsTableRows(state.products)}
            </tbody>
          </table>
        </div>
      </div>
    </div>
    ${productModal()}
  `;
}

function renderProductsTableRows(products) {
  if (!products.length) {
    return `<tr><td colspan="6" class="text-center py-12 text-slate-500 dark:text-slate-400">
      <i class="fa-solid fa-box-open text-4xl mb-3 block opacity-30"></i>
      ${t('noProductsYet')}
    </td></tr>`;
  }
  return products.map(p => `
    <tr class="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
      <td class="py-3 px-4">
        <div class="flex items-center gap-3">
          <span class="text-2xl">${p.icon || '📦'}</span>
          <span class="font-medium text-slate-900 dark:text-white">${esc(p.name)}</span>
        </div>
      </td>
      <td class="py-3 px-4">
        <span class="badge">${esc(p.category)}</span>
      </td>
      <td class="py-3 px-4 font-semibold text-emerald-600 dark:text-emerald-400">
        ${fmt(p.price)}
      </td>
      <td class="py-3 px-4">
        <span class="${p.stock < LOW_STOCK_LIMIT ? 'text-red-500 font-semibold' : 'text-slate-700 dark:text-slate-300'}">
          ${p.stock}
          ${p.stock < LOW_STOCK_LIMIT ? '<i class="fa-solid fa-triangle-exclamation ms-1 text-amber-500"></i>' : ''}
        </span>
      </td>
      <td class="py-3 px-4 font-mono text-slate-500 dark:text-slate-400">${esc(p.barcode)}</td>
      <td class="py-3 px-4">
        <div class="flex items-center gap-2">
          <button onclick="openProductModal('${p.id}')" class="btn-icon-sm text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30" title="${t('edit')}">
            <i class="fa-solid fa-pen-to-square"></i>
          </button>
          <button onclick="deleteProduct('${p.id}')" class="btn-icon-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30" title="${t('delete')}">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

function filterProductsTable(query) {
  const filtered = state.products.filter(p =>
    p.name.toLowerCase().includes(query.toLowerCase()) ||
    p.barcode.toLowerCase().includes(query.toLowerCase()) ||
    p.category.toLowerCase().includes(query.toLowerCase())
  );
  const tbody = document.getElementById('productsTableBody');
  if (tbody) tbody.innerHTML = renderProductsTableRows(filtered);
}

function productModal(productId = null) {
  const p = productId ? state.products.find(x => x.id === productId) : null;
  const isEdit = !!p;
  return `
    <div id="productModal" class="modal-overlay ${isEdit ? '' : 'hidden'}">
      <div class="modal-box">
        <div class="flex items-center justify-between mb-5">
          <h2 class="text-lg font-bold text-slate-900 dark:text-white">
            ${isEdit ? t('editProduct') : t('addProduct')}
          </h2>
          <button onclick="closeProductModal()" class="btn-icon text-slate-500 hover:text-slate-700">
            <i class="fa-solid fa-xmark text-xl"></i>
          </button>
        </div>
        <form id="productForm" onsubmit="submitProductForm(event)" class="space-y-4">
          <input type="hidden" id="pf_id" value="${isEdit ? p.id : ''}">
          <div class="grid grid-cols-2 gap-4">
            <div class="col-span-2">
              <label class="form-label">${t('productName')}</label>
              <input id="pf_name" type="text" required class="input-field w-full" value="${isEdit ? esc(p.name) : ''}">
            </div>
            <div>
              <label class="form-label">${t('productPrice')}</label>
              <input id="pf_price" type="number" min="0" step="0.01" required class="input-field w-full" value="${isEdit ? p.price : ''}">
            </div>
            <div>
              <label class="form-label">${t('productStock')}</label>
              <input id="pf_stock" type="number" min="0" required class="input-field w-full" value="${isEdit ? p.stock : ''}">
            </div>
            <div>
              <label class="form-label">${t('productCategory')}</label>
              <select id="pf_category" class="input-field w-full">
                ${CATEGORIES.map(c => `<option value="${c}" ${isEdit && p.category === c ? 'selected' : ''}>${c}</option>`).join('')}
              </select>
            </div>
            <div>
              <label class="form-label">${t('productIcon')}</label>
              <input id="pf_icon" type="text" class="input-field w-full" value="${isEdit ? p.icon : '📦'}" maxlength="4">
            </div>
            <div class="col-span-2">
              <label class="form-label">${t('productBarcode')}</label>
              <input id="pf_barcode" type="text" class="input-field w-full" value="${isEdit ? esc(p.barcode) : ''}">
            </div>
          </div>
          <div class="flex justify-end gap-3 pt-2">
            <button type="button" onclick="closeProductModal()" class="btn-secondary">${t('cancel')}</button>
            <button type="submit" class="btn-primary">${t('save')}</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

function openProductModal(productId = null) {
  const modal = document.getElementById('productModal');
  if (!modal) return;
  // Re-render modal with correct product data
  const container = document.createElement('div');
  container.innerHTML = productModal(productId);
  const newModal = container.querySelector('#productModal');
  modal.replaceWith(newModal);
  document.getElementById('productModal').classList.remove('hidden');
}

function closeProductModal() {
  document.getElementById('productModal')?.classList.add('hidden');
}

function submitProductForm(e) {
  e.preventDefault();
  const id       = document.getElementById('pf_id').value;
  const product  = {
    id:       id || genId(),
    name:     document.getElementById('pf_name').value.trim(),
    price:    parseFloat(document.getElementById('pf_price').value),
    stock:    parseInt(document.getElementById('pf_stock').value),
    category: document.getElementById('pf_category').value,
    icon:     document.getElementById('pf_icon').value || '📦',
    barcode:  document.getElementById('pf_barcode').value.trim(),
  };

  if (id) {
    const idx = state.products.findIndex(p => p.id === id);
    if (idx > -1) state.products[idx] = product;
  } else {
    state.products.push(product);
  }
  saveProducts();
  closeProductModal();
  showToast(t('settingsSaved'), 'success');
  // Refresh table rows
  const tbody = document.getElementById('productsTableBody');
  if (tbody) tbody.innerHTML = renderProductsTableRows(state.products);
}

function deleteProduct(id) {
  if (!confirm(t('confirmDelete'))) return;
  state.products = state.products.filter(p => p.id !== id);
  saveProducts();
  const tbody = document.getElementById('productsTableBody');
  if (tbody) tbody.innerHTML = renderProductsTableRows(state.products);
  showToast('Product deleted', 'info');
}

/* ─── 7. POS / Cart ────────────────────────────────────── */

function renderPOSPage() {
  const categories = ['All', ...new Set(state.products.map(p => p.category))];
  const content = document.getElementById('pageContent');
  content.innerHTML = `
    <div class="flex flex-col lg:flex-row h-full gap-0 min-h-0">

      <!-- ── Products Panel ── -->
      <div class="flex-1 flex flex-col min-h-0 p-4 overflow-hidden">
        <!-- Search + Category Filter -->
        <div class="flex flex-col sm:flex-row gap-3 mb-4">
          <div class="relative flex-1">
            <i class="fa-solid fa-magnifying-glass absolute top-1/2 -translate-y-1/2 start-3 text-slate-400 text-sm"></i>
            <input id="posSearch" type="text" placeholder="${t('searchPlaceholder')}"
              class="input-field ps-9 w-full text-sm"
              value="${state.posSearch}"
              oninput="updatePOSSearch(this.value)" />
          </div>
          <div class="flex gap-2 overflow-x-auto pb-1 flex-shrink-0" id="categoryFilters">
            ${categories.map(cat => `
              <button onclick="setPOSCategory('${cat}')"
                class="cat-btn px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all
                       ${state.posCategory === cat
                          ? 'bg-indigo-600 text-white shadow-md'
                          : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-indigo-400'}"
              >${cat === 'All' ? t('allCategories') : cat}</button>
            `).join('')}
          </div>
        </div>

        <!-- Product Grid -->
        <div id="productGrid" class="flex-1 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3 content-start">
          ${renderProductCards()}
        </div>
      </div>

      <!-- ── Cart Panel ── -->
      <div class="lg:w-80 xl:w-96 flex flex-col border-t lg:border-t-0 lg:border-s border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-900">
        <!-- Cart Header -->
        <div class="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700/60">
          <h2 class="font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <i class="fa-solid fa-cart-shopping text-indigo-500"></i>
            ${t('cart')}
            <span id="cartBadge" class="ml-1 bg-indigo-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-semibold">
              ${state.cart.reduce((s, i) => s + i.qty, 0)}
            </span>
          </h2>
          <button onclick="clearCart()" class="text-xs text-red-500 hover:text-red-700 font-medium flex items-center gap-1">
            <i class="fa-solid fa-trash-can"></i>
            ${t('clearCart')}
          </button>
        </div>

        <!-- Cart Items -->
        <div id="cartItems" class="flex-1 overflow-y-auto p-3 space-y-2">
          ${renderCartItems()}
        </div>

        <!-- Totals -->
        <div class="border-t border-slate-200 dark:border-slate-700/60 p-4 space-y-2">
          <div class="flex justify-between text-sm text-slate-600 dark:text-slate-400">
            <span>${t('subtotal')}</span>
            <span id="cartSubtotal">${fmt(cartSubtotal())}</span>
          </div>
          <div class="flex justify-between text-sm text-slate-600 dark:text-slate-400">
            <span>${t('tax')} (${state.settings.taxRate}%)</span>
            <span id="cartTax">${fmt(cartTax())}</span>
          </div>
          <div class="flex justify-between text-base font-bold text-slate-900 dark:text-white border-t border-slate-200 dark:border-slate-700 pt-2 mt-1">
            <span>${t('total')}</span>
            <span id="cartTotal">${fmt(cartTotal())}</span>
          </div>
          <button onclick="openCheckout()"
            class="w-full mt-2 py-3 rounded-xl font-bold text-white
                   ${state.cart.length ? 'bg-indigo-600 hover:bg-indigo-700 active:scale-95' : 'bg-slate-300 dark:bg-slate-700 cursor-not-allowed'}
                   transition-all duration-150 flex items-center justify-center gap-2 text-sm"
            ${state.cart.length ? '' : 'disabled'}>
            <i class="fa-solid fa-circle-check"></i>
            ${t('checkout')}
          </button>
        </div>
      </div>
    </div>
    ${checkoutModal()}
    ${receiptModal()}
  `;
}

function renderProductCards() {
  let products = state.products;

  if (state.posCategory !== 'All') {
    products = products.filter(p => p.category === state.posCategory);
  }
  if (state.posSearch) {
    const q = state.posSearch.toLowerCase();
    products = products.filter(p =>
      p.name.toLowerCase().includes(q) || p.barcode.includes(q)
    );
  }

  if (!products.length) {
    return `<div class="col-span-full flex flex-col items-center justify-center py-16 text-slate-400 dark:text-slate-600">
      <i class="fa-solid fa-box-open text-5xl mb-3"></i>
      <p>${t('noProducts')}</p>
    </div>`;
  }

  return products.map(p => {
    const outOfStock = p.stock <= 0;
    return `
      <button onclick="${outOfStock ? '' : `addToCart('${p.id}')`}"
        class="product-card relative flex flex-col items-center justify-between p-3 rounded-xl border transition-all duration-200 text-start
               ${outOfStock
                  ? 'border-slate-200 dark:border-slate-700 opacity-50 cursor-not-allowed bg-slate-50 dark:bg-slate-800/30'
                  : 'border-slate-200 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-500 bg-white dark:bg-slate-800 hover:shadow-lg hover:-translate-y-0.5 active:scale-95 cursor-pointer'}"
        ${outOfStock ? 'disabled' : ''}
        title="${outOfStock ? t('outOfStock') : p.name}"
      >
        <span class="text-4xl mb-2 select-none">${p.icon || CATEGORY_ICONS[p.category] || '📦'}</span>
        <div class="w-full">
          <p class="text-xs font-semibold text-slate-800 dark:text-white leading-tight line-clamp-2">${esc(p.name)}</p>
          <p class="text-indigo-600 dark:text-indigo-400 font-bold text-sm mt-1">${fmt(p.price)}</p>
          <p class="text-xs text-slate-400 mt-0.5">${outOfStock ? `<span class="text-red-500">${t('outOfStock')}</span>` : `${p.stock} ${t('inStock')}`}</p>
        </div>
      </button>
    `;
  }).join('');
}

function updatePOSSearch(val) {
  state.posSearch = val;
  const grid = document.getElementById('productGrid');
  if (grid) grid.innerHTML = renderProductCards();
}

function setPOSCategory(cat) {
  state.posCategory = cat;
  // Update buttons
  document.querySelectorAll('.cat-btn').forEach(btn => {
    const isActive = btn.textContent.trim() === (cat === 'All' ? t('allCategories') : cat);
    btn.classList.toggle('bg-indigo-600',   isActive);
    btn.classList.toggle('text-white',      isActive);
    btn.classList.toggle('shadow-md',       isActive);
    btn.classList.toggle('bg-white',        !isActive);
    btn.classList.toggle('dark:bg-slate-800', !isActive);
  });
  const grid = document.getElementById('productGrid');
  if (grid) grid.innerHTML = renderProductCards();
}

/* ─── Cart helpers ─────────────────────────────────────── */

function addToCart(productId) {
  const product = state.products.find(p => p.id === productId);
  if (!product || product.stock <= 0) return;

  const existing = state.cart.find(i => i.product.id === productId);
  if (existing) {
    if (existing.qty >= product.stock) {
      showToast('Max stock reached', 'warning');
      return;
    }
    existing.qty++;
  } else {
    state.cart.push({ product: { ...product }, qty: 1 });
  }
  updateCartUI();
  animateAddToCart();
}

function changeQty(productId, delta) {
  const idx = state.cart.findIndex(i => i.product.id === productId);
  if (idx === -1) return;
  state.cart[idx].qty += delta;
  if (state.cart[idx].qty <= 0) {
    state.cart.splice(idx, 1);
  }
  updateCartUI();
}

function removeFromCart(productId) {
  state.cart = state.cart.filter(i => i.product.id !== productId);
  updateCartUI();
}

function clearCart() {
  state.cart = [];
  updateCartUI();
}

function cartSubtotal() {
  return state.cart.reduce((s, i) => s + i.product.price * i.qty, 0);
}

function cartTax() {
  return cartSubtotal() * (state.settings.taxRate / 100);
}

function cartTotal() {
  return cartSubtotal() + cartTax();
}

function updateCartUI() {
  const itemsEl    = document.getElementById('cartItems');
  const badgeEl    = document.getElementById('cartBadge');
  const subtotalEl = document.getElementById('cartSubtotal');
  const taxEl      = document.getElementById('cartTax');
  const totalEl    = document.getElementById('cartTotal');
  const checkoutBtn= document.querySelector('[onclick="openCheckout()"]');

  if (itemsEl)    itemsEl.innerHTML   = renderCartItems();
  if (badgeEl)    badgeEl.textContent = state.cart.reduce((s, i) => s + i.qty, 0);
  if (subtotalEl) subtotalEl.textContent = fmt(cartSubtotal());
  if (taxEl)      taxEl.textContent   = fmt(cartTax());
  if (totalEl)    totalEl.textContent = fmt(cartTotal());
  if (checkoutBtn) {
    const hasItems = state.cart.length > 0;
    checkoutBtn.disabled = !hasItems;
    checkoutBtn.classList.toggle('bg-indigo-600', hasItems);
    checkoutBtn.classList.toggle('hover:bg-indigo-700', hasItems);
    checkoutBtn.classList.toggle('bg-slate-300', !hasItems);
    checkoutBtn.classList.toggle('dark:bg-slate-700', !hasItems);
    checkoutBtn.classList.toggle('cursor-not-allowed', !hasItems);
  }
}

function renderCartItems() {
  if (!state.cart.length) {
    return `<div class="flex flex-col items-center justify-center h-full py-10 text-slate-400 dark:text-slate-600">
      <i class="fa-solid fa-cart-shopping text-5xl mb-3 opacity-30"></i>
      <p class="font-medium text-sm">${t('emptyCart')}</p>
      <p class="text-xs mt-1">${t('emptyCartSub')}</p>
    </div>`;
  }
  return state.cart.map(item => `
    <div class="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 rounded-xl p-2.5">
      <span class="text-2xl flex-shrink-0">${item.product.icon || '📦'}</span>
      <div class="flex-1 min-w-0">
        <p class="text-xs font-semibold text-slate-800 dark:text-white truncate">${esc(item.product.name)}</p>
        <p class="text-xs text-indigo-600 dark:text-indigo-400">${fmt(item.product.price)}</p>
      </div>
      <div class="flex items-center gap-1 flex-shrink-0">
        <button onclick="changeQty('${item.product.id}', -1)"
          class="w-6 h-6 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-white hover:bg-indigo-100 dark:hover:bg-indigo-900 flex items-center justify-center text-sm font-bold transition-colors">
          <i class="fa-solid fa-minus text-[10px]"></i>
        </button>
        <span class="w-6 text-center text-xs font-bold text-slate-800 dark:text-white">${item.qty}</span>
        <button onclick="changeQty('${item.product.id}', 1)"
          class="w-6 h-6 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-white hover:bg-indigo-100 dark:hover:bg-indigo-900 flex items-center justify-center text-sm font-bold transition-colors">
          <i class="fa-solid fa-plus text-[10px]"></i>
        </button>
        <button onclick="removeFromCart('${item.product.id}')"
          class="w-6 h-6 rounded-md text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 flex items-center justify-center transition-colors ms-1">
          <i class="fa-solid fa-xmark text-xs"></i>
        </button>
      </div>
    </div>
  `).join('');
}

function animateAddToCart() {
  const badge = document.getElementById('cartBadge');
  if (!badge) return;
  badge.classList.add('scale-125', 'bg-emerald-500');
  setTimeout(() => badge.classList.remove('scale-125', 'bg-emerald-500'), 300);
}

/* ─── 8. Barcode Scanner ───────────────────────────────── */

document.addEventListener('keydown', (e) => {
  // Only on POS page, ignore if typing in an input
  if (state.currentPage !== 'pos') return;
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;

  // Collect rapid keystrokes (barcode scanners fire within ~50ms)
  if (e.key === 'Enter') {
    if (state.barcodeBuffer.length > 2) {
      const product = state.products.find(p => p.barcode === state.barcodeBuffer);
      if (product) {
        addToCart(product.id);
        showToast(`📦 ${product.name} added (barcode)`, 'success');
      } else {
        showToast(`Barcode not found: ${state.barcodeBuffer}`, 'warning');
      }
    }
    state.barcodeBuffer = '';
    clearTimeout(state.barcodeTimer);
    return;
  }

  if (e.key.length === 1) {
    state.barcodeBuffer += e.key;
    clearTimeout(state.barcodeTimer);
    // Clear buffer if no Enter within 300ms (not a barcode scanner)
    state.barcodeTimer = setTimeout(() => { state.barcodeBuffer = ''; }, 300);
  }
});

/* ─── 9. Checkout Flow ─────────────────────────────────── */

function checkoutModal() {
  return `
    <div id="checkoutModal" class="modal-overlay hidden">
      <div class="modal-box max-w-sm">
        <div class="flex items-center justify-between mb-5">
          <h2 class="text-lg font-bold text-slate-900 dark:text-white">
            <i class="fa-solid fa-credit-card text-indigo-500 me-2"></i>
            ${t('checkout')}
          </h2>
          <button onclick="closeCheckout()" class="btn-icon text-slate-500 hover:text-slate-700">
            <i class="fa-solid fa-xmark text-xl"></i>
          </button>
        </div>

        <!-- Summary -->
        <div class="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 mb-4 space-y-1 text-sm">
          <div class="flex justify-between text-slate-600 dark:text-slate-400">
            <span>${t('subtotal')}</span><span>${fmt(cartSubtotal())}</span>
          </div>
          <div class="flex justify-between text-slate-600 dark:text-slate-400">
            <span>${t('tax')}</span><span>${fmt(cartTax())}</span>
          </div>
          <div class="flex justify-between font-bold text-slate-900 dark:text-white border-t border-slate-200 dark:border-slate-700 pt-2">
            <span>${t('total')}</span><span class="text-indigo-600 dark:text-indigo-400 text-base">${fmt(cartTotal())}</span>
          </div>
        </div>

        <!-- Payment Method -->
        <div class="mb-4">
          <p class="form-label mb-2">${t('paymentMethod')}</p>
          <div class="grid grid-cols-2 gap-2">
            <button id="pmCash" onclick="selectPayment('cash')"
              class="pm-btn pm-active flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-semibold text-sm transition-all">
              <i class="fa-solid fa-money-bills"></i> ${t('cash')}
            </button>
            <button id="pmCard" onclick="selectPayment('card')"
              class="pm-btn flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold text-sm transition-all hover:border-indigo-400">
              <i class="fa-solid fa-credit-card"></i> ${t('card')}
            </button>
          </div>
        </div>

        <!-- Cash tendered (visible for cash) -->
        <div id="cashSection" class="mb-4 space-y-2">
          <label class="form-label">${t('amountTendered')}</label>
          <input id="amountTendered" type="number" min="${cartTotal()}" step="0.5"
            class="input-field w-full text-lg font-bold text-center"
            value="${Math.ceil(cartTotal() / 5) * 5}"
            oninput="updateChange()" />
          <div class="flex justify-between items-center bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-2 text-sm">
            <span class="text-emerald-700 dark:text-emerald-400 font-medium">${t('change')}</span>
            <span id="changeAmt" class="font-bold text-emerald-700 dark:text-emerald-400">${fmt(Math.ceil(cartTotal() / 5) * 5 - cartTotal())}</span>
          </div>
        </div>

        <div class="flex gap-3">
          <button onclick="closeCheckout()" class="btn-secondary flex-1">${t('cancel')}</button>
          <button onclick="confirmPayment()" class="btn-primary flex-1">
            <i class="fa-solid fa-check me-1"></i> ${t('confirmPayment')}
          </button>
        </div>
      </div>
    </div>
  `;
}

let selectedPayment = 'cash';

function openCheckout() {
  if (!state.cart.length) return;
  selectedPayment = 'cash';
  document.getElementById('checkoutModal')?.classList.remove('hidden');
  updateChange();
}

function closeCheckout() {
  document.getElementById('checkoutModal')?.classList.add('hidden');
}

function selectPayment(method) {
  selectedPayment = method;
  ['cash', 'card'].forEach(m => {
    const btn = document.getElementById(`pm${m.charAt(0).toUpperCase() + m.slice(1)}`);
    if (!btn) return;
    const active = m === method;
    btn.classList.toggle('pm-active', active);
    btn.classList.toggle('border-indigo-500', active);
    btn.classList.toggle('bg-indigo-50', active);
    btn.classList.toggle('dark:bg-indigo-900/30', active);
    btn.classList.toggle('text-indigo-700', active);
    btn.classList.toggle('dark:text-indigo-300', active);
    btn.classList.toggle('border-slate-200', !active);
    btn.classList.toggle('dark:border-slate-700', !active);
    btn.classList.toggle('text-slate-600', !active);
    btn.classList.toggle('dark:text-slate-300', !active);
  });
  const cashSection = document.getElementById('cashSection');
  if (cashSection) cashSection.style.display = method === 'cash' ? '' : 'none';
}

function updateChange() {
  const tendered = parseFloat(document.getElementById('amountTendered')?.value) || 0;
  const change   = tendered - cartTotal();
  const el       = document.getElementById('changeAmt');
  if (el) {
    el.textContent = fmt(Math.max(0, change));
    el.classList.toggle('text-red-500', change < 0);
    el.classList.toggle('text-emerald-700', change >= 0);
  }
}

function confirmPayment() {
  const tendered = parseFloat(document.getElementById('amountTendered')?.value) || cartTotal();
  if (selectedPayment === 'cash' && tendered < cartTotal()) {
    showToast('Amount tendered is less than total!', 'error');
    return;
  }

  // Build sale record
  const sale = {
    id:        genId(),
    orderNo:   state.sales.length + 1,
    timestamp: new Date().toISOString(),
    items:     state.cart.map(i => ({ ...i.product, qty: i.qty, lineTotal: i.product.price * i.qty })),
    subtotal:  cartSubtotal(),
    tax:       cartTax(),
    total:     cartTotal(),
    method:    selectedPayment,
    tendered:  tendered,
    change:    Math.max(0, tendered - cartTotal()),
    lang:      state.lang,
  };

  // Deduct stock
  sale.items.forEach(item => {
    const p = state.products.find(x => x.id === item.id);
    if (p) p.stock = Math.max(0, p.stock - item.qty);
  });
  saveProducts();

  // Save sale
  state.sales.unshift(sale);
  DB.setSales(state.sales);

  // Clear cart
  state.cart = [];

  // Close checkout modal, show receipt
  closeCheckout();
  showReceiptModal(sale);
}

/* ─── Receipt Modal ────────────────────────────────────── */

function receiptModal() {
  return `<div id="receiptModal" class="modal-overlay hidden"><div class="modal-box max-w-sm"></div></div>`;
}

function showReceiptModal(sale) {
  const modal = document.getElementById('receiptModal');
  if (!modal) return;
  modal.classList.remove('hidden');
  modal.querySelector('.modal-box').innerHTML = buildReceiptHTML(sale, false);
}

function buildReceiptHTML(sale, forPrint = false) {
  const dt  = new Date(sale.timestamp);
  const dateStr = dt.toLocaleDateString(state.lang === 'ar' ? 'ar-EG' : 'en-GB');
  const timeStr = dt.toLocaleTimeString(state.lang === 'ar' ? 'ar-EG' : 'en-GB');

  if (forPrint) {
    return `
      <div class="receipt-print">
        <div class="receipt-header">
          <div class="receipt-logo">🛍️</div>
          <h1>${state.settings.storeName}</h1>
          <p>${state.settings.storeAddress}</p>
          <p>${state.settings.storePhone}</p>
          <div class="receipt-divider">- - - - - - - - - - - - - - - - -</div>
          <p>${t('receipt')} #${sale.orderNo}</p>
          <p>${dateStr} ${timeStr}</p>
          <div class="receipt-divider">- - - - - - - - - - - - - - - - -</div>
        </div>
        <table class="receipt-table">
          <thead><tr><th>${t('item')}</th><th>${t('qty')}</th><th>${t('unitPrice')}</th><th>${t('subtotal')}</th></tr></thead>
          <tbody>
            ${sale.items.map(i => `<tr><td>${i.name}</td><td>${i.qty}</td><td>${fmt(i.price)}</td><td>${fmt(i.lineTotal)}</td></tr>`).join('')}
          </tbody>
        </table>
        <div class="receipt-divider">- - - - - - - - - - - - - - - - -</div>
        <div class="receipt-totals">
          <div><span>${t('subtotal')}</span><span>${fmt(sale.subtotal)}</span></div>
          <div><span>${t('tax')} (${state.settings.taxRate}%)</span><span>${fmt(sale.tax)}</span></div>
          <div class="receipt-total-line"><span>${t('receiptTotal')}</span><span>${fmt(sale.total)}</span></div>
          ${sale.method === 'cash' ? `
          <div><span>${t('cash')}</span><span>${fmt(sale.tendered)}</span></div>
          <div><span>${t('change')}</span><span>${fmt(sale.change)}</span></div>` : `
          <div><span>${t('paymentMethod')}</span><span>${t('card')}</span></div>`}
        </div>
        <div class="receipt-divider">- - - - - - - - - - - - - - - - -</div>
        <div class="receipt-footer">${t('thankYou')}</div>
      </div>
    `;
  }

  // In-app receipt modal
  return `
    <div class="text-center mb-5">
      <div class="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
        <i class="fa-solid fa-circle-check text-3xl text-emerald-500"></i>
      </div>
      <h2 class="text-xl font-bold text-slate-900 dark:text-white">${t('paymentSuccess')}</h2>
      <p class="text-slate-500 dark:text-slate-400 text-sm">${t('orderNo')}${sale.orderNo}</p>
    </div>
    <div class="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 mb-4 space-y-2 text-sm">
      <div class="flex justify-between text-slate-600 dark:text-slate-400">
        <span>${t('subtotal')}</span><span>${fmt(sale.subtotal)}</span>
      </div>
      <div class="flex justify-between text-slate-600 dark:text-slate-400">
        <span>${t('tax')}</span><span>${fmt(sale.tax)}</span>
      </div>
      <div class="flex justify-between font-bold text-slate-900 dark:text-white border-t border-slate-200 dark:border-slate-700 pt-2">
        <span>${t('total')}</span><span class="text-indigo-600 dark:text-indigo-400">${fmt(sale.total)}</span>
      </div>
      ${sale.method === 'cash' ? `
      <div class="flex justify-between text-slate-600 dark:text-slate-400">
        <span>${t('amountTendered')}</span><span>${fmt(sale.tendered)}</span>
      </div>
      <div class="flex justify-between text-emerald-600 dark:text-emerald-400 font-semibold">
        <span>${t('change')}</span><span>${fmt(sale.change)}</span>
      </div>` : ''}
    </div>
    <div class="flex flex-col gap-2">
      <button onclick="printSaleReceipt('${sale.id}')"
        class="btn-secondary flex items-center justify-center gap-2">
        <i class="fa-solid fa-print"></i> ${t('printReceipt')}
      </button>
      <button onclick="startNewSale()"
        class="btn-primary flex items-center justify-center gap-2">
        <i class="fa-solid fa-plus"></i> ${t('newSale')}
      </button>
    </div>
  `;
}

function startNewSale() {
  document.getElementById('receiptModal')?.classList.add('hidden');
  updateCartUI();
  // Re-render product grid to reflect stock changes
  const grid = document.getElementById('productGrid');
  if (grid) grid.innerHTML = renderProductCards();
}

function printSaleReceipt(saleId) {
  const sale = state.sales.find(s => s.id === saleId);
  if (!sale) return;
  const win = window.open('', '_blank', 'width=400,height=600');
  win.document.write(`
    <!DOCTYPE html><html dir="${state.lang === 'ar' ? 'rtl' : 'ltr'}" lang="${state.lang}">
    <head>
      <meta charset="UTF-8">
      <title>${t('receipt')} #${sale.orderNo}</title>
      <style>${getPrintStyles()}</style>
    </head>
    <body>${buildReceiptHTML(sale, true)}</body>
    </html>
  `);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); win.close(); }, 500);
}

function getPrintStyles() {
  return `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Courier New', Courier, monospace; font-size: 12px; width: 80mm; margin: 0 auto; padding: 8px; }
    .receipt-header { text-align: center; margin-bottom: 8px; }
    .receipt-logo { font-size: 32px; margin-bottom: 4px; }
    .receipt-header h1 { font-size: 16px; font-weight: bold; margin-bottom: 2px; }
    .receipt-header p { font-size: 11px; color: #555; }
    .receipt-divider { text-align: center; color: #999; margin: 6px 0; }
    .receipt-table { width: 100%; border-collapse: collapse; margin: 6px 0; }
    .receipt-table th { text-align: left; border-bottom: 1px dashed #ccc; padding: 2px 0; font-size: 11px; }
    .receipt-table td { padding: 2px 0; font-size: 11px; }
    .receipt-totals { margin-top: 4px; }
    .receipt-totals div { display: flex; justify-content: space-between; margin: 2px 0; font-size: 12px; }
    .receipt-total-line { font-weight: bold; font-size: 14px !important; border-top: 1px solid #000; padding-top: 4px; margin-top: 4px; }
    .receipt-footer { text-align: center; margin-top: 10px; font-size: 12px; }
    @media print { body { width: 100%; } }
  `;
}

/* ─── 10. Dashboard ────────────────────────────────────── */

function renderDashboardPage() {
  const today     = new Date().toDateString();
  const todaySales= state.sales.filter(s => new Date(s.timestamp).toDateString() === today);
  const todayTotal= todaySales.reduce((s, x) => s + x.total, 0);
  const allTotal  = state.sales.reduce((s, x) => s + x.total, 0);
  const lowStock  = state.products.filter(p => p.stock < LOW_STOCK_LIMIT);

  const content = document.getElementById('pageContent');
  content.innerHTML = `
    <div class="p-6 max-w-7xl mx-auto space-y-6">
      <h1 class="text-2xl font-bold text-slate-900 dark:text-white">${t('dashboardTitle')}</h1>

      <!-- KPI Cards -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        ${kpiCard('fa-solid fa-coins', t('todaySales'), fmt(todayTotal), 'bg-indigo-500', '+' + todaySales.length + ' orders')}
        ${kpiCard('fa-solid fa-receipt', t('todayOrders'), todaySales.length, 'bg-emerald-500', t('date') + ': ' + new Date().toLocaleDateString())}
        ${kpiCard('fa-solid fa-chart-line', t('totalRevenue'), fmt(allTotal), 'bg-violet-500', state.sales.length + ' total orders')}
        ${kpiCard('fa-solid fa-triangle-exclamation', t('lowStockAlerts'), lowStock.length, 'bg-amber-500', lowStock.length + ' ' + t('lowStockWarning'))}
      </div>

      <!-- Low Stock & Recent Sales -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Low Stock -->
        <div class="card p-4">
          <h3 class="font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
            <i class="fa-solid fa-box-open text-amber-500"></i> ${t('lowStockAlerts')}
          </h3>
          ${lowStock.length ? `
            <div class="space-y-2">
              ${lowStock.map(p => `
                <div class="flex items-center justify-between bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-lg p-2.5">
                  <div class="flex items-center gap-2">
                    <span class="text-xl">${p.icon}</span>
                    <div>
                      <p class="text-sm font-semibold text-slate-800 dark:text-white">${esc(p.name)}</p>
                      <p class="text-xs text-slate-500">${esc(p.category)}</p>
                    </div>
                  </div>
                  <span class="text-sm font-bold text-amber-600 dark:text-amber-400">${p.stock} ${t('inStock')}</span>
                </div>
              `).join('')}
            </div>
          ` : `<p class="text-sm text-emerald-600 dark:text-emerald-400"><i class="fa-solid fa-circle-check me-1"></i>${t('noLowStock')}</p>`}
        </div>

        <!-- Recent Sales -->
        <div class="card p-4">
          <h3 class="font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
            <i class="fa-solid fa-clock-rotate-left text-indigo-500"></i> ${t('recentSales')}
          </h3>
          ${state.sales.length ? `
            <div class="space-y-2">
              ${state.sales.slice(0, 5).map(s => `
                <div class="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
                  <div>
                    <p class="text-sm font-medium text-slate-800 dark:text-white">#${s.orderNo} · ${s.items.length} ${t('items')}</p>
                    <p class="text-xs text-slate-500">${new Date(s.timestamp).toLocaleString(state.lang === 'ar' ? 'ar-EG' : 'en-GB')}</p>
                  </div>
                  <div class="text-end">
                    <p class="text-sm font-bold text-indigo-600 dark:text-indigo-400">${fmt(s.total)}</p>
                    <span class="text-xs text-slate-400">${s.method === 'cash' ? t('cash') : t('card')}</span>
                  </div>
                </div>
              `).join('')}
            </div>
          ` : `<p class="text-sm text-slate-400">${t('noSales')}</p>`}
        </div>
      </div>
    </div>
  `;
}

function kpiCard(icon, label, value, colorClass, sub) {
  return `
    <div class="card p-4">
      <div class="flex items-start justify-between mb-3">
        <div class="w-10 h-10 ${colorClass} bg-opacity-10 dark:bg-opacity-20 rounded-xl flex items-center justify-center">
          <i class="${icon} ${colorClass.replace('bg-', 'text-')}"></i>
        </div>
      </div>
      <p class="text-2xl font-bold text-slate-900 dark:text-white">${value}</p>
      <p class="text-sm text-slate-500 dark:text-slate-400 mt-0.5">${label}</p>
      <p class="text-xs text-slate-400 dark:text-slate-600 mt-1">${sub}</p>
    </div>
  `;
}

/* ─── 11. History ──────────────────────────────────────── */

function renderHistoryPage() {
  const content = document.getElementById('pageContent');
  content.innerHTML = `
    <div class="p-6 max-w-7xl mx-auto">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 class="text-2xl font-bold text-slate-900 dark:text-white">${t('historyTitle')}</h1>
        <button onclick="clearHistory()" class="btn-danger text-sm flex items-center gap-2">
          <i class="fa-solid fa-trash-can"></i> ${t('clearHistory')}
        </button>
      </div>

      ${state.sales.length ? `
      <div class="card overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400">
                <th class="text-start py-3 px-4">${t('orderId')}</th>
                <th class="text-start py-3 px-4">${t('date')}</th>
                <th class="text-start py-3 px-4">${t('items')}</th>
                <th class="text-start py-3 px-4">${t('amount')}</th>
                <th class="text-start py-3 px-4">${t('method')}</th>
                <th class="text-start py-3 px-4">${t('viewReceipt')}</th>
              </tr>
            </thead>
            <tbody>
              ${state.sales.map(s => `
                <tr class="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td class="py-3 px-4 font-mono font-medium text-slate-700 dark:text-slate-300">#${s.orderNo}</td>
                  <td class="py-3 px-4 text-slate-600 dark:text-slate-400">
                    ${new Date(s.timestamp).toLocaleString(state.lang === 'ar' ? 'ar-EG' : 'en-GB')}
                  </td>
                  <td class="py-3 px-4 text-slate-600 dark:text-slate-400">${s.items.length}</td>
                  <td class="py-3 px-4 font-semibold text-indigo-600 dark:text-indigo-400">${fmt(s.total)}</td>
                  <td class="py-3 px-4">
                    <span class="badge ${s.method === 'cash' ? 'badge-green' : 'badge-blue'}">
                      <i class="fa-solid ${s.method === 'cash' ? 'fa-money-bills' : 'fa-credit-card'} me-1"></i>
                      ${s.method === 'cash' ? t('cash') : t('card')}
                    </span>
                  </td>
                  <td class="py-3 px-4">
                    <button onclick="printSaleReceipt('${s.id}')" class="btn-icon-sm text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30">
                      <i class="fa-solid fa-print"></i>
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
      ` : `
      <div class="card flex flex-col items-center justify-center py-20 text-slate-400 dark:text-slate-600">
        <i class="fa-solid fa-clock-rotate-left text-5xl mb-4 opacity-30"></i>
        <p class="text-lg font-medium">${t('noHistory')}</p>
      </div>
      `}
    </div>
  `;
}

function clearHistory() {
  if (!confirm(t('confirmClearHist'))) return;
  state.sales = [];
  DB.setSales([]);
  renderHistoryPage();
  showToast('History cleared', 'info');
}

/* ─── 12. Settings ─────────────────────────────────────── */

function renderSettingsPage() {
  const s = state.settings;
  const content = document.getElementById('pageContent');
  content.innerHTML = `
    <div class="p-6 max-w-2xl mx-auto">
      <h1 class="text-2xl font-bold text-slate-900 dark:text-white mb-6">${t('settingsTitle')}</h1>

      <div class="card p-6 space-y-5">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="form-label">${t('storeName')}</label>
            <input id="set_name" type="text" class="input-field w-full" value="${esc(s.storeName)}">
          </div>
          <div>
            <label class="form-label">${t('storePhone')}</label>
            <input id="set_phone" type="text" class="input-field w-full" value="${esc(s.storePhone)}">
          </div>
          <div class="sm:col-span-2">
            <label class="form-label">${t('storeAddress')}</label>
            <input id="set_addr" type="text" class="input-field w-full" value="${esc(s.storeAddress)}">
          </div>
          <div>
            <label class="form-label">${t('taxRate')}</label>
            <input id="set_tax" type="number" min="0" max="100" step="0.5" class="input-field w-full" value="${s.taxRate}">
          </div>
          <div>
            <label class="form-label">${t('currency')}</label>
            <input id="set_currency" type="text" class="input-field w-full" value="${esc(s.currency)}">
          </div>
          <div>
            <label class="form-label">${t('language')}</label>
            <select id="set_lang" class="input-field w-full">
              <option value="en" ${state.lang === 'en' ? 'selected' : ''}>English</option>
              <option value="ar" ${state.lang === 'ar' ? 'selected' : ''}>العربية</option>
            </select>
          </div>
          <div>
            <label class="form-label">${t('theme')}</label>
            <select id="set_theme" class="input-field w-full">
              <option value="dark" ${state.theme === 'dark' ? 'selected' : ''}>${t('dark')}</option>
              <option value="light" ${state.theme === 'light' ? 'selected' : ''}>${t('light')}</option>
            </select>
          </div>
        </div>

        <div class="flex flex-col sm:flex-row gap-3 pt-2">
          <button onclick="saveSettings()" class="btn-primary flex-1 flex items-center justify-center gap-2">
            <i class="fa-solid fa-floppy-disk"></i> ${t('saveSettings')}
          </button>
          <button onclick="resetAllData()" class="btn-danger flex items-center justify-center gap-2">
            <i class="fa-solid fa-rotate-left"></i> ${t('resetData')}
          </button>
        </div>
      </div>
    </div>
  `;
}

function saveSettings() {
  state.settings = {
    storeName:   document.getElementById('set_name').value,
    storePhone:  document.getElementById('set_phone').value,
    storeAddress:document.getElementById('set_addr').value,
    taxRate:     parseFloat(document.getElementById('set_tax').value) || DEFAULT_TAX_RATE,
    currency:    document.getElementById('set_currency').value || 'EGP',
    lang:        document.getElementById('set_lang').value,
    theme:       document.getElementById('set_theme').value,
  };
  DB.setSettings(state.settings);

  // Apply theme & language if changed
  applyTheme(state.settings.theme);
  applyLanguage(state.settings.lang);

  showToast(t('settingsSaved'), 'success');
}

function resetAllData() {
  if (!confirm(t('confirmReset'))) return;
  localStorage.clear();
  location.reload();
}

/* ─── Page Router ──────────────────────────────────────── */

function renderPage(pageId) {
  switch (pageId) {
    case 'pos':       renderPOSPage();       break;
    case 'products':  renderProductsPage();  break;
    case 'dashboard': renderDashboardPage(); break;
    case 'history':   renderHistoryPage();   break;
    case 'settings':  renderSettingsPage();  break;
    default:          renderPOSPage();
  }
}

/* ─── 14. Toast Notifications ──────────────────────────── */

function showToast(message, type = 'info') {
  const icons = { success: 'fa-circle-check', error: 'fa-circle-xmark', warning: 'fa-triangle-exclamation', info: 'fa-circle-info' };
  const colors = { success: 'bg-emerald-500', error: 'bg-red-500', warning: 'bg-amber-500', info: 'bg-indigo-500' };

  const toast = document.createElement('div');
  toast.className = `fixed bottom-4 ${state.lang === 'ar' ? 'left-4' : 'right-4'} z-[9999] flex items-center gap-3 px-4 py-3 rounded-xl text-white text-sm font-medium shadow-xl ${colors[type]} translate-y-0 opacity-100 transition-all duration-300 max-w-xs`;
  toast.innerHTML = `<i class="fa-solid ${icons[type]}"></i><span>${message}</span>`;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(20px)';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

/* ─── Helpers ──────────────────────────────────────────── */

function fmt(amount) {
  const cur = state.settings.currency || 'EGP';
  return new Intl.NumberFormat(state.lang === 'ar' ? 'ar-EG' : 'en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount) + ' ' + cur;
}

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ─── 15. Init ─────────────────────────────────────────── */

function initApp() {
  // Load persisted data
  const saved = DB.getSettings();
  if (saved) {
    state.settings = { ...state.settings, ...saved };
    state.lang  = saved.lang  || 'en';
    state.theme = saved.theme || 'dark';
  }
  loadProducts();
  state.sales = DB.getSales();

  // Apply theme & language
  applyTheme(state.theme);
  applyLanguage(state.lang);

  // Build sidebar
  buildSidebar();

  // Update app name
  const appNameEl = document.getElementById('appName');
  if (appNameEl) appNameEl.textContent = state.settings.storeName;

  // Render default page
  renderPage('pos');

  // Register Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('[PWA] SW registered:', reg.scope))
      .catch(err => console.warn('[PWA] SW registration failed:', err));
  }

  // Theme toggle button
  updateThemeToggleBtn();
}

// Boot
document.addEventListener('DOMContentLoaded', initApp);

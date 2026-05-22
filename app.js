// =============================================================
// app.js — Shady Store POS — Full Application Logic
// =============================================================

// ─────────────────────────────────────────────────────────────
// 1. STATE & CONSTANTS
// ─────────────────────────────────────────────────────────────
const APP_VERSION = "1.0.0";
const LS_KEYS = {
  products:   "ss_products",
  categories: "ss_categories",
  sales:      "ss_sales",
  settings:   "ss_settings",
};

let state = {
  lang:       "en",
  darkMode:   false,
  currentView: "pos",
  cart:       [],
  products:   [],
  categories: [],
  sales:      [],
  settings: {
    storeName: "Shady Store",
    taxRate:   14,
    currency:  "EGP",
    cashier:   "Admin",
  },
  barcodeBuffer:     "",
  barcodeTimeout:    null,
  cartOpen:          false,
  editingProduct:    null,
  editingCategory:   null,
  currentSale:       null,
  productSearchTerm: "",
  selectedCategory:  "all",
};

// ─────────────────────────────────────────────────────────────
// 2. PERSISTENCE HELPERS
// ─────────────────────────────────────────────────────────────
const save = (key, data) => localStorage.setItem(key, JSON.stringify(data));
const load = (key, fallback = []) => {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch { return fallback; }
};

function loadAll() {
  state.products   = load(LS_KEYS.products,   []);
  state.categories = load(LS_KEYS.categories, []);
  state.sales      = load(LS_KEYS.sales,      []);
  const saved      = load(LS_KEYS.settings,  {});
  state.settings   = { ...state.settings, ...saved };
  const pref       = localStorage.getItem("ss_lang");
  const dark       = localStorage.getItem("ss_dark");
  if (pref) state.lang = pref;
  if (dark !== null) state.darkMode = dark === "true";
}

function seedDemoData() {
  if (state.categories.length === 0) {
    state.categories = [
      { id: uid(), name: "Beverages",  nameAr: "مشروبات",  icon: "☕" },
      { id: uid(), name: "Snacks",     nameAr: "وجبات خفيفة", icon: "🍿" },
      { id: uid(), name: "Dairy",      nameAr: "منتجات ألبان", icon: "🥛" },
      { id: uid(), name: "Bakery",     nameAr: "مخبوزات",  icon: "🍞" },
    ];
    save(LS_KEYS.categories, state.categories);
  }
  if (state.products.length === 0) {
    const [bev, snk, dai, bak] = state.categories.map(c => c.id);
    state.products = [
      { id: uid(), name: "Espresso",      nameAr: "إسبريسو",      categoryId: bev, barcode: "100001", stock: 50, costPrice: 8,  sellingPrice: 20 },
      { id: uid(), name: "Cappuccino",    nameAr: "كابتشينو",     categoryId: bev, barcode: "100002", stock: 40, costPrice: 10, sellingPrice: 25 },
      { id: uid(), name: "Orange Juice",  nameAr: "عصير برتقال",  categoryId: bev, barcode: "100003", stock: 3,  costPrice: 7,  sellingPrice: 18 },
      { id: uid(), name: "Chips Bag",     nameAr: "شيبس",         categoryId: snk, barcode: "100004", stock: 80, costPrice: 5,  sellingPrice: 12 },
      { id: uid(), name: "Chocolate Bar", nameAr: "شوكولاتة",     categoryId: snk, barcode: "100005", stock: 2,  costPrice: 6,  sellingPrice: 15 },
      { id: uid(), name: "Milk 1L",       nameAr: "حليب 1 لتر",  categoryId: dai, barcode: "100006", stock: 20, costPrice: 12, sellingPrice: 22 },
      { id: uid(), name: "Yogurt Cup",    nameAr: "زبادي",        categoryId: dai, barcode: "100007", stock: 15, costPrice: 4,  sellingPrice: 10 },
      { id: uid(), name: "Croissant",     nameAr: "كرواسان",      categoryId: bak, barcode: "100008", stock: 8,  costPrice: 8,  sellingPrice: 18 },
      { id: uid(), name: "Sandwich",      nameAr: "ساندوتش",      categoryId: bak, barcode: "100009", stock: 0,  costPrice: 15, sellingPrice: 35 },
    ];
    save(LS_KEYS.products, state.products);
  }
}

// ─────────────────────────────────────────────────────────────
// 3. UTILITY HELPERS
// ─────────────────────────────────────────────────────────────
const uid    = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const t      = (key) => (TRANSLATIONS[state.lang] || TRANSLATIONS.en)[key] || key;
const fmt    = (n) => `${state.settings.currency} ${Number(n).toFixed(2)}`;
const fmtNum = (n) => Number(n).toFixed(2);
const today  = () => new Date().toISOString().split("T")[0];

function showToast(msg, type = "success") {
  const existing = document.getElementById("toast");
  if (existing) existing.remove();
  const toast = document.createElement("div");
  toast.id = "toast";
  const color = type === "success" ? "bg-indigo-600" : type === "error" ? "bg-red-600" : "bg-amber-500";
  toast.className = `fixed top-4 start-1/2 -translate-x-1/2 z-[9999] px-5 py-3 rounded-xl shadow-2xl text-white text-sm font-semibold ${color} transition-all duration-300`;
  toast.style.transform = "translateX(-50%) translateY(-10px)";
  toast.style.opacity   = "0";
  toast.textContent     = msg;
  document.body.appendChild(toast);
  requestAnimationFrame(() => {
    toast.style.transform = "translateX(-50%) translateY(0)";
    toast.style.opacity   = "1";
  });
  setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 300);
  }, 2800);
}

// ─────────────────────────────────────────────────────────────
// 4. CART LOGIC
// ─────────────────────────────────────────────────────────────
function cartAdd(productId) {
  const product = state.products.find(p => p.id === productId);
  if (!product) return;
  if (product.stock === 0) { showToast(t("out_of_stock"), "error"); return; }
  const existing = state.cart.find(i => i.productId === productId);
  if (existing) {
    if (existing.qty >= product.stock) { showToast(t("out_of_stock"), "error"); return; }
    existing.qty++;
  } else {
    state.cart.push({ productId, qty: 1 });
  }
  renderCart();
  updateCartBadge();
}

function cartRemove(productId) {
  state.cart = state.cart.filter(i => i.productId !== productId);
  renderCart();
  updateCartBadge();
}

function cartSetQty(productId, qty) {
  const product = state.products.find(p => p.id === productId);
  qty = parseInt(qty);
  if (isNaN(qty) || qty < 1) { cartRemove(productId); return; }
  if (qty > product.stock) { showToast(t("out_of_stock"), "error"); return; }
  const item = state.cart.find(i => i.productId === productId);
  if (item) item.qty = qty;
  renderCart();
  updateCartBadge();
}

function cartClear() {
  state.cart = [];
  renderCart();
  updateCartBadge();
}

function cartTotals() {
  const subtotal = state.cart.reduce((sum, item) => {
    const p = state.products.find(x => x.id === item.productId);
    return sum + (p ? p.sellingPrice * item.qty : 0);
  }, 0);
  const taxAmt = subtotal * (state.settings.taxRate / 100);
  const total  = subtotal + taxAmt;
  return { subtotal, taxAmt, total };
}

function cartProfit() {
  return state.cart.reduce((sum, item) => {
    const p = state.products.find(x => x.id === item.productId);
    return sum + (p ? (p.sellingPrice - p.costPrice) * item.qty : 0);
  }, 0);
}

function updateCartBadge() {
  const total = state.cart.reduce((s, i) => s + i.qty, 0);
  const badge = document.getElementById("cart-badge");
  if (badge) {
    badge.textContent = total;
    badge.classList.toggle("hidden", total === 0);
  }
}

// ─────────────────────────────────────────────────────────────
// 5. BARCODE SCANNER LISTENER
// ─────────────────────────────────────────────────────────────
function initBarcodeScanner() {
  document.addEventListener("keydown", (e) => {
    // Only capture on POS view and when not in an input field
    if (state.currentView !== "pos") return;
    const tag = document.activeElement.tagName.toLowerCase();
    if (tag === "input" || tag === "textarea") return;

    if (e.key === "Enter") {
      if (state.barcodeBuffer.length > 2) {
        handleBarcodeScan(state.barcodeBuffer.trim());
      }
      state.barcodeBuffer = "";
      clearTimeout(state.barcodeTimeout);
      return;
    }
    if (e.key.length === 1) {
      state.barcodeBuffer += e.key;
      clearTimeout(state.barcodeTimeout);
      state.barcodeTimeout = setTimeout(() => { state.barcodeBuffer = ""; }, 100);
    }
  });
}

function handleBarcodeScan(code) {
  const product = state.products.find(p => p.barcode === code);
  if (product) {
    cartAdd(product.id);
    showToast(`✓ ${state.lang === "ar" ? product.nameAr || product.name : product.name}`);
    // Open cart drawer on mobile
    if (window.innerWidth < 1024 && !state.cartOpen) toggleCart(true);
  } else {
    showToast(`Barcode not found: ${code}`, "error");
  }
}

// ─────────────────────────────────────────────────────────────
// 6. CHECKOUT & SALES
// ─────────────────────────────────────────────────────────────
function openCheckout() {
  if (state.cart.length === 0) { showToast("Cart is empty", "error"); return; }
  const { subtotal, taxAmt, total } = cartTotals();
  const modal = document.getElementById("checkout-modal");

  document.getElementById("co-subtotal").textContent = fmt(subtotal);
  document.getElementById("co-tax").textContent      = fmt(taxAmt);
  document.getElementById("co-total").textContent    = fmt(total);
  document.getElementById("co-tendered").value       = fmtNum(total);
  document.getElementById("co-change").textContent   = fmt(0);
  document.getElementById("co-result").classList.add("hidden");
  document.getElementById("co-form").classList.remove("hidden");

  modal.classList.remove("hidden");
  modal.querySelector(".modal-box").classList.add("scale-in");
  calcChange();
}

function calcChange() {
  const { total } = cartTotals();
  const tendered  = parseFloat(document.getElementById("co-tendered").value) || 0;
  const change    = tendered - total;
  document.getElementById("co-change").textContent = fmt(Math.max(0, change));
}

function completeSale() {
  const { subtotal, taxAmt, total } = cartTotals();
  const profit    = cartProfit();
  const method    = document.querySelector('input[name="payment"]:checked')?.value || "cash";
  const tendered  = parseFloat(document.getElementById("co-tendered").value) || total;
  const change    = Math.max(0, tendered - total);

  const sale = {
    id:        uid(),
    orderNum:  (state.sales.length + 1).toString().padStart(5, "0"),
    date:      new Date().toISOString(),
    items:     state.cart.map(i => ({
      productId:    i.productId,
      qty:          i.qty,
      name:         state.products.find(p => p.id === i.productId)?.name || "",
      nameAr:       state.products.find(p => p.id === i.productId)?.nameAr || "",
      sellingPrice: state.products.find(p => p.id === i.productId)?.sellingPrice || 0,
      costPrice:    state.products.find(p => p.id === i.productId)?.costPrice || 0,
    })),
    subtotal, taxAmt, total, profit,
    payment: method, tendered, change,
    taxRate: state.settings.taxRate,
    lang:    state.lang,
  };

  // Deduct stock
  sale.items.forEach(item => {
    const p = state.products.find(x => x.id === item.productId);
    if (p) p.stock = Math.max(0, p.stock - item.qty);
  });
  save(LS_KEYS.products, state.products);

  state.sales.unshift(sale);
  save(LS_KEYS.sales, state.sales);
  state.currentSale = sale;

  // Show result panel
  document.getElementById("co-form").classList.add("hidden");
  const res = document.getElementById("co-result");
  res.classList.remove("hidden");
  document.getElementById("co-res-total").textContent   = fmt(total);
  document.getElementById("co-res-change").textContent  = fmt(change);
  document.getElementById("co-res-method").textContent  = t(method);
  document.getElementById("co-res-order").textContent   = `#${sale.orderNum}`;

  cartClear();
  if (window.innerWidth < 1024) toggleCart(false);
}

function printReceipt(sale) {
  if (!sale) return;
  const receiptEl = document.getElementById("receipt-print");
  receiptEl.innerHTML = buildReceiptHTML(sale);
  window.print();
}

function buildReceiptHTML(sale) {
  const lang = sale.lang || state.lang;
  const T    = (key) => (TRANSLATIONS[lang] || TRANSLATIONS.en)[key] || key;
  const dir  = lang === "ar" ? "rtl" : "ltr";
  const rows = sale.items.map(item => `
    <tr>
      <td style="padding:2px 0;max-width:120px;word-break:break-word;">${lang === "ar" ? item.nameAr || item.name : item.name}</td>
      <td style="text-align:center;padding:2px 4px;">${item.qty}</td>
      <td style="text-align:end;padding:2px 0;">${fmtNum(item.sellingPrice * item.qty)}</td>
    </tr>`).join("");

  return `
    <div dir="${dir}" style="font-family:monospace;font-size:12px;max-width:302px;margin:0 auto;padding:8px;">
      <div style="text-align:center;margin-bottom:8px;">
        <div style="font-size:20px;font-weight:bold;">${state.settings.storeName}</div>
        <div style="font-size:10px;color:#666;">${new Date(sale.date).toLocaleString(lang === "ar" ? "ar-EG" : "en-US")}</div>
        <div style="font-size:10px;">${T("receipt_order")}: #${sale.orderNum}</div>
      </div>
      <hr style="border-top:1px dashed #000;margin:6px 0;"/>
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="border-bottom:1px dashed #000;">
            <th style="text-align:start;padding:2px 0;font-size:10px;">${T("receipt_item")}</th>
            <th style="text-align:center;padding:2px 4px;font-size:10px;">${T("receipt_qty")}</th>
            <th style="text-align:end;padding:2px 0;font-size:10px;">${T("receipt_amount")}</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <hr style="border-top:1px dashed #000;margin:6px 0;"/>
      <div style="display:flex;justify-content:space-between;"><span>${T("receipt_subtotal")}</span><span>${state.settings.currency} ${fmtNum(sale.subtotal)}</span></div>
      <div style="display:flex;justify-content:space-between;"><span>${T("receipt_tax")} (${sale.taxRate}%)</span><span>${state.settings.currency} ${fmtNum(sale.taxAmt)}</span></div>
      <div style="display:flex;justify-content:space-between;font-weight:bold;font-size:14px;margin-top:4px;"><span>${T("receipt_total")}</span><span>${state.settings.currency} ${fmtNum(sale.total)}</span></div>
      <hr style="border-top:1px dashed #000;margin:6px 0;"/>
      <div style="display:flex;justify-content:space-between;"><span>${T("receipt_payment")}</span><span>${T(sale.payment)}</span></div>
      ${sale.payment === "cash" ? `<div style="display:flex;justify-content:space-between;"><span>${T("receipt_change")}</span><span>${state.settings.currency} ${fmtNum(sale.change)}</span></div>` : ""}
      <hr style="border-top:1px dashed #000;margin:6px 0;"/>
      <div style="text-align:center;font-size:10px;margin-top:8px;">
        <div>${T("receipt_thank_you")}</div>
        <div style="margin-top:4px;color:#999;">${T("receipt_powered")}</div>
      </div>
    </div>`;
}

// ─────────────────────────────────────────────────────────────
// 7. RENDER — POS VIEW
// ─────────────────────────────────────────────────────────────
function renderCategories() {
  const el = document.getElementById("category-filters");
  if (!el) return;
  const cats = state.categories;
  let html = `<button onclick="filterCategory('all')" class="cat-chip ${state.selectedCategory === 'all' ? 'active' : ''}">${t("all_categories")}</button>`;
  cats.forEach(c => {
    const name = state.lang === "ar" ? (c.nameAr || c.name) : c.name;
    html += `<button onclick="filterCategory('${c.id}')" class="cat-chip ${state.selectedCategory === c.id ? 'active' : ''}">${c.icon} ${name}</button>`;
  });
  el.innerHTML = html;
}

function filterCategory(id) {
  state.selectedCategory = id;
  renderCategories();
  renderProducts();
}

function renderProducts() {
  const el = document.getElementById("product-grid");
  if (!el) return;
  let products = state.products;
  if (state.selectedCategory !== "all") {
    products = products.filter(p => p.categoryId === state.selectedCategory);
  }
  const term = (state.productSearchTerm || "").toLowerCase().trim();
  if (term) {
    products = products.filter(p =>
      p.name.toLowerCase().includes(term) ||
      (p.nameAr && p.nameAr.includes(term)) ||
      (p.barcode && p.barcode.includes(term))
    );
  }

  if (products.length === 0) {
    el.innerHTML = `<div class="col-span-full flex flex-col items-center justify-center py-16 text-slate-400">
      <i class="fa-solid fa-box-open text-5xl mb-3 opacity-30"></i>
      <p class="text-sm">${t("no_products")}</p>
    </div>`;
    return;
  }

  el.innerHTML = products.map(p => {
    const name        = state.lang === "ar" ? (p.nameAr || p.name) : p.name;
    const cat         = state.categories.find(c => c.id === p.categoryId);
    const inCart      = state.cart.find(i => i.productId === p.id);
    const outOfStock  = p.stock === 0;
    const lowStock    = p.stock > 0 && p.stock <= 5;
    const cartClass   = inCart ? "ring-2 ring-indigo-500" : "";
    const stockBadge  = outOfStock
      ? `<span class="badge badge-red">${t("out_of_stock")}</span>`
      : lowStock
      ? `<span class="badge badge-amber">${t("low_stock")} (${p.stock})</span>`
      : `<span class="badge badge-green">${p.stock} ${t("stock_label")}</span>`;

    return `
      <button onclick="cartAdd('${p.id}')" ${outOfStock ? "disabled" : ""}
        class="product-card ${cartClass} ${outOfStock ? "opacity-50 cursor-not-allowed" : ""}">
        <div class="product-card-icon">${cat?.icon || "🛍️"}</div>
        <div class="product-card-body">
          <div class="product-card-name">${name}</div>
          ${stockBadge}
          <div class="product-card-price">${fmt(p.sellingPrice)}</div>
        </div>
        ${inCart ? `<div class="product-cart-qty">${inCart.qty}</div>` : ""}
      </button>`;
  }).join("");
}

function renderCart() {
  const el = document.getElementById("cart-items");
  if (!el) return;

  if (state.cart.length === 0) {
    el.innerHTML = `<div class="flex flex-col items-center justify-center py-10 text-slate-400 select-none">
      <i class="fa-solid fa-cart-shopping text-4xl mb-2 opacity-30"></i>
      <p class="text-sm font-medium">${t("cart_empty")}</p>
      <p class="text-xs">${t("cart_empty_sub")}</p>
    </div>`;
    document.getElementById("cart-footer")?.classList.add("hidden");
    return;
  }

  document.getElementById("cart-footer")?.classList.remove("hidden");

  el.innerHTML = state.cart.map(item => {
    const p    = state.products.find(x => x.id === item.productId);
    if (!p) return "";
    const name = state.lang === "ar" ? (p.nameAr || p.name) : p.name;
    const line = p.sellingPrice * item.qty;
    return `
      <div class="cart-item">
        <div class="cart-item-name">${name}</div>
        <div class="cart-item-controls">
          <button onclick="cartSetQty('${p.id}', ${item.qty - 1})" class="qty-btn">
            <i class="fa-solid fa-minus text-xs"></i>
          </button>
          <input type="number" value="${item.qty}" min="1" max="${p.stock}"
            onchange="cartSetQty('${p.id}', this.value)"
            class="qty-input" />
          <button onclick="cartSetQty('${p.id}', ${item.qty + 1})" class="qty-btn">
            <i class="fa-solid fa-plus text-xs"></i>
          </button>
          <button onclick="cartRemove('${p.id}')" class="remove-btn">
            <i class="fa-solid fa-trash-can text-xs"></i>
          </button>
        </div>
        <div class="cart-item-price">${fmt(line)}</div>
      </div>`;
  }).join("");

  const { subtotal, taxAmt, total } = cartTotals();
  const sf = document.getElementById("cart-subtotal");
  const tf = document.getElementById("cart-tax");
  const tt = document.getElementById("cart-total");
  if (sf) sf.textContent = fmt(subtotal);
  if (tf) tf.textContent = fmt(taxAmt);
  if (tt) tt.textContent = fmt(total);
}

function toggleCart(force) {
  state.cartOpen = (force !== undefined) ? force : !state.cartOpen;
  const drawer = document.getElementById("cart-drawer");
  const overlay= document.getElementById("cart-overlay");
  if (!drawer) return;
  if (state.cartOpen) {
    drawer.classList.add("cart-open");
    overlay?.classList.remove("hidden");
    document.body.style.overflow = "hidden";
  } else {
    drawer.classList.remove("cart-open");
    overlay?.classList.add("hidden");
    document.body.style.overflow = "";
  }
}

// ─────────────────────────────────────────────────────────────
// 8. RENDER — DASHBOARD VIEW
// ─────────────────────────────────────────────────────────────
function renderDashboard() {
  const todaySales = state.sales.filter(s => s.date.startsWith(today()));
  const revenue    = todaySales.reduce((s, x) => s + x.total,   0);
  const profit     = todaySales.reduce((s, x) => s + x.profit,  0);
  const orders     = todaySales.length;
  const lowStock   = state.products.filter(p => p.stock > 0 && p.stock <= 5);
  const outStock   = state.products.filter(p => p.stock === 0);

  setInner("dash-revenue", fmt(revenue));
  setInner("dash-orders",  orders);
  setInner("dash-profit",  fmt(profit));
  setInner("dash-low",     lowStock.length + outStock.length);

  // Sales history table
  const tbody = document.getElementById("sales-tbody");
  if (!tbody) return;
  if (state.sales.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center py-8 text-slate-400">${t("no_sales")}</td></tr>`;
    return;
  }
  tbody.innerHTML = state.sales.slice(0, 50).map(sale => `
    <tr class="table-row">
      <td>${new Date(sale.date).toLocaleDateString()}</td>
      <td>#${sale.orderNum}</td>
      <td>${sale.items.reduce((s, i) => s + i.qty, 0)}</td>
      <td>${fmt(sale.total)}</td>
      <td class="text-emerald-500 font-semibold">${fmt(sale.profit)}</td>
      <td>${t(sale.payment)}</td>
      <td>
        <button onclick="viewSaleReceipt('${sale.id}')" class="action-btn">
          <i class="fa-solid fa-receipt me-1"></i>${t("view_receipt")}
        </button>
      </td>
    </tr>`).join("");

  // Low stock alerts
  const alertsEl = document.getElementById("low-stock-list");
  if (alertsEl) {
    const all = [...outStock, ...lowStock];
    if (all.length === 0) {
      alertsEl.innerHTML = `<p class="text-slate-400 text-sm py-4 text-center"><i class="fa-solid fa-circle-check me-2 text-emerald-500"></i>All stock levels are healthy</p>`;
    } else {
      alertsEl.innerHTML = all.map(p => {
        const name = state.lang === "ar" ? (p.nameAr || p.name) : p.name;
        const cls  = p.stock === 0 ? "text-red-500" : "text-amber-500";
        return `<div class="flex items-center justify-between py-2 border-b border-slate-700/50">
          <span class="text-sm">${name}</span>
          <span class="text-sm font-bold ${cls}">${p.stock === 0 ? t("out_of_stock") : `${p.stock} left`}</span>
        </div>`;
      }).join("");
    }
  }
}

function viewSaleReceipt(id) {
  const sale = state.sales.find(s => s.id === id);
  if (!sale) return;
  state.currentSale = sale;
  // Open checkout modal in print-preview mode
  const modal = document.getElementById("checkout-modal");
  document.getElementById("co-form").classList.add("hidden");
  const res = document.getElementById("co-result");
  res.classList.remove("hidden");
  document.getElementById("co-res-total").textContent  = fmt(sale.total);
  document.getElementById("co-res-change").textContent = fmt(sale.change);
  document.getElementById("co-res-method").textContent = t(sale.payment);
  document.getElementById("co-res-order").textContent  = `#${sale.orderNum}`;
  modal.classList.remove("hidden");
}

// ─────────────────────────────────────────────────────────────
// 9. RENDER — PRODUCTS MANAGEMENT
// ─────────────────────────────────────────────────────────────
function renderProductsAdmin() {
  const el = document.getElementById("products-table-body");
  if (!el) return;

  let products = state.products;
  const term = (document.getElementById("prod-search")?.value || "").toLowerCase();
  if (term) products = products.filter(p =>
    p.name.toLowerCase().includes(term) || (p.nameAr && p.nameAr.includes(term)));

  if (products.length === 0) {
    el.innerHTML = `<tr><td colspan="8" class="text-center py-8 text-slate-400">${t("no_products")}</td></tr>`;
    return;
  }
  el.innerHTML = products.map(p => {
    const cat  = state.categories.find(c => c.id === p.categoryId);
    const catN = cat ? (state.lang === "ar" ? cat.nameAr || cat.name : cat.name) : "-";
    const name = state.lang === "ar" ? (p.nameAr || p.name) : p.name;
    const stockCls = p.stock === 0 ? "text-red-500" : p.stock <= 5 ? "text-amber-500" : "text-emerald-500";
    return `
      <tr class="table-row">
        <td>${name}</td>
        <td>${catN}</td>
        <td class="font-mono text-xs">${p.barcode || "—"}</td>
        <td class="font-semibold ${stockCls}">${p.stock}</td>
        <td class="text-orange-400">${fmt(p.costPrice)}</td>
        <td class="text-indigo-400">${fmt(p.sellingPrice)}</td>
        <td>
          <button onclick="openProductModal('${p.id}')" class="action-btn me-1">
            <i class="fa-solid fa-pen-to-square"></i>
          </button>
          <button onclick="deleteProduct('${p.id}')" class="action-btn danger">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </td>
      </tr>`;
  }).join("");
}

function openProductModal(id) {
  const modal = document.getElementById("product-modal");
  const form  = document.getElementById("product-form");
  form.reset();
  // Populate category dropdown
  const catSel = document.getElementById("pf-category");
  catSel.innerHTML = state.categories.map(c =>
    `<option value="${c.id}">${c.icon} ${state.lang === "ar" ? c.nameAr || c.name : c.name}</option>`
  ).join("");

  if (id) {
    const p = state.products.find(x => x.id === id);
    if (!p) return;
    state.editingProduct = id;
    document.getElementById("product-modal-title").textContent = t("edit_product");
    document.getElementById("pf-name").value         = p.name;
    document.getElementById("pf-name-ar").value      = p.nameAr || "";
    document.getElementById("pf-category").value     = p.categoryId;
    document.getElementById("pf-barcode").value      = p.barcode || "";
    document.getElementById("pf-stock").value        = p.stock;
    document.getElementById("pf-cost").value         = p.costPrice;
    document.getElementById("pf-selling").value      = p.sellingPrice;
  } else {
    state.editingProduct = null;
    document.getElementById("product-modal-title").textContent = t("add_product");
  }
  modal.classList.remove("hidden");
}

function saveProduct() {
  const name     = document.getElementById("pf-name").value.trim();
  const nameAr   = document.getElementById("pf-name-ar").value.trim();
  const catId    = document.getElementById("pf-category").value;
  const barcode  = document.getElementById("pf-barcode").value.trim();
  const stock    = parseInt(document.getElementById("pf-stock").value)    || 0;
  const cost     = parseFloat(document.getElementById("pf-cost").value)   || 0;
  const selling  = parseFloat(document.getElementById("pf-selling").value)|| 0;

  if (!name) { showToast("Product name required", "error"); return; }
  if (!catId){ showToast("Select a category", "error"); return; }

  if (state.editingProduct) {
    const p = state.products.find(x => x.id === state.editingProduct);
    if (p) Object.assign(p, { name, nameAr, categoryId: catId, barcode, stock, costPrice: cost, sellingPrice: selling });
  } else {
    state.products.push({ id: uid(), name, nameAr, categoryId: catId, barcode, stock, costPrice: cost, sellingPrice: selling });
  }
  save(LS_KEYS.products, state.products);
  closeModal("product-modal");
  renderProductsAdmin();
  showToast(t("save"));
}

function deleteProduct(id) {
  if (!confirm(t("confirm_delete"))) return;
  state.products = state.products.filter(p => p.id !== id);
  save(LS_KEYS.products, state.products);
  renderProductsAdmin();
  showToast("Deleted", "error");
}

function generateBarcode() {
  const el = document.getElementById("pf-barcode");
  if (el) el.value = Date.now().toString().slice(-8);
}

// ─────────────────────────────────────────────────────────────
// 10. RENDER — CATEGORIES MANAGEMENT
// ─────────────────────────────────────────────────────────────
function renderCategoriesAdmin() {
  const el = document.getElementById("categories-list");
  if (!el) return;
  if (state.categories.length === 0) {
    el.innerHTML = `<p class="text-slate-400 text-center py-8">${t("no_categories")}</p>`;
    return;
  }
  el.innerHTML = state.categories.map(c => {
    const name = state.lang === "ar" ? (c.nameAr || c.name) : c.name;
    const count= state.products.filter(p => p.categoryId === c.id).length;
    return `
      <div class="flex items-center justify-between bg-slate-800/50 rounded-xl px-4 py-3 mb-2">
        <div class="flex items-center gap-3">
          <span class="text-2xl">${c.icon}</span>
          <div>
            <div class="font-semibold text-slate-100">${name}</div>
            <div class="text-xs text-slate-400">${count} products</div>
          </div>
        </div>
        <div class="flex gap-2">
          <button onclick="openCategoryModal('${c.id}')" class="action-btn">
            <i class="fa-solid fa-pen-to-square"></i>
          </button>
          <button onclick="deleteCategory('${c.id}')" class="action-btn danger">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>
      </div>`;
  }).join("");
}

function openCategoryModal(id) {
  const modal = document.getElementById("category-modal");
  document.getElementById("cat-form").reset();
  if (id) {
    const c = state.categories.find(x => x.id === id);
    if (!c) return;
    state.editingCategory = id;
    document.getElementById("cat-modal-title").textContent = t("edit_category");
    document.getElementById("cf-name").value    = c.name;
    document.getElementById("cf-name-ar").value = c.nameAr || "";
    document.getElementById("cf-icon").value    = c.icon;
  } else {
    state.editingCategory = null;
    document.getElementById("cat-modal-title").textContent = t("add_category");
  }
  modal.classList.remove("hidden");
}

function saveCategory() {
  const name   = document.getElementById("cf-name").value.trim();
  const nameAr = document.getElementById("cf-name-ar").value.trim();
  const icon   = document.getElementById("cf-icon").value.trim() || "📦";
  if (!name) { showToast("Category name required", "error"); return; }

  if (state.editingCategory) {
    const c = state.categories.find(x => x.id === state.editingCategory);
    if (c) Object.assign(c, { name, nameAr, icon });
  } else {
    state.categories.push({ id: uid(), name, nameAr, icon });
  }
  save(LS_KEYS.categories, state.categories);
  closeModal("category-modal");
  renderCategoriesAdmin();
  showToast(t("save"));
}

function deleteCategory(id) {
  const count = state.products.filter(p => p.categoryId === id).length;
  if (count > 0 && !confirm(`This category has ${count} products. Delete anyway?`)) return;
  state.categories = state.categories.filter(c => c.id !== id);
  save(LS_KEYS.categories, state.categories);
  renderCategoriesAdmin();
}

// ─────────────────────────────────────────────────────────────
// 11. RENDER — SETTINGS VIEW
// ─────────────────────────────────────────────────────────────
function renderSettings() {
  const s = state.settings;
  setVal("set-storename",   s.storeName);
  setVal("set-tax",         s.taxRate);
  setVal("set-currency",    s.currency);
  setVal("set-cashier",     s.cashier || "Admin");
}

function saveSettings() {
  state.settings.storeName = getVal("set-storename") || "Shady Store";
  state.settings.taxRate   = parseFloat(getVal("set-tax")) || 0;
  state.settings.currency  = getVal("set-currency") || "EGP";
  state.settings.cashier   = getVal("set-cashier") || "Admin";
  save(LS_KEYS.settings, state.settings);
  showToast(t("settings_saved"));
  // Update store name in nav
  document.querySelectorAll(".store-name-label").forEach(el => { el.textContent = state.settings.storeName; });
}

// ─────────────────────────────────────────────────────────────
// 12. NAVIGATION
// ─────────────────────────────────────────────────────────────
function navigate(view) {
  state.currentView = view;
  document.querySelectorAll(".view-section").forEach(el => {
    el.classList.add("hidden");
    el.style.display = "";
  });
  const el = document.getElementById(`view-${view}`);
  if (el) {
    el.classList.remove("hidden");
    // POS needs flex layout
    if (view === "pos") el.style.display = "flex";
  }

  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.classList.toggle("nav-active", btn.dataset.view === view);
  });

  // Render correct view
  if (view === "pos") { renderCategories(); renderProducts(); renderCart(); }
  if (view === "dashboard") { renderDashboard(); }
  if (view === "products")  { renderProductsAdmin(); }
  if (view === "categories"){ renderCategoriesAdmin(); }
  if (view === "settings")  { renderSettings(); }

  // Close mobile menu if open
  document.getElementById("mobile-menu")?.classList.add("hidden");
}

// ─────────────────────────────────────────────────────────────
// 13. LANGUAGE & THEME TOGGLES
// ─────────────────────────────────────────────────────────────
function setLanguage(lang) {
  state.lang = lang;
  localStorage.setItem("ss_lang", lang);
  const dir = TRANSLATIONS[lang].dir;
  document.documentElement.dir  = dir;
  document.documentElement.lang = lang;
  applyTranslations();
  // Re-render everything
  navigate(state.currentView);
}

function applyTranslations() {
  document.querySelectorAll("[data-t]").forEach(el => {
    el.textContent = t(el.dataset.t);
  });
  document.querySelectorAll("[data-t-placeholder]").forEach(el => {
    el.placeholder = t(el.dataset.tPlaceholder);
  });
  document.querySelectorAll("[data-t-title]").forEach(el => {
    el.title = t(el.dataset.tTitle);
  });
  // Update lang buttons
  document.getElementById("btn-lang-en")?.classList.toggle("lang-active", state.lang === "en");
  document.getElementById("btn-lang-ar")?.classList.toggle("lang-active", state.lang === "ar");
  // Update store name
  document.querySelectorAll(".store-name-label").forEach(el => { el.textContent = state.settings.storeName; });
}

function toggleDarkMode() {
  state.darkMode = !state.darkMode;
  localStorage.setItem("ss_dark", state.darkMode);
  applyTheme();
}

function applyTheme() {
  document.documentElement.classList.toggle("dark", state.darkMode);
  const icon = document.getElementById("theme-icon");
  if (icon) icon.className = state.darkMode ? "fa-solid fa-sun" : "fa-solid fa-moon";
}

// ─────────────────────────────────────────────────────────────
// 14. MODAL HELPERS
// ─────────────────────────────────────────────────────────────
function closeModal(id) {
  document.getElementById(id)?.classList.add("hidden");
}

// ─────────────────────────────────────────────────────────────
// 15. DOM HELPERS
// ─────────────────────────────────────────────────────────────
const setInner = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
const setVal   = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
const getVal   = (id)    => document.getElementById(id)?.value || "";

// ─────────────────────────────────────────────────────────────
// 16. CSV EXPORT
// ─────────────────────────────────────────────────────────────
function exportSalesCSV() {
  const rows = [["Order#","Date","Items","Subtotal","Tax","Total","Profit","Payment"]];
  state.sales.forEach(s => {
    rows.push([`#${s.orderNum}`, new Date(s.date).toLocaleString(), s.items.reduce((a,i)=>a+i.qty,0),
      s.subtotal.toFixed(2), s.taxAmt.toFixed(2), s.total.toFixed(2), s.profit.toFixed(2), s.payment]);
  });
  const csv  = rows.map(r => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url; a.download = `shady-store-sales-${today()}.csv`;
  a.click(); URL.revokeObjectURL(url);
}

// ─────────────────────────────────────────────────────────────
// 17. SERVICE WORKER REGISTRATION
// ─────────────────────────────────────────────────────────────
function registerSW() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js")
      .then(reg => console.log("[App] SW registered:", reg.scope))
      .catch(err => console.warn("[App] SW failed:", err));
  }
}

// ─────────────────────────────────────────────────────────────
// 18. INIT
// ─────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  loadAll();
  seedDemoData();
  applyTheme();
  applyTranslations();
  initBarcodeScanner();
  registerSW();
  navigate("pos");

  // Handle resize: close cart drawer when going to desktop
  window.addEventListener("resize", () => {
    if (window.innerWidth >= 1024 && state.cartOpen) {
      toggleCart(false);
    }
  });

  // POS search input
  const searchEl = document.getElementById("pos-search");
  if (searchEl) {
    searchEl.addEventListener("input", (e) => {
      state.productSearchTerm = e.target.value;
      renderProducts();
    });
  }

  // Checkout amount tendered
  document.getElementById("co-tendered")?.addEventListener("input", calcChange);
});

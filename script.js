const navToggle = document.getElementById("navToggle");
const mainNav = document.getElementById("mainNav");
const banner = document.querySelector(".banner");
const navWrap = document.querySelector(".nav-wrap");

const cartToggle = document.getElementById("cartToggle");
const cartDrawer = document.getElementById("cartDrawer");
const cartClose = document.getElementById("cartClose");
const cartOverlay = document.getElementById("cartOverlay");

const cartItemsEl = document.getElementById("cartItems");
const cartSubtotalEl = document.getElementById("cartSubtotal");
const cartCountEl = document.getElementById("cartCount");
const addToCartBtn = document.querySelector(".product-add-btn");
const STRIPE_PRODUCT_ENDPOINT = "/.netlify/functions/get-product";
const STRIPE_PRODUCTS_ENDPOINT = "/.netlify/functions/list-products";
let liveProductPrice = null;

const PAGE_REVEAL_SELECTOR = [
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "p",
  "li",
  "label",
  "button",
  "legend",
  "summary",
  "figcaption",
  "dt",
  "dd",
  "blockquote",
  "span",
  ".brand-text",
  ".nav-menu a",
  ".social-links a",
  ".read-more",
  ".checkout-back",
  ".summary-empty a",
  ".tracking-link",
  ".cart-count",
  ".cart-drawer-header h2",
  ".cart-empty",
  ".cart-item-main h3",
  ".cart-item-size",
  ".cart-item-price",
  ".cart-subtotal-label",
  ".cart-subtotal-amount",
  ".checkout-back",
  ".checkout-heading",
  ".checkout-subheading",
  ".checkout-panel h2",
  ".checkout-form-grid legend",
  ".checkout-form-grid label",
  ".checkout-secure",
  ".checkout-btn",
  ".pay-btn",
  ".pay-message",
  ".product-origincat",
  ".product-title",
  ".product-description",
  ".product-price-inline",
  ".product-add-btn",
  ".size-label",
  ".size-option",
  ".summary-item-name",
  ".summary-item-meta",
  ".summary-item-price",
  ".summary-total-label",
  ".summary-total-amount",
  ".tracking-shell h1",
  ".tracking-shell h2",
  ".tracking-shell p",
  ".tracking-form label",
  ".tracking-form button",
  ".tracking-message",
  ".tracking-status",
  ".return-card h1",
  ".return-card p",
  ".btn-primary",
  ".read-more",
  ".social-links a",
  ".shop-filter-btn",
  ".shop-search",
  ".newsletter-form button",
  ".newsletter-form input",
  ".team-role",
  ".blog-date",
  ".blog-category"
].join(", ");

const PAGE_REVEAL_MEDIA_SELECTOR = "img, svg, video, iframe, .team-image, .return-icon";
const PAGE_REVEAL_EXCLUDE_SELECTOR = "script, style, meta, link, title, noscript, template, option";
const PAGE_REVEAL_BASE_DELAY_MS = 80;
const PAGE_REVEAL_MAX_DELAY_MS = 520;
const PAGE_REVEAL_BAND_STEP_MS = 78;
const PAGE_REVEAL_RANK_STEP_MS = 36;
const PAGE_REVEAL_INDEX_STEP_MS = 14;
const PAGE_REVEAL_TEXT_DURATION_MS = 680;
const PAGE_REVEAL_MEDIA_DURATION_MS = 900;
const PAGE_REVEAL_MEDIA_RANK = 3;

function getRevealRank(el) {
  if (el.matches(PAGE_REVEAL_MEDIA_SELECTOR)) return 3;
  if (
    el.matches(
      "button, input, select, textarea, .nav-menu a, .social-links a, .read-more, .checkout-back, .summary-empty a, .tracking-link, .btn-primary, .checkout-btn, .pay-btn, .product-add-btn, .shop-filter-btn, .size-option, .newsletter-form button, .tracking-form button"
    )
  ) {
    return 2;
  }
  if (el.matches("h1, h2, h3, h4, h5, h6, legend, .brand-text")) return 0;
  return 1;
}

function revealPageContent(scope = document) {
  const root = scope instanceof Element ? scope : document.body;
  if (!root) return;

  const candidates = [];

  if (root instanceof Element && root.matches(PAGE_REVEAL_SELECTOR)) {
    candidates.push(root);
  }
  if (root instanceof Element && root.matches(PAGE_REVEAL_MEDIA_SELECTOR)) {
    candidates.push(root);
  }

  root.querySelectorAll(PAGE_REVEAL_SELECTOR).forEach((el) => {
    candidates.push(el);
  });
  root.querySelectorAll(PAGE_REVEAL_MEDIA_SELECTOR).forEach((el) => {
    candidates.push(el);
  });

  const targets = candidates.filter((el) => {
    if (!(el instanceof Element)) return false;
    if (el.dataset.pageRevealApplied === "true") return false;
    if (el.matches(PAGE_REVEAL_EXCLUDE_SELECTOR)) return false;
    if (el.hidden || el.closest("[hidden]")) return false;
    return true;
  });

  if (targets.length === 0) return;

  const entries = targets
    .map((el, index) => {
      const rect = el.getBoundingClientRect();
      return {
        el,
        index,
        top: rect.top,
        left: rect.left,
        band: Math.round(rect.top / 84),
        rank: getRevealRank(el),
      };
    })
    .sort((a, b) => a.band - b.band || a.rank - b.rank || a.left - b.left || a.index - b.index);

  const bandCounts = new Map();

  entries.forEach(({ el, band, rank }) => {
    const key = `${band}:${rank}`;
    const localIndex = bandCounts.get(key) || 0;
    bandCounts.set(key, localIndex + 1);

    el.dataset.pageRevealApplied = "true";
    el.classList.add("page-reveal", rank === PAGE_REVEAL_MEDIA_RANK ? "page-reveal--media" : "page-reveal--text");
    el.style.setProperty(
      "--reveal-delay",
      `${Math.min(
        PAGE_REVEAL_MAX_DELAY_MS,
        PAGE_REVEAL_BASE_DELAY_MS +
          band * PAGE_REVEAL_BAND_STEP_MS +
          rank * PAGE_REVEAL_RANK_STEP_MS +
          localIndex * PAGE_REVEAL_INDEX_STEP_MS
      )}ms`
    );
    el.style.setProperty(
      "--reveal-duration",
      rank === PAGE_REVEAL_MEDIA_RANK ? `${PAGE_REVEAL_MEDIA_DURATION_MS}ms` : `${PAGE_REVEAL_TEXT_DURATION_MS}ms`
    );
  });

  requestAnimationFrame(() => {
    entries.forEach(({ el }) => el.classList.add("is-visible"));
  });
}

// Cart backed by sessionStorage so items persist across page navigations
const CART_KEY = "keystone_cart";

function loadCart() {
  try {
    const raw = sessionStorage.getItem(CART_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveCart() {
  try {
    sessionStorage.setItem(CART_KEY, JSON.stringify(cart));
  } catch {}
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const cart = loadCart();

function formatMoney(value) {
  return `$${value.toFixed(2)}`;
}

function updateCartBadge() {
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);
  if (!cartCountEl) return;
  cartCountEl.hidden = count <= 0;
  if (count > 0) cartCountEl.textContent = count;
}

function updateCartSubtotal() {
  if (!cartSubtotalEl) return;
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  cartSubtotalEl.textContent = formatMoney(subtotal);
}

function renderCart() {
  if (!cartItemsEl) return;

  if (cart.length === 0) {
    cartItemsEl.innerHTML = '<p class="cart-empty">Your cart is empty.</p>';
    updateCartBadge();
    updateCartSubtotal();
    return;
  }

  cartItemsEl.innerHTML = cart
    .map(
      (item, index) => `
      <div class="cart-item">
        <img class="cart-item-image" src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}" />
        <div class="cart-item-main">
          <h3>${escapeHtml(item.name)}</h3>
          <p class="cart-item-size">Size: ${escapeHtml(item.size)}</p>
          <div class="quantity-selector" aria-label="Quantity selector">
            <button type="button" class="qty-btn" data-action="decrease" data-index="${index}" aria-label="Decrease quantity">−</button>
            <span class="qty-value">${item.quantity}</span>
            <button type="button" class="qty-btn" data-action="increase" data-index="${index}" aria-label="Increase quantity">+</button>
          </div>
        </div>
        <div class="cart-item-meta">
          <p class="cart-item-price">${formatMoney(item.price * item.quantity)}</p>
          <button type="button" class="cart-remove" data-action="remove" data-index="${index}" aria-label="Remove item">×</button>
        </div>
      </div>`
    )
    .join("");

  updateCartBadge();
  updateCartSubtotal();
}

function addToCart(product) {
  const existing = cart.find((item) => item.name === product.name && item.size === product.size);
  if (existing) existing.quantity += 1;
  else cart.push({ ...product, quantity: 1 });

  saveCart();
  renderCart();
  openCart();
}

function isProductPage() {
  return location.pathname.includes("product-");
}

async function fetchStripeProduct(productId) {
  const response = await fetch(`${STRIPE_PRODUCT_ENDPOINT}?productId=${encodeURIComponent(productId)}`);
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  return response.json();
}

function deriveOrigin(name) {
  const lower = name.toLowerCase();
  if (lower.includes("ethiopia")) return "Ethiopia";
  if (lower.includes("colombia")) return "Colombia";
  if (lower.includes("guatemala")) return "Guatemala";
  if (lower.includes("sumatra")) return "Sumatra";
  if (lower.includes("costa rica")) return "Costa Rica";
  if (lower.includes("brazil")) return "Brazil";
  return "";
}

function formatProductMetadata(product, fallbackSize) {
  const productOrigin = product.metadata?.origin || deriveOrigin(product.name);
  const productSize = product.metadata?.size || fallbackSize;
  const roast = product.metadata?.roast || "";
  return [roast, productOrigin, productSize].filter(Boolean).join(", ");
}

function setProductPageFromStripe(product) {
  if (!product) return;

  const titleEl = document.querySelector(".product-title");
  const descriptionEl = document.querySelector(".product-description");
  const purchasePriceEl = document.querySelector(".purchase-card-price");

  if (titleEl && product.name) titleEl.textContent = product.name;
  if (descriptionEl && product.description) descriptionEl.textContent = product.description;

  if (purchasePriceEl && product.price?.display) {
    purchasePriceEl.textContent = `$${product.price.display}`;
  }

  if (typeof product.price?.display === "string") {
    const parsed = Number(product.price.display);
    liveProductPrice = Number.isFinite(parsed) ? parsed : null;
  }

  if (product.name) document.title = `${product.name} | Keystone Coffee`;
}

function setCardFromStripe(card, product) {
  if (!card || !product) return;

  const cardTitleEl = card.querySelector(".card-body h3");
  const cardMetaEl = card.querySelector(".card-body .card-meta");
  const cardPriceEl = card.querySelector(".card-body .card-price");
  const cardImgEl = card.querySelector("img");

  if (product.name) {
    card.dataset.name = product.name;
    if (cardTitleEl) cardTitleEl.textContent = product.name;
  }

  if (product.price?.display) {
    const displayPrice = product.price.display;
    card.dataset.price = displayPrice;
    if (cardPriceEl) cardPriceEl.textContent = `$${displayPrice}`;
  }

  if (cardMetaEl) {
    cardMetaEl.textContent = formatProductMetadata(product, card.dataset.size);
  }

  if (product.image) {
    card.dataset.image = product.image;
    if (cardImgEl) cardImgEl.src = product.image;
  }
}

async function initProductPageFromStripe() {
  if (!isProductPage()) return;

  const main = document.querySelector("main[data-product-id]");
  const productId = main?.dataset.productId;
  if (!productId) return;

  try {
    const product = await fetchStripeProduct(productId);
    setProductPageFromStripe(product);
  } catch (error) {
    console.warn("Unable to load live product data:", error);
  }
}

async function initProductCards() {
  const cards = Array.from(document.querySelectorAll(".card[data-product-id]"));
  if (cards.length === 0) return;

  const productCache = new Map();

  await Promise.all(
    cards.map(async (card) => {
      const productId = card.dataset.productId;
      if (!productId) return;

      try {
        if (!productCache.has(productId)) {
          productCache.set(productId, fetchStripeProduct(productId));
        }

        const product = await productCache.get(productId);
        setCardFromStripe(card, product);
      } catch (error) {
        console.warn("Unable to load card product data:", error);
      }
    })
  );
}

let applyShopFilters = null;

function initShopFilters() {
  const searchInput = document.querySelector(".shop-search");
  const filterButtons = Array.from(document.querySelectorAll(".shop-filter-btn"));
  if (!searchInput && filterButtons.length === 0) return;

  let activeOrigin = "all";

  // Re-queries cards each call so it works with dynamically-rendered cards
  applyShopFilters = () => {
    const cards = Array.from(document.querySelectorAll(".shop-page .card[data-origin]"));
    const searchValue = searchInput ? searchInput.value.trim().toLowerCase() : "";

    cards.forEach((card) => {
      const cardName = (card.dataset.name || card.querySelector(".card-body h3")?.textContent || "").toLowerCase();
      const cardOrigin = (card.dataset.origin || "").toLowerCase();
      const matchesSearch = cardName.includes(searchValue);
      const matchesOrigin = activeOrigin === "all" || cardOrigin === activeOrigin;
      card.hidden = !(matchesSearch && matchesOrigin);
    });
  };

  if (searchInput) searchInput.addEventListener("input", applyShopFilters);

  filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      activeOrigin = (button.dataset.filter || "all").toLowerCase();
      filterButtons.forEach((btn) => btn.classList.toggle("active", btn === button));
      applyShopFilters();
    });
  });

  applyShopFilters();
}

function slugify(name) {
  // NFD normalization decomposes accented characters (e.g. 'ú' → 'u' + combining accent)
  // so the subsequent regex can strip the diacritical marks, handling names like
  // 'Costa Rica Tarrazú' → 'product-costa-rica-tarrazu.html'
  return (
    "product-" +
    name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") +
    ".html"
  );
}

async function fetchAllStripeProducts() {
  const response = await fetch(STRIPE_PRODUCTS_ENDPOINT);
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  const data = await response.json();
  return data.products || [];
}

function createProductCard(product) {
  const href = product.metadata?.slug || slugify(product.name);
  const origin = product.metadata?.origin || deriveOrigin(product.name);
  const image = product.image || "";
  const price = product.price?.display || "—";
  const name = product.name || "Product";
  const size = product.metadata?.size || "12 oz";

  const a = document.createElement("a");
  a.className = "card";
  a.href = href;
  a.dataset.productId = product.id;
  a.dataset.name = name;
  a.dataset.price = price;
  a.dataset.size = size;
  a.dataset.image = image;
  if (origin) a.dataset.origin = origin;

  const img = document.createElement("img");
  img.src = image;
  img.alt = name;

  const indicator = document.createElement("span");
  indicator.className = "card-selection-indicator";
  indicator.setAttribute("aria-hidden", "true");

  const body = document.createElement("div");
  body.className = "card-body";

  const h3 = document.createElement("h3");
  h3.textContent = name;

  const meta = document.createElement("p");
  meta.className = "card-meta";
  meta.textContent = formatProductMetadata(product, size);

  const p = document.createElement("p");
  p.className = "card-price";
  p.textContent = `$${price}`;

  body.appendChild(h3);
  body.appendChild(meta);
  body.appendChild(p);
  a.appendChild(indicator);
  a.appendChild(img);
  a.appendChild(body);

  return a;
}

async function initShopProducts() {
  const grid = document.getElementById("shop-grid");
  if (!grid) return;

  try {
    const products = await fetchAllStripeProducts();
    grid.innerHTML = "";
    products.forEach((product) => {
      grid.appendChild(createProductCard(product));
    });
  } catch (err) {
    console.warn("Unable to load shop products:", err);
    grid.innerHTML = '<p class="load-error">Unable to load products. Please try again later.</p>';
  }

  // Apply any active search/filter state after cards are in the DOM
  if (typeof applyShopFilters === "function") applyShopFilters();
  revealPageContent(grid);
}

function pickRandom(arr, n) {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, n);
}

async function initFeaturedProducts() {
  const grid = document.getElementById("featured-grid");
  if (!grid) return;

  try {
    const products = await fetchAllStripeProducts();
    const featured = pickRandom(products, 3);
    grid.innerHTML = "";
    featured.forEach((product) => {
      grid.appendChild(createProductCard(product));
    });
  } catch (err) {
    console.warn("Unable to load featured products:", err);
  }

  revealPageContent(grid);
}

function isCartOpen() {
  return cartDrawer?.classList.contains("open");
}

function showBanner() {
  if (banner) banner.classList.remove("is-hidden");
}

function hideBanner() {
  if (banner) banner.classList.add("is-hidden");
}

/**
 * Banner rules:
 * - Always hide banner when cart drawer is open (main page + product pages)
 * - Show banner again when cart drawer closes
 * - On main page, scrolling can hide/show banner as previously implemented
 * - On product pages, show on close; hide on open
 */
function openCart() {
  if (!cartDrawer || !cartOverlay || !cartToggle) return;

  cartDrawer.classList.add("open");
  cartDrawer.setAttribute("aria-hidden", "false");
  cartToggle.setAttribute("aria-expanded", "true");
  cartOverlay.hidden = false;

  hideBanner();
}

function closeCart() {
  if (!cartDrawer || !cartOverlay || !cartToggle) return;

  cartDrawer.classList.remove("open");
  cartDrawer.setAttribute("aria-hidden", "true");
  cartToggle.setAttribute("aria-expanded", "false");
  cartOverlay.hidden = true;

  showBanner();
}

navToggle?.addEventListener("click", (e) => {
  e.stopPropagation();
  const isOpen = mainNav.classList.toggle("open");
  navToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
  navWrap?.classList.toggle("is-open", isOpen);
  closeCart();
});

cartToggle?.addEventListener("click", (e) => {
  e.stopPropagation();
  if (cartDrawer?.classList.contains("open")) closeCart();
  else {
    openCart();
    mainNav?.classList.remove("open");
    navToggle?.setAttribute("aria-expanded", "false");
    navWrap?.classList.remove("is-open");
  }
});

cartClose?.addEventListener("click", closeCart);
cartOverlay?.addEventListener("click", closeCart);

document.addEventListener("click", (e) => {
  if (!e.target.closest(".nav-wrap") && !e.target.closest(".cart-drawer")) {
    mainNav?.classList.remove("open");
    navToggle?.setAttribute("aria-expanded", "false");
    navWrap?.classList.remove("is-open");
    closeCart();
  }
});

cartItemsEl?.addEventListener("click", (e) => {
  const button = e.target.closest("button[data-action]");
  if (!button) return;

  e.stopPropagation();

  const index = Number(button.dataset.index);
  const action = button.dataset.action;

  if (action === "increase") cart[index].quantity += 1;
  else if (action === "decrease") {
    cart[index].quantity -= 1;
    if (cart[index].quantity <= 0) cart.splice(index, 1);
  } else if (action === "remove") {
    cart.splice(index, 1);
  }

  saveCart();
  renderCart();
  openCart();
});

if (addToCartBtn) {
  addToCartBtn.addEventListener("click", () => {
    showBanner();

    const title = document.querySelector(".product-title")?.textContent.trim() || "Product";
    const priceText =
      document.querySelector(".purchase-card-price")?.textContent.trim() ||
      document.querySelector(".product-price-inline")?.textContent.trim() ||
      "$9.99";
    const fallbackPrice = Number(priceText.replace(/[^0-9.]/g, "")) || 9.99;
    const price = Number.isFinite(liveProductPrice) ? liveProductPrice : fallbackPrice;
    const image = document.querySelector(".product-media img")?.src || "";
    const size = document.querySelector(".size-option.active")?.dataset.size || "12oz";

    addToCart({ name: title, price, size, image });
    animateAddToCart(addToCartBtn);
  });
}

function loadProductImages() {
  const cards = document.querySelectorAll(".card[data-product-id]");
  cards.forEach((card) => {
    const productId = card.dataset.productId;
    fetch(`/.netlify/functions/get-product?productId=${encodeURIComponent(productId)}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (data && data.image) {
          const img = card.querySelector("img");
          if (img) img.src = data.image;
          card.dataset.image = data.image;
        }
      })
      .catch((err) => {
        // Silently fall back to existing src — do not break the page
        console.warn(`loadProductImages: failed to load image for product "${productId}"`, err);
      });
  });
}

function animateAddToCart(btn) {
  if (btn.classList.contains("btn-success")) return;
  const original = btn.textContent;
  btn.classList.add("btn-success");
  btn.textContent = "✓ Added to Cart";
  btn.disabled = true;
  setTimeout(() => {
    btn.classList.remove("btn-success");
    btn.textContent = original;
    btn.disabled = false;
  }, 1500);
}

// Checkout navigates to the dedicated, fully themed checkout page rather than
// opening an in-page overlay.
function startCheckout() {
  if (cart.length === 0) return;
  closeCart();
  window.location.href = "checkout.html";
}

// Wire up all Checkout buttons (inside cart drawer footer)
document.addEventListener("click", (e) => {
  if (e.target.closest(".checkout-btn")) {
    e.stopPropagation();
    startCheckout();
  }
});

/* Page-load reveal cascade */
window.addEventListener("DOMContentLoaded", () => {
  loadProductImages();
  revealPageContent(document.body);

  if (!isProductPage()) showBanner();
});

window.addEventListener("DOMContentLoaded", () => {
  initProductPageFromStripe();
  initProductCards();
  initShopFilters();
  initShopProducts();
  initFeaturedProducts();
});

renderCart();

/* Size option selector (product pages) */
const sizeOptionBtns = document.querySelectorAll(".size-option");
sizeOptionBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    sizeOptionBtns.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
  });
});

let lastScrollY = window.scrollY;
let hideTimer = null;

window.addEventListener("scroll", () => {
  if (!banner) return;

  // If cart is open, banner must stay hidden
  if (isCartOpen()) return;

  // Only main page scroll-hide behavior
  if (!isProductPage()) {
    const currentScrollY = window.scrollY;

    if (currentScrollY === 0) {
      clearTimeout(hideTimer);
      showBanner();
    } else if (currentScrollY > lastScrollY) {
      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => hideBanner(), 20);
    } else {
      clearTimeout(hideTimer);
      showBanner();
    }

    lastScrollY = currentScrollY;
  }
});

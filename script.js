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
    const price = Number(priceText.replace(/[^0-9.]/g, "")) || 9.99;
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
      .catch(() => {
        // Silently fall back to existing src — do not break the page
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

/* Slow top->bottom cascade on all pages */
window.addEventListener("DOMContentLoaded", () => {
  loadProductImages();

  const main = document.querySelector("main");
  if (!main) return;

  const targets = Array.from(
    main.querySelectorAll(
      ".hero, .section, .company-summary, .social-section, .contact-section, .grid, .features, .card, .product-layout, .product-media, .product-info, .product-title, .product-description, .produc[...]"
    )
  );

  if (targets.length === 0) return;

  targets.forEach((el) => el.classList.add("reveal"));

  const ordered = targets
    .map((el) => ({ el, top: el.getBoundingClientRect().top }))
    .sort((a, b) => a.top - b.top);

  const baseDelay = 250;
  const step = 160;

  ordered.forEach(({ el }, idx) => {
    el.style.transitionDelay = `${baseDelay + idx * step}ms`;
  });

  requestAnimationFrame(() => {
    ordered.forEach(({ el }) => el.classList.add("is-visible"));
  });

  if (!isProductPage()) showBanner();
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

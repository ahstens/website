// Standalone, themed Stripe checkout page (Payment Element).
const CART_KEY = "keystone_cart";

function loadCart() {
  try {
    const raw = sessionStorage.getItem(CART_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function formatMoney(value) {
  return `$${value.toFixed(2)}`;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const cart = loadCart();
const summaryEl = document.getElementById("orderSummary");
const paymentArea = document.getElementById("paymentArea");

function renderSummary() {
  if (cart.length === 0) {
    summaryEl.innerHTML = `
      <p class="summary-empty">
        Your cart is empty. <a href="index.html">Browse our coffee</a> to get started.
      </p>`;
    return;
  }

  const rows = cart
    .map(
      (item) => `
      <div class="summary-item">
        <img class="summary-item-image" src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}" />
        <div>
          <p class="summary-item-name">${escapeHtml(item.name)}</p>
          <p class="summary-item-meta">Size: ${escapeHtml(item.size)} &middot; Qty ${Number(item.quantity)}</p>
        </div>
        <p class="summary-item-price">${formatMoney(item.price * item.quantity)}</p>
      </div>`
    )
    .join("");

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  summaryEl.innerHTML = `
    ${rows}
    <div class="summary-total">
      <span class="summary-total-label">Total</span>
      <span class="summary-total-amount">${formatMoney(total)}</span>
    </div>`;
}

function loadStripeJs() {
  return new Promise((resolve, reject) => {
    if (window.Stripe) return resolve(window.Stripe);
    const script = document.createElement("script");
    script.src = "https://js.stripe.com/v3/";
    script.async = true;
    script.onload = () => resolve(window.Stripe);
    script.onerror = () => reject(new Error("Failed to load Stripe.js"));
    document.head.appendChild(script);
  });
}

// Stripe Appearance API tuned to the Keystone Coffee palette so the payment
// form matches the rest of the site (plum background, gold accents, cream text).
const appearance = {
  theme: "night",
  labels: "floating",
  variables: {
    colorPrimary: "#d99e54",
    colorBackground: "#5e3a43",
    colorText: "#f7f4ef",
    colorTextSecondary: "rgba(247, 244, 239, 0.7)",
    colorTextPlaceholder: "rgba(247, 244, 239, 0.45)",
    colorDanger: "#ff8a8a",
    colorIconTabSelected: "#6e434d",
    fontFamily: 'Georgia, "Times New Roman", serif',
    fontSizeBase: "16px",
    borderRadius: "8px",
    spacingUnit: "4px",
  },
  rules: {
    ".Input": {
      border: "1px solid rgba(217, 158, 84, 0.4)",
      boxShadow: "none",
    },
    ".Input:focus": {
      border: "1px solid #d99e54",
      boxShadow: "0 0 0 1px #d99e54",
    },
    ".Label": {
      color: "rgba(247, 244, 239, 0.85)",
    },
    ".Tab": {
      border: "1px solid rgba(217, 158, 84, 0.4)",
      backgroundColor: "rgba(255, 255, 255, 0.04)",
    },
    ".Tab:hover": {
      borderColor: "rgba(217, 158, 84, 0.7)",
    },
    ".Tab--selected": {
      borderColor: "#d99e54",
      backgroundColor: "rgba(217, 158, 84, 0.16)",
    },
    ".TabLabel--selected": {
      color: "#d99e54",
    },
    ".Block": {
      backgroundColor: "rgba(255, 255, 255, 0.04)",
      borderColor: "rgba(217, 158, 84, 0.4)",
    },
  },
};

let stripe = null;
let elements = null;

function renderPaymentError(message) {
  paymentArea.innerHTML = `
    <p class="pay-message" style="color: rgb(255, 178, 178);">${escapeHtml(message)}</p>
    <a class="pay-btn" href="index.html" style="display:block; text-align:center; line-height:56px; text-decoration:none;">Return to Shop</a>`;
}

async function initPayment() {
  try {
    const res = await fetch("/.netlify/functions/create-payment-intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: cart }),
    });

    let data = {};
    try {
      data = await res.json();
    } catch {
      // Non-JSON response (e.g. a platform error page) — keep data empty.
    }
    if (!res.ok) {
      throw new Error(data.error || `Could not start checkout (HTTP ${res.status}).`);
    }

    const { clientSecret, publishableKey } = data;
    if (!clientSecret || !publishableKey) {
      throw new Error("Payment could not be initialized. Please contact support.");
    }

    const StripeConstructor = await loadStripeJs();
    stripe = StripeConstructor(publishableKey);
    elements = stripe.elements({ clientSecret, appearance });

    paymentArea.innerHTML = `
      <form id="payment-form">
        <div id="link-authentication-element"></div>
        <div id="payment-element"></div>
        <button id="payBtn" class="pay-btn" type="submit">Pay now</button>
        <p id="payMessage" class="pay-message" role="alert"></p>
        <p class="checkout-secure">&#128274; Payments are securely processed by Stripe.</p>
      </form>`;

    const linkAuth = elements.create("linkAuthentication");
    linkAuth.mount("#link-authentication-element");

    const paymentElement = elements.create("payment", { layout: "tabs" });
    paymentElement.mount("#payment-element");

    document.getElementById("payment-form").addEventListener("submit", handleSubmit);
  } catch (err) {
    renderPaymentError(err.message || "Something went wrong while preparing checkout.");
  }
}

let submitting = false;

async function handleSubmit(event) {
  event.preventDefault();
  if (submitting || !stripe || !elements) return;

  submitting = true;
  const payBtn = document.getElementById("payBtn");
  const messageEl = document.getElementById("payMessage");
  messageEl.textContent = "";
  payBtn.disabled = true;
  payBtn.innerHTML = '<span class="pay-btn-spinner" aria-hidden="true"></span> Processing&hellip;';

  const { error } = await stripe.confirmPayment({
    elements,
    confirmParams: {
      return_url: `${window.location.origin}/checkout-return.html`,
    },
  });

  // Reaching here means the redirect did not happen, so an error occurred.
  if (error) {
    messageEl.textContent = error.message || "Payment could not be completed. Please try again.";
  }
  submitting = false;
  payBtn.disabled = false;
  payBtn.textContent = "Pay now";
}

renderSummary();

if (cart.length === 0) {
  paymentArea.innerHTML = `<p class="summary-empty">Add an item to your cart to check out.</p>`;
} else {
  initPayment();
}

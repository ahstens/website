// Standalone, themed Stripe checkout page (Payment Element).
const CART_KEY = "keystone_cart";
const SHIPPING_ADDRESS_KEY = "keystone_shipping_address";
const TRACKING_NUMBER_KEY = "keystone_tracking_number";

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
const checkoutGridEl = document.querySelector(".checkout-grid");
const shippingFieldIds = {
  name: "shippingName",
  street1: "shippingStreet1",
  city: "shippingCity",
  state: "shippingState",
  zip: "shippingZip",
  email: "shippingEmail",
};

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

function loadStoredAddress() {
  try {
    const stored = JSON.parse(sessionStorage.getItem(SHIPPING_ADDRESS_KEY) || "null");
    return stored && typeof stored === "object" ? stored : null;
  } catch {
    return null;
  }
}

function formatExternalUrl(value) {
  try {
    const parsed = new URL(String(value || ""), window.location.origin);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.toString();
    }
  } catch {}
  return "";
}

function getShippingInput(field) {
  return document.getElementById(shippingFieldIds[field]);
}

function prefillShippingAddress() {
  const stored = loadStoredAddress();
  if (!stored) return;
  Object.keys(shippingFieldIds).forEach((field) => {
    const input = getShippingInput(field);
    if (input) input.value = String(stored[field] || "");
  });
}

function collectShippingAddress() {
  const values = {};
  const missing = [];

  Object.keys(shippingFieldIds).forEach((field) => {
    const input = getShippingInput(field);
    const value = String(input?.value || "").trim();
    values[field] = value;
    if (!value) {
      missing.push(field);
      if (input) input.setAttribute("aria-invalid", "true");
    } else if (input) {
      input.removeAttribute("aria-invalid");
    }
  });

  return {
    missing,
    toAddress: {
      name: values.name,
      street1: values.street1,
      city: values.city,
      state: values.state,
      zip: values.zip,
      country: "US",
      email: values.email,
    },
  };
}

function renderCheckoutState(content) {
  if (!checkoutGridEl) return;
  checkoutGridEl.innerHTML = `
    <section class="checkout-panel checkout-result-panel">
      ${content}
    </section>`;
}

function renderSuccess(toAddress, labelData) {
  const safeTrackingUrl = formatExternalUrl(labelData.trackingUrl);
  renderCheckoutState(`
    <span class="checkout-result-icon" aria-hidden="true">&#10003;</span>
    <h2>Order Confirmed!</h2>
    <p>Your payment was successful and your shipping label has been created.</p>
    ${toAddress.email ? `<p class="checkout-result-email">${escapeHtml(toAddress.email)}</p>` : ""}
    <p class="checkout-result-note">Tracking Number: <strong>${escapeHtml(labelData.trackingNumber || "Pending")}</strong></p>
    ${safeTrackingUrl ? `<p><a class="tracking-link" href="${safeTrackingUrl}" target="_blank" rel="noopener noreferrer">Track this shipment</a></p>` : ""}
    <p>${labelData.carrier ? `Carrier: ${escapeHtml(labelData.carrier)}` : ""} ${labelData.servicelevel ? `(${escapeHtml(labelData.servicelevel)})` : ""}</p>
    <div class="checkout-result-actions">
      <a href="tracking.html" class="pay-btn">Track My Order</a>
      <a href="index.html" class="pay-btn">Continue Shopping</a>
    </div>
  `);
}

function renderPaymentOnlySuccess(toAddress, message) {
  renderCheckoutState(`
    <span class="checkout-result-icon" aria-hidden="true">&#10003;</span>
    <h2>Payment Confirmed!</h2>
    <p>${escapeHtml(message)}</p>
    ${toAddress.email ? `<p class="checkout-result-email">${escapeHtml(toAddress.email)}</p>` : ""}
    <p>If needed, our team can provide tracking details by email.</p>
    <div class="checkout-result-actions">
      <a href="tracking.html" class="pay-btn">Track Order</a>
      <a href="index.html" class="pay-btn">Continue Shopping</a>
    </div>
  `);
}

function renderProcessingState() {
  renderCheckoutState(`
    <span class="checkout-result-icon" aria-hidden="true">&#9203;</span>
    <h2>Payment Processing</h2>
    <p>Your payment is being processed. We'll email you once it's confirmed.</p>
    <div class="checkout-result-actions">
      <a href="index.html" class="pay-btn">Continue Shopping</a>
    </div>
  `);
}

async function createLabelForSuccessfulPayment(toAddress) {
  try {
    const res = await fetch("/.netlify/functions/create-shippo-label", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toAddress, items: cart }),
    });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || "Label creation failed");

    if (data.trackingNumber) {
      sessionStorage.setItem(TRACKING_NUMBER_KEY, data.trackingNumber);
    }

    sessionStorage.removeItem(CART_KEY);
    sessionStorage.removeItem(SHIPPING_ADDRESS_KEY);
    renderSuccess(toAddress, data);
  } catch (err) {
    sessionStorage.removeItem(CART_KEY);
    sessionStorage.removeItem(SHIPPING_ADDRESS_KEY);
    renderPaymentOnlySuccess(
      toAddress,
      `Your payment went through, but we couldn't create the shipping label automatically: ${err.message || "Please contact support."}`
    );
  }
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
    fontFamily: 'Freight Text Pro, Georgia, "Times New Roman", serif',
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

  const payBtn = document.getElementById("payBtn");
  const messageEl = document.getElementById("payMessage");
  if (!payBtn || !messageEl) return;
  messageEl.textContent = "";

  const { missing, toAddress } = collectShippingAddress();
  if (missing.length > 0) {
    messageEl.textContent = "Please fill in your full shipping address before completing payment.";
    return;
  }

  sessionStorage.setItem(SHIPPING_ADDRESS_KEY, JSON.stringify(toAddress));

  submitting = true;
  payBtn.disabled = true;
  payBtn.innerHTML = '<span class="pay-btn-spinner" aria-hidden="true"></span> Processing&hellip;';

  const { error, paymentIntent } = await stripe.confirmPayment({
    elements,
    confirmParams: {
      return_url: `${window.location.origin}/checkout-return.html`,
    },
    redirect: "if_required",
  });

  if (error) {
    messageEl.textContent = error.message || "Payment could not be completed. Please try again.";
  } else if (paymentIntent?.status === "succeeded") {
    await createLabelForSuccessfulPayment(toAddress);
  } else if (paymentIntent?.status === "processing") {
    sessionStorage.removeItem(CART_KEY);
    renderProcessingState();
  } else if (paymentIntent) {
    messageEl.textContent = `Payment status: ${paymentIntent.status}. Please follow any prompts or check your email for updates.`;
  }

  submitting = false;
  if (document.body.contains(payBtn)) {
    payBtn.disabled = false;
    payBtn.textContent = "Pay now";
  }
}

renderSummary();
prefillShippingAddress();

if (cart.length === 0) {
  paymentArea.innerHTML = `<p class="summary-empty">Add an item to your cart to check out.</p>`;
} else {
  initPayment();
}

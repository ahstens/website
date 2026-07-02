// Standalone, themed Stripe checkout page (Payment Element).
const CART_KEY = "keystone_cart";
const SHIPPING_ADDRESS_KEY = "keystone_shipping_address";

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
        <fieldset class="checkout-form-grid">
          <legend>Shipping Address</legend>
          <label>Full Name<input name="shippingName" type="text" autocomplete="name" required /></label>
          <label>Email<input name="shippingEmail" type="email" autocomplete="email" required /></label>
          <label>Street Address<input name="shippingStreet1" type="text" autocomplete="shipping address-line1" required /></label>
          <label>City<input name="shippingCity" type="text" autocomplete="shipping address-level2" required /></label>
          <label>State<input name="shippingState" type="text" autocomplete="shipping address-level1" required /></label>
          <label>ZIP Code<input name="shippingZip" type="text" autocomplete="shipping postal-code" required /></label>
        </fieldset>
        <label class="checkout-checkbox">
          <input id="billingSameAsShipping" type="checkbox" checked />
          Billing address is the same as shipping
        </label>
        <fieldset id="billingFields" class="checkout-form-grid" hidden>
          <legend>Billing Address</legend>
          <label>Full Name<input name="billingName" type="text" autocomplete="name" /></label>
          <label>Email<input name="billingEmail" type="email" autocomplete="email" /></label>
          <label>Street Address<input name="billingStreet1" type="text" autocomplete="billing address-line1" /></label>
          <label>City<input name="billingCity" type="text" autocomplete="billing address-level2" /></label>
          <label>State<input name="billingState" type="text" autocomplete="billing address-level1" /></label>
          <label>ZIP Code<input name="billingZip" type="text" autocomplete="billing postal-code" /></label>
        </fieldset>
        <div id="payment-element"></div>
        <button id="payBtn" class="pay-btn" type="submit">Pay now</button>
        <p id="payMessage" class="pay-message" role="alert"></p>
        <p class="checkout-secure">&#128274; Payments are securely processed by Stripe.</p>
      </form>`;

    const paymentElement = elements.create("payment", { layout: "tabs" });
    paymentElement.mount("#payment-element");

    document.getElementById("payment-form").addEventListener("submit", handleSubmit);
    const billingSameCheckbox = document.getElementById("billingSameAsShipping");
    const billingFieldset = document.getElementById("billingFields");
    const billingInputs = billingFieldset.querySelectorAll("input");
    billingSameCheckbox.addEventListener("change", () => {
      const showBillingFields = !billingSameCheckbox.checked;
      billingFieldset.hidden = !showBillingFields;
      billingInputs.forEach((input) => {
        input.required = showBillingFields;
      });
    });
  } catch (err) {
    renderPaymentError(err.message || "Something went wrong while preparing checkout.");
  }
}

let submitting = false;

async function handleSubmit(event) {
  event.preventDefault();
  if (submitting || !stripe || !elements) return;

  const form = document.getElementById("payment-form");
  const formData = new FormData(form);
  const toAddress = {
    name: String(formData.get("shippingName") || "").trim(),
    street1: String(formData.get("shippingStreet1") || "").trim(),
    city: String(formData.get("shippingCity") || "").trim(),
    state: String(formData.get("shippingState") || "").trim(),
    zip: String(formData.get("shippingZip") || "").trim(),
    country: "US",
    email: String(formData.get("shippingEmail") || "").trim(),
  };
  sessionStorage.setItem(SHIPPING_ADDRESS_KEY, JSON.stringify(toAddress));

  const billingSameAsShipping = document.getElementById("billingSameAsShipping")?.checked ?? true;
  const billingDetails = billingSameAsShipping
    ? toAddress
    : {
        name: String(formData.get("billingName") || "").trim(),
        street1: String(formData.get("billingStreet1") || "").trim(),
        city: String(formData.get("billingCity") || "").trim(),
        state: String(formData.get("billingState") || "").trim(),
        zip: String(formData.get("billingZip") || "").trim(),
        country: "US",
        email: String(formData.get("billingEmail") || "").trim(),
      };

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
      shipping: {
        name: toAddress.name,
        address: {
          line1: toAddress.street1,
          city: toAddress.city,
          state: toAddress.state,
          postal_code: toAddress.zip,
          country: toAddress.country,
        },
      },
      payment_method_data: {
        billing_details: {
          name: billingDetails.name,
          email: billingDetails.email,
          address: {
            line1: billingDetails.street1,
            city: billingDetails.city,
            state: billingDetails.state,
            postal_code: billingDetails.zip,
            country: billingDetails.country,
          },
        },
      },
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

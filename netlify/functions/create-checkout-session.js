const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const items = body.items; // [{ priceId: 'price_...', quantity: 1 }, ...]

    if (!Array.isArray(items) || items.length === 0) {
      return { statusCode: 400, body: 'No items provided' };
    }

    const line_items = items.map((it) => ({
      price: it.priceId,
      quantity: it.quantity || 1,
    }));

    // Netlify sets URL during deploy; fallback to environment or a placeholder
    const origin = process.env.SITE_ORIGIN || (process.env.URL ? `https://${process.env.URL}` : 'https://your-site.netlify.app');
    const success_url = `${origin}/success.html`;
    const cancel_url = `${origin}/`;

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items,
      success_url,
      cancel_url,
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: session.url }),
    };
  } catch (err) {
    console.error('create-checkout-session error', err);
    return { statusCode: 500, body: 'Internal Server Error' };
  }
};

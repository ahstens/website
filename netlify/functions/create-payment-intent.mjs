export default async (req) => {
  try {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    // Trim to tolerate keys pasted into the Netlify dashboard with stray
    // whitespace/newlines, which otherwise produce "Invalid API Key" errors.
    const secretKey = (Netlify.env.get('STRIPE_SECRET_KEY') || '').trim();
    const publishableKey = (Netlify.env.get('STRIPE_PUBLISHABLE_KEY') || '').trim();

    if (!secretKey || !publishableKey) {
      return Response.json(
        { error: 'Stripe is not configured. Set STRIPE_SECRET_KEY and STRIPE_PUBLISHABLE_KEY.' },
        { status: 500 }
      );
    }

    let items;
    try {
      ({ items } = await req.json());
    } catch {
      return Response.json({ error: 'Invalid request body' }, { status: 400 });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return Response.json({ error: 'Cart is empty' }, { status: 400 });
    }

    // Load the Stripe SDK defensively. If the dependency is missing from the
    // deployed bundle, fail with a clear JSON message instead of an unhandled
    // crash (which would surface to the browser as a generic checkout error).
    let Stripe;
    try {
      ({ default: Stripe } = await import('stripe'));
    } catch {
      return Response.json(
        { error: 'Payment library unavailable. Please try again later.' },
        { status: 500 }
      );
    }

    // Compute the total server-side from validated line items so the charged
    // amount never depends on a trusted client-supplied total.
    let amount = 0;
    const descriptions = [];
    for (const item of items) {
      const unitAmount = Math.round(Number(item.price) * 100);
      const quantity = Math.max(1, Math.floor(Number(item.quantity) || 1));
      if (!Number.isFinite(unitAmount) || unitAmount <= 0) {
        throw new Error(`Invalid price for item "${item.name || 'unknown'}"`);
      }
      amount += unitAmount * quantity;
      descriptions.push(`${String(item.name || 'Item')} ×${quantity}`);
    }

    if (amount <= 0) {
      return Response.json({ error: 'Cart total must be greater than zero' }, { status: 400 });
    }

    const stripe = new Stripe(secretKey);
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      description: descriptions.join(', ').slice(0, 1000),
    });

    return Response.json({
      clientSecret: paymentIntent.client_secret,
      publishableKey,
      amount,
    });
  } catch (err) {
    // Catch-all so the browser always receives a JSON { error } payload with a
    // real reason rather than an opaque platform error envelope.
    console.error('create-payment-intent failed:', err);
    return Response.json(
      { error: err?.message || 'Unable to create payment intent' },
      { status: 500 }
    );
  }
};

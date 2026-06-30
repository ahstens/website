export default async (req) => {
  try {
    const paymentIntentId = new URL(req.url).searchParams.get('payment_intent');

    if (!paymentIntentId) {
      return Response.json({ error: 'payment_intent is required' }, { status: 400 });
    }

    const secretKey = (Netlify.env.get('STRIPE_SECRET_KEY') || '').trim();
    if (!secretKey) {
      return Response.json({ error: 'Stripe is not configured' }, { status: 500 });
    }

    let Stripe;
    try {
      ({ default: Stripe } = await import('stripe'));
    } catch {
      return Response.json(
        { error: 'Payment library unavailable. Please try again later.' },
        { status: 500 }
      );
    }

    const stripe = new Stripe(secretKey);
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    return Response.json({
      status: paymentIntent.status,
      amount: paymentIntent.amount,
      customerEmail: paymentIntent.receipt_email ?? null,
    });
  } catch (err) {
    console.error('retrieve-payment-intent failed:', err);
    return Response.json(
      { error: err?.message || 'Unable to retrieve payment status' },
      { status: 500 }
    );
  }
};

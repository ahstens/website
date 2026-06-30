const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

exports.handler = async function (event) {
  const productId = (event.queryStringParameters && event.queryStringParameters.productId) || null;

  if (!productId) {
    return { statusCode: 400, body: 'productId query parameter is required' };
  }

  try {
    // Retrieve product
    const product = await stripe.products.retrieve(productId);

    // Resolve price (prefer default_price if set)
    let price = null;
    if (product.default_price) {
      price = await stripe.prices.retrieve(product.default_price);
    } else {
      const pricesList = await stripe.prices.list({ product: productId, limit: 1 });
      price = pricesList.data[0] || null;
    }

    const body = {
      id: product.id,
      name: product.name,
      description: product.description || null,
      image: (product.images && product.images[0]) || null,
      price: price
        ? { id: price.id, unit_amount: price.unit_amount, currency: price.currency, display: (price.unit_amount / 100).toFixed(2) }
        : null,
    };

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    };
  } catch (err) {
    console.error('Stripe error:', err);
    return {
      statusCode: 500,
      body: 'Error fetching product from Stripe',
    };
  }
};

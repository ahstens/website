const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

exports.handler = async function () {
  try {
    // Fetch all active products (auto-paginate up to 100)
    const productsList = await stripe.products.list({ active: true, limit: 100 });

    // Collect all unique price IDs needed
    const pricePromises = productsList.data.map(async (product) => {
      let price = null;
      try {
        if (product.default_price) {
          price = await stripe.prices.retrieve(product.default_price);
        } else {
          const pricesList = await stripe.prices.list({ product: product.id, limit: 1 });
          price = pricesList.data[0] || null;
        }
      } catch (err) {
        console.warn(`list-products: failed to retrieve price for ${product.id}`, err.message);
      }
      return {
        id: product.id,
        name: product.name,
        description: product.description || null,
        image: (product.images && product.images[0]) || null,
        metadata: product.metadata || {},
        price: price
          ? {
              id: price.id,
              unit_amount: price.unit_amount,
              currency: price.currency,
              display: (price.unit_amount / 100).toFixed(2),
            }
          : null,
      };
    });

    const products = await Promise.all(pricePromises);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ products }),
    };
  } catch (err) {
    console.error('list-products error:', err);
    return { statusCode: 500, body: 'Error fetching products from Stripe' };
  }
};

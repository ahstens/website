const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

exports.handler = async function () {
  try {
    // Expand default_price in the products list call to avoid N+1 price lookups
    const productsList = await stripe.products.list({
      active: true,
      limit: 100,
      expand: ['data.default_price'],
    });

    const products = await Promise.all(
      productsList.data.map(async (product) => {
        let price = null;

        if (product.default_price && typeof product.default_price === 'object') {
          // Already expanded by the list call
          price = product.default_price;
        } else if (!product.default_price) {
          // No default_price — fall back to listing prices for this product
          try {
            const pricesList = await stripe.prices.list({ product: product.id, limit: 1 });
            price = pricesList.data[0] || null;
          } catch (err) {
            console.warn(`list-products: failed to retrieve price for ${product.id}`, err.message);
          }
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
      })
    );

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ products }),
    };
  } catch (err) {
    console.error('list-products error:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Error fetching products from Stripe', message: err.message }),
    };
  }
};

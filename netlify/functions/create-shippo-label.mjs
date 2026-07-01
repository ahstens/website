const SHIPPO_BASE_URL = 'https://api.goshippo.com';

function normalizeSize(size) {
  return String(size || '').trim().toLowerCase().replace(/\s+/g, '');
}

function calculateParcelWeight(items) {
  const sizeWeights = {
    '12oz': 1,
    '2lb': 2.5,
    '5lb': 5.5,
  };

  return items.reduce((total, item) => {
    const quantity = Math.max(1, Math.floor(Number(item?.quantity) || 1));
    const perUnitWeight = sizeWeights[normalizeSize(item?.size)] ?? 1;
    return total + (perUnitWeight * quantity);
  }, 0);
}

async function shippoRequest(path, apiKey, options = {}) {
  const response = await fetch(`${SHIPPO_BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `ShippoToken ${apiKey}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {};
  }

  if (!response.ok) {
    const details = data?.detail || data?.error || `Shippo request failed (HTTP ${response.status})`;
    const error = new Error(String(details));
    error.status = response.status >= 400 && response.status < 500 ? 400 : 502;
    throw error;
  }

  return data;
}

export default async (req) => {
  try {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const apiKey = (Netlify.env.get('SHIPPO_API_KEY') || '').trim();
    if (!apiKey) {
      return Response.json(
        { error: 'Shippo is not configured. Set SHIPPO_API_KEY.' },
        { status: 500 }
      );
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const toAddress = body?.toAddress;
    const items = body?.items;

    if (!toAddress || typeof toAddress !== 'object') {
      return Response.json({ error: 'toAddress is required' }, { status: 400 });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return Response.json({ error: 'items are required' }, { status: 400 });
    }

    const requiredAddressFields = ['name', 'street1', 'city', 'state', 'zip', 'country', 'email'];
    for (const field of requiredAddressFields) {
      if (!String(toAddress[field] || '').trim()) {
        return Response.json({ error: `toAddress.${field} is required` }, { status: 400 });
      }
    }

    // TODO: Replace with Keystone Coffee's real warehouse/fulfillment address details.
    const fromAddress = {
      name: 'Keystone Coffee',
      street1: '123 Warehouse Ln',
      city: 'Hometown',
      state: 'TX',
      zip: '75001',
      country: 'US',
      phone: '5551234567',
      email: (Netlify.env.get('SHIPPO_FROM_EMAIL') || 'hello@keystonecoffee.com').trim(),
    };

    const parcelWeight = calculateParcelWeight(items);

    const shipment = await shippoRequest('/shipments', apiKey, {
      method: 'POST',
      body: JSON.stringify({
        address_from: fromAddress,
        address_to: toAddress,
        parcels: [
          {
            length: '10',
            width: '8',
            height: '6',
            distance_unit: 'in',
            weight: String(parcelWeight > 0 ? parcelWeight : 1),
            mass_unit: 'lb',
          },
        ],
        async: false,
      }),
    });

    const rates = Array.isArray(shipment?.rates) ? shipment.rates.slice() : [];
    if (rates.length === 0) {
      return Response.json({ error: 'No shipping rates available for this shipment' }, { status: 502 });
    }

    rates.sort((a, b) => Number(a?.amount) - Number(b?.amount));
    const cheapestRateId = rates[0]?.object_id;

    if (!cheapestRateId) {
      return Response.json({ error: 'Unable to select a shipping rate' }, { status: 502 });
    }

    const transaction = await shippoRequest('/transactions', apiKey, {
      method: 'POST',
      body: JSON.stringify({
        rate: cheapestRateId,
        label_file_type: 'PDF',
        async: false,
      }),
    });

    if (transaction?.status === 'ERROR') {
      return Response.json(
        { error: transaction?.messages?.[0]?.text || 'Shippo could not create a label' },
        { status: 502 }
      );
    }

    return Response.json({
      trackingNumber: transaction?.tracking_number ?? null,
      trackingUrl: transaction?.tracking_url_provider ?? null,
      labelUrl: transaction?.label_url ?? null,
      carrier: transaction?.rate?.provider ?? null,
      servicelevel: transaction?.rate?.servicelevel?.name ?? null,
    });
  } catch (err) {
    console.error('create-shippo-label failed:', err);
    return Response.json(
      { error: err?.message || 'Unable to create shipping label' },
      { status: Number(err?.status) || 500 }
    );
  }
};

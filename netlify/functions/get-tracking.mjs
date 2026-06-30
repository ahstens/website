const SHIPPO_BASE_URL = 'https://api.goshippo.com';

async function shippoGet(path, apiKey) {
  const response = await fetch(`${SHIPPO_BASE_URL}${path}`, {
    method: 'GET',
    headers: {
      Authorization: `ShippoToken ${apiKey}`,
      'Content-Type': 'application/json',
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
    if (req.method !== 'GET') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const apiKey = (Netlify.env.get('SHIPPO_API_KEY') || '').trim();
    if (!apiKey) {
      return Response.json(
        { error: 'Shippo is not configured. Set SHIPPO_API_KEY.' },
        { status: 500 }
      );
    }

    const params = new URL(req.url).searchParams;
    const carrier = String(params.get('carrier') || '').trim();
    const trackingNumber = String(params.get('trackingNumber') || '').trim();

    if (!carrier || !trackingNumber) {
      return Response.json(
        { error: 'carrier and trackingNumber are required query parameters' },
        { status: 400 }
      );
    }

    const data = await shippoGet(
      `/tracks/${encodeURIComponent(carrier)}/${encodeURIComponent(trackingNumber)}`,
      apiKey
    );

    const trackingHistory = Array.isArray(data?.tracking_history)
      ? data.tracking_history.map((event) => ({
          status: event?.status ?? null,
          statusDetails: event?.status_details ?? null,
          location: event?.location ?? null,
          datetime: event?.status_date ?? null,
        }))
      : [];

    return Response.json({
      status: data?.tracking_status?.status ?? null,
      statusDetails: data?.tracking_status?.status_details ?? null,
      eta: data?.eta ?? null,
      location: data?.tracking_status?.location ?? null,
      trackingHistory,
    });
  } catch (err) {
    console.error('get-tracking failed:', err);
    return Response.json(
      { error: err?.message || 'Unable to retrieve tracking information' },
      { status: Number(err?.status) || 500 }
    );
  }
};

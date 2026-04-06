/**
 * Internal client for catalog-service.
 *
 * Start small. More methods can be added as catalog GraphQL
 * fields move behind the gateway.
 */
function getCatalogServiceBaseUrl() {
  return process.env.CATALOG_SERVICE_URL || 'http://localhost:4012';
}

async function parseJson(response) {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

async function request(path, options = {}) {
  const url = `${getCatalogServiceBaseUrl()}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const data = await parseJson(response);

  if (!response.ok) {
    const message =
      data?.error ||
      data?.message ||
      `Catalog service request failed: ${response.status}`;

    throw new Error(message);
  }

  return data;
}

export async function getHealth() {
  return request('/health', { method: 'GET' });
}
/**
 * Internal client for auth-service.
 *
 * Gateway stays the public GraphQL facade.
 * Auth-service owns the real auth business logic.
 */
function getAuthServiceBaseUrl() {
  return process.env.AUTH_SERVICE_URL || 'http://localhost:4011';
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
  const url = `${getAuthServiceBaseUrl()}${path}`;
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
      `Auth service request failed: ${response.status}`;

    throw new Error(message);
  }

  return data;
}

export async function getMe(token) {
  return request('/auth/me', {
    method: 'GET',
    headers: token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : {},
  });
}

export async function login(input) {
  return request('/auth/login', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function register(input) {
  return request('/auth/register', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
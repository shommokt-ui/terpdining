// All HTTP requests go through here so web and native share authentication,
// readable errors, cancellation, and a bounded wait when the server is offline.
const API = import.meta.env?.VITE_API_URL || '';

function errorMessage(detail, fallback) {
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail.map((item) => item.msg).filter(Boolean).join('; ') || fallback;
  }
  return fallback;
}

// Render's Free API can take about a minute to wake after being idle. Leave
// enough time for that cold start to finish before telling the user it failed.
async function request(path, { method = 'GET', body, signal, timeoutMs = 120000 } = {}) {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal?.addEventListener('abort', cancel, { once: true });
  if (signal?.aborted) cancel();
  const timer = setTimeout(cancel, timeoutMs);
  const token = localStorage.getItem('token');
  try {
    const res = await fetch(`${API}${path}`, {
      method,
      headers: {
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const error = new Error(errorMessage(data.detail, res.statusText || 'Request failed. Please try again.'));
      error.status = res.status;
      throw error;
    }
    return res.status === 204 || method === 'DELETE' ? null : await res.json();
  } catch (error) {
    if (controller.signal.aborted && !signal?.aborted) {
      throw new Error('The server took too long to respond. Please try again.');
    }
    if (error instanceof TypeError) {
      throw new Error('Unable to connect. Check your connection and try again.');
    }
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', cancel);
  }
}

export function apiGet(path, options) {
  return request(path, options);
}

export function apiPost(path, body, options) {
  // Recipe generation may take longer than an ordinary database request.
  return request(path, { timeoutMs: path === '/api/recipe' ? 120000 : 60000, ...options, method: 'POST', body });
}

export function apiPut(path, body, options) {
  return request(path, { ...options, method: 'PUT', body });
}

export function apiDelete(path, options) {
  return request(path, { ...options, method: 'DELETE' });
}

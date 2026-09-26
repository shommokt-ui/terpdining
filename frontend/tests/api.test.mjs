import { afterEach, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { apiGet, apiPost, apiDelete } from '../src/api.js';

const originalFetch = globalThis.fetch;
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
beforeEach(() => {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true, value: { getItem: () => 'test-token' },
  });
});
afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage);
  else delete globalThis.localStorage;
});

test('sends JSON and the saved token', async () => {
  globalThis.fetch = async (url, options) => {
    assert.equal(url, '/api/example');
    assert.equal(options.headers.Authorization, 'Bearer test-token');
    assert.equal(options.method, 'POST');
    assert.deepEqual(JSON.parse(options.body), { count: 1 });
    return Response.json({ ok: true });
  };
  assert.deepEqual(await apiPost('/api/example', { count: 1 }), { ok: true });
});

test('validation errors are readable and retain their HTTP status', async () => {
  globalThis.fetch = async () => Response.json({ detail: [{ msg: 'Password is too short' }] }, { status: 422 });
  await assert.rejects(apiGet('/api/example'), { message: 'Password is too short', status: 422 });
});

test('non-JSON server failures retain status for authentication decisions', async () => {
  globalThis.fetch = async () => new Response('Unavailable', { status: 503, statusText: 'Service Unavailable' });
  await assert.rejects(apiGet('/api/example'), { message: 'Service Unavailable', status: 503 });
});

test('DELETE accepts an empty successful response', async () => {
  globalThis.fetch = async () => new Response(null, { status: 204 });
  assert.equal(await apiDelete('/api/example'), null);
});

function pendingFetch(_url, { signal }) {
  return new Promise((_resolve, reject) => {
    const abort = () => reject(new DOMException('Aborted', 'AbortError'));
    if (signal.aborted) abort();
    else signal.addEventListener('abort', abort, { once: true });
  });
}

test('a hung request times out instead of leaving startup blocked', async () => {
  globalThis.fetch = pendingFetch;
  await assert.rejects(apiGet('/api/example', { timeoutMs: 5 }), /too long to respond/);
});

test('navigation cancellation remains an abort, not a timeout error', async () => {
  globalThis.fetch = pendingFetch;
  const controller = new AbortController();
  const result = apiGet('/api/example', { signal: controller.signal });
  controller.abort();
  await assert.rejects(result, { name: 'AbortError' });
});

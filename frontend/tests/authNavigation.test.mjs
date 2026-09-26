import { test } from 'node:test';
import assert from 'node:assert/strict';
import { authReturnTo } from '../src/lib/authNavigation.js';

test('account forms keep the original browsing destination', () => {
  const fromSettings = authReturnTo({ pathname: '/settings' });
  assert.equal(authReturnTo({ pathname: '/login', state: { returnTo: fromSettings } }), '/settings');
  assert.equal(authReturnTo({ pathname: '/register', state: { returnTo: fromSettings } }), '/settings');
  assert.equal(authReturnTo({ pathname: '/forgot-password', state: { returnTo: fromSettings } }), '/settings');
});

test('direct account links fall back to the menu', () => {
  assert.equal(authReturnTo({ pathname: '/login' }), '/menu');
  assert.equal(authReturnTo({ pathname: '/register' }), '/menu');
});

test('return destinations cannot loop through forms or leave the app', () => {
  for (const returnTo of ['/login', '/register', '//example.com', 'https://example.com', '/unknown']) {
    assert.equal(authReturnTo({ pathname: '/login', state: { returnTo } }), '/menu');
  }
});

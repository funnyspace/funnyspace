import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const cloudSource = readFileSync(new URL('../cloud-backup.js', import.meta.url), 'utf8');
const widgetSource = readFileSync(new URL('../turnstile.js', import.meta.url), 'utf8');

function setup(siteKey, verify) {
  const requests = [];
  const context = {
    BILLNEST_AUTH_CONFIG: {
      url: 'https://project.supabase.co/',
      key: 'sb_publishable_test',
      turnstileSiteKey: siteKey
    },
    BillNestTurnstile: verify,
    URL,
    navigator: { onLine: true },
    location: { href: 'https://billing.example.com/' },
    document: { addEventListener() {}, getElementById() { return null; } },
    window: { addEventListener() {} },
    localStorage: { getItem() { return null; }, setItem() {} },
    async fetch(url, request) {
      requests.push([url, JSON.parse(request.body)]);
      return { ok: true, text: async () => '{}' };
    }
  };
  vm.runInNewContext(cloudSource, context);
  return { cloud: context.BillNestCloud, requests };
}

test('email, phone and resend requests obtain fresh Turnstile tokens', async () => {
  const host = {};
  let attempts = 0;
  const { cloud, requests } = setup('public-site-key', async (siteKey, target) => {
    assert.equal(siteKey, 'public-site-key');
    assert.equal(target, host);
    return 'token-' + ++attempts;
  });

  await cloud.sendOtp('email', 'Shop@example.com', 'signin', host);
  for (let attempt = 0; attempt < 2; attempt++) {
    await cloud.sendOtp('phone', '9876543210', 'signup', host);
  }
  assert.deepEqual(requests.map(([url, body]) => [url, body]), [
    ['https://project.supabase.co/auth/v1/otp', {
      email: 'shop@example.com', create_user: false, gotrue_meta_security: { captcha_token: 'token-1' }
    }],
    ['https://project.supabase.co/auth/v1/otp', {
      phone: '+919876543210', create_user: true, channel: 'sms', gotrue_meta_security: { captcha_token: 'token-2' }
    }],
    ['https://project.supabase.co/auth/v1/otp', {
      phone: '+919876543210', create_user: true, channel: 'sms', gotrue_meta_security: { captcha_token: 'token-3' }
    }]
  ]);
});

test('a failed or unavailable configured challenge prevents the OTP request', async () => {
  const failed = setup('public-site-key', async () => { throw new Error('Challenge failed'); });
  await assert.rejects(failed.cloud.sendOtp('email', 'shop@example.com'), /Challenge failed/);
  assert.equal(failed.requests.length, 0);

  const unavailable = setup('public-site-key');
  await assert.rejects(unavailable.cloud.sendOtp('email', 'shop@example.com'), /could not load/);
  assert.equal(unavailable.requests.length, 0);
});

test('an unconfigured deployment can still request an OTP from its configured Supabase project', async () => {
  const { cloud, requests } = setup('');
  await cloud.sendOtp('email', 'shop@example.com');
  const [, body] = requests[0];
  assert.equal(body.email, 'shop@example.com');
  assert.equal(body.gotrue_meta_security, undefined);
});

test('the widget is removed after success and after cancellation', async () => {
  let callbacks;
  const removed = [];
  const element = { remove() { removed.push('container'); } };
  const host = { isConnected: true, append() {} };
  const context = {
    setTimeout, clearTimeout,
    document: { createElement() { return element; } },
    turnstile: {
      render(_widget, options) { callbacks = options; return 'widget-id'; },
      execute(id) { assert.equal(id, 'widget-id'); },
      remove(id) { removed.push(id); }
    }
  };
  vm.runInNewContext(widgetSource, context);
  const ready = context.BillNestTurnstile('public-site-key', host);
  await Promise.resolve();
  callbacks.callback('challenge-token');
  assert.equal(await ready, 'challenge-token');
  assert.deepEqual(removed, ['widget-id', 'container']);

  const controller = new AbortController();
  const cancelled = context.BillNestTurnstile('public-site-key', host, controller.signal);
  await Promise.resolve();
  controller.abort();
  await assert.rejects(cancelled, { name: 'AbortError' });
  assert.deepEqual(removed, ['widget-id', 'container', 'widget-id', 'container']);
});

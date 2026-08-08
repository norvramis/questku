const { test } = require('node:test');
const assert = require('node:assert');
const { apiReq } = require('../src/core/api');

function makeDeps(api) {
  const calls = [];
  return {
    deps: {
      api,
      maxRetries: 3,
      logRate: (m) => calls.push('rate:' + m),
      logRetry: (m) => calls.push('retry:' + m),
      sleep: async (s) => calls.push('sleep:' + s),
    },
    calls,
  };
}

test('apiReq: GET returns body through api.get', async () => {
  const api = { get: async () => ({ status: 200, body: { ok: 1 } }) };
  const { deps } = makeDeps(api);
  const res = await apiReq(deps, 'GET', '/x');
  assert.deepEqual(res.body, { ok: 1 });
  assert.equal(res.status, 200);
});

test('apiReq: POST sends body via api.post', async () => {
  let sent = null;
  const api = { post: async ({ url, body }) => { sent = { url, body }; return { status: 200, body: {} }; } };
  const { deps } = makeDeps(api);
  await apiReq(deps, 'POST', '/x', { a: 1 });
  assert.deepEqual(sent, { url: '/x', body: { a: 1 } });
});

test('apiReq: 429 -> waits retry_after, retries, succeeds', async () => {
  let n = 0;
  const api = { get: async () => { n++; return n === 1 ? { status: 429, body: { retry_after: 1 } } : { status: 200, body: {} }; } };
  const { deps, calls } = makeDeps(api);
  const res = await apiReq(deps, 'GET', '/x');
  assert.equal(res.status, 200);
  assert.ok(calls.some((c) => c.startsWith('rate:')));
  assert.ok(calls.some((c) => c.startsWith('sleep:')));
});

test('apiReq: 4xx response is returned without retry', async () => {
  let n = 0;
  const api = { get: async () => { n++; return { status: 403, body: {} }; } };
  const { deps, calls } = makeDeps(api);
  const res = await apiReq(deps, 'GET', '/x');
  assert.equal(res.status, 403);
  assert.equal(n, 1, 'must not retry on 4xx');
  assert.equal(calls.some((c) => c.startsWith('retry:')), false);
});

test('apiReq: thrown 429 retries then succeeds', async () => {
  let n = 0;
  const api = { get: async () => { n++; if (n === 1) throw Object.assign(new Error('rl'), { status: 429, body: { retry_after: 5 } }); return { status: 200, body: {} }; } };
  const { deps } = makeDeps(api);
  const res = await apiReq(deps, 'GET', '/x');
  assert.equal(res.status, 200);
});

test('apiReq: thrown 4xx rethrows without retry', async () => {
  let n = 0;
  const api = { get: async () => { n++; throw Object.assign(new Error('bad'), { status: 400, body: {} }); } };
  const { deps, calls } = makeDeps(api);
  await assert.rejects(() => apiReq(deps, 'GET', '/x'));
  assert.equal(n, 1);
  assert.equal(calls.some((c) => c.startsWith('retry:')), false);
});

test('apiReq: network error retries up to maxRetries then throws', async () => {
  let n = 0;
  const api = { get: async () => { n++; throw new Error('net'); } };
  const { deps, calls } = makeDeps(api);
  await assert.rejects(() => apiReq(deps, 'GET', '/x'));
  assert.equal(n, 4, '1 attempt + 3 retries');
  assert.equal(calls.filter((c) => c.startsWith('retry:')).length, 3);
});

test('apiReq: network error recovers on retry', async () => {
  let n = 0;
  const api = { get: async () => { n++; if (n <= 2) throw new Error('net'); return { status: 200, body: {} }; },
    post: async () => { n++; if (n <= 2) throw new Error('net'); return { status: 200, body: {} }; } };
  const { deps } = makeDeps(api);
  const res = await apiReq(deps, 'POST', '/x');
  assert.equal(res.status, 200);
});

test('apiReq: DEL uses api.del', async () => {
  let url = null;
  const api = { del: async ({ url: u }) => { url = u; return { status: 204, body: null }; } };
  const { deps } = makeDeps(api);
  await apiReq(deps, 'DEL', '/x');
  assert.equal(url, '/x');
  const r2 = await apiReq(deps, 'DELETE', '/y');
});
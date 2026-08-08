const { test, before, after } = require('node:test');
const assert = require('node:assert');
const net = require('node:net');
const { spawn } = require('node:child_process');
const path = require('node:path');

const RELAY_HOST = '127.0.0.1';
const RELAY_PORT = 43210;
const RELAY_PS1 = path.join(__dirname, '..', 'relay', 'relay.ps1');

let relayProc = null;
let startedByTest = false;

function parseHttp(bytes) {
  const idx = bytes.indexOf('\r\n\r\n');
  const head = bytes.slice(0, idx);
  const body = bytes.slice(idx + 4);
  const first = head.split('\r\n')[0].split(' ');
  const status = parseInt(first[1], 10);
  const headers = {};
  for (const line of head.split('\r\n').slice(1)) {
    const i = line.indexOf(':');
    if (i > 0) headers[line.slice(0, i).trim().toLowerCase()] = line.slice(i + 1).trim();
  }
  return { status, headers, body };
}

function rawRequest(method, reqPath, opts = {}) {
  const { origin, body, bodyManager = 'auto', timeoutMs = 4000 } = opts;
  // bodyManager 'auto': writes body with real Content-Length.
  // bodyManager 'declare': writes header Content-Length but sends no body (for 413/rate tests:
  //                       relay closes without draining unread body -> ECONNRESET on the writer).
  return new Promise((resolve, reject) => {
    const sock = net.createConnection({ host: RELAY_HOST, port: RELAY_PORT });
    let buf = '';
    sock.setEncoding('utf8');
    const to = setTimeout(() => { sock.destroy(); reject(new Error('request timeout')); }, timeoutMs);
    sock.on('error', (e) => { clearTimeout(to); reject(e); });
    sock.on('connect', () => {
      const payload = (body != null) ? (typeof body === 'string' ? body : JSON.stringify(body)) : '';
      const head = [
        `${method} ${reqPath} HTTP/1.1`,
        `Host: ${RELAY_HOST}:${RELAY_PORT}`,
        ...(origin ? [`Origin: ${origin}`] : []),
        'Connection: close',
      ];
      if (payload || bodyManager === 'declare') {
        head.push('Content-Type: application/json');
        const declared = bodyManager === 'declare' ? 70000 : Buffer.byteLength(payload);
        head.push(`Content-Length: ${declared}`);
      }
      sock.write(head.join('\r\n') + '\r\n\r\n');
      if (bodyManager !== 'declare') sock.write(payload);
    });
    sock.on('data', (d) => { buf += d; });
    sock.on('end', () => { clearTimeout(to); resolve(parseHttp(buf)); });
    sock.on('close', () => { clearTimeout(to); });
  });
}

function healthStatus() {
  return new Promise((resolve) => {
    const sock = net.createConnection({ host: RELAY_HOST, port: RELAY_PORT });
    sock.setTimeout(1500);
    sock.on('connect', () => sock.write(`GET /health HTTP/1.1\r\nHost: ${RELAY_HOST}:${RELAY_PORT}\r\nConnection: close\r\n\r\n`));
    let buf = '';
    sock.on('data', (d) => { buf += d; });
    sock.on('end', () => { sock.destroy(); resolve(parseHttp(buf).status); });
    sock.on('timeout', () => { sock.destroy(); resolve(0); });
    sock.on('error', () => resolve(0));
  });
}

async function waitUntil(pred, ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await pred()) return true;
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

before(async () => {
  if (await healthStatus()) { startedByTest = false; return; }
  relayProc = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', RELAY_PS1], { stdio: 'ignore' });
  startedByTest = true;
  const ok = await waitUntil(healthStatus, 10000);
  assert.ok(ok, 'relay did not start within 10s');
});

after(() => {
  if (relayProc && startedByTest) {
    relayProc.kill();
    relayProc = null;
  }
});

function proxyBody(url, extra = '{}') {
  return JSON.stringify({ url, body: JSON.parse(extra), headers: {} });
}

test('GET /health returns 200, ok:true', async () => {
  const r = await rawRequest('GET', '/health');
  assert.equal(r.status, 200);
  const j = JSON.parse(r.body || '{}');
  assert.equal(j.ok, true);
});

test('unknown endpoint returns 404', async () => {
  const r = await rawRequest('GET', '/nope');
  assert.equal(r.status, 404);
});

test('SSRF guard: http scheme upstream rejected', async () => {
  const r = await rawRequest('POST', '/proxy', { body: proxyBody('http://127.0.0.1:9999/anything') });
  assert.equal(r.status, 403);
});

test('SSRF guard: non-discordsays host rejected', async () => {
  const r = await rawRequest('POST', '/proxy', { body: proxyBody('https://evil.example.com/.proxy/acf/authorize') });
  assert.equal(r.status, 403);
});

test('SSRF guard: AWS metadata host rejected', async () => {
  const r = await rawRequest('POST', '/proxy', { body: proxyBody('https://169.254.169.254/latest/meta-data/') });
  assert.equal(r.status, 403);
});

test('SSRF guard: discordsays host but banned path rejected', async () => {
  const r = await rawRequest('POST', '/proxy', { body: proxyBody('https://1234.discordsays.com/api/something') });
  assert.equal(r.status, 403);
});

test('CORS: allowed origin gets reflected ACAO', async () => {
  const r = await rawRequest('GET', '/health', { origin: 'https://discord.com' });
  assert.equal(r.headers['access-control-allow-origin'], 'https://discord.com');
});

test('CORS: canary origin allowed', async () => {
  const r = await rawRequest('GET', '/health', { origin: 'https://canary.discord.com' });
  assert.equal(r.headers['access-control-allow-origin'], 'https://canary.discord.com');
});

test('CORS: unknown origin gets NO ACAO', async () => {
  const r = await rawRequest('GET', '/health', { origin: 'https://evil.example.com' });
  assert.equal(r.status, 200);
  assert.ok(!('access-control-allow-origin' in r.headers), 'evil origin must not receive ACAO');
});

test('payload too large (>64KB) rejected with 413', async () => {
  const r = await rawRequest('POST', '/proxy', { bodyManager: 'declare' });
  assert.equal(r.status, 413);
});

test('rate limit: >100 allowed requests per origin returns 429', async () => {
  const origin = 'https://ptb.discord.com';
  const statuses = [];
  for (let i = 0; i < 105; i++) {
    const r = await rawRequest('POST', '/proxy', { origin, body: '{}', bodyManager: 'declare' });
    statuses.push(r.status);
  }
  assert.ok(statuses.includes(429), 'expected at least one 429 after 100 requests, got: ' + statuses.join(','));
});
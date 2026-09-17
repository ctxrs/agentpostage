import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const cli = fileURLToPath(new URL('../plugins/agentpostage/skills/agentpostage/scripts/agentpostage.mjs', import.meta.url));
const key = 'synthetic-test-key-not-a-credential';
const letterId = '00000000-0000-4000-8000-000000000001';

test('CLI with an isolated mock API', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'agentpostage-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const address = {
    name: 'Example Person', address_line1: '123 Example Street',
    city: 'Boston', state: 'MA', postal_code: '02110', country: 'US',
  };
  // Only transport encoding is tested. Real PDF validation belongs to the API.
  const pdf = Buffer.from('%PDF-1.7\nsynthetic transport fixture\n%%EOF\n');
  await writeFile(join(directory, 'letter.pdf'), pdf);
  await writeFile(join(directory, 'sender.json'), JSON.stringify(address));
  await writeFile(join(directory, 'recipient.json'), JSON.stringify(address));
  const requests = [];
  let respond;
  const server = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const raw = Buffer.concat(chunks).toString();
    const request = { method: req.method, path: req.url, headers: req.headers, body: raw ? JSON.parse(raw) : null };
    requests.push(request);
    respond(req, res, request);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  function run(args, env = {}) {
    return new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [cli, ...args], {
        cwd: directory,
        env: { AGENTPOSTAGE_API_KEY: key, AGENTPOSTAGE_BASE_URL: base, ...env },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let stdout = '', stderr = '';
      const timer = setTimeout(() => {
        child.kill();
        reject(new Error('CLI test timed out'));
      }, 10_000);
      child.stdout.setEncoding('utf8').on('data', value => { stdout += value; });
      child.stderr.setEncoding('utf8').on('data', value => { stderr += value; });
      child.on('error', error => { clearTimeout(timer); reject(error); });
      child.on('close', code => { clearTimeout(timer); resolve({ code, stdout, stderr }); });
    });
  }
  const send = ['send', '--pdf', 'letter.pdf', '--sender', 'sender.json', '--recipient', 'recipient.json'];
  const json = (res, value, status = 200) => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(value));
  };

  await t.test('help does not need credentials or contact the API', async () => {
    const before = requests.length;
    const result = await run(['--help'], { AGENTPOSTAGE_API_KEY: '' });
    assert.equal(result.code, 0);
    assert.match(result.stdout, /Usage:/);
    assert.equal(requests.length, before);
  });

  await t.test('price submits page count and print options without a PDF or send key', async () => {
    respond = (_req, res) => json(res, { total_cents: 550, currency: 'USD' });
    const result = await run(['price', '--pages', '3', '--service', 'first_class', '--color', 'color', '--duplex', 'true']);
    assert.equal(result.code, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), { total_cents: 550, currency: 'USD' });
    const request = requests.at(-1);
    assert.equal(request.method, 'POST');
    assert.equal(request.path, '/v1/price');
    assert.equal(request.headers.authorization, `Bearer ${key}`);
    assert.equal(request.headers['idempotency-key'], undefined);
    assert.deepEqual(request.body, { page_count: 3, service: 'first_class', color: 'color', duplex: true });
  });

  await t.test('a lost send response can be retried with identical bytes and the same key', async () => {
    const args = [...send, '--service', 'certified_return_receipt', '--duplex', 'true', '--paper', 'ivory', '--return-envelope', 'small', '--idempotency-key', 'synthetic-letter-001'];
    respond = req => req.socket.destroy();
    const failed = await run(args);
    assert.equal(failed.code, 1);
    assert.match(failed.stderr, /synthetic-letter-001/);
    const original = requests.at(-1);
    respond = (_req, res) => json(res, { id: letterId, status: 'queued', cost: { total_cents: 1560, currency: 'USD' } }, 202);
    const retried = await run(args);
    assert.equal(retried.code, 0, retried.stderr);
    assert.equal(JSON.parse(retried.stdout).status, 'queued');
    const request = requests.at(-1);
    assert.equal(request.path, '/v1/letters');
    assert.equal(request.method, 'POST');
    assert.equal(request.headers['idempotency-key'], 'synthetic-letter-001');
    assert.deepEqual(request.body, original.body);
    assert.deepEqual(request.body, {
      pdf_base64: pdf.toString('base64'), sender: address, recipient: address,
      service: 'certified_return_receipt', duplex: true, paper: 'ivory', return_envelope: 'small',
    });
    assert.ok(!retried.stderr.includes(key));
  });

  await t.test('a generated send key remains available after a failed request', async () => {
    respond = req => req.socket.destroy();
    const result = await run(send);
    assert.equal(result.code, 1);
    const idempotencyKey = requests.at(-1).headers['idempotency-key'];
    assert.match(idempotencyKey, /^[0-9a-f-]{36}$/);
    assert.ok(result.stderr.startsWith(`Idempotency-Key: ${idempotencyKey}\n`));
  });

  await t.test('read, pagination and cancellation commands use the intended endpoints', async () => {
    respond = (_req, res) => json(res, { ok: true });
    for (const [args, method, path] of [
      [['balance'], 'GET', '/v1/balance'],
      [['get', letterId], 'GET', `/v1/letters/${letterId}`],
      [['list', '--limit', '2', '--cursor', 'a+b/c='], 'GET', '/v1/letters?limit=2&cursor=a%2Bb%2Fc%3D'],
      [['transactions', '--limit', '1'], 'GET', '/v1/transactions?limit=1'],
      [['billing'], 'GET', '/v1/billing/link'],
      [['cancel', letterId], 'POST', `/v1/letters/${letterId}/cancel`],
    ]) {
      const result = await run(args);
      assert.equal(result.code, 0, result.stderr);
      assert.equal(requests.at(-1).method, method);
      assert.equal(requests.at(-1).path, path);
      assert.equal(requests.at(-1).body, null);
    }
  });

  await t.test('bad options, missing secrets and invalid files fail before network access', async () => {
    const before = requests.length;
    await writeFile(join(directory, 'bad-address.json'), 'not-json');
    for (const [args, env] of [
      [['balance'], { AGENTPOSTAGE_API_KEY: '' }],
      [['balance'], { AGENTPOSTAGE_BASE_URL: 'http://example.invalid' }],
      [['balance', '--pages', '2'], {}],
      [['price', '--pages', '0'], {}],
      [['price', '--pages', '501'], {}],
      [['price', '--pages', '2', '--duplex', 'yes'], {}],
      [['price', '--pages', '2', '--service', 'international'], {}],
      [['get', '../balance'], {}],
      [[...send, '--idempotency-key', 'short'], {}],
      [['send', '--pdf', 'missing.pdf', '--sender', 'sender.json', '--recipient', 'recipient.json'], {}],
      [['send', '--pdf', 'letter.pdf', '--sender', 'bad-address.json', '--recipient', 'recipient.json'], {}],
    ]) {
      const result = await run(args, env);
      assert.equal(result.code, 1, args.join(' '));
      assert.equal(result.stdout, '');
      assert.ok(!result.stderr.includes(key));
    }
    assert.equal(requests.length, before);
  });

  await t.test('API errors preserve useful guidance and redact echoed credentials', async () => {
    respond = (_req, res) => json(res, { error: { code: 'permission_error', message: `Rejected ${key}`, next_action: 'Check the configured key.' } }, 403);
    const result = await run(['balance']);
    assert.equal(result.code, 1);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /HTTP 403 permission_error/);
    assert.match(result.stderr, /Check the configured key/);
    assert.match(result.stderr, /\[redacted\]/);
    assert.ok(!result.stderr.includes(key));
  });

  await t.test('redirects do not forward the key or silently repeat a send', async () => {
    const before = requests.length;
    respond = (_req, res) => {
      res.writeHead(307, { Location: `${base}/redirect-target` });
      res.end();
    };
    const result = await run([...send, '--idempotency-key', 'synthetic-redirect-001']);
    assert.equal(result.code, 1);
    assert.equal(requests.length, before + 1);
    assert.equal(requests.at(-1).path, '/v1/letters');
  });

  await t.test('malformed and oversized API responses fail clearly', async () => {
    respond = (_req, res) => res.end('<html>not JSON</html>');
    const malformed = await run(['balance']);
    assert.equal(malformed.code, 1);
    assert.match(malformed.stderr, /invalid JSON/);
    respond = (_req, res) => res.end('x'.repeat(1024 * 1024 + 1));
    const oversized = await run(['balance']);
    assert.equal(oversized.code, 1);
    assert.match(oversized.stderr, /exceeds 1 MiB/);
  });
});

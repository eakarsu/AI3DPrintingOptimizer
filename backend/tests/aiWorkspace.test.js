'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { createAIWorkspaceRouter, validateFields, FIELD_KEYS } = require('../aiWorkspace.cjs');

const feature = { id: 'fixture-feature', title: 'Fixture planning report', description: 'Controlled test only' };
const fields = Object.fromEntries(FIELD_KEYS.map((key) => [key, `${key} fixture`]));

class DisposablePool {
  constructor() { this.rows = []; this.queries = []; }
  async connect() { return { query: this.query.bind(this), release() {} }; }
  async query(sql, values = []) {
    this.queries.push({ sql, values });
    if (['BEGIN','COMMIT','ROLLBACK'].includes(sql)) return { rows: [] };
    if (sql.startsWith('CREATE TABLE')) return { rows: [] };
    if (sql.startsWith('SELECT *')) return { rows: this.rows.filter((row) => row.user_id === values[0] && row.feature === values[1]) };
    if (sql.startsWith('SELECT id')) return { rows: this.rows.filter((row) => String(row.id) === String(values[0]) && row.user_id === values[1] && row.feature === values[2]).map(({ id }) => ({ id })) };
    if (sql.startsWith('INSERT INTO')) {
      const row = { id: this.rows.length + 1, user_id: values[0], feature: values[1], input: values[2], result: values[3], result_json: values[4], model: values[5], usage: values[6], created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      this.rows.push(row); return { rows: [row] };
    }
    if (sql.startsWith('UPDATE')) {
      const row = this.rows.find((item) => String(item.id) === String(values[7]) && item.user_id === values[0] && item.feature === values[1]);
      if (!row) return { rows: [] };
      Object.assign(row, { input: values[2], result: values[3], result_json: values[4], model: values[5], usage: values[6], updated_at: new Date().toISOString() }); return { rows: [row] };
    }
    if (sql.startsWith('DELETE')) {
      const index = this.rows.findIndex((row) => String(row.id) === String(values[0]) && row.user_id === values[1]);
      if (index < 0) return { rows: [] };
      return { rows: [{ id: this.rows.splice(index, 1)[0].id }] };
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  }
}

async function fixtureServer(fetchImpl) {
  const pool = new DisposablePool();
  const app = express(); app.use(express.json());
  app.use('/api/report-workspace', createAIWorkspaceRouter({
    pool,
    authenticateToken: (req, _res, next) => { req.user = { id: 7, tenantId: 'alpha' }; next(); },
    aiRateLimiter: (_req, _res, next) => next(),
    features: [feature], fetchImpl,
    env: { OPENROUTER_API_KEY: 'controlled-fixture-key', OPENROUTER_MODEL: 'fixture/model', OPENROUTER_BASE_URL: 'https://fixture.invalid/v1' },
  }));
  const server = await new Promise((resolve) => { const value = app.listen(0, '127.0.0.1', () => resolve(value)); });
  return { pool, server, base: `http://127.0.0.1:${server.address().port}/api/report-workspace` };
}

function providerResponse() {
  return { ok: true, status: 200, async json() { return { model: 'fixture/model', usage: { total_tokens: 21 }, choices: [{ message: { content: '# Fixture report\n\nNo external action occurred.' } }] }; } };
}

test('validates complete workspace fields and rejects missing required data', () => {
  assert.deepEqual(validateFields(fields), fields);
  assert.throws(() => validateFields({ ...fields, input: '' }), /request and desired outcome/i);
});

test('controlled provider action persists actor-scoped SQL and supports delete', async (t) => {
  const fixture = await fixtureServer(async (url, options) => {
    assert.equal(url, 'https://fixture.invalid/v1/chat/completions');
    assert.equal(options.signal.aborted, false);
    return providerResponse();
  });
  t.after(() => fixture.server.close());
  const run = await fetch(`${fixture.base}/run`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ feature: feature.id, fields }) });
  assert.equal(run.status, 200);
  const saved = (await run.json()).item;
  assert.equal(saved.user_id, 'tenant:alpha:user:7');
  assert.equal(fixture.pool.rows.length, 1);
  assert.match(fixture.pool.queries.find((item) => item.sql.startsWith('INSERT INTO')).sql, /user_id, feature, input, result/);
  const history = await (await fetch(`${fixture.base}/runs?feature=${feature.id}`)).json();
  assert.equal(history.items.length, 1);
  const deleted = await fetch(`${fixture.base}/runs/${saved.id}`, { method: 'DELETE' });
  assert.equal(deleted.status, 200);
  assert.equal(fixture.pool.rows.length, 0);
});

test('client cancellation aborts the controlled provider and performs no INSERT', async (t) => {
  let providerAborted = false;
  const fixture = await fixtureServer((_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => { providerAborted = true; const error = new Error('fixture aborted'); error.name = 'AbortError'; reject(error); }, { once: true });
  }));
  t.after(() => fixture.server.close());
  const controller = new AbortController();
  const pending = fetch(`${fixture.base}/run`, { method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ feature: feature.id, fields }) });
  setTimeout(() => controller.abort(), 20);
  await assert.rejects(pending, /abort/i);
  await new Promise((resolve) => setTimeout(resolve, 40));
  assert.equal(providerAborted, true);
  assert.equal(fixture.pool.rows.length, 0);
  assert.equal(fixture.pool.queries.some((item) => item.sql.startsWith('INSERT INTO')), false);
});

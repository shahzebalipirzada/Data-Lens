import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app, setup, reset, teardown, housingCsv, register } from './helpers.js';

before(setup);
beforeEach(reset);
after(teardown);

const auth = (token) => ({ Authorization: `Bearer ${token}` });

async function uploadHousing(token, name = 'housing') {
  return request(app)
    .post('/api/datasets')
    .set(auth(token))
    .field('name', name)
    .attach('file', Buffer.from(housingCsv()), 'housing.csv');
}

test('health check responds', async () => {
  const res = await request(app).get('/api/health');
  assert.equal(res.status, 200);
  assert.equal(res.body.status, 'ok');
});

test('security headers are present', async () => {
  const res = await request(app).get('/api/health');
  assert.ok(res.headers['x-content-type-options']);
  assert.equal(res.headers['x-powered-by'], undefined);
});

// ---------- auth ----------

test('register returns a user and access token, and sets an httpOnly refresh cookie', async () => {
  const { res } = await register(app);
  assert.equal(res.status, 201);
  assert.ok(res.body.accessToken);
  assert.equal(res.body.user.role, 'user');
  assert.equal(res.body.user.passwordHash, undefined);
  assert.equal(res.body.user.refreshTokens, undefined);
  const cookie = res.headers['set-cookie'][0];
  assert.match(cookie, /dl_refresh=/);
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /Path=\/api\/auth/);
});

test('passwords are stored hashed with bcrypt', async () => {
  const { body } = await register(app);
  const { User } = await import('../src/models/User.js');
  const u = await User.findOne({ email: body.email }).select('+passwordHash');
  assert.match(u.passwordHash, /^\$2[aby]\$/);
  assert.notEqual(u.passwordHash, body.password);
});

test('register validates input and rejects duplicates', async () => {
  const weak = await request(app).post('/api/auth/register').send({ name: 'A', email: 'nope', password: 'short' });
  assert.equal(weak.status, 400);
  assert.ok(weak.body.details.length >= 2);
  const first = await register(app, { email: 'dup@example.com' });
  assert.equal(first.res.status, 201);
  const dup = await register(app, { email: 'DUP@example.com' });
  assert.equal(dup.res.status, 409);
});

test('login succeeds with the right password and fails generically otherwise', async () => {
  const { body } = await register(app);
  const ok = await request(app).post('/api/auth/login').send({ email: body.email, password: body.password });
  assert.equal(ok.status, 200);
  const bad = await request(app).post('/api/auth/login').send({ email: body.email, password: 'wrongpass1' });
  const unknown = await request(app).post('/api/auth/login').send({ email: 'ghost@example.com', password: 'wrongpass1' });
  assert.equal(bad.status, 401);
  assert.equal(unknown.status, 401);
  assert.equal(bad.body.error, unknown.body.error);
});

test('NoSQL operator injection in login is rejected by validation', async () => {
  const res = await request(app).post('/api/auth/login').send({ email: { $gt: '' }, password: { $gt: '' } });
  assert.equal(res.status, 400);
});

test('protected routes require a valid bearer token', async () => {
  assert.equal((await request(app).get('/api/datasets')).status, 401);
  assert.equal((await request(app).get('/api/datasets').set(auth('garbage'))).status, 401);
  const { token } = await register(app);
  assert.equal((await request(app).get('/api/datasets').set(auth(token))).status, 200);
  const me = await request(app).get('/api/auth/me').set(auth(token));
  assert.equal(me.status, 200);
});

test('refresh rotates the refresh token and issues a new access token', async () => {
  const { cookie } = await register(app);
  const r1 = await request(app).post('/api/auth/refresh').set('Cookie', cookie);
  assert.equal(r1.status, 200);
  assert.ok(r1.body.accessToken);
  const newCookie = r1.headers['set-cookie'][0].split(';')[0];
  assert.notEqual(newCookie, cookie);
  const r2 = await request(app).post('/api/auth/refresh').set('Cookie', newCookie);
  assert.equal(r2.status, 200);
});

test('reusing an old refresh token is treated as theft and ends all sessions', async () => {
  const { cookie } = await register(app);
  const r1 = await request(app).post('/api/auth/refresh').set('Cookie', cookie);
  const latest = r1.headers['set-cookie'][0].split(';')[0];
  const replay = await request(app).post('/api/auth/refresh').set('Cookie', cookie);
  assert.equal(replay.status, 401);
  const afterTheft = await request(app).post('/api/auth/refresh').set('Cookie', latest);
  assert.equal(afterTheft.status, 401);
});

test('refresh without a cookie is rejected, logout revokes the session', async () => {
  assert.equal((await request(app).post('/api/auth/refresh')).status, 401);
  const { cookie } = await register(app);
  const out = await request(app).post('/api/auth/logout').set('Cookie', cookie);
  assert.equal(out.status, 204);
  assert.equal((await request(app).post('/api/auth/refresh').set('Cookie', cookie)).status, 401);
});

// ---------- datasets ----------

test('upload profiles a CSV and returns column statistics', async () => {
  const { token } = await register(app);
  const res = await uploadHousing(token);
  assert.equal(res.status, 201);
  const d = res.body.dataset;
  assert.equal(d.name, 'housing');
  assert.equal(d.rowCount, 200);
  assert.equal(d.columnCount, 7);
  assert.equal(d.rows, undefined, 'raw rows must not be returned');
  const byName = Object.fromEntries(d.columns.map((c) => [c.name, c]));
  assert.equal(byName.sqft.type, 'number');
  assert.equal(byName.sqft.missing, 8);
  assert.equal(byName.city.type, 'string');
  assert.equal(byName.city.unique, 3);
  assert.equal(byName.sold.type, 'boolean');
  assert.equal(byName.listed.type, 'date');
  assert.ok(d.correlations.columns.includes('price'));
  assert.equal(d.preview.length, 10);
  assert.equal(d.summary.totalMissing, 8);
});

test('upload rejects non-CSV files, missing files and oversized files', async () => {
  const { token } = await register(app);
  const wrongType = await request(app).post('/api/datasets').set(auth(token)).attach('file', Buffer.from('x'), 'notes.txt');
  assert.equal(wrongType.status, 400);
  const none = await request(app).post('/api/datasets').set(auth(token));
  assert.equal(none.status, 400);
  const big = await request(app).post('/api/datasets').set(auth(token)).attach('file', Buffer.alloc(6 * 1024 * 1024, 'a'), 'big.csv');
  assert.equal(big.status, 413);
});

test('users only see and modify their own datasets', async () => {
  const a = await register(app);
  const b = await register(app);
  const up = await uploadHousing(a.token);
  const id = up.body.dataset.id;
  assert.equal((await request(app).get(`/api/datasets/${id}`).set(auth(b.token))).status, 404);
  assert.equal((await request(app).delete(`/api/datasets/${id}`).set(auth(b.token))).status, 404);
  assert.equal((await request(app).patch(`/api/datasets/${id}`).set(auth(b.token)).send({ name: 'x' })).status, 404);
  const list = await request(app).get('/api/datasets').set(auth(b.token));
  assert.equal(list.body.datasets.length, 0);
  assert.equal((await request(app).get(`/api/datasets/${id}`).set(auth(a.token))).status, 200);
});

test('invalid ids are rejected with 400', async () => {
  const { token } = await register(app);
  assert.equal((await request(app).get('/api/datasets/not-an-id').set(auth(token))).status, 400);
});

// ---------- models ----------

async function trainHousing(token, datasetId, extra = {}) {
  return request(app)
    .post('/api/models')
    .set(auth(token))
    .send({ datasetId, target: 'price', features: ['sqft', 'bedrooms', 'age'], ...extra });
}

test('training fits the data, reports metrics and drops incomplete rows', async () => {
  const { token } = await register(app);
  const { body } = await uploadHousing(token);
  const res = await trainHousing(token, body.dataset.id);
  assert.equal(res.status, 201);
  const m = res.body.model;
  assert.equal(m.rowsDropped, 8);
  assert.equal(m.rowsUsed, 192);
  assert.ok(m.metrics.test.r2 > 0.99, `r2=${m.metrics.test.r2}`);
  assert.ok(m.metrics.test.rmse < 1000);
  const w = Object.fromEntries(m.coefficients.map((c) => [c.feature, c.weight]));
  assert.ok(Math.abs(w.sqft - 150) < 1, `sqft weight ${w.sqft}`);
  assert.ok(Math.abs(w.bedrooms - 10000) < 300, `bedrooms weight ${w.bedrooms}`);
  assert.ok(m.lossHistory.length > 2);
  assert.ok(m.samples.length > 0);
});

test('training validates target, features and column types', async () => {
  const { token } = await register(app);
  const { body } = await uploadHousing(token);
  const id = body.dataset.id;
  assert.equal((await trainHousing(token, id, { features: ['city'] })).status, 400);
  assert.equal((await trainHousing(token, id, { target: 'nope' })).status, 400);
  assert.equal((await trainHousing(token, id, { features: ['price'] })).status, 400);
  assert.equal((await trainHousing(token, id, { features: [] })).status, 400);
  assert.equal((await trainHousing(token, id, { learningRate: 0 })).status, 400);
  assert.equal((await trainHousing(token, id, { learningRate: 500 })).status, 400);
});

test('predict returns a sensible value and validates inputs', async () => {
  const { token } = await register(app);
  const { body } = await uploadHousing(token);
  const { body: t } = await trainHousing(token, body.dataset.id);
  const ok = await request(app)
    .post(`/api/models/${t.model.id}/predict`)
    .set(auth(token))
    .send({ inputs: { sqft: 1000, bedrooms: 3, age: 10 } });
  assert.equal(ok.status, 200);
  const expected = 150 * 1000 + 10000 * 3 - 500 * 10 + 20000;
  assert.ok(Math.abs(ok.body.prediction - expected) < 3000, `${ok.body.prediction} vs ${expected}`);
  const missing = await request(app).post(`/api/models/${t.model.id}/predict`).set(auth(token)).send({ inputs: { sqft: 1 } });
  assert.equal(missing.status, 400);
  const nan = await request(app).post(`/api/models/${t.model.id}/predict`).set(auth(token)).send({ inputs: { sqft: 'a', bedrooms: 1, age: 1 } });
  assert.equal(nan.status, 400);
});

test("a user cannot train on or read another user's data", async () => {
  const a = await register(app);
  const b = await register(app);
  const { body } = await uploadHousing(a.token);
  assert.equal((await trainHousing(b.token, body.dataset.id)).status, 404);
  const { body: t } = await trainHousing(a.token, body.dataset.id);
  assert.equal((await request(app).get(`/api/models/${t.model.id}`).set(auth(b.token))).status, 404);
  assert.equal((await request(app).post(`/api/models/${t.model.id}/predict`).set(auth(b.token)).send({ inputs: {} })).status, 404);
});

// ---------- reports ----------

test('reports snapshot a model, survive dataset deletion, and are private', async () => {
  const a = await register(app);
  const b = await register(app);
  const { body } = await uploadHousing(a.token);
  const { body: t } = await trainHousing(a.token, body.dataset.id);

  const created = await request(app).post('/api/reports').set(auth(a.token)).send({ modelId: t.model.id, title: 'Housing v1', notes: 'baseline' });
  assert.equal(created.status, 201);
  const rid = created.body.report.id;
  assert.equal(created.body.report.snapshot.model.target, 'price');
  assert.ok(created.body.report.snapshot.model.metrics.test.r2 > 0.99);

  assert.equal((await request(app).get(`/api/reports/${rid}`).set(auth(b.token))).status, 404);
  assert.equal((await request(app).post('/api/reports').set(auth(b.token)).send({ modelId: t.model.id, title: 'x' })).status, 404);

  assert.equal((await request(app).delete(`/api/datasets/${body.dataset.id}`).set(auth(a.token))).status, 204);
  assert.equal((await request(app).get(`/api/models/${t.model.id}`).set(auth(a.token))).status, 404);
  const still = await request(app).get(`/api/reports/${rid}`).set(auth(a.token));
  assert.equal(still.status, 200);
  assert.equal(still.body.report.snapshot.dataset.name, 'housing');

  const list = await request(app).get('/api/reports').set(auth(a.token));
  assert.equal(list.body.reports.length, 1);
  assert.equal((await request(app).delete(`/api/reports/${rid}`).set(auth(a.token))).status, 204);
});

// ---------- admin / RBAC ----------

test('admin routes are forbidden for normal users and open to admins', async () => {
  const user = await register(app);
  assert.equal((await request(app).get('/api/admin/stats').set(auth(user.token))).status, 403);
  assert.equal((await request(app).get('/api/admin/users').set(auth(user.token))).status, 403);
  assert.equal((await request(app).get('/api/admin/stats')).status, 401);

  const admin = await register(app, { email: 'admin@example.com' });
  assert.equal(admin.res.body.user.role, 'admin');
  const stats = await request(app).get('/api/admin/stats').set(auth(admin.token));
  assert.equal(stats.status, 200);
  assert.equal(stats.body.users, 2);
  const users = await request(app).get('/api/admin/users').set(auth(admin.token));
  assert.equal(users.body.users.length, 2);
});

test('admin can promote users and delete accounts with their data, but not themselves', async () => {
  const user = await register(app);
  const admin = await register(app, { email: 'admin@example.com' });
  await uploadHousing(user.token);

  const promote = await request(app).patch(`/api/admin/users/${user.res.body.user.id}/role`).set(auth(admin.token)).send({ role: 'admin' });
  assert.equal(promote.status, 200);
  assert.equal(promote.body.user.role, 'admin');
  await request(app).patch(`/api/admin/users/${user.res.body.user.id}/role`).set(auth(admin.token)).send({ role: 'user' });

  const self = await request(app).delete(`/api/admin/users/${admin.res.body.user.id}`).set(auth(admin.token));
  assert.equal(self.status, 400);

  const del = await request(app).delete(`/api/admin/users/${user.res.body.user.id}`).set(auth(admin.token));
  assert.equal(del.status, 204);
  const { Dataset } = await import('../src/models/Dataset.js');
  assert.equal(await Dataset.countDocuments(), 0);
  // the deleted user's still-valid access token no longer works
  assert.equal((await request(app).get('/api/datasets').set(auth(user.token))).status, 401);
});

test('unknown routes return a JSON 404 and malformed JSON returns 400', async () => {
  const nf = await request(app).get('/api/nope');
  assert.equal(nf.status, 404);
  assert.ok(nf.body.error);
  const bad = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{bad');
  assert.equal(bad.status, 400);
});

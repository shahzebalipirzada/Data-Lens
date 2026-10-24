// Shared test setup. Tests need a running MongoDB. The URI comes from TEST_MONGODB_URI
// (default mongodb://127.0.0.1:27017/datalens_test) and never from your .env, so tests
// cannot touch real data. The database is wiped between tests, so its name must end in "_test".
process.env.NODE_ENV = 'test';
process.env.ADMIN_EMAILS = 'admin@example.com';
process.env.MONGODB_URI = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/datalens_test';

const { connectDb, disconnectDb } = await import('../src/db.js');
const { config } = await import('../src/config.js');
const { createApp } = await import('../src/app.js');
const { default: mongoose } = await import('mongoose');
const { mulberry32 } = await import('../src/services/regression.js');

export const app = createApp();

export async function setup() {
  if (!/_test(\?|$)/.test(config.mongoUri)) {
    throw new Error(`Refusing to run tests against "${config.mongoUri}": the database name must end in _test`);
  }
  await connectDb();
  await mongoose.connection.dropDatabase();
}

export async function reset() {
  const collections = await mongoose.connection.db.collections();
  await Promise.all(collections.map((c) => c.deleteMany({})));
}

export async function teardown() {
  await mongoose.connection.dropDatabase();
  await disconnectDb();
}

export function housingCsv(n = 200) {
  const rand = mulberry32(21);
  const cities = ['Karachi', 'Lahore', 'Sukkur'];
  const lines = ['sqft,bedrooms,age,price,city,sold,listed'];
  for (let i = 0; i < n; i++) {
    const sqft = Math.round(500 + rand() * 2500);
    const bedrooms = 1 + Math.floor(rand() * 5);
    const age = Math.floor(rand() * 40);
    const price = Math.round(150 * sqft + 10000 * bedrooms - 500 * age + 20000 + (rand() - 0.5) * 2000);
    const sqftCell = i % 25 === 0 ? '' : sqft; // a few missing values
    const day = String(1 + (i % 28)).padStart(2, '0');
    lines.push(`${sqftCell},${bedrooms},${age},${price},${cities[i % 3]},${i % 2 ? 'true' : 'false'},2024-03-${day}`);
  }
  return lines.join('\n');
}

export async function register(agentOrApp, overrides = {}) {
  const { default: request } = await import('supertest');
  const body = { name: 'Test User', email: `u${Math.random().toString(36).slice(2, 8)}@example.com`, password: 'Passw0rdOK', ...overrides };
  const res = await request(agentOrApp).post('/api/auth/register').send(body);
  return { res, body, token: res.body.accessToken, cookie: res.headers['set-cookie']?.[0]?.split(';')[0] };
}

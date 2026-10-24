import 'dotenv/config';

const env = process.env.NODE_ENV || 'development';
const isProd = env === 'production';
const isTest = env === 'test';

function secret(name) {
  const value = process.env[name];
  if (value) return value;
  if (isProd) throw new Error(`Missing required environment variable ${name}`);
  return `dev-only-${name.toLowerCase()}-change-me`;
}

export const config = {
  env,
  isProd,
  isTest,
  port: Number(process.env.PORT) || 5000,
  mongoUri:
    process.env.MONGODB_URI ||
    (isTest ? 'mongodb://127.0.0.1:27017/datalens_test' : 'mongodb://127.0.0.1:27017/datalens'),
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  trustProxy: process.env.TRUST_PROXY === 'true',
  jwt: {
    accessSecret: secret('JWT_ACCESS_SECRET'),
    refreshSecret: secret('JWT_REFRESH_SECRET'),
    accessTtl: process.env.JWT_ACCESS_TTL || '15m',
    refreshTtlDays: Number(process.env.JWT_REFRESH_TTL_DAYS) || 7,
  },
  cookie: {
    name: 'dl_refresh',
    sameSite: process.env.COOKIE_SAMESITE || 'lax', // use "none" when the client and API are on different sites
    secure: process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === 'true' : isProd,
  },
  bcryptRounds: isTest ? 4 : 12,
  adminEmails: (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
  rateLimit: {
    apiMax: isTest ? 100000 : 300,
    authMax: isTest ? 100000 : 30,
    windowMs: 15 * 60 * 1000,
  },
  upload: {
    maxBytes: 5 * 1024 * 1024,
    maxRows: 20000,
    maxColumns: 100,
  },
  training: { maxFeatures: 20, minRows: 10 },
};

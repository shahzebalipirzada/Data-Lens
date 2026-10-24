import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';

export const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

export function signAccessToken(user) {
  return jwt.sign({ role: user.role }, config.jwt.accessSecret, {
    subject: String(user._id),
    expiresIn: config.jwt.accessTtl,
  });
}

export function signRefreshToken(user) {
  // jti makes every refresh token unique, even when issued within the same second
  return jwt.sign({}, config.jwt.refreshSecret, {
    subject: String(user._id),
    expiresIn: `${config.jwt.refreshTtlDays}d`,
    jwtid: crypto.randomUUID(),
  });
}

export const verifyAccessToken = (token) => jwt.verify(token, config.jwt.accessSecret);
export const verifyRefreshToken = (token) => jwt.verify(token, config.jwt.refreshSecret);

export function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure: config.cookie.secure,
    sameSite: config.cookie.sameSite,
    path: '/api/auth',
    maxAge: config.jwt.refreshTtlDays * 24 * 60 * 60 * 1000,
  };
}

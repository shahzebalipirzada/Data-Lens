import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { config } from '../config.js';
import { User } from '../models/User.js';
import { RefreshToken } from '../models/RefreshToken.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import {
  sha256,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  refreshCookieOptions,
} from '../utils/tokens.js';

const router = Router();
const MAX_SESSIONS = 5;

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80),
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(72, 'Password must be at most 72 characters')
    .regex(/[A-Za-z]/, 'Password needs at least one letter')
    .regex(/\d/, 'Password needs at least one number'),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(72),
});

// A real hash to compare against when the email is unknown, so timing does not reveal which emails exist
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', config.bcryptRounds);

async function startSession(res, user) {
  const refreshToken = signRefreshToken(user);
  const expiresAt = new Date(Date.now() + config.jwt.refreshTtlDays * 24 * 60 * 60 * 1000);
  await RefreshToken.create({ user: user._id, tokenHash: sha256(refreshToken), expiresAt });

  // Keep only the newest few sessions per user
  const sessions = await RefreshToken.find({ user: user._id }).sort({ createdAt: -1 }).skip(MAX_SESSIONS).select('_id');
  if (sessions.length) await RefreshToken.deleteMany({ _id: { $in: sessions.map((t) => t._id) } });

  res.cookie(config.cookie.name, refreshToken, refreshCookieOptions());
  return signAccessToken(user);
}

router.post(
  '/register',
  validate(registerSchema),
  asyncHandler(async (req, res) => {
    const { name, email, password } = req.body;
    if (await User.exists({ email })) throw ApiError.conflict('An account with this email already exists');
    const passwordHash = await bcrypt.hash(password, config.bcryptRounds);
    const role = config.adminEmails.includes(email) ? 'admin' : 'user';
    const user = await User.create({ name, email, passwordHash, role });
    const accessToken = await startSession(res, user);
    res.status(201).json({ user, accessToken });
  })
);

router.post(
  '/login',
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email }).select('+passwordHash');
    const ok = await bcrypt.compare(password, user ? user.passwordHash : DUMMY_HASH);
    if (!user || !ok) throw ApiError.unauthorized('Invalid email or password');
    const accessToken = await startSession(res, user);
    res.json({ user, accessToken });
  })
);

router.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const token = req.cookies?.[config.cookie.name];
    if (!token) throw ApiError.unauthorized('No session');

    let payload;
    try {
      payload = verifyRefreshToken(token);
    } catch {
      res.clearCookie(config.cookie.name, { ...refreshCookieOptions(), maxAge: undefined });
      throw ApiError.unauthorized('Session expired');
    }

    // Atomically consume the token: only one request can ever win this delete
    const consumed = await RefreshToken.findOneAndDelete({ tokenHash: sha256(token) });
    if (!consumed) {
      // A validly signed token that is not on record was already used: treat it as theft and end every session
      await RefreshToken.deleteMany({ user: payload.sub });
      res.clearCookie(config.cookie.name, { ...refreshCookieOptions(), maxAge: undefined });
      throw ApiError.unauthorized('Session no longer valid');
    }

    const user = await User.findById(consumed.user);
    if (!user) throw ApiError.unauthorized('Account no longer exists');
    const accessToken = await startSession(res, user);
    res.json({ user, accessToken });
  })
);

router.post(
  '/logout',
  asyncHandler(async (req, res) => {
    const token = req.cookies?.[config.cookie.name];
    if (token) await RefreshToken.deleteOne({ tokenHash: sha256(token) });
    res.clearCookie(config.cookie.name, { ...refreshCookieOptions(), maxAge: undefined });
    res.status(204).end();
  })
);

router.get('/me', requireAuth, (req, res) => res.json({ user: req.user }));

export default router;

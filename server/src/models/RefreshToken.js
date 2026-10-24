import mongoose from 'mongoose';

// One document per active session. Rotation deletes the old document atomically,
// which makes every refresh token single-use. MongoDB removes expired ones itself (TTL index).
const refreshTokenSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  tokenHash: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true, expires: 0 },
  createdAt: { type: Date, default: Date.now },
});

export const RefreshToken = mongoose.model('RefreshToken', refreshTokenSchema);

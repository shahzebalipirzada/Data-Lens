import { Router } from 'express';
import { z } from 'zod';
import { User } from '../models/User.js';
import { Dataset } from '../models/Dataset.js';
import { MlModel } from '../models/MlModel.js';
import { Report } from '../models/Report.js';
import { RefreshToken } from '../models/RefreshToken.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate, validObjectId } from '../middleware/validate.js';

const router = Router();
router.use(requireAuth, requireRole('admin'));

const roleSchema = z.object({ role: z.enum(['user', 'admin']) });

router.get(
  '/stats',
  asyncHandler(async (_req, res) => {
    const [users, datasets, models, reports] = await Promise.all([
      User.countDocuments(),
      Dataset.countDocuments(),
      MlModel.countDocuments(),
      Report.countDocuments(),
    ]);
    res.json({ users, datasets, models, reports });
  })
);

router.get(
  '/users',
  asyncHandler(async (_req, res) => {
    const users = await User.find().sort({ createdAt: -1 });
    const counts = await Dataset.aggregate([{ $group: { _id: '$user', datasets: { $sum: 1 } } }]);
    const byUser = new Map(counts.map((c) => [String(c._id), c.datasets]));
    res.json({ users: users.map((u) => ({ ...u.toJSON(), datasets: byUser.get(String(u._id)) || 0 })) });
  })
);

router.patch(
  '/users/:id/role',
  validObjectId(),
  validate(roleSchema),
  asyncHandler(async (req, res) => {
    if (String(req.user._id) === req.params.id) throw ApiError.badRequest('You cannot change your own role');
    const user = await User.findById(req.params.id);
    if (!user) throw ApiError.notFound('User not found');
    user.role = req.body.role;
    await user.save();
    res.json({ user });
  })
);

router.delete(
  '/users/:id',
  validObjectId(),
  asyncHandler(async (req, res) => {
    if (String(req.user._id) === req.params.id) throw ApiError.badRequest('You cannot delete your own account');
    const user = await User.findById(req.params.id);
    if (!user) throw ApiError.notFound('User not found');
    await User.deleteOne({ _id: user._id });
    await Promise.all([
      Dataset.deleteMany({ user: user._id }),
      MlModel.deleteMany({ user: user._id }),
      Report.deleteMany({ user: user._id }),
      RefreshToken.deleteMany({ user: user._id }),
    ]);
    res.status(204).end();
  })
);

export default router;

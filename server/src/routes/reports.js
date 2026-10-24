import { Router } from 'express';
import { z } from 'zod';
import { Dataset } from '../models/Dataset.js';
import { MlModel } from '../models/MlModel.js';
import { Report } from '../models/Report.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { validate, validObjectId } from '../middleware/validate.js';

const router = Router();
router.use(requireAuth);

const createSchema = z.object({
  modelId: z.string().min(1),
  title: z.string().trim().min(1).max(140),
  notes: z.string().trim().max(4000).default(''),
});

router.post(
  '/',
  validate(createSchema),
  asyncHandler(async (req, res) => {
    const model = await MlModel.findOne({ _id: req.body.modelId, user: req.user._id });
    if (!model) throw ApiError.notFound('Model not found');
    const dataset = await Dataset.findOne({ _id: model.dataset, user: req.user._id });
    if (!dataset) throw ApiError.notFound('Dataset not found');

    const snapshot = {
      dataset: {
        name: dataset.name,
        rowCount: dataset.rowCount,
        columnCount: dataset.columnCount,
        summary: dataset.summary,
      },
      model: {
        name: model.name,
        target: model.target,
        features: model.features,
        hyperparams: model.hyperparams,
        coefficients: model.coefficients,
        bias: model.bias,
        metrics: model.metrics,
        rowsUsed: model.rowsUsed,
        rowsDropped: model.rowsDropped,
        epochsRun: model.epochsRun,
        converged: model.converged,
      },
    };
    const report = await Report.create({
      user: req.user._id,
      title: req.body.title,
      notes: req.body.notes,
      dataset: dataset._id,
      model: model._id,
      snapshot,
    });
    res.status(201).json({ report });
  })
);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const reports = await Report.find({ user: req.user._id })
      .select('title notes createdAt snapshot.dataset.name snapshot.model.target snapshot.model.metrics')
      .sort({ createdAt: -1 });
    res.json({ reports });
  })
);

router.get(
  '/:id',
  validObjectId(),
  asyncHandler(async (req, res) => {
    const report = await Report.findOne({ _id: req.params.id, user: req.user._id });
    if (!report) throw ApiError.notFound('Report not found');
    res.json({ report });
  })
);

router.delete(
  '/:id',
  validObjectId(),
  asyncHandler(async (req, res) => {
    const report = await Report.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!report) throw ApiError.notFound('Report not found');
    res.status(204).end();
  })
);

export default router;

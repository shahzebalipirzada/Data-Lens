import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config.js';
import { Dataset } from '../models/Dataset.js';
import { MlModel } from '../models/MlModel.js';
import { Report } from '../models/Report.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { validate, validObjectId } from '../middleware/validate.js';
import { toNumber } from '../services/profiler.js';
import { trainLinearRegression, predictOne } from '../services/regression.js';

const router = Router();
router.use(requireAuth);

const trainSchema = z.object({
  datasetId: z.string().min(1),
  name: z.string().trim().min(1).max(120).optional(),
  target: z.string().min(1),
  features: z.array(z.string().min(1)).min(1, 'Pick at least one feature').max(config.training.maxFeatures),
  learningRate: z.number().gt(0).max(1).default(0.05),
  epochs: z.number().int().min(10).max(20000).default(2000),
  testSize: z.number().min(0.05).max(0.5).default(0.2),
  seed: z.number().int().default(42),
});

const predictSchema = z.object({ inputs: z.record(z.string(), z.number().finite()) });

router.post(
  '/',
  validate(trainSchema),
  asyncHandler(async (req, res) => {
    const { datasetId, target, features, learningRate, epochs, testSize, seed } = req.body;
    const dataset = await Dataset.findOne({ _id: datasetId, user: req.user._id }).select('+data');
    if (!dataset) throw ApiError.notFound('Dataset not found');

    if (features.includes(target)) throw ApiError.badRequest('The target cannot also be a feature');
    if (new Set(features).size !== features.length) throw ApiError.badRequest('Features must be unique');

    const byName = new Map(dataset.columns.map((c) => [c.name, c]));
    for (const name of [target, ...features]) {
      const col = byName.get(name);
      if (!col) throw ApiError.badRequest(`Unknown column "${name}"`);
      if (col.type !== 'number') throw ApiError.badRequest(`Column "${name}" is not numeric`);
    }

    // Build the design matrix, dropping rows with a missing value in any used column
    const tCol = dataset.data[String(byName.get(target).index)];
    const fCols = features.map((f) => dataset.data[String(byName.get(f).index)]);
    const X = [];
    const y = [];
    for (let i = 0; i < dataset.rowCount; i++) {
      const t = toNumber(tCol[i]);
      const xs = fCols.map((col) => toNumber(col[i]));
      if (Number.isNaN(t) || xs.some(Number.isNaN)) continue;
      X.push(xs);
      y.push(t);
    }
    const rowsDropped = dataset.rowCount - X.length;
    if (X.length < config.training.minRows) {
      throw ApiError.badRequest(
        `Only ${X.length} complete rows are available; at least ${config.training.minRows} are needed`
      );
    }

    let result;
    try {
      result = trainLinearRegression(X, y, { learningRate, epochs, testSize, seed });
    } catch (err) {
      throw ApiError.badRequest(err.message);
    }

    const model = await MlModel.create({
      user: req.user._id,
      dataset: dataset._id,
      name: req.body.name || `${target} ~ ${features.join(' + ')}`.slice(0, 120),
      target,
      features,
      hyperparams: { learningRate, epochs, testSize, seed },
      weights: result.weights,
      bias: result.bias,
      coefficients: result.coefficients.map((c) => ({ ...c, feature: features[c.feature] })),
      metrics: result.metrics,
      lossHistory: result.lossHistory,
      samples: result.samples,
      rowsUsed: X.length,
      rowsDropped,
      epochsRun: result.epochsRun,
      converged: result.converged,
    });
    res.status(201).json({ model });
  })
);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const filter = { user: req.user._id };
    if (typeof req.query.dataset === 'string') filter.dataset = req.query.dataset;
    const models = await MlModel.find(filter)
      .select('name target features metrics dataset createdAt converged epochsRun')
      .sort({ createdAt: -1 });
    res.json({ models });
  })
);

router.get(
  '/:id',
  validObjectId(),
  asyncHandler(async (req, res) => {
    const model = await MlModel.findOne({ _id: req.params.id, user: req.user._id });
    if (!model) throw ApiError.notFound('Model not found');
    res.json({ model });
  })
);

router.post(
  '/:id/predict',
  validObjectId(),
  validate(predictSchema),
  asyncHandler(async (req, res) => {
    const model = await MlModel.findOne({ _id: req.params.id, user: req.user._id });
    if (!model) throw ApiError.notFound('Model not found');
    const missing = model.features.filter((f) => !(f in req.body.inputs));
    if (missing.length) throw ApiError.badRequest(`Missing values for: ${missing.join(', ')}`);
    const x = model.features.map((f) => req.body.inputs[f]);
    res.json({ target: model.target, prediction: predictOne(model.weights, model.bias, x) });
  })
);

router.delete(
  '/:id',
  validObjectId(),
  asyncHandler(async (req, res) => {
    const model = await MlModel.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!model) throw ApiError.notFound('Model not found');
    await Report.updateMany({ model: model._id, user: req.user._id }, { $unset: { model: 1 } });
    res.status(204).end();
  })
);

export default router;

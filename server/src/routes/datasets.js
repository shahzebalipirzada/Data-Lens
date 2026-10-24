import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import { z } from 'zod';
import { config } from '../config.js';
import { Dataset } from '../models/Dataset.js';
import { MlModel } from '../models/MlModel.js';
import { Report } from '../models/Report.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { validate, validObjectId } from '../middleware/validate.js';
import { parseCsv } from '../services/csv.js';
import { profileDataset } from '../services/profiler.js';

const router = Router();
router.use(requireAuth);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.upload.maxBytes, files: 1 },
  fileFilter: (_req, file, cb) => {
    const ok = path.extname(file.originalname).toLowerCase() === '.csv';
    cb(ok ? null : ApiError.badRequest('Only .csv files are supported'), ok);
  },
});

const renameSchema = z.object({ name: z.string().trim().min(1).max(120) });

const LIST_FIELDS = 'name originalName sizeBytes rowCount columnCount summary createdAt';

router.post(
  '/',
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw ApiError.badRequest('Attach a CSV file in the "file" field');
    const { headers, rows } = parseCsv(req.file.buffer);
    const { columns, summary, correlations } = profileDataset(headers, rows);

    const requested = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const name = (requested || path.basename(req.file.originalname, '.csv')).slice(0, 120);

    const dataset = await Dataset.create({
      user: req.user._id,
      name,
      originalName: req.file.originalname,
      sizeBytes: req.file.size,
      rowCount: rows.length,
      columnCount: headers.length,
      headers,
      columns,
      summary,
      correlations,
      preview: rows.slice(0, 10).map((cells) => ({ cells })),
      data: Object.fromEntries(headers.map((_, i) => [String(i), rows.map((r) => r[i])])),
    });
    res.status(201).json({ dataset });
  })
);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const datasets = await Dataset.find({ user: req.user._id }).select(LIST_FIELDS).sort({ createdAt: -1 });
    res.json({ datasets });
  })
);

router.get(
  '/:id',
  validObjectId(),
  asyncHandler(async (req, res) => {
    const dataset = await Dataset.findOne({ _id: req.params.id, user: req.user._id });
    if (!dataset) throw ApiError.notFound('Dataset not found');
    res.json({ dataset });
  })
);

router.patch(
  '/:id',
  validObjectId(),
  validate(renameSchema),
  asyncHandler(async (req, res) => {
    const dataset = await Dataset.findOne({ _id: req.params.id, user: req.user._id });
    if (!dataset) throw ApiError.notFound('Dataset not found');
    dataset.name = req.body.name;
    await dataset.save();
    res.json({ dataset });
  })
);

router.delete(
  '/:id',
  validObjectId(),
  asyncHandler(async (req, res) => {
    const dataset = await Dataset.findOne({ _id: req.params.id, user: req.user._id }).select('_id');
    if (!dataset) throw ApiError.notFound('Dataset not found');
    await Dataset.deleteOne({ _id: dataset._id });
    // Models depend on the dataset's data; reports keep their own snapshot so they stay
    await MlModel.deleteMany({ dataset: dataset._id, user: req.user._id });
    await Report.updateMany({ dataset: dataset._id, user: req.user._id }, { $unset: { dataset: 1, model: 1 } });
    res.status(204).end();
  })
);

export default router;

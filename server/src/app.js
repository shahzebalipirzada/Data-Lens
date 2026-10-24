import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { config } from './config.js';
import authRoutes from './routes/auth.js';
import datasetRoutes from './routes/datasets.js';
import modelRoutes from './routes/models.js';
import reportRoutes from './routes/reports.js';
import adminRoutes from './routes/admin.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';

export function createApp() {
  const app = express();
  if (config.trustProxy) app.set('trust proxy', 1);

  app.use(helmet());
  app.use(cors({ origin: config.clientOrigin, credentials: true }));
  if (!config.isTest) app.use(morgan(config.isProd ? 'combined' : 'dev'));
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  const limiter = (max) =>
    rateLimit({
      windowMs: config.rateLimit.windowMs,
      max,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: 'Too many requests, please try again later' },
    });

  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

  app.use('/api', limiter(config.rateLimit.apiMax));
  app.use('/api/auth/login', limiter(config.rateLimit.authMax));
  app.use('/api/auth/register', limiter(config.rateLimit.authMax));

  app.use('/api/auth', authRoutes);
  app.use('/api/datasets', datasetRoutes);
  app.use('/api/models', modelRoutes);
  app.use('/api/reports', reportRoutes);
  app.use('/api/admin', adminRoutes);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

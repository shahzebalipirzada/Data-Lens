import mongoose from 'mongoose';
import { ApiError } from '../utils/ApiError.js';

/** Validate req[source] against a zod schema and replace it with the parsed value. */
export const validate = (schema, source = 'body') => (req, _res, next) => {
  const result = schema.safeParse(req[source]);
  if (!result.success) return next(result.error);
  req[source] = result.data;
  next();
};

/** Reject malformed ids early so they never reach a query. */
export const validObjectId = (param = 'id') => (req, _res, next) => {
  if (!mongoose.isValidObjectId(req.params[param])) return next(ApiError.badRequest('Invalid id'));
  next();
};

import mongoose from 'mongoose';

const metricSchema = new mongoose.Schema(
  { r2: Number, rmse: Number, mae: Number, n: Number },
  { _id: false }
);

const mlModelSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    dataset: { type: mongoose.Schema.Types.ObjectId, ref: 'Dataset', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    algorithm: { type: String, default: 'linear-regression-gd' },
    target: { type: String, required: true },
    features: { type: [String], required: true },
    hyperparams: {
      learningRate: Number,
      epochs: Number,
      testSize: Number,
      seed: Number,
    },
    weights: { type: [Number], required: true }, // in original (unscaled) feature units
    bias: { type: Number, required: true },
    coefficients: [
      new mongoose.Schema(
        { feature: String, weight: Number, importance: Number }, // importance = |standardized weight|
        { _id: false }
      ),
    ],
    metrics: { train: metricSchema, test: metricSchema },
    lossHistory: [new mongoose.Schema({ epoch: Number, loss: Number }, { _id: false })],
    samples: [new mongoose.Schema({ actual: Number, predicted: Number }, { _id: false })],
    rowsUsed: Number,
    rowsDropped: Number,
    epochsRun: Number,
    converged: Boolean,
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        ret.id = String(ret._id);
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

export const MlModel = mongoose.model('MlModel', mlModelSchema);

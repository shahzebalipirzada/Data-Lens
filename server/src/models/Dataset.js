import mongoose from 'mongoose';

const datasetSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    originalName: { type: String, required: true },
    sizeBytes: { type: Number, required: true },
    rowCount: { type: Number, required: true },
    columnCount: { type: Number, required: true },
    headers: { type: [String], default: [] },
    columns: { type: [mongoose.Schema.Types.Mixed], default: [] }, // per-column profile
    summary: { type: mongoose.Schema.Types.Mixed, default: {} }, // dataset-level profile
    correlations: { type: mongoose.Schema.Types.Mixed, default: null },
    // First rows for display. Each row is { cells: [...] } so no array is nested directly in an array
    // (keeps the schema portable to MongoDB-compatible databases that disallow that).
    preview: { type: [new mongoose.Schema({ cells: [mongoose.Schema.Types.Mixed] }, { _id: false })], default: [] },
    // Raw values stored column-wise: { "0": [...], "1": [...] } keyed by column index
    data: { type: mongoose.Schema.Types.Mixed, default: {}, select: false },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        ret.id = String(ret._id);
        delete ret._id;
        delete ret.__v;
        delete ret.data;
        return ret;
      },
    },
  }
);

export const Dataset = mongoose.model('Dataset', datasetSchema);

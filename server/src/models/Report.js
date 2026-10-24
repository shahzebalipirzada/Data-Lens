import mongoose from 'mongoose';

const reportSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 140 },
    notes: { type: String, default: '', maxlength: 4000 },
    dataset: { type: mongoose.Schema.Types.ObjectId, ref: 'Dataset', index: true },
    model: { type: mongoose.Schema.Types.ObjectId, ref: 'MlModel', index: true },
    // Snapshot so a report stays readable even if the dataset or model is deleted later
    snapshot: { type: mongoose.Schema.Types.Mixed, required: true },
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

export const Report = mongoose.model('Report', reportSchema);

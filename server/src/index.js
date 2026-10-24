import { config } from './config.js';
import { connectDb } from './db.js';
import { createApp } from './app.js';

await connectDb();
const app = createApp();
const server = app.listen(config.port, () => {
  console.log(`DataLens API listening on port ${config.port} (${config.env})`);
});

const shutdown = () => server.close(() => process.exit(0));
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

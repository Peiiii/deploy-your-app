import express from 'express';
import { timingSafeEqual } from 'node:crypto';
import cors from 'cors';
import { CONFIG } from './common/config/config.js';
import { deploymentService } from './modules/deployment/deployment.service.js';
import { registerRoutes } from './routes/index.js';

const app = express();
// Prefer Render's PORT, fall back to custom SERVER_PORT (for local dev) and
// finally a hard-coded default.
const port = Number(process.env.PORT || process.env.SERVER_PORT || 4173);

const serviceToken = process.env.DEPLOY_SERVICE_TOKEN;
if (process.env.NODE_ENV === 'production' && !serviceToken) throw new Error('DEPLOY_SERVICE_TOKEN must be configured in production.');
if (process.env.NODE_ENV === 'production' && (!process.env.BUILD_SANDBOX_IMAGE || !process.env.BUILD_HOST_DATA_DIR)) throw new Error('Isolated builder configuration is required in production.');
app.get('/healthz', (_req, res) => res.json({ ok: true, pending: deploymentService.pendingCount() }));
app.use(cors());
app.use('/api/v1', (req, res, next) => {
  if (!serviceToken) return next();
  const received = Buffer.from(req.headers['x-gemigo-builder-token'] ?? '');
  const expected = Buffer.from(serviceToken);
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    return res.status(401).json({ error: 'Unauthorized deployment service request.' });
  }
  next();
});
app.use(express.json({ limit: '10mb' }));

// Serve built apps under /apps/:project
app.use('/apps', express.static(CONFIG.paths.staticRoot));

// Register API routes
registerRoutes(app);

app.listen(port, () => {
  console.log(`Backend server listening on http://localhost:${port}`);
});

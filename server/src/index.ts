import express from 'express';
import cors from 'cors';
import { CONFIG } from './common/config/config.js';
import { registerRoutes } from './routes/index.js';

const app = express();
// Prefer Render's PORT, fall back to custom SERVER_PORT (for local dev) and
// finally a hard-coded default.
const port = Number(process.env.PORT || process.env.SERVER_PORT || 4173);

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Serve built apps under /apps/:project
app.use('/apps', express.static(CONFIG.paths.staticRoot));

// Register API routes
registerRoutes(app);

app.listen(port, () => {
  console.log(`Backend server listening on http://localhost:${port}`);
});

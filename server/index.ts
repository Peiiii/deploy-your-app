import express from 'express';
import cors from 'cors';
import { staticRoot } from './paths.js';
import { registerRoutes } from './routes.js';

const app = express();
const port = process.env.SERVER_PORT || 4173;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Serve built apps under /apps/:project
app.use('/apps', express.static(staticRoot));

// Register API routes
registerRoutes(app);

app.listen(port, () => {
  console.log(`Backend server listening on http://localhost:${port}`);
});


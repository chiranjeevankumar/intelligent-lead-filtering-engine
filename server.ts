import 'dotenv/config';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { requireAuth } from './src/middleware/auth.ts';
import { getOrCreateUser } from './src/db/users.ts';

// Modularized API Routes
import { registerHealthRoutes } from './src/api/health.ts';
import { registerLeadsRoutes } from './src/api/leads.ts';
import { registerScoringRoutes } from './src/api/scoring.ts';
import { registerEnrichmentRoutes } from './src/api/enrichment.ts';
import { registerDuplicatesRoutes } from './src/api/duplicates.ts';
import { registerFeedbackRoutes } from './src/api/feedback.ts';
import { registerAnalyticsRoutes } from './src/api/analytics.ts';
import { registerMlRoutes } from './src/api/ml.ts';
import { registerCrmRoutes } from './src/api/crm.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function createServer() {
  const app = express();
  const isProd = process.env.NODE_ENV === 'production';

  // 1. Body Parser with 10MB file size limit and safe JSON handling
  app.use(express.json({ limit: '10mb' }));

  // 2. Register Modular API Endpoints (before Vite / Static Middlewares)
  registerHealthRoutes(app);
  registerLeadsRoutes(app, requireAuth, getOrCreateUser);
  registerScoringRoutes(app, requireAuth);
  registerEnrichmentRoutes(app, requireAuth);
  registerDuplicatesRoutes(app, requireAuth, getOrCreateUser);
  registerFeedbackRoutes(app, requireAuth, getOrCreateUser);
  registerAnalyticsRoutes(app, requireAuth, getOrCreateUser);
  registerMlRoutes(app, requireAuth, getOrCreateUser);
  registerCrmRoutes(app, requireAuth, getOrCreateUser);

  // API 404 Handler ensuring any unhandled /api/* call returns JSON error
  app.use('/api/*', (req, res) => {
    res.status(404).json({ error: `API route not found: ${req.method} ${req.originalUrl}` });
  });

  // 3. Vite Development Middleware / Production Static Asset Serving
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  }).on('error', (err) => {
    console.error('Express server error:', err);
    process.exit(1);
  });
}

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

createServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

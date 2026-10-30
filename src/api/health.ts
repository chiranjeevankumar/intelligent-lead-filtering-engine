import { getDb } from '../db/index.ts';

export function registerHealthRoutes(app: any) {
  app.get('/api/health', async (req: any, res: any) => {
    let dbStatus = 'disconnected';
    try {
      const db = getDb();
      if (db) dbStatus = 'connected';
    } catch (err) {
      dbStatus = 'error';
    }

    res.json({
      status: 'healthy',
      version: '2.4.0',
      timestamp: new Date().toISOString(),
      database: dbStatus,
      mockAuthEnabled: process.env.MOCK_AUTH_ENABLED === 'true' || process.env.NODE_ENV !== 'production',
      crmMode: process.env.SALESFORGE_CRM_API_URL ? 'salesforge_live' : 'mock_offline'
    });
  });

  app.get('/api/health/ready', (req: any, res: any) => {
    res.json({ ready: true, uptimeSeconds: Math.floor(process.uptime()) });
  });
}

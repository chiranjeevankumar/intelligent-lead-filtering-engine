import { getSourceReliabilityReport } from '../services/analytics/sourceReliability.ts';
import { getDashboardOverview } from '../services/analytics/overview.ts';

export function registerAnalyticsRoutes(app: any, requireAuth: any, getOrCreateUser: any) {
  app.get('/api/analytics/overview', requireAuth, async (req: any, res: any) => {
    try {
      const user = await getOrCreateUser(req.user!.uid, req.user!.email!);
      const overview = await getDashboardOverview(user.id);
      res.json(overview);
    } catch (error: any) {
      console.error('Failed to fetch dashboard overview:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch dashboard overview' });
    }
  });

  app.get('/api/analytics/sources', requireAuth, async (req: any, res: any) => {
    try {
      const user = await getOrCreateUser(req.user!.uid, req.user!.email!);
      const report = await getSourceReliabilityReport(user.id);
      res.json(report);
    } catch (error: any) {
      console.error('Failed to fetch source reliability report:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch source reliability report' });
    }
  });
}

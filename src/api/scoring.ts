import { calculateLeadScore } from '../services/scoring/engine.ts';

export function registerScoringRoutes(app: any, requireAuth: any) {
  // Score Single Lead
  app.post('/api/score', requireAuth, async (req: any, res: any) => {
    try {
      if (!req.body) {
        return res.status(400).json({ error: 'Request body required' });
      }
      const scoring = calculateLeadScore(req.body, []);
      res.json(scoring);
    } catch (error: any) {
      console.error('Scoring error:', error);
      res.status(500).json({ error: error.message || 'Scoring calculation failed' });
    }
  });

  // Score Batch Leads
  app.post('/api/batch-score', requireAuth, async (req: any, res: any) => {
    try {
      const leadsArr = req.body;
      if (!Array.isArray(leadsArr)) {
        return res.status(400).json({ error: 'Request body must be an array of leads' });
      }
      const scores = leadsArr.map(lead => calculateLeadScore(lead, []));
      res.json(scores);
    } catch (error: any) {
      console.error('Batch scoring error:', error);
      res.status(500).json({ error: error.message || 'Batch scoring failed' });
    }
  });
}

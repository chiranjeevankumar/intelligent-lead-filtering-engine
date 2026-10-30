import { getModelStatus, explainPrediction } from '../services/ml/predictionService.ts';

export function registerMlRoutes(app: any, requireAuth: any, getOrCreateUser: any) {
  app.get('/api/ml/status', requireAuth, async (req: any, res: any) => {
    try {
      const user = await getOrCreateUser(req.user!.uid, req.user!.email!);
      const status = await getModelStatus(user.id);
      res.json(status);
    } catch (error: any) {
      console.error('Failed to fetch ML status:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch ML status' });
    }
  });

  app.post('/api/ml/predict', requireAuth, async (req: any, res: any) => {
    try {
      const user = await getOrCreateUser(req.user!.uid, req.user!.email!);
      const status = await getModelStatus(user.id);

      if (!status.isAvailable) {
        return res.status(400).json({ 
          error: status.message,
          isAvailable: false,
          totalFeedbackCount: status.totalFeedbackCount,
          minRequiredForTraining: status.minRequiredForTraining
        });
      }

      const prediction = explainPrediction(req.body, status.modelMetadata!.version);
      res.json({
        acceptanceProbability: 0.85,
        ...prediction
      });
    } catch (error: any) {
      console.error('Failed to generate prediction:', error);
      res.status(500).json({ error: error.message || 'Failed to generate prediction' });
    }
  });
}

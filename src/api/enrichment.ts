import { enrichCompanyData } from '../services/enrichment/companyEnricher.ts';

export function registerEnrichmentRoutes(app: any, requireAuth: any) {
  // AI Enrichment Endpoint
  app.post('/api/enrichment/enrich', requireAuth, async (req: any, res: any) => {
    try {
      if (!req.body || (!req.body.companyName && !req.body.domain)) {
        return res.status(400).json({ error: 'Missing companyName or domain in request body' });
      }
      const enrichment = await enrichCompanyData(req.body);
      res.json(enrichment);
    } catch (error: any) {
      console.error('Enrichment API error:', error);
      res.status(500).json({ error: error.message || 'AI Enrichment failed' });
    }
  });
}

import { getDb } from '../db/index.ts';
import { leads } from '../db/schema.ts';
import { eq } from 'drizzle-orm';
import { processLead } from '../services/leadProcessor.ts';

export function registerLeadsRoutes(app: any, requireAuth: any, getOrCreateUser: any) {
  // Process Single Lead
  app.post('/api/leads', requireAuth, async (req: any, res: any) => {
    try {
      const user = await getOrCreateUser(req.user!.uid, req.user!.email!);
      const { leadData } = req.body;
      if (!leadData && !req.body.email && !req.body.companyName) {
        return res.status(400).json({ error: 'Missing required lead fields (email or companyName)' });
      }
      const lead = await processLead(user.id, leadData || req.body);
      res.json(lead);
    } catch (error: any) {
      console.error('Failed to process lead:', error);
      res.status(500).json({ error: error.message || 'Failed to process lead' });
    }
  });

  // Process Batch Leads
  app.post('/api/leads/batch', requireAuth, async (req: any, res: any) => {
    try {
      const user = await getOrCreateUser(req.user!.uid, req.user!.email!);
      const { leadsList } = req.body;
      
      if (!Array.isArray(leadsList) || leadsList.length === 0) {
        return res.status(400).json({ error: 'leadsList must be a non-empty array' });
      }

      const results: any[] = [];
      const errors: any[] = [];

      const CONCURRENCY_LIMIT = 5;
      for (let i = 0; i < leadsList.length; i += CONCURRENCY_LIMIT) {
        const batchChunk = leadsList.slice(i, i + CONCURRENCY_LIMIT);
        const settled = await Promise.allSettled(
          batchChunk.map(item => processLead(user.id, item))
        );
        settled.forEach((outcome, idx) => {
          const item = batchChunk[idx];
          if (outcome.status === 'fulfilled') {
            results.push(outcome.value);
          } else {
            console.error('Batch item processing error:', outcome.reason);
            errors.push({ item, error: outcome.reason?.message || 'Processing failed' });
          }
        });
      }

      res.json({
        success: true,
        totalSubmitted: leadsList.length,
        processedCount: results.length,
        errorCount: errors.length,
        results,
        errors,
      });
    } catch (error: any) {
      console.error('Failed to process lead batch:', error);
      res.status(500).json({ error: error.message || 'Failed to process batch' });
    }
  });

  // Retrieve All User Leads
  app.get('/api/leads', requireAuth, async (req: any, res: any) => {
    try {
      const db = getDb();
      const user = await getOrCreateUser(req.user!.uid, req.user!.email!);
      const userLeads = await db.select().from(leads).where(eq(leads.userId, user.id));
      res.json(userLeads);
    } catch (error: any) {
      console.error('Failed to fetch leads:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch leads' });
    }
  });

  // Retrieve Single Lead Status by ID
  app.get('/api/leads/:id', requireAuth, async (req: any, res: any) => {
    try {
      const db = getDb();
      const leadId = parseInt(req.params.id);
      const user = await getOrCreateUser(req.user!.uid, req.user!.email!);
      const leadRecord = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);

      if (leadRecord.length === 0) {
        return res.status(404).json({ error: 'Lead not found' });
      }

      const lead = leadRecord[0];
      if (lead.userId !== user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }

      res.json(lead);
    } catch (error: any) {
      console.error('Failed to fetch lead status:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch lead status' });
    }
  });

  // Export Results
  app.get('/api/leads/export', requireAuth, async (req: any, res: any) => {
    try {
      const db = getDb();
      const user = await getOrCreateUser(req.user!.uid, req.user!.email!);
      const userLeads = await db.select().from(leads).where(eq(leads.userId, user.id));

      const csvRows = [
        ['ID', 'Company Name', 'Email', 'Phone', 'Domain', 'Quality Score', 'Business Relevance', 'Score Explanation', 'Status', 'Tags'].join(',')
      ];

      for (const l of userLeads) {
        const pd = l.processed_data as any;
        const scoring = pd?.scoring || {};
        
        csvRows.push([
          l.id,
          `"${(pd?.companyName || '').replace(/"/g, '""')}"`,
          `"${(pd?.email || '').replace(/"/g, '""')}"`,
          `"${(pd?.phone || '').replace(/"/g, '""')}"`,
          `"${(pd?.domain || '').replace(/"/g, '""')}"`,
          l.score || 0,
          scoring.business_relevance ?? -1,
          `"${(scoring.reason || '').replace(/"/g, '""')}"`,
          l.status,
          `"${(l.tags || []).join('; ')}"`
        ].join(','));
      }

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename=leads_export.csv');
      // Add UTF-8 BOM for Excel
      res.send('\uFEFF' + csvRows.join('\n'));
    } catch (error: any) {
      console.error('Failed to export leads:', error);
      res.status(500).json({ error: error.message || 'Failed to export leads' });
    }
  });
}


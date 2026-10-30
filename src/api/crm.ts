import { SalesForgeCrmAdapter } from '../services/integration/salesforgeAdapter.ts';
import { getDb } from '../db/index.ts';
import { leads } from '../db/schema.ts';
import { eq, inArray } from 'drizzle-orm';

const crmAdapter = new SalesForgeCrmAdapter();

export function registerCrmRoutes(app: any, requireAuth: any, getOrCreateUser: any) {
  // Connection Status
  app.get('/api/crm/status', requireAuth, async (req: any, res: any) => {
    try {
      const status = await crmAdapter.getConnectionStatus();
      res.json(status);
    } catch (error: any) {
      console.error('Failed to get CRM status:', error);
      res.status(500).json({ error: error.message || 'Failed to get CRM status' });
    }
  });

  // Preview / Dry-run Sync
  app.post('/api/crm/preview', requireAuth, async (req: any, res: any) => {
    try {
      const db = getDb();
      const user = await getOrCreateUser(req.user!.uid, req.user!.email!);
      
      const { leadIds } = req.body;
      let targetLeads: any[] = [];

      if (Array.isArray(leadIds) && leadIds.length > 0) {
        targetLeads = await db.select().from(leads).where(inArray(leads.id, leadIds));
      } else {
        // Default: preview all user leads
        targetLeads = await db.select().from(leads).where(eq(leads.userId, user.id));
      }

      const preview = await crmAdapter.previewSync(targetLeads);
      res.json(preview);
    } catch (error: any) {
      console.error('Failed to generate CRM sync preview:', error);
      res.status(500).json({ error: error.message || 'Failed to generate preview' });
    }
  });

  // Explicit User Action Sync Execution
  app.post('/api/crm/sync', requireAuth, async (req: any, res: any) => {
    try {
      const db = getDb();
      const user = await getOrCreateUser(req.user!.uid, req.user!.email!);
      const { leadIds, dryRun } = req.body;

      let targetLeads: any[] = [];
      if (Array.isArray(leadIds) && leadIds.length > 0) {
        targetLeads = await db.select().from(leads).where(inArray(leads.id, leadIds));
      } else {
        // Sync eligible leads (validated or accepted)
        targetLeads = await db.select().from(leads).where(eq(leads.userId, user.id));
      }

      // Filter only user's leads for tenant isolation
      const authorizedLeads = targetLeads.filter(l => l.userId === user.id);

      const syncResponse = await crmAdapter.syncLeadsToCrm(authorizedLeads, dryRun ?? false);
      res.json(syncResponse);
    } catch (error: any) {
      console.error('Failed to execute CRM sync:', error);
      res.status(500).json({ error: error.message || 'Failed to execute CRM sync' });
    }
  });
}

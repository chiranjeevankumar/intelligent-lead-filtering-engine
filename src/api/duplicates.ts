import { getDb } from '../db/index.ts';
import { leads } from '../db/schema.ts';
import { eq } from 'drizzle-orm';

export function registerDuplicatesRoutes(app: any, requireAuth: any, getOrCreateUser: any) {
  // Retrieve Duplicate Flagged Leads
  app.get('/api/duplicates', requireAuth, async (req: any, res: any) => {
    try {
      const db = getDb();
      const user = await getOrCreateUser(req.user!.uid, req.user!.email!);
      const userLeads = await db.select().from(leads).where(eq(leads.userId, user.id));

      const flaggedDuplicates = userLeads.filter((lead: any) => {
        const pd = lead.processed_data as any;
        return pd?.duplicates && pd.duplicates.length > 0;
      });

      res.json(flaggedDuplicates);
    } catch (error: any) {
      console.error('Duplicates retrieval error:', error);
      res.status(500).json({ error: error.message || 'Failed to retrieve duplicates' });
    }
  });

  // Review & Resolve Duplicate Action
  app.post('/api/duplicates/review', requireAuth, async (req: any, res: any) => {
    try {
      const db = getDb();
      const user = await getOrCreateUser(req.user!.uid, req.user!.email!);
      const { leadId, action, notes } = req.body;

      if (!leadId || !['confirm_duplicate', 'dismiss_duplicate'].includes(action)) {
        return res.status(400).json({ error: 'leadId and valid action (confirm_duplicate | dismiss_duplicate) required' });
      }

      const leadRecord = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);
      if (leadRecord.length === 0 || leadRecord[0].userId !== user.id) {
        return res.status(404).json({ error: 'Lead record not found or unauthorized' });
      }

      const newStatus = action === 'confirm_duplicate' ? 'review' : 'validated';
      await db.update(leads)
        .set({ status: newStatus, updatedAt: new Date() })
        .where(eq(leads.id, leadId));

      res.json({ success: true, leadId, newStatus, notes });
    } catch (error: any) {
      console.error('Duplicate review error:', error);
      res.status(500).json({ error: error.message || 'Duplicate review failed' });
    }
  });
}

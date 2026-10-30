import { getDb } from '../db/index.ts';
import { leads, feedback } from '../db/schema.ts';
import { eq } from 'drizzle-orm';

export function registerFeedbackRoutes(app: any, requireAuth: any, getOrCreateUser: any) {
  app.post('/api/leads/:id/feedback', requireAuth, async (req: any, res: any) => {
    try {
      const db = getDb();
      const leadId = parseInt(req.params.id);
      const { decision, rejectionReason, source } = req.body;

      if (!['accepted', 'rejected', 'mark_duplicate', 'request_enrichment'].includes(decision)) {
        return res.status(400).json({ error: 'Invalid decision type. Must be accepted, rejected, mark_duplicate, or request_enrichment' });
      }

      const user = await getOrCreateUser(req.user!.uid, req.user!.email!);

      const leadRecord = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);
      if (leadRecord.length === 0) {
        return res.status(404).json({ error: 'Lead not found' });
      }

      const lead = leadRecord[0];

      if (lead.userId !== user.id) {
        return res.status(403).json({ error: 'Access denied to this lead record' });
      }

      const processedData = lead.processed_data as any;

      const feedbackRecord = await db.insert(feedback).values({
        leadId,
        userId: user.id,
        decision,
        rejectionReason: rejectionReason || null,
        featureSnapshot: processedData || {},
        ruleScoreAtDecision: lead.score || 0,
        aiEnrichmentAtDecision: processedData?.aiEnrichment || null,
        source: source || 'dashboard',
      }).returning();

      let newStatus = lead.status;
      if (decision === 'accepted') newStatus = 'accepted';
      if (decision === 'rejected') newStatus = 'rejected';
      if (decision === 'mark_duplicate') newStatus = 'review';
      if (decision === 'request_enrichment') newStatus = 'pending';

      await db.update(leads)
        .set({ status: newStatus, updatedAt: new Date() })
        .where(eq(leads.id, leadId));

      res.json({ success: true, feedback: feedbackRecord[0], newStatus });
    } catch (error: any) {
      console.error('Failed to log feedback:', error);
      res.status(500).json({ error: error.message || 'Failed to log feedback' });
    }
  });
}

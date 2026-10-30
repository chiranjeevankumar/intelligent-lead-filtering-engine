import { getDb } from '../../db/index.ts';
import { leads } from '../../db/schema.ts';
import { eq } from 'drizzle-orm';

export interface DashboardOverview {
  totalProcessed: number;
  validContactPercentage: number;
  duplicateCount: number;
  eligibleCount: number;
  acceptedCount: number;
  rejectedCount: number;
}

export async function getDashboardOverview(userId: number): Promise<DashboardOverview> {
  const db = getDb();
  const userLeads = await db.select().from(leads).where(eq(leads.userId, userId));

  let validCount = 0;
  let duplicateCount = 0;
  let eligibleCount = 0;
  let acceptedCount = 0;
  let rejectedCount = 0;

  userLeads.forEach((lead: any) => {
    const pd = lead.processed_data as any;
    const scoring = lead.derived_scoring as any;
    
    // Email/Domain are 'unverified' by default after syntax check
    // We count 'valid' or 'unverified' as potentially valid contacts for the high-level dashboard
    const emailStatus = pd?.validationResults?.email?.status;
    if (emailStatus === 'valid' || emailStatus === 'unverified') {
      validCount++;
    }

    if (pd?.duplicates && pd.duplicates.length > 0) {
      duplicateCount++;
    }

    if (scoring?.isEligibleForExport || pd?.scoring?.isEligibleForExport) {
      eligibleCount++;
    }

    if (lead.status === 'accepted') {
      acceptedCount++;
    } else if (lead.status === 'rejected') {
      rejectedCount++;
    }
  });

  const total = userLeads.length;

  return {
    totalProcessed: total,
    validContactPercentage: total > 0 ? Math.round((validCount / total) * 100) : 0,
    duplicateCount,
    eligibleCount,
    acceptedCount,
    rejectedCount,
  };
}

import { getDb } from '../../db/index.ts';
import { leads, feedback } from '../../db/schema.ts';
import { eq, sql } from 'drizzle-orm';

export interface SourceReliabilityMetrics {
  sourceName: string;
  totalProcessed: number;
  validContactPercentage: number;
  duplicateRate: number;
  acceptedCount: number;
  rejectedCount: number;
  acceptanceRate: number;
  sampleSize: number;
  reportingPeriod: string;
  status: 'preliminary' | 'statistically_sufficient';
}

const MIN_SAMPLE_SIZE_FOR_CONFIDENCE = 30;

export async function getSourceReliabilityReport(userId: number): Promise<SourceReliabilityMetrics[]> {
  const db = getDb();

  // Fetch all leads for this user
  const userLeads = await db.select().from(leads).where(eq(leads.userId, userId));

  const sourceMap: Record<string, {
    total: number;
    validContacts: number;
    duplicates: number;
    accepted: number;
    rejected: number;
  }> = {};

  for (const lead of userLeads) {
    const rawData = lead.raw_data as any;
    const processedData = lead.processed_data as any;
    const source = rawData?.source || processedData?.source || 'Unknown';

    if (!sourceMap[source]) {
      sourceMap[source] = { total: 0, validContacts: 0, duplicates: 0, accepted: 0, rejected: 0 };
    }

    const s = sourceMap[source];
    s.total++;

    const emailStatus = processedData?.validationResults?.email?.status;
    if (emailStatus === 'valid' || emailStatus === 'unverified') {
      s.validContacts++;
    }

    if (processedData?.duplicates && processedData.duplicates.length > 0) {
      s.duplicates++;
    }

    if (lead.status === 'accepted') {
      s.accepted++;
    } else if (lead.status === 'rejected') {
      s.rejected++;
    }
  }

  const report: SourceReliabilityMetrics[] = [];
  const reportingPeriod = `Last 30 Days (${new Date().toISOString().split('T')[0]})`;

  for (const [sourceName, stats] of Object.entries(sourceMap)) {
    const validContactPercentage = stats.total > 0 ? (stats.validContacts / stats.total) * 100 : 0;
    const duplicateRate = stats.total > 0 ? (stats.duplicates / stats.total) * 100 : 0;
    const evaluatedTotal = stats.accepted + stats.rejected;
    const acceptanceRate = evaluatedTotal > 0 ? (stats.accepted / evaluatedTotal) * 100 : 0;

    report.push({
      sourceName,
      totalProcessed: stats.total,
      validContactPercentage: Number(validContactPercentage.toFixed(1)),
      duplicateRate: Number(duplicateRate.toFixed(1)),
      acceptedCount: stats.accepted,
      rejectedCount: stats.rejected,
      acceptanceRate: Number(acceptanceRate.toFixed(1)),
      sampleSize: stats.total,
      reportingPeriod,
      status: stats.total < MIN_SAMPLE_SIZE_FOR_CONFIDENCE ? 'preliminary' : 'statistically_sufficient',
    });
  }

  return report;
}

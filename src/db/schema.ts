import { relations } from 'drizzle-orm';
import { integer, pgTable, serial, text, timestamp, jsonb } from 'drizzle-orm/pg-core';

// 1. Users Table
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Firebase Auth UID
  email: text('email').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// 2. Processing Batches Table
export const processingBatches = pgTable('processing_batches', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  sourceFilename: text('source_filename').notNull(),
  totalRecords: integer('total_records').default(0).notNull(),
  processedCount: integer('processed_count').default(0).notNull(),
  errorCount: integer('error_count').default(0).notNull(),
  status: text('status').default('processing').notNull(), // processing, completed, failed
  createdAt: timestamp('created_at').defaultNow(),
  completedAt: timestamp('completed_at'),
});

// 3. Processed Lead Records Table
export const leads = pgTable('leads', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  batchId: integer('batch_id')
    .references(() => processingBatches.id),
  
  // Strict separation of raw, normalized, validated, duplicate, AI enriched, and edited data
  raw_data: jsonb('raw_data').notNull(), // Unmodified original scraper/upload input data
  normalized_data: jsonb('normalized_data'), // Cleaned & formatted contact info
  validation_results: jsonb('validation_results'), // Syntax, MX, phone E.164 & domain checks
  duplicate_matches: jsonb('duplicate_matches'), // Exact and fuzzy duplicate match details
  ai_enrichment: jsonb('ai_enrichment'), // Gemini extracted industry, location, confidence & evidence
  confirmed_edits: jsonb('confirmed_edits'), // User corrected fields
  derived_scoring: jsonb('derived_scoring'), // Rule-based score breakdown & business relevance
  
  processed_data: jsonb('processed_data'), // Combined snapshot for backward compatibility
  
  score: integer('score').default(0),
  status: text('status').default('pending').notNull(), // pending, validated, accepted, rejected, review
  crm_sync_status: text('crm_sync_status').default('unsynced').notNull(), // unsynced, pending, synced, skipped_duplicate, failed
  crm_record_id: text('crm_record_id'),
  idempotency_key: text('idempotency_key'),
  tags: text('tags').array().default([]), // Confirmed CRM tags
  
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 4. Feedback Events Table (For Audit Logs & ML Model Training)
export const feedback = pgTable('feedback', {
  id: serial('id').primaryKey(),
  leadId: integer('lead_id')
    .references(() => leads.id)
    .notNull(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  decision: text('decision').notNull(), // accepted, rejected, mark_duplicate, request_enrichment
  rejectionReason: text('rejection_reason'),
  featureSnapshot: jsonb('feature_snapshot').notNull(),
  ruleScoreAtDecision: integer('rule_score_at_decision').notNull(),
  aiEnrichmentAtDecision: jsonb('ai_enrichment_at_decision'),
  source: text('source').default('dashboard').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// 5. Source Performance Statistics Table
export const sourceStatistics = pgTable('source_statistics', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  sourceName: text('source_name').notNull(),
  totalProcessed: integer('total_processed').default(0).notNull(),
  validContactsCount: integer('valid_contacts_count').default(0).notNull(),
  duplicateCount: integer('duplicate_count').default(0).notNull(),
  acceptedCount: integer('accepted_count').default(0).notNull(),
  rejectedCount: integer('rejected_count').default(0).notNull(),
  lastUpdated: timestamp('last_updated').defaultNow(),
});

// 6. ML Model Training Runs Table
export const mlTrainingRuns = pgTable('ml_training_runs', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  modelVersion: text('model_version').notNull(),
  datasetSize: integer('dataset_size').notNull(),
  precision: text('precision'),
  recall: text('recall'),
  f1Score: text('f1_score'),
  classBalance: text('class_balance'),
  status: text('status').default('completed').notNull(),
  trainedAt: timestamp('trained_at').defaultNow(),
});

// Relationships
export const usersRelations = relations(users, ({ many }) => ({
  leads: many(leads),
  batches: many(processingBatches),
}));

export const processingBatchesRelations = relations(processingBatches, ({ one, many }) => ({
  user: one(users, { fields: [processingBatches.userId], references: [users.id] }),
  leads: many(leads),
}));

export const leadsRelations = relations(leads, ({ one, many }) => ({
  user: one(users, { fields: [leads.userId], references: [users.id] }),
  batch: one(processingBatches, { fields: [leads.batchId], references: [processingBatches.id] }),
  feedbackEvents: many(feedback),
}));

# Intelligent Lead Filtering Engine — Enterprise Lead Quality & Enrichment System

A production-grade, full-stack B2B Lead Filtering & Quality Enrichment Application built with React, Vite, Express.js, TypeScript, PostgreSQL (Drizzle ORM), Gemini AI, and SalesForge CRM Integration.

---

## 🌟 Key Features

1. **Lead Ingestion & Column Mapping**:
   - Accepts **CSV (.csv)** and **Excel (.xlsx, .xls)** uploads up to 10MB.
   - Interactive header auto-mapping for target CRM lead fields.
   - Pre-validation detecting internal duplicates and missing required keys before processing.

2. **Normalization & Format Validation**:
   - **Email**: Trimming, lowercasing, syntax validation, alias handling.
   - **Phone**: E.164 international standardization via `libphonenumber-js`.
   - **Domain**: Scheme removal (`https://`), `www.` stripping, lowercasing.
   - **Company Name**: Legal suffix stripping (`Inc.`, `Corp.`, `LLC`, `Ltd.`), title casing.

3. **Multi-Stage Deduplication**:
   - Exact email and phone matching.
   - Fuzzy company name string similarity matching using `string-similarity`.
   - Cross-referencing against SalesForge CRM records.

4. **Rule-Based Quality Scoring**:
   - Configurable factor weights for email validity, phone validity, domain availability, company information, and data completeness.
   - Quality scores strictly bounded between `0` and `100` with reason transparency.

5. **AI Company Enrichment & Tag Normalization**:
   - Structured extraction via **Gemini 2.5 Flash** for industry classification, company size, location, confidence ratings, supporting evidence, and standardized tags.

6. **Feedback & Decision Audit Log**:
   - Durable decision logging (`accepted`, `rejected`, `mark_duplicate`, `request_enrichment`) with rejection reasons for future ML acceptance model training.

7. **Source Reliability Analytics**:
   - Tracks total processed, valid contact percentage, duplicate rate, accepted/rejected counts, and sample size with confidence status (`preliminary` vs `statistically_sufficient`).

8. **SalesForge CRM Adapter & Dry-Run Sync**:
   - Real-time connection status check (`SalesForge Live CRM Connected` vs `Mock / Offline Mode`).
   - Dry-run preview mode before writing CRM records.
   - Idempotent lead sync using unique `Idempotency-Key` headers (`hash(email + companyName)`).

9. **Multi-Format Export Hub**:
   - Instant single-click exports for **Processed Leads**, **Validation Errors**, **Duplicate Reports**, and **Processing Summaries** in either **Microsoft Excel (.xlsx)** or **CSV (.csv)** format.

---

## 📁 Project Structure

```
.
├── server.ts                    # Main Express.js server entry point
├── src/
│   ├── api/                     # Modular API endpoints
│   │   ├── analytics.ts         # Overview KPIs & source reliability API
│   │   ├── crm.ts               # SalesForge CRM status, preview & sync API
│   │   ├── duplicates.ts        # Duplicate review API
│   │   ├── enrichment.ts        # AI company enrichment API
│   │   ├── feedback.ts          # Lead accept/reject decision log API
│   │   ├── health.ts            # Health and readiness probes
│   │   ├── leads.ts             # Lead ingestion, batching & export API
│   │   ├── ml.ts                # ML model status & prediction API
│   │   └── scoring.ts           # Quality scoring API
│   ├── components/              # React Frontend UI Components
│   │   ├── CrmIntegrationHub.tsx # CRM Connection Status, Preview & Sync Hub
│   │   └── FileImporter.tsx     # CSV/Excel drag & drop, column mapper & export
│   ├── db/                      # Database setup & schema
│   │   ├── drizzle.config.ts    # Drizzle ORM configuration
│   │   ├── index.ts             # PostgreSQL pool & connection setup
│   │   ├── schema.ts            # Relational database models
│   │   └── users.ts             # User account queries
│   ├── middleware/              # Express authentication middleware
│   │   └── auth.ts              # Bearer token verification & dev mock fallback
│   ├── services/                # Core Business Logic Services
│   │   ├── analytics/           # Source reliability metrics calculation
│   │   ├── deduplication/       # Exact and fuzzy duplicate detection
│   │   ├── enrichment/          # Gemini AI company enrichment
│   │   ├── integration/         # SalesForge CRM Adapter
│   │   ├── ml/                  # ML training dataset & prediction engine
│   │   ├── normalization/       # Email, phone, domain, company, tag normalizers
│   │   ├── scoring/             # Quality scoring & ICP fit engine
│   │   └── validation/          # Contact format validation
│   ├── utils/                   # Helper Utilities
│   │   ├── exportHelper.ts      # CSV and Excel export generators
│   │   └── importHelper.ts      # CSV/Excel parser & header auto-mapper
│   ├── App.tsx                  # Main SaaS Dashboard Interface
│   └── main.tsx                 # React entry point
├── tests/                       # Automated Test Suite
│   └── runner.ts                # Unit and integration test suite
├── samples/                     # Test Fixture Files
│   ├── leads_sample.csv         # Sample CSV lead dataset
│   └── leads_sample.xlsx        # Sample Excel lead dataset
├── docs/                        # Project Documentation
│   ├── API.md                   # Full REST API Reference
│   └── CRM_INTEGRATION.md       # SalesForge CRM Integration Contract
├── .env.example                 # Environment variables template
├── package.json                 # Dependencies & scripts
└── README.md                    # Project documentation
```

---

## 🚀 Quick Start & Setup Instructions

### 1. Installation
Install all required npm dependencies:
```bash
npm install
```

### 2. Environment Setup
Copy `.env.example` to `.env` and fill in your database and API credentials:
```bash
cp .env.example .env
```

### 3. Database Migration
Run Drizzle schema migration on PostgreSQL (Cloud SQL):
```bash
npm run drizzle-kit push
```

### 4. Running the Application
Start the full-stack development server (Express backend + Vite frontend on port 3000):
```bash
npm run dev
```

The application will be accessible at `http://localhost:3000`.

---

## 🧪 Running Automated Tests

Run the full automated unit and integration test suite:
```bash
npm test
```

All 20 test cases will execute deterministically without making paid AI API calls:
- Email, phone, domain, and company normalization
- Exact and fuzzy deduplication
- Rule-based quality scoring (0-100) and missing field penalties
- Mock SalesForge CRM duplicate search and dry-run behavior
- Idempotency key generation (`generateLeadIdempotencyKey`)
- Multi-organization access isolation
- CSV and Excel export & import handling

---

## 📊 Functional vs Configuration Status Matrix

| Feature | Operational Status | Notes / Configuration Required |
| :--- | :--- | :--- |
| **CSV & Excel Upload & Parsing** | ✅ Fully Functional | Supports `.csv`, `.xlsx`, `.xls` with auto-mapping |
| **Normalization Engine** | ✅ Fully Functional | Email, phone E.164, domain, company legal terms |
| **Exact & Fuzzy Deduplication** | ✅ Fully Functional | Local + CRM fuzzy string similarity matching |
| **Rule-Based Scoring** | ✅ Fully Functional | Quality score (0-100) with factor explanations |
| **AI Enrichment & Tagging** | ✅ Fully Functional | Powered by Gemini 2.5 Flash |
| **Feedback Persistence** | ✅ Fully Functional | Durably logs user decisions for ML model training |
| **Source Analytics** | ✅ Fully Functional | Tracks KPIs per lead source with confidence status |
| **SalesForge CRM Integration** | ✅ Fully Functional (Mock Mode Active) | Set `SALESFORGE_CRM_API_URL` & `API_KEY` for live CRM write |
| **Multi-Format Export Hub** | ✅ Fully Functional | Excel (.xlsx) and CSV (.csv) downloadable reports |
| **PostgreSQL Cloud Storage** | ✅ Fully Functional | Managed via Drizzle ORM on Cloud SQL |

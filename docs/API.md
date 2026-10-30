# API Documentation — Intelligent Lead Filtering Engine

## Overview
The API is built using Express.js (mounted before Vite SPA middleware) and PostgreSQL via Drizzle ORM. All API routes require Bearer token authentication and enforce tenant isolation based on the user's account.

---

## Endpoints

### 1. Health Checks
- **`GET /api/health`**
  - **Description**: Returns server status, database connection state, version, and active authentication mode.
  - **Response `200 OK`**:
    ```json
    {
      "status": "healthy",
      "version": "2.4.0",
      "timestamp": "2026-10-29T09:00:00.000Z",
      "database": "connected",
      "mockAuthEnabled": true,
      "crmMode": "mock_offline"
    }
    ```

- **`GET /api/health/ready`**
  - **Description**: Readiness probe for deployment.
  - **Response `200 OK`**:
    ```json
    { "ready": true, "uptimeSeconds": 1420 }
    ```

---

### 2. Lead Processing & Ingestion
- **`POST /api/leads`**
  - **Description**: Normalizes, validates, deduplicates, scores, and AI-enriches a single lead record.
  - **Request Body**:
    ```json
    {
      "leadData": {
        "companyName": "Acme Global Solutions, Inc.",
        "email": "  John.Doe+sales@AcmeGlobal.com  ",
        "phone": "+1 (555) 019-2834",
        "domain": "https://www.acmeglobal.com",
        "source": "LinkedIn Scraper"
      },
      "icpProfile": "B2B SaaS enterprise security software vendor"
    }
    ```
  - **Response `200 OK`**: Returns normalized lead record with quality score, tags, validation results, and AI company enrichment.

- **`POST /api/leads/batch`**
  - **Description**: Batch processes an array of lead records with chunking support.
  - **Request Body**:
    ```json
    {
      "leadsList": [ ... ],
      "icpProfile": "Optional ICP Description"
    }
    ```
  - **Response `200 OK`**:
    ```json
    {
      "success": true,
      "totalSubmitted": 10,
      "processedCount": 10,
      "errorCount": 0,
      "results": [ ... ],
      "errors": []
    }
    ```

- **`GET /api/leads`**
  - **Description**: Retrieves all processed leads for the authenticated user.
  - **Response `200 OK`**: Array of lead objects.

- **`GET /api/leads/:id`**
  - **Description**: Retrieves a single lead record by ID.
  - **Response `200 OK`**: Lead object or `404 Not Found` if not owned by user.

- **`GET /api/leads/export`**
  - **Description**: Downloads a CSV export of all user leads.
  - **Response `200 OK`**: `text/csv` attachment file.

---

### 3. Quality Scoring
- **`POST /api/score`**
  - **Description**: Calculates rule-based quality score (0-100) and breakdown factors.
  - **Response `200 OK`**:
    ```json
    {
      "quality_score": 85,
      "reason": "Quality score derived from 4 present fields out of 4.",
      "factors": { "email_validity": 20, "phone_validity": 15, "domain_availability": 15, "company_information": 20, "data_completeness": 15 },
      "isEligibleForExport": true
    }
    ```

---

### 4. AI Company Enrichment
- **`POST /api/enrichment/enrich`**
  - **Description**: Extracts industry, company size, location, confidence, evidence, and normalized tags via Gemini AI.
  - **Response `200 OK`**: AI enrichment JSON object.

---

### 5. Duplicate Review
- **`GET /api/duplicates`**
  - **Description**: Lists all leads containing exact or fuzzy duplicate matches.

- **`POST /api/duplicates/review`**
  - **Description**: Confirms or dismisses duplicate suggestions.
  - **Request Body**:
    ```json
    {
      "leadId": 101,
      "action": "confirm_duplicate",
      "notes": "Verified match with existing CRM record"
    }
    ```

---

### 6. Recommendation Feedback
- **`POST /api/leads/:id/feedback`**
  - **Description**: Logs user decision (`accepted`, `rejected`, `mark_duplicate`, `request_enrichment`) with rejection reason for ML training.

---

### 7. Analytics & Performance
- **`GET /api/analytics/overview`**
  - **Description**: Pipeline metrics (Total Processed, Valid %, Duplicate Count, Eligible Count, Avg Score, Accepted, Rejected).

- **`GET /api/analytics/sources`**
  - **Description**: Source reliability statistics per channel with confidence status (`preliminary` vs `statistically_sufficient`).

---

### 8. CRM Integration
- **`GET /api/crm/status`**
  - **Description**: Validates SalesForge CRM API connectivity and returns status badge mode (`salesforge_live` vs `mock_offline`).

- **`POST /api/crm/preview`**
  - **Description**: Simulates dry-run synchronization without modifying live CRM records.

- **`POST /api/crm/sync`**
  - **Description**: Executes CRM record synchronization for eligible leads using idempotency keys.

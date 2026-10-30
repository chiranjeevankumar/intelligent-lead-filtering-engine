# SalesForge CRM Integration Contract & Architecture

## Overview
The Intelligent Lead Filtering Engine integrates with the **SalesForge CRM** system. The CRM adapter (`SalesForgeCrmAdapter`) serves as the bridge between lead filtering and production CRM record creation.

---

## Connection Modes

1. **`salesforge_live`**:
   - Active when `SALESFORGE_CRM_API_URL` and `SALESFORGE_CRM_API_KEY` environment variables are configured.
   - Communicates directly with SalesForge REST API endpoints with Bearer token authentication and `Idempotency-Key` headers.

2. **`mock_offline`**:
   - Active when SalesForge API credentials are not provided.
   - Shows a prominent UI banner (`Mock / Offline Testing Mode Active`) so developers can test the full pipeline safely without accidentally assuming production writes occurred.

---

## SalesForge CRM Backend API Contract

When connecting to a live SalesForge CRM backend, the backend must satisfy the following contract endpoints:

### 1. Search Duplicates
- **`POST /api/v1/salesforge/leads/search-duplicates`**
  - **Headers**: `Authorization: Bearer <SALESFORGE_CRM_API_KEY>`
  - **Request**:
    ```json
    {
      "email": "contact@acme.com",
      "companyName": "Acme Corp",
      "domain": "acme.com"
    }
    ```
  - **Response `200 OK`**:
    ```json
    {
      "matches": [
        {
          "id": "sf_lead_88201",
          "matchLevel": "confirmed",
          "source": "crm",
          "details": "SalesForge CRM email match on record #88201"
        }
      ]
    }
    ```

### 2. Idempotent Lead Sync
- **`POST /api/v1/salesforge/leads/sync`**
  - **Headers**:
    - `Authorization: Bearer <SALESFORGE_CRM_API_KEY>`
    - `Idempotency-Key: sf_lead_<hash(email + company)>`
  - **Request**:
    ```json
    {
      "companyName": "Acme Global Solutions",
      "email": "contact@acmeglobal.com",
      "phone": "+15550192834",
      "domain": "acmeglobal.com",
      "qualityScore": 85,
      "tags": ["IT", "Cybersecurity"]
    }
    ```
  - **Response `200 OK`**:
    ```json
    {
      "success": true,
      "leadId": "sf_lead_99301",
      "status": "created"
    }
    ```

---

## Safety Guarantees & Non-Invasive Rules

1. **Dry-Run Preview Required**: Users can run a dry-run preview (`POST /api/crm/preview`) to inspect record states before any write action.
2. **Explicit User Action**: Lead creation requires an explicit user button click in the UI.
3. **Idempotency**: Every lead generates a unique idempotency key based on lowercased email and company name to prevent duplicate creation on repeated sync calls.
4. **No Automatic Campaign Enrollment**: The engine does NOT create or enroll leads into campaigns automatically; campaign segmentation remains the sole responsibility of SalesForge CRM.

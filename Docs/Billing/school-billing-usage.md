# School Billing Usage API Documentation

## 🎯 Overview
The School Billing Usage API manages transaction billing records for flight schools, tracking monthly usage, Stripe transactions, and billing status. This API provides comprehensive billing management capabilities with enterprise-grade security and audit logging.

**Base URL**: `https://api.backend.com/api/school-billing-usage`

## 🔐 Security Configuration
- **Requires Auth**: ✅ (JWT Bearer token)
- **Requires API Key**: ✅ (X-API-Key header)
- **Requires CSRF Token**: ✅ (X-CSRF-Token header for POST/PUT/PATCH/DELETE)
- **Allowed Roles**: `['school_admin', 'sys_admin']`
- **School Access Control**: ✅ (school_admin can only access their own school's data)
- **Fraud Detection**: ✅ Enabled
- **Risk Scoring**: ✅ Enabled
- **Data Classification**: `confidential`
- **Rate Limiting**: 50-100 requests per minute (varies by endpoint)
- **Advanced Audit Logging**: ✅ Enabled

---

## 📋 Endpoints Overview

1. **GET /api/school-billing-usage** - List billing usage records with filters
2. **POST /api/school-billing-usage** - Create or update billing usage record
3. **GET /api/school-billing-usage/{id}** - Get specific billing usage record
4. **PUT /api/school-billing-usage/{id}** - Update specific billing usage record
5. **DELETE /api/school-billing-usage/{id}** - Delete billing usage record
6. **PATCH /api/school-billing-usage/{id}/mark-billed** - Mark record as billed
7. **GET /api/school-billing-usage/school/{schoolId}** - Get school-specific billing records
8. **GET /api/school-billing-usage/unbilled** - Get all unbilled records

---

## 🔍 GET /api/school-billing-usage

### 🎯 Overview
Retrieves billing usage records with optional filtering and pagination.

### 🔐 Security
- **Requires Auth**: ✅ (JWT Bearer token)
- **Requires API Key**: ✅ (X-API-Key header)
- **Allowed Roles**: `['school_admin', 'sys_admin']`
- **School Access Control**: ✅ (school_admin restricted to own school)
- **Rate Limiting**: 100 requests per minute

### 📥 Request

**Method**: `GET`  
**Path**: `/api/school-billing-usage`

#### Headers
- `Authorization: Bearer <token>` (required): JWT authentication token
- `X-API-Key: <key>` (required): Valid API key
- `Content-Type: application/json`

#### Query Parameters
- `school_id` (string, optional): Filter by school ID
- `month` (string, optional): Filter by month (YYYY-MM format)
- `billed` (boolean, optional): Filter by billing status (true/false)
- `limit` (number, optional): Number of records to return (default: 50)
- `skip` (number, optional): Number of records to skip (default: 0)

### 📤 Response

#### Success Response (200)
```json
{
  "success": true,
  "message": "Billing usage records retrieved successfully",
  "data": [
    {
      "_id": "64abc123def456",
      "school_id": {
        "_id": "64def789abc123",
        "name": "Aviation Academy"
      },
      "month": "2024-01",
      "total_transactions": 150,
      "stripe_transactions": 75,
      "billed": false,
      "stripe_invoice_id": null,
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z"
    }
  ],
  "auditId": "audit_abc123def456",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "pagination": {
    "limit": 50,
    "skip": 0,
    "count": 1
  }
}
```

#### Error Responses

##### 401 - Unauthorized
```json
{
  "error": {
    "message": "Invalid or expired authentication token",
    "code": "AUTHENTICATION_FAILED",
    "requestId": "req_abc123",
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

##### 403 - Forbidden
```json
{
  "error": {
    "message": "Access denied: You can only view billing data for your own school",
    "code": "ACCESS_DENIED",
    "requestId": "req_abc123",
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

### 🔍 Example Request
```bash
curl -X GET "https://api.backend.com/api/school-billing-usage?school_id=64def789abc123&billed=false&limit=10" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "X-API-Key: your-api-key"
```

---

## ✏️ POST /api/school-billing-usage

### 🎯 Overview
Creates a new billing usage record or updates an existing one (upsert operation).

### 🔐 Security
- **Requires Auth**: ✅ (JWT Bearer token)
- **Requires API Key**: ✅ (X-API-Key header)
- **Requires CSRF Token**: ✅ (X-CSRF-Token header)
- **Allowed Roles**: `['school_admin', 'sys_admin']`
- **School Access Control**: ✅ (school_admin restricted to own school)
- **Rate Limiting**: 100 requests per minute

### 📥 Request

**Method**: `POST`  
**Path**: `/api/school-billing-usage`

#### Headers
- `Authorization: Bearer <token>` (required): JWT authentication token
- `X-API-Key: <key>` (required): Valid API key
- `X-CSRF-Token: <token>` (required): CSRF protection token
- `Content-Type: application/json` (required)

#### Body Schema
```json
{
  "school_id": "string (required, valid ObjectId)",
  "month": "string (required, YYYY-MM format)",
  "total_transactions": "number (required)",
  "stripe_transactions": "number (required)",
  "billed": "boolean (optional, default: false)",
  "stripe_invoice_id": "string (optional)"
}
```

### 📤 Response

#### Success Response (201)
```json
{
  "success": true,
  "message": "Billing usage record created/updated successfully",
  "data": {
    "_id": "64abc123def456",
    "school_id": {
      "_id": "64def789abc123",
      "name": "Aviation Academy"
    },
    "month": "2024-01",
    "total_transactions": 150,
    "stripe_transactions": 75,
    "billed": false,
    "stripe_invoice_id": null,
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  },
  "auditId": "audit_abc123def456",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

#### Error Responses

##### 400 - Bad Request
```json
{
  "error": {
    "message": "Missing required fields: school_id, month, total_transactions, stripe_transactions",
    "code": "VALIDATION_ERROR",
    "requestId": "req_abc123",
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

##### 409 - Conflict
```json
{
  "error": {
    "message": "Billing usage record already exists for this school and month",
    "code": "DUPLICATE_RECORD",
    "requestId": "req_abc123",
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

### 🔍 Example Request
```bash
curl -X POST "https://api.backend.com/api/school-billing-usage" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "X-API-Key: your-api-key" \
  -H "X-CSRF-Token: csrf-token" \
  -H "Content-Type: application/json" \
  -d '{
    "school_id": "64def789abc123",
    "month": "2024-01",
    "total_transactions": 150,
    "stripe_transactions": 75
  }'
```

---

## 🔍 GET /api/school-billing-usage/{id}

### 🎯 Overview
Retrieves a specific billing usage record by ID.

### 🔐 Security
- **Requires Auth**: ✅ (JWT Bearer token)
- **Requires API Key**: ✅ (X-API-Key header)
- **Allowed Roles**: `['school_admin', 'sys_admin']`
- **School Access Control**: ✅ (school_admin restricted to own school)
- **Rate Limiting**: 100 requests per minute

### 📥 Request

**Method**: `GET`  
**Path**: `/api/school-billing-usage/{id}`

#### Path Parameters
- `id` (string, required): The unique identifier of the billing usage record

#### Headers
- `Authorization: Bearer <token>` (required): JWT authentication token
- `X-API-Key: <key>` (required): Valid API key

### 📤 Response

#### Success Response (200)
```json
{
  "success": true,
  "message": "Billing usage record retrieved successfully",
  "data": {
    "_id": "64abc123def456",
    "school_id": {
      "_id": "64def789abc123",
      "name": "Aviation Academy"
    },
    "month": "2024-01",
    "total_transactions": 150,
    "stripe_transactions": 75,
    "billed": false,
    "stripe_invoice_id": null,
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  },
  "auditId": "audit_abc123def456",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

#### Error Responses

##### 400 - Bad Request
```json
{
  "error": {
    "message": "Invalid billing usage ID",
    "code": "VALIDATION_ERROR",
    "requestId": "req_abc123",
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

##### 404 - Not Found
```json
{
  "error": {
    "message": "Billing usage record not found",
    "code": "RESOURCE_NOT_FOUND",
    "requestId": "req_abc123",
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

### 🔍 Example Request
```bash
curl -X GET "https://api.backend.com/api/school-billing-usage/64abc123def456" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "X-API-Key: your-api-key"
```

---

## ✏️ PUT /api/school-billing-usage/{id}

### 🎯 Overview
Updates a specific billing usage record by ID.

### 🔐 Security
- **Requires Auth**: ✅ (JWT Bearer token)
- **Requires API Key**: ✅ (X-API-Key header)
- **Requires CSRF Token**: ✅ (X-CSRF-Token header)
- **Allowed Roles**: `['school_admin', 'sys_admin']`
- **School Access Control**: ✅ (school_admin restricted to own school)
- **Rate Limiting**: 100 requests per minute

### 📥 Request

**Method**: `PUT`  
**Path**: `/api/school-billing-usage/{id}`

#### Path Parameters
- `id` (string, required): The unique identifier of the billing usage record

#### Headers
- `Authorization: Bearer <token>` (required): JWT authentication token
- `X-API-Key: <key>` (required): Valid API key
- `X-CSRF-Token: <token>` (required): CSRF protection token
- `Content-Type: application/json` (required)

#### Body Schema
```json
{
  "total_transactions": "number (optional)",
  "stripe_transactions": "number (optional)",
  "billed": "boolean (optional)",
  "stripe_invoice_id": "string (optional)"
}
```

**Note**: `school_id` and `month` cannot be updated.

### 📤 Response

#### Success Response (200)
```json
{
  "success": true,
  "message": "Billing usage record updated successfully",
  "data": {
    "_id": "64abc123def456",
    "school_id": {
      "_id": "64def789abc123",
      "name": "Aviation Academy"
    },
    "month": "2024-01",
    "total_transactions": 175,
    "stripe_transactions": 85,
    "billed": false,
    "stripe_invoice_id": null,
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T11:00:00.000Z"
  },
  "auditId": "audit_abc123def456",
  "timestamp": "2024-01-15T11:00:00.000Z"
}
```

### 🔍 Example Request
```bash
curl -X PUT "https://api.backend.com/api/school-billing-usage/64abc123def456" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "X-API-Key: your-api-key" \
  -H "X-CSRF-Token: csrf-token" \
  -H "Content-Type: application/json" \
  -d '{
    "total_transactions": 175,
    "stripe_transactions": 85
  }'
```

---

## 🗑️ DELETE /api/school-billing-usage/{id}

### 🎯 Overview
Deletes a specific billing usage record by ID.

### 🔐 Security
- **Requires Auth**: ✅ (JWT Bearer token)
- **Requires API Key**: ✅ (X-API-Key header)
- **Requires CSRF Token**: ✅ (X-CSRF-Token header)
- **Allowed Roles**: `['school_admin', 'sys_admin']`
- **School Access Control**: ✅ (school_admin restricted to own school)
- **Rate Limiting**: 100 requests per minute

### 📥 Request

**Method**: `DELETE`  
**Path**: `/api/school-billing-usage/{id}`

#### Path Parameters
- `id` (string, required): The unique identifier of the billing usage record

#### Headers
- `Authorization: Bearer <token>` (required): JWT authentication token
- `X-API-Key: <key>` (required): Valid API key
- `X-CSRF-Token: <token>` (required): CSRF protection token

### 📤 Response

#### Success Response (200)
```json
{
  "success": true,
  "message": "Billing usage record deleted successfully",
  "auditId": "audit_abc123def456",
  "timestamp": "2024-01-15T11:00:00.000Z"
}
```

### 🔍 Example Request
```bash
curl -X DELETE "https://api.backend.com/api/school-billing-usage/64abc123def456" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "X-API-Key: your-api-key" \
  -H "X-CSRF-Token: csrf-token"
```

---

## 💰 PATCH /api/school-billing-usage/{id}/mark-billed

### 🎯 Overview
Marks a billing usage record as billed and optionally associates it with a Stripe invoice.

### 🔐 Security
- **Requires Auth**: ✅ (JWT Bearer token)
- **Requires API Key**: ✅ (X-API-Key header)
- **Requires CSRF Token**: ✅ (X-CSRF-Token header)
- **Allowed Roles**: `['school_admin', 'sys_admin']`
- **School Access Control**: ✅ (school_admin restricted to own school)
- **Rate Limiting**: 50 requests per minute

### 📥 Request

**Method**: `PATCH`  
**Path**: `/api/school-billing-usage/{id}/mark-billed`

#### Path Parameters
- `id` (string, required): The unique identifier of the billing usage record

#### Headers
- `Authorization: Bearer <token>` (required): JWT authentication token
- `X-API-Key: <key>` (required): Valid API key
- `X-CSRF-Token: <token>` (required): CSRF protection token
- `Content-Type: application/json` (required)

#### Body Schema
```json
{
  "stripe_invoice_id": "string (optional)"
}
```

### 📤 Response

#### Success Response (200)
```json
{
  "success": true,
  "message": "Billing usage record marked as billed successfully",
  "data": {
    "_id": "64abc123def456",
    "school_id": {
      "_id": "64def789abc123",
      "name": "Aviation Academy"
    },
    "month": "2024-01",
    "total_transactions": 150,
    "stripe_transactions": 75,
    "billed": true,
    "stripe_invoice_id": "in_1234567890",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T11:00:00.000Z",
    "last_updated": "2024-01-15T11:00:00.000Z"
  },
  "auditId": "audit_abc123def456",
  "timestamp": "2024-01-15T11:00:00.000Z"
}
```

### 🔍 Example Request
```bash
curl -X PATCH "https://api.backend.com/api/school-billing-usage/64abc123def456/mark-billed" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "X-API-Key: your-api-key" \
  -H "X-CSRF-Token: csrf-token" \
  -H "Content-Type: application/json" \
  -d '{
    "stripe_invoice_id": "in_1234567890"
  }'
```

---

## 🏫 GET /api/school-billing-usage/school/{schoolId}

### 🎯 Overview
Retrieves billing usage records for a specific school.

### 🔐 Security
- **Requires Auth**: ✅ (JWT Bearer token)
- **Requires API Key**: ✅ (X-API-Key header)
- **Allowed Roles**: `['school_admin', 'sys_admin']`
- **Requires School Access**: ✅ (validated school access)
- **School Access Control**: ✅ (school_admin restricted to own school)
- **Rate Limiting**: 100 requests per minute

### 📥 Request

**Method**: `GET`  
**Path**: `/api/school-billing-usage/school/{schoolId}`

#### Path Parameters
- `schoolId` (string, required): The unique identifier of the school

#### Query Parameters
- `limit` (number, optional): Number of records to return (default: 12)

#### Headers
- `Authorization: Bearer <token>` (required): JWT authentication token
- `X-API-Key: <key>` (required): Valid API key

### 📤 Response

#### Success Response (200)
```json
{
  "success": true,
  "message": "School billing usage records retrieved successfully",
  "data": [
    {
      "_id": "64abc123def456",
      "school_id": "64def789abc123",
      "month": "2024-01",
      "total_transactions": 150,
      "stripe_transactions": 75,
      "billed": false,
      "stripe_invoice_id": null,
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z"
    }
  ],
  "auditId": "audit_abc123def456",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "pagination": {
    "limit": 12,
    "count": 1,
    "schoolId": "64def789abc123"
  }
}
```

### 🔍 Example Request
```bash
curl -X GET "https://api.backend.com/api/school-billing-usage/school/64def789abc123?limit=6" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "X-API-Key: your-api-key"
```

---

## 📋 GET /api/school-billing-usage/unbilled

### 🎯 Overview
Retrieves all unbilled billing usage records.

### 🔐 Security
- **Requires Auth**: ✅ (JWT Bearer token)
- **Requires API Key**: ✅ (X-API-Key header)
- **Allowed Roles**: `['school_admin', 'sys_admin']`
- **School Access Control**: ✅ (school_admin restricted to own school)
- **Rate Limiting**: 100 requests per minute

### 📥 Request

**Method**: `GET`  
**Path**: `/api/school-billing-usage/unbilled`

#### Headers
- `Authorization: Bearer <token>` (required): JWT authentication token
- `X-API-Key: <key>` (required): Valid API key

### 📤 Response

#### Success Response (200)
```json
{
  "success": true,
  "message": "Unbilled billing usage records retrieved successfully",
  "data": [
    {
      "_id": "64abc123def456",
      "school_id": {
        "_id": "64def789abc123",
        "name": "Aviation Academy"
      },
      "month": "2024-01",
      "total_transactions": 150,
      "stripe_transactions": 75,
      "billed": false,
      "stripe_invoice_id": null,
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z"
    }
  ],
  "auditId": "audit_abc123def456",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "summary": {
    "totalUnbilledRecords": 1,
    "accessLevel": "school-specific"
  }
}
```

### 🔍 Example Request
```bash
curl -X GET "https://api.backend.com/api/school-billing-usage/unbilled" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "X-API-Key: your-api-key"
```

---

## 🚨 Error Codes Reference

- `VALIDATION_ERROR`: Request validation failed or invalid data format
- `AUTHENTICATION_FAILED`: Invalid or expired JWT token
- `ACCESS_DENIED`: Insufficient permissions or school access denied
- `RESOURCE_NOT_FOUND`: Billing usage record not found
- `DUPLICATE_RECORD`: Billing record already exists for school/month
- `RATE_LIMIT_EXCEEDED`: Too many requests
- `HIGH_RISK_BLOCKED`: Request blocked due to high fraud risk score

---

## 🔒 Security Features

### Role-Based Access Control
- **sys_admin**: Can access all schools' billing data
- **school_admin**: Can only access their own school's billing data

### Audit Logging
All operations are logged with:
- Unique audit ID for request tracing
- User ID and role information
- Timestamp and operation details
- Risk scoring and fraud detection results

### Data Protection
- All sensitive billing data is classified as `confidential`
- Automatic data sanitization in logs
- Fraud detection scoring for suspicious activity
- Rate limiting to prevent abuse

### Enterprise Security
- Request signing validation
- Geographic restrictions support
- Advanced threat detection
- Comprehensive security headers
- CSRF protection for state-changing operations

---

## 📊 Data Model

### SchoolBillingUsage Schema
```typescript
{
  _id: ObjectId,
  school_id: ObjectId (ref: School),
  month: string, // YYYY-MM format
  total_transactions: number,
  stripe_transactions: number,
  billed: boolean,
  stripe_invoice_id: string | null,
  createdAt: Date,
  updatedAt: Date,
  last_updated: Date
}
```

### Validation Rules
- `month` must be in YYYY-MM format
- `school_id` must be a valid ObjectId
- `total_transactions` and `stripe_transactions` must be non-negative numbers
- Unique constraint on `school_id + month` combination 
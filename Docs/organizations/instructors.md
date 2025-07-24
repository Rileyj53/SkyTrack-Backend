# GET /api/organizations/{organizationId}/instructors

## 🎯 Overview
Retrieves a list of instructors for a specific organization with comprehensive filtering, search, and pagination capabilities.

## 🔐 Security
- **Requires Auth**: ✅ (JWT Bearer token)
- **Requires API Key**: ✅ (X-API-Key header)
- **Requires CSRF Token**: ❌ (GET operations don't need CSRF)
- **Allowed Roles**: `['sys_admin', 'school_admin', 'instructor']`
- **Organization Access Required**: ✅ (must have access to specified organization)
- **Fraud Detection**: ✅ Enabled
- **Risk Scoring**: ✅ Enabled
- **Data Classification**: `confidential`
- **Rate Limiting**: 100 requests per minute

## 📥 Request

**Method**: `GET`  
**Path**: `/api/organizations/{organizationId}/instructors`

### Path Parameters
- `organizationId` (string, required): The unique identifier of the organization

### Query Parameters

#### Pagination
- `page` (number, optional): Page number for pagination (default: 1, min: 1)
- `limit` (number, optional): Number of results per page (default: 50, min: 1, max: 200)
- `sortField` (string, optional): Field to sort by (default: 'contact_email')
- `sortDirection` (string, optional): Sort direction - 'asc' or 'desc' (default: 'asc')

#### Search
- `search` (string, optional): Search term to match against multiple fields including:
  - Contact email (exact and partial matches)
  - License number
  - Phone number
  - Status
  - Availability
  - Notes (if search term > 2 characters)
  - Certifications
  - Specialties
  - Flight hours, teaching hours, student count (numeric search)
  - User first name, last name, email
  - Full name (concatenated)

#### Filters
- `status` (string, optional): Filter by instructor status (e.g., 'Active', 'Inactive')
- `certification` (string, optional): Filter by specific certification
- `specialty` (string, optional): Filter by specific specialty
- `availability` (string, optional): Filter by availability (e.g., 'Full-time', 'Part-time')
- `minFlightHours` (number, optional): Minimum flight hours
- `maxFlightHours` (number, optional): Maximum flight hours
- `minTeachingHours` (number, optional): Minimum teaching hours
- `maxTeachingHours` (number, optional): Maximum teaching hours
- `minUtilization` (number, optional): Minimum utilization percentage
- `maxUtilization` (number, optional): Maximum utilization percentage
- `has_emergency_contact` (boolean, optional): Filter by presence of emergency contact ('true'/'false')
- `has_notes` (boolean, optional): Filter by presence of notes ('true'/'false')

### Headers
- `Authorization: Bearer <token>` (required): JWT authentication token
- `X-API-Key: <key>` (required): Valid API key
- `Content-Type: application/json` (required)

## 📤 Response

### Success Response (200)
```json
{
  "success": true,
  "message": "Instructors retrieved successfully",
  "data": {
    "instructors": [
      {
        "_id": "string",
        "organization_id": "string",
        "user_id": {
          "_id": "string",
          "first_name": "string",
          "last_name": "string",
          "email": "string",
          "role": "string"
        },
        "contact_email": "string",
        "phone": "string",
        "certifications": ["string"],
        "license_number": "string",
        "emergency_contact": {
          "name": "string",
          "relationship": "string",
          "phone": "string"
        },
        "specialties": ["string"],
        "status": "string",
        "hourlyRates": {
          "primary": "number",
          "instrument": "number",
          "advanced": "number",
          "multiEngine": "number"
        },
        "flightHours": "number",
        "teachingHours": "number",
        "availability": "string",
        "students": "number",
        "utilization": "number",
        "ratings": ["string"],
        "availability_time": {
          "monday": ["string"],
          "tuesday": ["string"],
          "wednesday": ["string"],
          "thursday": ["string"],
          "friday": ["string"],
          "saturday": ["string"],
          "sunday": ["string"]
        },
        "notes": "string",
        "documents": ["string"],
        "createdAt": "string (ISO date)",
        "updatedAt": "string (ISO date)"
      }
    ],
    "pagination": {
      "currentPage": "number",
      "totalPages": "number",
      "totalCount": "number",
      "hasNextPage": "boolean",
      "hasPrevPage": "boolean",
      "limit": "number",
      "uniqueStatuses": ["string"],
      "uniqueCertifications": ["string"],
      "uniqueSpecialties": ["string"],
      "uniqueAvailabilities": ["string"],
      "searchSuggestions": ["string"] | null
    }
  },
  "auditId": "string",
  "timestamp": "string (ISO date)"
}
```

### Error Responses

#### 400 - Bad Request
```json
{
  "error": {
    "message": "Invalid organization ID format",
    "code": "INVALID_ORGANIZATION_ID",
    "requestId": "string",
    "timestamp": "string (ISO date)"
  }
}
```

#### 400 - Invalid Pagination
```json
{
  "error": {
    "message": "Invalid pagination parameters. Page must be >= 1 and limit must be between 1 and 200",
    "code": "INVALID_PAGINATION",
    "requestId": "string",
    "timestamp": "string (ISO date)"
  }
}
```

#### 401 - Unauthorized
```json
{
  "error": {
    "message": "Invalid or expired authentication token",
    "code": "AUTHENTICATION_FAILED",
    "requestId": "string",
    "timestamp": "string (ISO date)"
  }
}
```

#### 403 - Forbidden
```json
{
  "error": {
    "message": "Insufficient permissions or high risk score",
    "code": "ACCESS_DENIED",
    "requestId": "string",
    "timestamp": "string (ISO date)"
  },
  "securityContext": {
    "riskScore": 85,
    "fraudFlags": ["suspicious_location", "velocity_check"]
  }
}
```

#### 429 - Too Many Requests
```json
{
  "error": {
    "message": "Rate limit exceeded",
    "code": "RATE_LIMIT_EXCEEDED",
    "requestId": "string",
    "timestamp": "string (ISO date)",
    "retryAfter": 60
  }
}
```

## 🔍 Example Requests

### Basic Request
```bash
curl -X GET "https://api.skytrack.com/api/organizations/64abc123def456/instructors" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json"
```

### Search by Email
```bash
curl -X GET "https://api.skytrack.com/api/organizations/64abc123def456/instructors?search=john.doe@example.com" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json"
```

### Filter by Status and Certification
```bash
curl -X GET "https://api.skytrack.com/api/organizations/64abc123def456/instructors?status=Active&certification=CFI" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json"
```

### Filter by Flight Hours Range
```bash
curl -X GET "https://api.skytrack.com/api/organizations/64abc123def456/instructors?minFlightHours=1000&maxFlightHours=5000" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json"
```

### Search with Pagination
```bash
curl -X GET "https://api.skytrack.com/api/organizations/64abc123def456/instructors?search=CFI&page=2&limit=25&sortField=contact_email&sortDirection=asc" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json"
```

### Filter by Availability and Utilization
```bash
curl -X GET "https://api.skytrack.com/api/organizations/64abc123def456/instructors?availability=Full-time&minUtilization=80" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json"
```

## 🚨 Error Codes Reference
- `INVALID_ORGANIZATION_ID`: Invalid organization ID format
- `INVALID_PAGINATION`: Invalid pagination parameters
- `AUTHENTICATION_FAILED`: Invalid or expired token
- `ACCESS_DENIED`: Insufficient permissions or blocked by security policy
- `RATE_LIMIT_EXCEEDED`: Too many requests
- `HIGH_RISK_BLOCKED`: Request blocked due to high risk score

## 📊 Search Features

### Intelligent Search Ranking
The search functionality uses a sophisticated scoring system to rank results by relevance:

1. **Exact Email Match** (Score: 100) - Highest priority
2. **Email Starts With** (Score: 50) - High priority
3. **Email Contains** (Score: 25) - Medium priority
4. **License Number Match** (Score: 20) - Medium priority
5. **Name Matches** (Score: 15 each) - Medium priority
6. **Status Match** (Score: 10) - Lower priority
7. **Availability Match** (Score: 5) - Lower priority

### Search Fields
The search term is matched against:
- Contact email (exact, starts-with, contains)
- License number
- Phone number
- Status
- Availability
- Notes (if search term > 2 characters)
- Certifications (array search)
- Specialties (array search)
- Flight hours, teaching hours, student count (numeric search)
- User first name, last name, email
- Full name (concatenated first + last name)

### Search Suggestions
When a search term is provided, the response includes `searchSuggestions` with up to 10 relevant suggestions based on:
- Matching email addresses
- Matching license numbers
- Matching statuses
- Matching certifications
- Matching specialties

## 🔧 Filter Options

### Available Filters
- **Status**: Filter by instructor status (Active, Inactive, etc.)
- **Certification**: Filter by specific certification (CFI, CFII, MEI, etc.)
- **Specialty**: Filter by specific specialty (Primary, Instrument, Multi-Engine, etc.)
- **Availability**: Filter by availability type (Full-time, Part-time, etc.)
- **Flight Hours**: Range filter for minimum/maximum flight hours
- **Teaching Hours**: Range filter for minimum/maximum teaching hours
- **Utilization**: Range filter for minimum/maximum utilization percentage
- **Emergency Contact**: Filter by presence/absence of emergency contact
- **Notes**: Filter by presence/absence of notes

### Unique Values
The response includes `uniqueStatuses`, `uniqueCertifications`, `uniqueSpecialties`, and `uniqueAvailabilities` arrays containing all available values for building filter UI components.

## 📈 Pagination Information
The response includes comprehensive pagination information:
- `currentPage`: Current page number
- `totalPages`: Total number of pages
- `totalCount`: Total number of matching records
- `hasNextPage`: Whether there's a next page
- `hasPrevPage`: Whether there's a previous page
- `limit`: Number of results per page 
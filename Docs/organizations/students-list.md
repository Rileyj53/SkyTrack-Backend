# GET /api/organizations/{organizationId}/students

## 🎯 Overview
Retrieves a list of students for the specified organization with comprehensive filtering, search, and pagination capabilities. Supports both flight school students and flight club members.

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
**Path**: `/api/organizations/{organizationId}/students`

### Path Parameters
- `organizationId` (string, required): The unique identifier of the organization

### Query Parameters
- `page` (number, optional): Page number for pagination (default: 1)
- `limit` (number, optional): Number of records per page (default: 50, max: 200)
- `search` (string, optional): Search across student information including name, email, phone, etc.
- `status` (string, optional): Filter by student status (e.g., "Active", "Inactive", "Graduated")
- `program` (string, optional): Filter by program name (case-insensitive partial match)
- `certification` (string, optional): Filter by certification type (e.g., "private", "instrument")
- `enrollment_start_date` (string, optional): Filter students enrolled from this date (YYYY-MM-DD format)
- `enrollment_end_date` (string, optional): Filter students enrolled before this date (YYYY-MM-DD format)
- `stage` (string, optional): Filter by current training stage (case-insensitive partial match)
- `milestone` (string, optional): Filter by next milestone (case-insensitive partial match)
- `license_number` (string, optional): Filter by license number (case-insensitive partial match)
- `phone` (string, optional): Filter by phone number (case-insensitive partial match)
- `has_emergency_contact` (string, optional): Filter by emergency contact presence ("true" or "false")
- `has_notes` (string, optional): Filter by notes presence ("true" or "false")
- `sortField` (string, optional): Field to sort by (default: "enrollmentDate")
- `sortDirection` (string, optional): Sort direction - "asc" or "desc" (default: "desc")

### Headers
- `Authorization: Bearer <token>` (required): JWT authentication token
- `X-API-Key: <key>` (required): Valid API key

## 📤 Response

### Success Response (200)
```json
{
  "success": true,
  "message": "Students retrieved successfully",
  "data": {
    "students": [
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
        "enrollmentDate": "string (ISO date)",
        "program": "string (optional)",
        "status": "string",
        "stage": "string",
        "nextMilestone": "string",
        "notes": "string",
        "progress": {
          "requirements": [
            {
              "name": "string",
              "total_hours": "number",
              "completed_hours": "number",
              "type": "string"
            }
          ],
          "milestones": [
            {
              "name": "string",
              "description": "string",
              "order": "number",
              "completed": "boolean"
            }
          ],
          "stages": [
            {
              "name": "string",
              "description": "string",
              "order": "number",
              "completed": "boolean"
            }
          ],
          "lastUpdated": "string (ISO date)"
        },
        "studentNotes": [
          {
            "note": "string",
            "type": "string",
            "created_at": "string (ISO date)",
            "updated_at": "string (ISO date)"
          }
        ],
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
      "limit": "number"
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

## 🔍 Search Functionality

The `search` parameter performs a comprehensive text search across all student data:

### **Searchable Fields:**
- **User Information**: `first_name`, `last_name`, `email`
- **Student Information**: `contact_email`, `phone`, `license_number`, `program`, `status`, `stage`, `nextMilestone`, `notes`
- **Emergency Contact**: `emergency_contact.name`, `emergency_contact.phone`
- **Full Name**: Searches for concatenated first and last names

### **Search Examples:**
```bash
# Search for students by name
GET /api/organizations/687c208d97e9217fc09e7c40/students?search=David Brown

# Search for students by email
GET /api/organizations/687c208d97e9217fc09e7c40/students?search=student1@albatrossflight.com

# Search for students by phone number
GET /api/organizations/687c208d97e9217fc09e7c40/students?search=555-123-4567

# Search for students by program
GET /api/organizations/687c208d97e9217fc09e7c40/students?search=Private Pilot
```

## 🔍 Filtering Examples

### **Basic Filtering:**
```bash
# Filter by status
GET /api/organizations/687c208d97e9217fc09e7c40/students?status=Active

# Filter by program
GET /api/organizations/687c208d97e9217fc09e7c40/students?program=Instrument Rating

# Filter by certification
GET /api/organizations/687c208d97e9217fc09e7c40/students?certification=private
```

### **Date Filtering:**
```bash
# Filter by enrollment date range
GET /api/organizations/687c208d97e9217fc09e7c40/students?enrollment_start_date=2023-01-01&enrollment_end_date=2023-12-31

# Filter students enrolled in 2023
GET /api/organizations/687c208d97e9217fc09e7c40/students?enrollment_start_date=2023-01-01&enrollment_end_date=2023-12-31
```

### **Advanced Filtering:**
```bash
# Filter by training stage
GET /api/organizations/687c208d97e9217fc09e7c40/students?stage=Pre-Solo

# Filter by next milestone
GET /api/organizations/687c208d97e9217fc09e7c40/students?milestone=First Solo

# Filter by license number
GET /api/organizations/687c208d97e9217fc09e7c40/students?license_number=STU001

# Filter by phone number
GET /api/organizations/687c208d97e9217fc09e7c40/students?phone=555-123
```

### **Boolean Filtering:**
```bash
# Filter students with emergency contact
GET /api/organizations/687c208d97e9217fc09e7c40/students?has_emergency_contact=true

# Filter students without emergency contact
GET /api/organizations/687c208d97e9217fc09e7c40/students?has_emergency_contact=false

# Filter students with notes
GET /api/organizations/687c208d97e9217fc09e7c40/students?has_notes=true

# Filter students without notes
GET /api/organizations/687c208d97e9217fc09e7c40/students?has_notes=false
```

### **Combined Filtering:**
```bash
# Active students in Private Pilot program with emergency contact
GET /api/organizations/687c208d97e9217fc09e7c40/students?status=Active&program=Private Pilot&has_emergency_contact=true

# Students in Pre-Solo stage with notes, sorted by enrollment date
GET /api/organizations/687c208d97e9217fc09e7c40/students?stage=Pre-Solo&has_notes=true&sortField=enrollmentDate&sortDirection=desc
```

## 🔍 Example Requests

### Basic Request
```bash
curl -X GET "https://api.skytrack.com/api/organizations/687c208d97e9217fc09e7c40/students" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "X-API-Key: your-api-key"
```

### Request with Search and Filtering
```bash
curl -X GET "https://api.skytrack.com/api/organizations/687c208d97e9217fc09e7c40/students?search=David&status=Active&program=Private Pilot&page=1&limit=20" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "X-API-Key: your-api-key"
```

### Request with Date Filtering
```bash
curl -X GET "https://api.skytrack.com/api/organizations/687c208d97e9217fc09e7c40/students?enrollment_start_date=2023-01-01&enrollment_end_date=2023-12-31&sortField=enrollmentDate&sortDirection=asc" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "X-API-Key: your-api-key"
```

## 🚨 Error Codes Reference
- `INVALID_ORGANIZATION_ID`: Invalid organization ID format
- `INVALID_PAGINATION`: Invalid pagination parameters
- `AUTHENTICATION_FAILED`: Invalid or expired token
- `ACCESS_DENIED`: Insufficient permissions or blocked by security policy
- `RATE_LIMIT_EXCEEDED`: Too many requests
- `HIGH_RISK_BLOCKED`: Request blocked due to high risk score

## 📋 Role-Based Access Control

- **Instructors**: Can view students in their organization
- **School Admins**: Can view all students in their organization
- **System Admins**: Can view all students across all organizations

## 📊 Available Sort Fields

- `enrollmentDate` (default): Sort by enrollment date
- `contact_email`: Sort by contact email
- `program`: Sort by program name
- `status`: Sort by student status
- `stage`: Sort by current training stage
- `nextMilestone`: Sort by next milestone
- `license_number`: Sort by license number
- `createdAt`: Sort by creation date
- `updatedAt`: Sort by last update date

## 📋 Usage Notes

### Flight Schools vs Flight Clubs
- **Flight Schools**: Students will have a `program` field with progress tracking
- **Flight Clubs**: Members may not have a `program` field and won't have progress tracking

### Search Performance
- Search uses MongoDB aggregation pipeline for optimal performance
- Complex searches with multiple filters are optimized for large datasets
- Results are automatically sorted and paginated for efficient data retrieval

### Data Population
- User information is automatically populated for students with linked user accounts
- Progress tracking data is included for students enrolled in programs
- Emergency contact and notes are included when available 
# POST /api/organizations/{organizationId}/students

## 🎯 Overview
Creates a new student or member record for the specified organization. This endpoint supports both flight schools (with programs) and flight clubs (with members). For flight schools, a program is required to track student progress. For flight clubs, members can be created without a program.

## 🔐 Security
- **Requires Auth**: ✅ (JWT Bearer token)
- **Requires API Key**: ✅ (X-API-Key header)
- **Requires CSRF Token**: ✅ (X-CSRF-Token header)
- **Allowed Roles**: `['sys_admin', 'school_admin']`
- **Organization Access Required**: ✅ (must have access to specified organization)
- **Fraud Detection**: ✅ Enabled
- **Risk Scoring**: ✅ Enabled
- **Data Classification**: `confidential`
- **Rate Limiting**: 50 requests per minute

## 📥 Request

**Method**: `POST`  
**Path**: `/api/organizations/{organizationId}/students`

### Path Parameters
- `organizationId` (string, required): The unique identifier of the organization

### Headers
- `Authorization: Bearer <token>` (required): JWT authentication token
- `X-API-Key: <key>` (required): Valid API key
- `X-CSRF-Token: <token>` (required): CSRF protection token
- `Content-Type: application/json` (required)

### Body Schema
```json
{
  "contact_email": "string (required, valid email format)",
  "phone": "string (optional, format: 555-555-1234)",
  "certifications": ["string (optional, enum: private, instrument, commercial, multi-engine, cfi, cfii, mei, atp)"],
  "license_number": "string (optional)",
  "emergency_contact": {
    "name": "string (required if emergency_contact provided)",
    "relationship": "string (required if emergency_contact provided)",
    "phone": "string (required if emergency_contact provided, format: 555-555-1234)"
  },
  "enrollmentDate": "string (optional, ISO date format, defaults to current date)",
  "program": "string (optional, required for flight schools, not needed for flight clubs)",
  "status": "string (optional, enum: Active, Inactive, Graduated, On Hold, Discontinued, defaults to Active)",
  "stage": "string (optional)",
  "nextMilestone": "string (optional)",
  "notes": "string (optional)",
  "studentNotes": [
    {
      "author_id": "string (required)",
      "author_name": "string (required)",
      "type": "string (required, enum: flight, ground, medical, other)",
      "title": "string (required)",
      "content": "string (required)",
      "tags": ["string (optional)"],
      "is_private": "boolean (optional, defaults to false)",
      "attachments": [
        {
          "name": "string (required)",
          "url": "string (required)",
          "type": "string (optional)"
        }
      ]
    }
  ]
}
```

## 📤 Response

### Success Response (201)
```json
{
  "success": true,
  "message": "Student created successfully" | "Member created successfully",
  "data": {
    "student": {
      "_id": "string",
      "organization_id": "string",
      "user_id": "string (optional)",
      "contact_email": "string",
      "phone": "string (optional)",
      "certifications": ["string"],
      "license_number": "string (optional)",
      "emergency_contact": {
        "name": "string",
        "relationship": "string",
        "phone": "string"
      },
      "enrollmentDate": "string (ISO date)",
      "program": "string (optional)",
      "status": "string",
      "stage": "string (optional)",
      "nextMilestone": "string (optional)",
      "notes": "string (optional)",
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
            "completed": "boolean",
            "completedDate": "string (optional, ISO date)"
          }
        ],
        "stages": [
          {
            "name": "string",
            "description": "string",
            "order": "number",
            "completed": "boolean",
            "completedDate": "string (optional, ISO date)"
          }
        ],
        "lastUpdated": "string (ISO date)"
      },
      "studentNotes": [
        {
          "_id": "string",
          "student_id": "string",
          "author_id": "string",
          "author_name": "string",
          "type": "string",
          "title": "string",
          "content": "string",
          "tags": ["string"],
          "is_private": "boolean",
          "attachments": [
            {
              "name": "string",
              "url": "string",
              "type": "string"
            }
          ],
          "created_at": "string (ISO date)",
          "updated_at": "string (ISO date)"
        }
      ],
      "created_at": "string (ISO date)",
      "updated_at": "string (ISO date)"
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
    "message": "Missing required field: contact_email is required",
    "code": "MISSING_REQUIRED_FIELDS",
    "requestId": "string",
    "timestamp": "string (ISO date)"
  }
}
```

```json
{
  "error": {
    "message": "Invalid email format",
    "code": "INVALID_EMAIL_FORMAT",
    "requestId": "string",
    "timestamp": "string (ISO date)"
  }
}
```

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

#### 404 - Not Found
```json
{
  "error": {
    "message": "Program not found for this organization",
    "code": "PROGRAM_NOT_FOUND",
    "requestId": "string",
    "timestamp": "string (ISO date)"
  }
}
```

#### 409 - Conflict
```json
{
  "error": {
    "message": "A student with this email already exists in this organization",
    "code": "DUPLICATE_STUDENT_EMAIL",
    "requestId": "string",
    "timestamp": "string (ISO date)"
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

### Flight School Student (with program)
```bash
curl -X POST "https://api.skytrack.com/api/organizations/64abc123def456/students" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "X-API-Key: your-api-key" \
  -H "X-CSRF-Token: csrf-token" \
  -H "Content-Type: application/json" \
  -d '{
    "contact_email": "john.doe@example.com",
    "phone": "555-123-4567",
    "certifications": ["private"],
    "license_number": "123456789",
    "emergency_contact": {
      "name": "Jane Doe",
      "relationship": "Spouse",
      "phone": "555-987-6543"
    },
    "program": "Private Pilot Training",
    "status": "Active",
    "notes": "New student starting private pilot training"
  }'
```

### Flight Club Member (without program)
```bash
curl -X POST "https://api.skytrack.com/api/organizations/64abc123def456/students" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "X-API-Key: your-api-key" \
  -H "X-CSRF-Token: csrf-token" \
  -H "Content-Type: application/json" \
  -d '{
    "contact_email": "member@example.com",
    "phone": "555-456-7890",
    "certifications": ["private", "instrument"],
    "license_number": "987654321",
    "emergency_contact": {
      "name": "John Smith",
      "relationship": "Emergency Contact",
      "phone": "555-111-2222"
    },
    "status": "Active",
    "notes": "New club member"
  }'
```

## 🚨 Error Codes Reference
- `MISSING_REQUIRED_FIELDS`: Required field is missing
- `INVALID_EMAIL_FORMAT`: Email format is invalid
- `INVALID_ORGANIZATION_ID`: Organization ID format is invalid
- `AUTHENTICATION_FAILED`: Invalid or expired token
- `ACCESS_DENIED`: Insufficient permissions or blocked by security policy
- `PROGRAM_NOT_FOUND`: Specified program does not exist in the organization
- `DUPLICATE_STUDENT_EMAIL`: Email already exists in organization
- `RATE_LIMIT_EXCEEDED`: Too many requests
- `HIGH_RISK_BLOCKED`: Request blocked due to high risk score

## 📋 Usage Notes

### Flight Schools vs Flight Clubs
- **Flight Schools**: Provide a `program` field to track student progress through structured training programs
- **Flight Clubs**: Omit the `program` field to create members without structured training requirements

### Progress Tracking
- When a `program` is provided, the system automatically initializes progress tracking with:
  - Program requirements (hours, milestones, stages)
  - Initial stage and milestone from the program
  - Progress tracking structure
- When no `program` is provided, no progress tracking is initialized

### Email Uniqueness
- Email addresses must be unique within each organization
- The system automatically converts emails to lowercase for consistency

### Phone Number Format
- All phone numbers must follow the format: `555-555-1234`
- This applies to both the main phone and emergency contact phone

### Status Options
- `Active`: Currently enrolled/active member
- `Inactive`: Temporarily inactive
- `Graduated`: Completed program
- `On Hold`: Temporarily suspended
- `Discontinued`: Permanently left the organization 
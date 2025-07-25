# Individual Student Management API

## 🎯 Overview
Manage individual student records with support for flexible ID lookup. This endpoint supports both student ID and user ID for maximum convenience.

## 🔐 Security
- **Requires Auth**: ✅ (JWT Bearer token)
- **Requires API Key**: ✅ (X-API-Key header)
- **Requires CSRF Token**: Varies by operation (GET: ❌, PUT/DELETE: ✅)
- **Allowed Roles**: 
  - GET: `['sys_admin', 'school_admin', 'instructor', 'student', 'mechanic', 'member']`
  - PUT: `['sys_admin', 'school_admin', 'instructor', 'student', 'mechanic', 'member']`
  - DELETE: `['sys_admin', 'school_admin']`
- **Organization Access Required**: ✅ (must have access to specified organization)
- **Fraud Detection**: ✅ Enabled
- **Risk Scoring**: ✅ Enabled
- **Data Classification**: `confidential`
- **Rate Limiting**: 100 requests per minute

---

# GET /api/organizations/{organizationId}/students/{id}

## 🎯 Overview
Retrieve detailed information about a specific student. The `{id}` parameter can be either:
- **Student ID**: The MongoDB ObjectId of the student record
- **User ID**: The MongoDB ObjectId of the associated user account

This flexible approach allows you to fetch student data even when you only have the user ID.

## 📥 Request

**Method**: `GET`  
**Path**: `/api/organizations/{organizationId}/students/{id}`

### Path Parameters
- `organizationId` (string, required): The unique identifier of the organization
- `id` (string, required): Either the student ID or user ID (MongoDB ObjectId format)

### Headers
- `Authorization: Bearer <token>` (required): JWT authentication token
- `X-API-Key: <key>` (required): Valid API key

## 📤 Response

### Success Response (200)
```json
{
  "success": true,
  "message": "Student retrieved successfully",
  "data": {
    "_id": "674a1b2c3d4e5f6789012345",
    "organization_id": "674a1b2c3d4e5f6789012346",
    "user_id": {
      "_id": "674a1b2c3d4e5f6789012347",
      "first_name": "John",
      "last_name": "Doe",
      "email": "john.doe@example.com",
      "role": "student"
    },
    "contact_email": "john.doe@student.com",
    "phone": "+1-555-123-4567",
    "certifications": ["private", "instrument"],
    "license_number": "PPL123456",
    "emergency_contact": {
      "name": "Jane Doe",
      "relationship": "Mother",
      "phone": "+1-555-987-6543",
      "email": "jane.doe@example.com"
    },
    "enrollmentDate": "2024-01-15T00:00:00.000Z",
    "program": "Private Pilot Training",
    "status": "Active",
    "stage": "Cross Country Training",
    "nextMilestone": "Solo Cross Country",
    "notes": "Excellent progress, ready for solo flights",
    "progress": {
      "requirements": [
        {
          "name": "Dual Flight Time",
          "total_hours": 40,
          "completed_hours": 25,
          "type": "flight_time"
        }
      ],
      "milestones": [
        {
          "name": "First Solo",
          "description": "Complete first solo flight",
          "order": 1,
          "completed": true
        }
      ]
    },
    "studentNotes": [
      {
        "_id": "674a1b2c3d4e5f6789012348",
        "date": "2024-01-20T10:30:00.000Z",
        "note": "Great landing practice today",
        "instructor": "CFI Smith",
        "type": "training"
      }
    ],
    "created_at": "2024-01-15T08:00:00.000Z",
    "updated_at": "2024-01-20T15:30:00.000Z"
  },
  "auditId": "audit_67891234567890abcdef1234",
  "timestamp": "2024-01-20T15:30:00.000Z",
  "searchInfo": {
    "providedId": "674a1b2c3d4e5f6789012347",
    "foundBy": "user_id",
    "studentId": "674a1b2c3d4e5f6789012345",
    "userId": "674a1b2c3d4e5f6789012347"
  }
}
```

### Error Responses

#### 400 - Bad Request
```json
{
  "error": {
    "message": "Invalid ID format - must be a valid ObjectId",
    "code": "INVALID_ID_FORMAT",
    "requestId": "audit_67891234567890abcdef1234",
    "timestamp": "2024-01-20T15:30:00.000Z"
  }
}
```

#### 404 - Not Found
```json
{
  "error": {
    "message": "Student not found in this organization. The provided ID was not found as either a student ID or user ID.",
    "code": "STUDENT_NOT_FOUND",
    "requestId": "audit_67891234567890abcdef1234",
    "timestamp": "2024-01-20T15:30:00.000Z",
    "details": {
      "providedId": "674a1b2c3d4e5f6789012347",
      "searchedBy": ["student_id", "user_id"],
      "organizationId": "674a1b2c3d4e5f6789012346"
    }
  }
}
```

#### 403 - Forbidden (Students accessing other records)
```json
{
  "error": {
    "message": "Students can only access their own records",
    "code": "INSUFFICIENT_PERMISSIONS",
    "requestId": "audit_67891234567890abcdef1234",
    "timestamp": "2024-01-20T15:30:00.000Z"
  }
}
```

## 🔍 Example Requests

### Using Student ID
```bash
curl -X GET "https://api.skytrack.com/api/organizations/674a1b2c3d4e5f6789012346/students/674a1b2c3d4e5f6789012345" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "X-API-Key: your-api-key"
```

### Using User ID
```bash
curl -X GET "https://api.skytrack.com/api/organizations/674a1b2c3d4e5f6789012346/students/674a1b2c3d4e5f6789012347" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "X-API-Key: your-api-key"
```

---

# PUT /api/organizations/{organizationId}/students/{id}

## 🎯 Overview
Update a student record. The `{id}` parameter supports both student ID and user ID lookup.

## 📥 Request

**Method**: `PUT`  
**Path**: `/api/organizations/{organizationId}/students/{id}`

### Path Parameters
- `organizationId` (string, required): The unique identifier of the organization
- `id` (string, required): Either the student ID or user ID (MongoDB ObjectId format)

### Headers
- `Authorization: Bearer <token>` (required): JWT authentication token
- `X-API-Key: <key>` (required): Valid API key
- `X-CSRF-Token: <token>` (required): CSRF protection token

### Body Schema
```json
{
  "contact_email": "string (optional, valid email format)",
  "phone": "string (optional)",
  "certifications": "array (optional, array of certification types)",
  "license_number": "string (optional)",
  "emergency_contact": {
    "name": "string",
    "relationship": "string",
    "phone": "string",
    "email": "string"
  },
  "enrollmentDate": "string (optional, ISO date format)",
  "program": "string (optional)",
  "status": "string (optional)",
  "stage": "string (optional)",
  "nextMilestone": "string (optional)",
  "notes": "string (optional)",
  "progress": "object (optional)",
  "studentNotes": "array (optional)"
}
```

## 📤 Response

### Success Response (200)
```json
{
  "success": true,
  "message": "Student updated successfully",
  "data": {
    "student": {
      // Updated student object
    }
  },
  "auditId": "audit_67891234567890abcdef1234",
  "timestamp": "2024-01-20T15:30:00.000Z",
  "searchInfo": {
    "providedId": "674a1b2c3d4e5f6789012347",
    "foundBy": "user_id",
    "studentId": "674a1b2c3d4e5f6789012345",
    "userId": "674a1b2c3d4e5f6789012347"
  }
}
```

### Error Responses
Similar to GET endpoint, plus validation errors for invalid data.

## 🔍 Example Request
```bash
curl -X PUT "https://api.skytrack.com/api/organizations/674a1b2c3d4e5f6789012346/students/674a1b2c3d4e5f6789012347" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "X-API-Key: your-api-key" \
  -H "X-CSRF-Token: csrf-token" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "Active",
    "stage": "Advanced Maneuvers",
    "nextMilestone": "Checkride Preparation"
  }'
```

---

# DELETE /api/organizations/{organizationId}/students/{id}

## 🎯 Overview
Delete a student record. The `{id}` parameter supports both student ID and user ID lookup.

**⚠️ Warning**: This operation permanently removes the student record and cannot be undone.

## 📥 Request

**Method**: `DELETE`  
**Path**: `/api/organizations/{organizationId}/students/{id}`

### Path Parameters
- `organizationId` (string, required): The unique identifier of the organization
- `id` (string, required): Either the student ID or user ID (MongoDB ObjectId format)

### Headers
- `Authorization: Bearer <token>` (required): JWT authentication token
- `X-API-Key: <key>` (required): Valid API key
- `X-CSRF-Token: <token>` (required): CSRF protection token

## 📤 Response

### Success Response (200)
```json
{
  "success": true,
  "message": "Student deleted successfully",
  "data": {
    "student_id": "674a1b2c3d4e5f6789012345"
  },
  "auditId": "audit_67891234567890abcdef1234",
  "timestamp": "2024-01-20T15:30:00.000Z",
  "searchInfo": {
    "providedId": "674a1b2c3d4e5f6789012347",
    "foundBy": "user_id",
    "studentId": "674a1b2c3d4e5f6789012345",
    "userId": "674a1b2c3d4e5f6789012347"
  }
}
```

## 🔍 Example Request
```bash
curl -X DELETE "https://api.skytrack.com/api/organizations/674a1b2c3d4e5f6789012346/students/674a1b2c3d4e5f6789012347" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "X-API-Key: your-api-key" \
  -H "X-CSRF-Token: csrf-token"
```

---

## 🚨 Error Codes Reference

- `INVALID_ID_FORMAT`: Provided ID is not a valid MongoDB ObjectId
- `STUDENT_NOT_FOUND`: Student not found by either student ID or user ID
- `INSUFFICIENT_PERMISSIONS`: User lacks permission for the operation
- `INVALID_EMAIL_FORMAT`: Invalid email format in update request
- `AUTHENTICATION_FAILED`: Invalid or expired token
- `RATE_LIMIT_EXCEEDED`: Too many requests

## 🔄 ID Lookup Logic

The endpoint uses a two-step lookup process:

1. **Step 1**: Try to find student by `_id` field (student ID)
2. **Step 2**: If not found, try to find student by `user_id` field (user ID)
3. **Result**: Return the student if found by either method

This approach provides maximum flexibility while maintaining security and performance.

## 🎯 Access Control

- **System Admins**: Full access to all operations
- **School Admins**: Full access within their organization
- **Instructors**: Read/update access within their organization
- **Students**: Read/update access to their own records only
- **Mechanics/Members**: Read/update access within their organization

## 📊 Response Enhancement

The `searchInfo` object in successful responses provides transparency about how the student was found:
- `providedId`: The original ID provided in the request
- `foundBy`: Whether the student was found by "student_id" or "user_id"
- `studentId`: The actual student record ID
- `userId`: The associated user account ID

This information is helpful for debugging and understanding the lookup process. 
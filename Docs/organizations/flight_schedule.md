# GET /api/organizations/{organizationId}/flight_schedule

## 🎯 Overview
Retrieves a list of flight schedules for the specified organization with comprehensive filtering, search, and pagination capabilities.

## 🔐 Security
- **Requires Auth**: ✅ (JWT Bearer token)
- **Requires API Key**: ✅ (X-API-Key header)
- **Requires CSRF Token**: ✅ (X-CSRF-Token header)
- **Allowed Roles**: `['sys_admin', 'school_admin', 'instructor', 'student']`
- **Organization Access Required**: ✅ (must have access to specified organization)
- **Fraud Detection**: ✅ Enabled
- **Risk Scoring**: ✅ Enabled
- **Data Classification**: `confidential`
- **Rate Limiting**: 100 requests per minute

## 📥 Request

**Method**: `GET`  
**Path**: `/api/organizations/{organizationId}/flight_schedule`

### Path Parameters
- `organizationId` (string, required): The unique identifier of the organization

### Query Parameters
- `page` (number, optional): Page number for pagination (default: 1)
- `limit` (number, optional): Number of records per page (default: 50, max: 100)
- `status` (string, optional): Filter by flight status (e.g., "scheduled", "completed", "canceled")
- `start_date` (string, optional): Filter flights starting from this date (YYYY-MM-DD format)
- `end_date` (string, optional): Filter flights ending before this date (YYYY-MM-DD format)
- `plane_id` (string, optional): Filter by specific plane ID
- `instructor_id` (string, optional): Filter by specific instructor ID
- `student_id` (string, optional): Filter by specific student ID
- `search` (string, optional): **NEW** - Search across all flight schedule data including plane, student, and instructor information
- `sortField` (string, optional): Field to sort by (default: "scheduled_start_time")
- `sortDirection` (string, optional): Sort direction - "asc" or "desc" (default: "asc")
- `statusOrder` (string, optional): Custom status ordering (default: "In-progress,Scheduled,Completed,Canceled")

### Headers
- `Authorization: Bearer <token>` (required): JWT authentication token
- `X-API-Key: <key>` (required): Valid API key
- `X-CSRF-Token: <token>` (required): CSRF protection token

## 📤 Response

### Success Response (200)
```json
{
  "success": true,
  "message": "Flight schedules retrieved successfully",
  "data": {
    "schedules": [
      {
        "_id": "string",
        "organization_id": {
          "_id": "string",
          "name": "string",
          "address": "string",
          "airport": "string",
          "phone": "string",
          "email": "string"
        },
        "plane_id": {
          "_id": "string",
          "registration": "string",
          "type": "string",
          "aircraftModel": "string",
          "status": "string"
        },
        "instructor_id": {
          "_id": "string",
          "contact_email": "string",
          "status": "string",
          "flightHours": "number",
          "user_id": {
            "_id": "string",
            "first_name": "string",
            "last_name": "string",
            "email": "string"
          }
        },
        "student_id": {
          "_id": "string",
          "contact_email": "string",
          "program": "string",
          "status": "string",
          "enrollmentDate": "string",
          "user_id": {
            "_id": "string",
            "first_name": "string",
            "last_name": "string",
            "email": "string"
          }
        },
        "scheduled_start_time": "string (ISO date)",
        "scheduled_end_time": "string (ISO date)",
        "actual_start_time": "string (ISO date, optional)",
        "actual_end_time": "string (ISO date, optional)",
        "flight_type": "string",
        "status": "string",
        "notes": "string (optional)",
        "createdAt": "string (ISO date)",
        "updatedAt": "string (ISO date)"
      }
    ],
    "pagination": {
      "page": "number",
      "limit": "number",
      "total": "number",
      "pages": "number"
    },
    "search": {
      "term": "string",
      "resultsFound": "number",
      "originalTotal": "number"
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
  }
}
```

#### 404 - Not Found
```json
{
  "error": {
    "message": "Student/Instructor record not found",
    "code": "STUDENT_NOT_FOUND|INSTRUCTOR_NOT_FOUND",
    "requestId": "string",
    "timestamp": "string (ISO date)"
  }
}
```

## 🔍 Search Functionality

The `search` parameter performs a comprehensive text search across all flight schedule data:

### **Searchable Fields:**
- **Flight Schedule**: `flight_type`, `status`, `notes`
- **Plane Information**: `registration`, `type`, `aircraftModel`, `status`
- **Instructor Information**: `contact_email`, `status`, `flightHours`, `first_name`, `last_name`, `email`
- **Student Information**: `contact_email`, `program`, `status`, `enrollmentDate`, `first_name`, `last_name`, `email`
- **Organization Information**: `name`, `address`, `airport`, `phone`, `email`

### **Search Examples:**
```bash
# Search for flights with "Training" in flight type or notes
GET /api/organizations/687c208d97e9217fc09e7c40/flight_schedule?search=Training

# Search for flights involving a specific student by name
GET /api/organizations/687c208d97e9217fc09e7c40/flight_schedule?search=David Brown

# Search for flights with a specific plane registration
GET /api/organizations/687c208d97e9217fc09e7c40/flight_schedule?search=N12345

# Search for flights with a specific instructor by email
GET /api/organizations/687c208d97e9217fc09e7c40/flight_schedule?search=instructor1@albatrossflight.com

# Search for flights with "Solo" in flight type
GET /api/organizations/687c208d97e9217fc09e7c40/flight_schedule?search=Solo
```

### **Filtering Examples:**
```bash
# Filter by specific student ID
GET /api/organizations/687c208d97e9217fc09e7c40/flight_schedule?student_id=687c4f0c071a9fe822d33620

# Filter by specific instructor ID
GET /api/organizations/687c208d97e9217fc09e7c40/flight_schedule?instructor_id=687c55f3071a9fe822d337b0

# Filter by specific plane ID
GET /api/organizations/687c208d97e9217fc09e7c40/flight_schedule?plane_id=687efa9e3d4c554ecf7ee538

# Filter by flight status
GET /api/organizations/687c208d97e9217fc09e7c40/flight_schedule?status=scheduled

# Combine multiple filters
GET /api/organizations/687c208d97e9217fc09e7c40/flight_schedule?student_id=687c4f0c071a9fe822d33620&status=scheduled&start_date=2025-07-21
```

## 🔍 Example Requests

### Basic Request
```bash
curl -X GET "https://api.skytrack.com/api/organizations/687c208d97e9217fc09e7c40/flight_schedule" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "X-API-Key: your-api-key" \
  -H "X-CSRF-Token: csrf-token"
```

### Request with Search
```bash
curl -X GET "https://api.skytrack.com/api/organizations/687c208d97e9217fc09e7c40/flight_schedule?search=Training&page=1&limit=20" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "X-API-Key: your-api-key" \
  -H "X-CSRF-Token: csrf-token"
```

### Request with Date Filtering
```bash
curl -X GET "https://api.skytrack.com/api/organizations/687c208d97e9217fc09e7c40/flight_schedule?start_date=2025-07-21&end_date=2025-07-22&status=scheduled" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "X-API-Key: your-api-key" \
  -H "X-CSRF-Token: csrf-token"
```

## 🚨 Error Codes Reference
- `INVALID_ORGANIZATION_ID`: Invalid organization ID format
- `AUTHENTICATION_FAILED`: Invalid or expired token
- `ACCESS_DENIED`: Insufficient permissions or blocked by security policy
- `STUDENT_NOT_FOUND`: Student record not found for authenticated user
- `INSTRUCTOR_NOT_FOUND`: Instructor record not found for authenticated user
- `RATE_LIMIT_EXCEEDED`: Too many requests
- `HIGH_RISK_BLOCKED`: Request blocked due to high risk score

## 📋 Role-Based Access Control

- **Students**: Can only view their own flight schedules
- **Instructors**: Can view schedules they're assigned to
- **School Admins**: Can view all schedules in their organization
- **System Admins**: Can view all schedules across all organizations 
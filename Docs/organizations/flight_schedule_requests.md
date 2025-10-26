# Flight Schedule Request System API Documentation

## 🎯 Overview
The Flight Schedule Request System allows students to request new flight schedules that require admin/instructor approval before being added to the organization's schedule. This provides a controlled workflow for schedule management while ensuring resource conflicts are avoided.

## 🔄 Request Workflow
1. **Student Request**: Students create flight schedule requests
2. **Admin Review**: School admins or instructors review pending requests
3. **Approval/Rejection**: Admins approve or reject requests with optional notes
4. **Schedule Creation**: Approved requests automatically create actual flight schedules

---

## 📋 GET /api/organizations/{organizationId}/flight_schedule/requests

### 🎯 Overview
Retrieves a list of flight schedule requests for the specified organization with filtering and pagination.

### 🔐 Security
- **Requires Auth**: ✅ (JWT Bearer token)
- **Requires API Key**: ✅ (X-API-Key header)
- **Requires CSRF Token**: ✅ (X-CSRF-Token header)
- **Allowed Roles**: `['sys_admin', 'school_admin', 'instructor', 'student']`
- **Organization Access Required**: ✅
- **Rate Limiting**: 50 requests per minute

### 📥 Request

**Method**: `GET`  
**Path**: `/api/organizations/{organizationId}/flight_schedule/requests`

#### Path Parameters
- `organizationId` (string, required): The unique identifier of the organization

#### Query Parameters
- `page` (number, optional): Page number for pagination (default: 1)
- `limit` (number, optional): Number of records per page (default: 50, max: 100)
- `status` (string, optional): Filter by request status (`pending`, `approved`, `rejected`)
- `start_date` (string, optional): Filter requests starting from this date (YYYY-MM-DD format)
- `end_date` (string, optional): Filter requests ending before this date (YYYY-MM-DD format)

#### Headers
- `Authorization: Bearer <token>` (required)
- `X-API-Key: <key>` (required)
- `X-CSRF-Token: <token>` (required)

### 📤 Response

#### Success Response (200)
```json
{
  "success": true,
  "message": "Flight schedule requests retrieved successfully",
  "data": {
    "requests": [
      {
        "_id": "string",
        "organization_id": {
          "_id": "string",
          "name": "string",
          "address": "string",
          "airport": "string"
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
          "user_id": {
            "_id": "string",
            "first_name": "string",
            "last_name": "string",
            "email": "string"
          }
        },
        "student_id": {
          "_id": "string",
          "user_id": {
            "_id": "string",
            "first_name": "string",
            "last_name": "string",
            "email": "string"
          }
        },
        "requested_by": {
          "_id": "string",
          "first_name": "string",
          "last_name": "string",
          "email": "string"
        },
        "approved_by": {
          "_id": "string",
          "first_name": "string",
          "last_name": "string",
          "email": "string"
        },
        "scheduled_start_time": "string (ISO date)",
        "scheduled_end_time": "string (ISO date)",
        "scheduled_duration": "number (hours)",
        "flight_type": "string",
        "status": "pending|approved|rejected",
        "request_notes": "string (optional)",
        "admin_notes": "string (optional)",
        "approved_at": "string (ISO date, optional)",
        "created_at": "string (ISO date)",
        "updated_at": "string (ISO date)"
      }
    ],
    "pagination": {
      "page": "number",
      "limit": "number",
      "total": "number",
      "pages": "number"
    }
  },
  "auditId": "string",
  "timestamp": "string (ISO date)"
}
```

### 📋 Role-Based Access Control
- **Students**: Can only view their own requests
- **Instructors**: Can view requests for flights they would be assigned to
- **School Admins**: Can view all requests in their organization
- **System Admins**: Can view all requests across all organizations

---

## ➕ POST /api/organizations/{organizationId}/flight_schedule/requests

### 🎯 Overview
Creates a new flight schedule request that requires admin approval.

### 🔐 Security
- **Requires Auth**: ✅ (JWT Bearer token)
- **Requires API Key**: ✅ (X-API-Key header)
- **Requires CSRF Token**: ✅ (X-CSRF-Token header)
- **Allowed Roles**: `['sys_admin', 'school_admin', 'instructor', 'student']`
- **Organization Access Required**: ✅
- **Rate Limiting**: 50 requests per minute

### 📥 Request

**Method**: `POST`  
**Path**: `/api/organizations/{organizationId}/flight_schedule/requests`

#### Path Parameters
- `organizationId` (string, required): The unique identifier of the organization

#### Headers
- `Authorization: Bearer <token>` (required)
- `X-API-Key: <key>` (required)
- `X-CSRF-Token: <token>` (required)
- `Content-Type: application/json` (required)

#### Request Body
```json
{
  "plane_id": "string (required)",
  "student_id": "string (required - either student_id OR user_id must be provided)",
  "user_id": "string (required - either student_id OR user_id must be provided)",
  "instructor_id": "string (optional)",
  "scheduled_start_time": "string (required, ISO date)",
  "scheduled_end_time": "string (required, ISO date)",
  "flight_type": "string (required)",
  "request_notes": "string (optional, max 1000 chars)"
}
```

**Note**: You can provide either `student_id` OR `user_id` (or both if they match). If `user_id` is provided, the system will automatically find the corresponding `student_id` for that user.

### 📤 Response

#### Success Response (201)
```json
{
  "success": true,
  "message": "Flight schedule request created successfully",
  "data": {
    "request": {
      "_id": "string",
      "organization_id": { /* populated organization data */ },
      "plane_id": { /* populated plane data */ },
      "instructor_id": { /* populated instructor data */ },
      "student_id": { /* populated student data */ },
      "requested_by": { /* populated user data */ },
      "scheduled_start_time": "string (ISO date)",
      "scheduled_end_time": "string (ISO date)",
      "scheduled_duration": "number (hours)",
      "flight_type": "string",
      "status": "pending",
      "request_notes": "string",
      "created_at": "string (ISO date)",
      "updated_at": "string (ISO date)"
    }
  },
  "auditId": "string",
  "timestamp": "string (ISO date)"
}
```

#### Error Responses

##### 400 - Bad Request
```json
{
  "error": {
    "message": "Either student_id or user_id is required",
    "code": "MISSING_STUDENT_REFERENCE",
    "requestId": "string",
    "timestamp": "string (ISO date)"
  }
}
```

```json
{
  "error": {
    "message": "Invalid user_id format",
    "code": "INVALID_USER_ID",
    "field": "user_id",
    "requestId": "string",
    "timestamp": "string (ISO date)"
  }
}
```

```json
{
  "error": {
    "message": "The provided student_id and user_id do not match",
    "code": "STUDENT_USER_MISMATCH",
    "requestId": "string",
    "timestamp": "string (ISO date)"
  }
}
```

```json
{
  "error": {
    "message": "Aircraft selection is required",
    "code": "MISSING_REQUIRED_FIELD",
    "field": "plane_id",
    "requestId": "string",
    "timestamp": "string (ISO date)"
  }
}
```

##### 404 - Student Not Found
```json
{
  "error": {
    "message": "No student record found for the provided user_id",
    "code": "STUDENT_NOT_FOUND_FOR_USER",
    "field": "user_id",
    "requestId": "string",
    "timestamp": "string (ISO date)"
  }
}
```

```json
{
  "error": {
    "message": "Student not found with the provided student_id",
    "code": "STUDENT_NOT_FOUND",
    "field": "student_id",
    "requestId": "string",
    "timestamp": "string (ISO date)"
  }
}
```

##### 403 - Unauthorized Student Request
```json
{
  "error": {
    "message": "Students can only create requests for themselves",
    "code": "UNAUTHORIZED_STUDENT_REQUEST",
    "requestId": "string",
    "timestamp": "string (ISO date)"
  }
}
```

##### 409 - Conflict
```json
{
  "error": {
    "message": "You already have a pending request for this time slot",
    "code": "EXISTING_REQUEST_CONFLICT",
    "requestId": "string",
    "timestamp": "string (ISO date)"
  }
}
```

### 🚨 Validation Rules
- Either `student_id` OR `user_id` must be provided (or both if they match)
- If `user_id` is provided, the system will find the corresponding `student_id`
- If both are provided, they must match the same student record
- Students can only create requests for themselves
- No overlapping pending requests for the same student
- No conflicts with existing approved schedules
- Flight end time must be after start time
- All required fields must be provided

---

## 🔍 GET /api/organizations/{organizationId}/flight_schedule/requests/{requestId}

### 🎯 Overview
Retrieves details of a specific flight schedule request.

### 📥 Request
**Method**: `GET`  
**Path**: `/api/organizations/{organizationId}/flight_schedule/requests/{requestId}`

#### Path Parameters
- `organizationId` (string, required): The unique identifier of the organization
- `requestId` (string, required): The unique identifier of the request

### 📤 Response
Same structure as the POST response, returning the specific request details.

---

## ✏️ PUT /api/organizations/{organizationId}/flight_schedule/requests/{requestId}

### 🎯 Overview
Updates a flight schedule request (approve/reject) - **Admin/Instructor only**.

### 🔐 Security
- **Allowed Roles**: `['sys_admin', 'school_admin', 'instructor']` only
- Students cannot update requests

### 📥 Request

**Method**: `PUT`  
**Path**: `/api/organizations/{organizationId}/flight_schedule/requests/{requestId}`

#### Request Body
```json
{
  "status": "approved|rejected (required)",
  "admin_notes": "string (optional, max 1000 chars)"
}
```

### 📤 Response

#### Success Response (200)
```json
{
  "success": true,
  "message": "Flight schedule request updated successfully",
  "data": {
    "request": {
      /* Updated request with new status and admin_notes */
      "status": "approved|rejected",
      "admin_notes": "string",
      "approved_by": { /* populated admin user data */ },
      "approved_at": "string (ISO date)"
    }
  },
  "auditId": "string",
  "timestamp": "string (ISO date)"
}
```

#### Error Responses

##### 400 - Already Processed
```json
{
  "error": {
    "message": "Flight schedule request has already been approved",
    "code": "REQUEST_ALREADY_PROCESSED",
    "requestId": "string",
    "timestamp": "string (ISO date)"
  }
}
```

##### 409 - Approval Conflict
```json
{
  "error": {
    "message": "Cannot approve: conflict detected with existing scheduled flight",
    "code": "APPROVAL_CONFLICT",
    "requestId": "string",
    "timestamp": "string (ISO date)"
  }
}
```

### ✅ Approval Process
When a request is **approved**:
1. System checks for conflicts with existing schedules
2. If no conflicts, creates an actual `FlightSchedule` record
3. Updates request status to "approved"
4. Records the approving admin and timestamp

When a request is **rejected**:
1. Updates request status to "rejected"
2. Records the rejecting admin and timestamp
3. No flight schedule is created

---

## 🗑️ DELETE /api/organizations/{organizationId}/flight_schedule/requests/{requestId}

### 🎯 Overview
Deletes a flight schedule request.

### 🔐 Security
- **Students**: Can delete their own pending requests only
- **Admins**: Can delete any requests

### 📥 Request
**Method**: `DELETE`  
**Path**: `/api/organizations/{organizationId}/flight_schedule/requests/{requestId}`

### 📤 Response
```json
{
  "success": true,
  "message": "Flight schedule request deleted successfully",
  "data": {
    "request_id": "string"
  },
  "auditId": "string",
  "timestamp": "string (ISO date)"
}
```

---

## 📋 Example Usage Workflow

### 1. Student Creates Request (using student_id)
```bash
curl -X POST "https://api.skytrack.com/api/organizations/687c208d97e9217fc09e7c40/flight_schedule/requests" \
  -H "Authorization: Bearer <token>" \
  -H "X-API-Key: <key>" \
  -H "X-CSRF-Token: <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "plane_id": "687efa9e3d4c554ecf7ee538",
    "student_id": "687c4f0c071a9fe822d33620",
    "instructor_id": "687c55f3071a9fe822d337b0",
    "scheduled_start_time": "2024-01-15T10:00:00.000Z",
    "scheduled_end_time": "2024-01-15T12:00:00.000Z",
    "flight_type": "Training Flight",
    "request_notes": "Need to practice crosswind landings"
  }'
```

### 1a. Student Creates Request (using user_id)
```bash
curl -X POST "https://api.skytrack.com/api/organizations/687c208d97e9217fc09e7c40/flight_schedule/requests" \
  -H "Authorization: Bearer <token>" \
  -H "X-API-Key: <key>" \
  -H "X-CSRF-Token: <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "plane_id": "687efa9e3d4c554ecf7ee538",
    "user_id": "687c220797e9217fc09e7c86",
    "instructor_id": "687c55f3071a9fe822d337b0",
    "scheduled_start_time": "2024-01-15T10:00:00.000Z",
    "scheduled_end_time": "2024-01-15T12:00:00.000Z",
    "flight_type": "Training Flight",
    "request_notes": "Need to practice crosswind landings"
  }'
```

### 1b. Admin Creates Request for Student (using user_id)
```bash
curl -X POST "https://api.skytrack.com/api/organizations/687c208d97e9217fc09e7c40/flight_schedule/requests" \
  -H "Authorization: Bearer <token>" \
  -H "X-API-Key: <key>" \
  -H "X-CSRF-Token: <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "plane_id": "687efa9e3d4c554ecf7ee538",
    "user_id": "687c220797e9217fc09e7c86",
    "instructor_id": "687c55f3071a9fe822d337b0",
    "scheduled_start_time": "2024-01-15T14:00:00.000Z",
    "scheduled_end_time": "2024-01-15T16:00:00.000Z",
    "flight_type": "Solo Flight",
    "request_notes": "Scheduled solo flight for student"
  }'
```

### 2. Admin Views Pending Requests
```bash
curl -X GET "https://api.skytrack.com/api/organizations/687c208d97e9217fc09e7c40/flight_schedule/requests?status=pending" \
  -H "Authorization: Bearer <token>" \
  -H "X-API-Key: <key>" \
  -H "X-CSRF-Token: <token>"
```

### 3. Admin Approves Request
```bash
curl -X PUT "https://api.skytrack.com/api/organizations/687c208d97e9217fc09e7c40/flight_schedule/requests/675a1b2c3d4e5f6789012345" \
  -H "Authorization: Bearer <token>" \
  -H "X-API-Key: <key>" \
  -H "X-CSRF-Token: <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "approved",
    "admin_notes": "Approved - good weather conditions expected"
  }'
```

---

## 🚨 Error Codes Reference
- `MISSING_STUDENT_REFERENCE`: Either student_id or user_id must be provided
- `INVALID_USER_ID`: Invalid user_id format
- `STUDENT_USER_MISMATCH`: Provided student_id and user_id do not match
- `STUDENT_NOT_FOUND_FOR_USER`: No student record found for the provided user_id
- `MISSING_REQUIRED_FIELD`: Required field missing in request
- `INVALID_OBJECT_ID`: Invalid MongoDB ObjectId format
- `INVALID_DATE_FORMAT`: Invalid ISO date format
- `INVALID_TIME_RANGE`: End time must be after start time
- `UNAUTHORIZED_STUDENT_REQUEST`: Student can only request for themselves
- `EXISTING_REQUEST_CONFLICT`: Overlapping pending request exists
- `SCHEDULE_CONFLICT`: Conflict with existing approved schedule
- `REQUEST_NOT_FOUND`: Request not found or access denied
- `REQUEST_ALREADY_PROCESSED`: Request already approved/rejected
- `APPROVAL_CONFLICT`: Cannot approve due to schedule conflict
- `INSUFFICIENT_PERMISSIONS`: User lacks required permissions

---

## 🔄 Integration with Existing Flight Schedules

### Direct Schedule Creation (Admins/Instructors)
- Use `/api/organizations/{organizationId}/flight_schedule` (POST) for direct schedule creation
- Bypasses the request/approval workflow
- Immediately creates confirmed flight schedules

### Request-Based Schedule Creation (Students)
- Use `/api/organizations/{organizationId}/flight_schedule/requests` (POST) for student requests  
- Requires admin approval before schedule creation
- Provides audit trail and approval workflow

### Student Attempt at Direct Creation
If a student tries to use the direct schedule creation endpoint:
```json
{
  "error": {
    "message": "Students must use the flight schedule request system. Please create a request at /flight_schedule/requests instead.",
    "code": "INSUFFICIENT_PERMISSIONS",
    "requestId": "string",
    "timestamp": "string (ISO date)"
  }
}
```
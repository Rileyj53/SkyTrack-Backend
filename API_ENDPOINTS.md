# SkyTrack API Endpoints Documentation
#SkyTrack

## Authentication Endpoints

### User Registration and Login
- [ ] `POST /api/auth/register` - Register a new user
  - Requires: email, password, role (optional, default: 'student')
  - Returns: JWT token, CSRF token
  - Headers: X-API-Key

- [ ] `POST /api/auth/login` - Login user
  - Requires: email, password
  - Returns: JWT token, CSRF token
  - Headers: X-API-Key

- [ ] `POST /api/auth/logout` - Logout user
  - Requires: JWT token in Authorization header
  - Headers: X-API-Key, X-CSRF-Token

### Password Management
- [ ] `POST /api/auth/reset-password/request` - Request password reset
  - Requires: email
  - Headers: X-API-Key

- [ ] `POST /api/auth/reset-password/verify` - Verify reset token
  - Requires: token, newPassword
  - Headers: X-API-Key

### Magic Link Authentication
- [ ] `POST /api/auth/magic-link/request` - Request magic link
  - Requires: email
  - Headers: X-API-Key

- [ ] `POST /api/auth/magic-link/login` - Login with magic link
  - Requires: token or code
  - Headers: X-API-Key

### Multi-Factor Authentication (MFA)
- [ ] `POST /api/auth/mfa/setup` - Setup MFA
  - Requires: JWT token
  - Headers: X-API-Key, X-CSRF-Token

- [ ] `POST /api/auth/mfa/verify` - Verify MFA setup
  - Requires: token
  - Headers: X-API-Key, X-CSRF-Token

- [ ] `POST /api/auth/mfa/verify-login` - Verify MFA during login
  - Requires: token
  - Headers: X-API-Key, X-CSRF-Token

- [ ] `GET /api/auth/mfa/status` - Get MFA status
  - Requires: JWT token
  - Headers: X-API-Key, X-CSRF-Token

- [ ] `POST /api/auth/mfa/disable` - Disable MFA
  - Requires: JWT token
  - Headers: X-API-Key, X-CSRF-Token

### Account Management
- [ ] `POST /api/auth/unlock-account` - Unlock locked account
  - Requires: email
  - Headers: X-API-Key

- [ ] `GET /api/auth/test-api-key` - Test API key validity
  - Requires: JWT token
  - Headers: X-API-Key, X-CSRF-Token

## User Management

- [ ] `GET /api/users/[userId]` - Get user information
  - Requires: JWT token, userId
  - Headers: X-API-Key, X-CSRF-Token
  - Returns: User object (excluding sensitive information)
  - Access: Users can only view their own profile unless they are sys_admin

- [ ] `PUT /api/users/[userId]` - Update user information
  - Requires: JWT token, userId, updated user data
  - Headers: X-API-Key, X-CSRF-Token
  - Returns: Updated user object
  - Access: Users can only update their own profile unless they are sys_admin
  - Updatable fields: email, role, school_id, pilot_id, isActive
  - Role changes restricted to sys_admin only

## School Management

- [ ] `GET /api/schools` - List all schools
  - Requires: JWT token
  - Headers: X-API-Key, X-CSRF-Token
  - Returns: List of schools (excluding sensitive payment info)
  - Permissions: sys_admin only

- [ ] `POST /api/schools` - Create a new school
  - Requires: JWT token, school data (name required)
  - Headers: X-API-Key, X-CSRF-Token
  - Returns: Created school object
  - Permissions: sys_admin, school_admin

- [ ] `GET /api/schools/[schoolId]` - Get a specific school
  - Requires: JWT token, schoolId
  - Headers: X-API-Key, X-CSRF-Token
  - Returns: School object (excluding sensitive payment info)

- [ ] `PUT /api/schools/[schoolId]` - Update a school
  - Requires: JWT token, schoolId, updated school data
  - Headers: X-API-Key, X-CSRF-Token
  - Returns: Updated school object
  - Permissions: sys_admin, school_admin

- [ ] `DELETE /api/schools/[schoolId]` - Delete a school
  - Requires: JWT token, schoolId
  - Headers: X-API-Key, X-CSRF-Token
  - Returns: Success message
  - Permissions: sys_admin only

## Pilot Management

- [ ] `GET /api/schools/[schoolId]/pilots` - List all pilots for a school
  - Requires: JWT token, schoolId
  - Headers: X-API-Key, X-CSRF-Token
  - Returns: List of pilots for the specified school
  - Access: Users with access to the school

- [ ] `POST /api/schools/[schoolId]/pilots` - Create a new pilot for a school
  - Requires: JWT token, schoolId, pilot data
  - Headers: X-API-Key, X-CSRF-Token
  - Returns: Created pilot object
  - Permissions: sys_admin, school_admin
  - Required fields: first_name, last_name, contact_email, phone, pilot_type, license_number

- [ ] `GET /api/schools/[schoolId]/pilots/[pilotId]` - Get a specific pilot
  - Requires: JWT token, schoolId, pilotId
  - Headers: X-API-Key, X-CSRF-Token
  - Returns: Pilot object
  - Access: Users with access to the school

- [ ] `PUT /api/schools/[schoolId]/pilots/[pilotId]` - Update a pilot
  - Requires: JWT token, schoolId, pilotId, updated pilot data
  - Headers: X-API-Key, X-CSRF-Token
  - Returns: Updated pilot object
  - Permissions: sys_admin, school_admin

- [ ] `DELETE /api/schools/[schoolId]/pilots/[pilotId]` - Delete a pilot
  - Requires: JWT token, schoolId, pilotId
  - Headers: X-API-Key, X-CSRF-Token
  - Returns: Success message
  - Permissions: sys_admin, school_admin

## Plane Management

### List Planes for a School
- **Endpoint:** `GET /api/schools/:schoolId/planes`
- **Description:** Lists all planes for a specific school
- **Headers:**
  - `x-api-key`: API key for authentication
  - `Authorization`: Bearer token for user authentication
- **Access:**
  - System administrators can access planes for any school
  - School administrators and instructors can only access planes for their own school
- **Response:**
  ```json
  {
    "planes": [
      {
        "_id": "plane_id",
        "tail_number": "N12345",
        "model": "Cessna 172",
        "status": "active",
        "capacity": 4,
        "location": "Hangar A",
        "school_id": "school_id",
        "year_manufactured": 2015,
        "last_maintenance_date": "2023-01-15T00:00:00.000Z",
        "next_maintenance_date": "2023-07-15T00:00:00.000Z",
        "total_flight_hours": 1200,
        "notes": "Regular maintenance completed",
        "created_at": "2023-01-01T00:00:00.000Z",
        "updated_at": "2023-01-15T00:00:00.000Z"
      }
    ]
  }
  ```

### Create a Plane
- **Endpoint:** `POST /api/schools/:schoolId/planes`
- **Description:** Creates a new plane for a specific school
- **Headers:**
  - `x-api-key`: API key for authentication
  - `Authorization`: Bearer token for user authentication
- **Access:**
  - System administrators can create planes for any school
  - School administrators can only create planes for their own school
- **Request Body:**
  ```json
  {
    "tail_number": "N12345",
    "model": "Cessna 172",
    "status": "active",
    "capacity": 4,
    "location": "Hangar A",
    "year_manufactured": 2015,
    "last_maintenance_date": "2023-01-15T00:00:00.000Z",
    "next_maintenance_date": "2023-07-15T00:00:00.000Z",
    "total_flight_hours": 1200,
    "notes": "Regular maintenance completed"
  }
  ```
- **Response:**
  ```json
  {
    "message": "Plane created successfully",
    "plane": {
      "_id": "plane_id",
      "tail_number": "N12345",
      "model": "Cessna 172",
      "status": "active",
      "capacity": 4,
      "location": "Hangar A",
      "school_id": "school_id",
      "year_manufactured": 2015,
      "last_maintenance_date": "2023-01-15T00:00:00.000Z",
      "next_maintenance_date": "2023-07-15T00:00:00.000Z",
      "total_flight_hours": 1200,
      "notes": "Regular maintenance completed",
      "created_at": "2023-01-01T00:00:00.000Z",
      "updated_at": "2023-01-01T00:00:00.000Z"
    }
  }
  ```

### Get a Specific Plane
- **Endpoint:** `GET /api/schools/:schoolId/planes/:planeId`
- **Description:** Retrieves details of a specific plane
- **Headers:**
  - `x-api-key`: API key for authentication
  - `Authorization`: Bearer token for user authentication
- **Access:**
  - System administrators can access any plane
  - School administrators and instructors can only access planes for their own school
- **Response:**
  ```json
  {
    "plane": {
      "_id": "plane_id",
      "tail_number": "N12345",
      "model": "Cessna 172",
      "status": "active",
      "capacity": 4,
      "location": "Hangar A",
      "school_id": "school_id",
      "year_manufactured": 2015,
      "last_maintenance_date": "2023-01-15T00:00:00.000Z",
      "next_maintenance_date": "2023-07-15T00:00:00.000Z",
      "total_flight_hours": 1200,
      "notes": "Regular maintenance completed",
      "created_at": "2023-01-01T00:00:00.000Z",
      "updated_at": "2023-01-15T00:00:00.000Z"
    }
  }
  ```

### Update a Plane
- **Endpoint:** `PUT /api/schools/:schoolId/planes/:planeId`
- **Description:** Updates a specific plane
- **Headers:**
  - `x-api-key`: API key for authentication
  - `Authorization`: Bearer token for user authentication
- **Access:**
  - System administrators can update any plane
  - School administrators can only update planes for their own school
- **Request Body:**
  ```json
  {
    "status": "maintenance",
    "location": "Hangar B",
    "next_maintenance_date": "2023-08-15T00:00:00.000Z",
    "notes": "Scheduled maintenance"
  }
  ```
- **Response:**
  ```json
  {
    "message": "Plane updated successfully",
    "plane": {
      "_id": "plane_id",
      "tail_number": "N12345",
      "model": "Cessna 172",
      "status": "maintenance",
      "capacity": 4,
      "location": "Hangar B",
      "school_id": "school_id",
      "year_manufactured": 2015,
      "last_maintenance_date": "2023-01-15T00:00:00.000Z",
      "next_maintenance_date": "2023-08-15T00:00:00.000Z",
      "total_flight_hours": 1200,
      "notes": "Scheduled maintenance",
      "created_at": "2023-01-01T00:00:00.000Z",
      "updated_at": "2023-01-20T00:00:00.000Z"
    }
  }
  ```

### Delete a Plane
- **Endpoint:** `DELETE /api/schools/:schoolId/planes/:planeId`
- **Description:** Deletes a specific plane
- **Headers:**
  - `x-api-key`: API key for authentication
  - `Authorization`: Bearer token for user authentication
- **Access:**
  - System administrators can delete any plane
  - School administrators can only delete planes for their own school
- **Response:**
  ```json
  {
    "message": "Plane deleted successfully"
  }
  ```

## API Key Management

- [ ] `GET /api/api-keys/keys` - List API keys
  - Requires: JWT token
  - Headers: X-API-Key, X-CSRF-Token

- [ ] `POST /api/api-keys/generate` - Generate new API key
  - Requires: JWT token, label
  - Headers: X-API-Key, X-CSRF-Token

- [ ] `DELETE /api/api-keys/[apiKeyId]` - Revoke API key
  - Requires: JWT token
  - Headers: X-API-Key, X-CSRF-Token

## Protected Routes

- [ ] `GET /api/protected` - Access protected data
  - Requires: JWT token
  - Headers: X-API-Key, X-CSRF-Token

- [ ] `POST /api/protected` - Submit protected data
  - Requires: JWT token
  - Headers: X-API-Key, X-CSRF-Token

- [ ] `GET /api/protected/test` - Test protected route
  - Requires: JWT token
  - Headers: X-API-Key, X-CSRF-Token

## System Endpoints

- [ ] `GET /api/health` - System health check
  - No authentication required

- [ ] `GET /api/test` - Test API endpoint
  - No authentication required

- [ ] `GET /api/auth/test` - Test auth API
  - No authentication required

## Schedule Management

### List Schedules
- **Endpoint:** `GET /api/schools/:schoolId/schedules`
- **Description:** List all schedules for a school
- **Headers:**
  - `x-api-key`: API key
  - `Authorization`: Bearer token
- **Query Parameters:**
  - `startDate` (optional): Filter schedules starting from this date
  - `endDate` (optional): Filter schedules ending before this date
  - `studentId` (optional): Filter schedules for a specific student
  - `instructorId` (optional): Filter schedules for a specific instructor
  - `planeId` (optional): Filter schedules for a specific plane
  - `status` (optional): Filter schedules by status (scheduled, in-progress, completed, canceled)
  - `flightType` (optional): Filter schedules by flight type (lesson, solo, checkride, etc.)
- **Access:** School administrators, instructors, and students (can only view their own schedules)
- **Returns:** List of schedules with populated student, instructor, and plane information

### Create Schedule
- **Endpoint:** `POST /api/schools/:schoolId/schedules`
- **Description:** Create a new schedule
- **Headers:**
  - `x-api-key`: API key
  - `Authorization`: Bearer token
- **Body:**
  ```json
  {
    "student_id": "string (required)",
    "instructor_id": "string (required)",
    "plane_id": "string (required)",
    "start_time": "string (ISO date, required)",
    "end_time": "string (ISO date, required)",
    "flight_type": "string (required)",
    "notes": "string (optional)",
    "weather_conditions": "string (optional)",
    "aircraft_condition": "string (optional)",
    "instructor_notes": "string (optional)",
    "student_notes": "string (optional)",
    "status": "string (default: 'scheduled')"
  }
  ```
- **Access:** School administrators and instructors
- **Returns:** Created schedule with populated references

### Get Schedule
- **Endpoint:** `GET /api/schools/:schoolId/schedules/:scheduleId`
- **Description:** Get a specific schedule
- **Headers:**
  - `x-api-key`: API key
  - `Authorization`: Bearer token
- **Access:** School administrators, instructors, and students (can only view their own schedules)
- **Returns:** Schedule details with populated references

### Update Schedule
- **Endpoint:** `PUT /api/schools/:schoolId/schedules/:scheduleId`
- **Description:** Update a specific schedule
- **Headers:**
  - `x-api-key`: API key
  - `Authorization`: Bearer token
- **Body:** Any of the fields from the create schedule body
- **Access:** School administrators and instructors
- **Returns:** Updated schedule with populated references

### Delete Schedule
- **Endpoint:** `DELETE /api/schools/:schoolId/schedules/:scheduleId`
- **Description:** Delete a specific schedule
- **Headers:**
  - `x-api-key`: API key
  - `Authorization`: Bearer token
- **Access:** School administrators and instructors
- **Returns:** Success message

## Notes

1. All endpoints except health check and test endpoints require an API key in the `X-API-Key` header
2. Protected routes require both API key and JWT token
3. Most POST/PUT/DELETE requests require CSRF token in `X-CSRF-Token` header
4. JWT tokens should be sent in the `Authorization` header as `Bearer <token>`
5. All timestamps are in ISO 8601 format
6. Error responses follow the format: `{ error: string, status: number }` 
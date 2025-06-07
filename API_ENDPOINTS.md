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

- [ ] `POST /api/auth/reset-password/complete` - Complete password reset
  - Requires: token, newPassword (or password)
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

- [ ] `GET /api/auth/mfa/debug` - Debug MFA functionality
  - Requires: JWT token
  - Headers: X-API-Key, X-CSRF-Token

### CSRF Token Management
- [ ] `GET /api/auth/csrf-token` - Generate CSRF token
  - Requires: API key
  - Headers: X-API-Key
  - Returns: CSRF token and expiration

### Current User Information
- [ ] `GET /api/auth/me` - Get current user information
  - Requires: JWT token
  - Headers: X-API-Key, X-CSRF-Token
  - Returns: User object with school, student, and instructor details

### Account Management
- [ ] `POST /api/auth/unlock-account` - Unlock locked account
  - Requires: email
  - Headers: X-API-Key

- [ ] `GET /api/auth/test-api-key` - Test API key validity
  - Requires: JWT token
  - Headers: X-API-Key, X-CSRF-Token

- [ ] `GET /api/auth/test` - Test auth API
  - No authentication required

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

## Student Management

- [ ] `GET /api/schools/[schoolId]/students` - List all students for a school
  - Requires: JWT token, schoolId
  - Headers: X-API-Key, X-CSRF-Token
  - Returns: List of students for the specified school with populated user information
  - Access: Users with access to the school

- [ ] `POST /api/schools/[schoolId]/students` - Create a new student for a school
  - Requires: JWT token, schoolId, student data
  - Headers: X-API-Key, X-CSRF-Token
  - Returns: Created student object
  - Permissions: sys_admin, school_admin, instructor
  - Required fields: contact_email, program

- [ ] `GET /api/schools/[schoolId]/students/[studentId]` - Get a specific student
  - Requires: JWT token, schoolId, studentId
  - Headers: X-API-Key, X-CSRF-Token
  - Returns: Student object with progress and program information
  - Access: Users with access to the school

- [ ] `PUT /api/schools/[schoolId]/students/[studentId]` - Update a student
  - Requires: JWT token, schoolId, studentId, updated student data
  - Headers: X-API-Key, X-CSRF-Token
  - Returns: Updated student object
  - Permissions: sys_admin, school_admin, instructor

- [ ] `DELETE /api/schools/[schoolId]/students/[studentId]` - Delete a student
  - Requires: JWT token, schoolId, studentId
  - Headers: X-API-Key, X-CSRF-Token
  - Returns: Success message
  - Permissions: sys_admin, school_admin

## Instructor Management

- [ ] `GET /api/schools/[schoolId]/instructors` - List all instructors for a school
  - Requires: JWT token, schoolId
  - Headers: X-API-Key, X-CSRF-Token
  - Returns: List of instructors for the specified school
  - Access: Users with access to the school

- [ ] `POST /api/schools/[schoolId]/instructors` - Create a new instructor for a school
  - Requires: JWT token, schoolId, instructor data
  - Headers: X-API-Key, X-CSRF-Token
  - Returns: Created instructor object
  - Permissions: sys_admin, school_admin
  - Required fields: first_name, last_name, contact_email, phone, instructor_type, license_number

- [ ] `GET /api/schools/[schoolId]/instructors/[instructorId]` - Get a specific instructor
  - Requires: JWT token, schoolId, instructorId
  - Headers: X-API-Key, X-CSRF-Token
  - Returns: Instructor object
  - Access: Users with access to the school

- [ ] `PUT /api/schools/[schoolId]/instructors/[instructorId]` - Update an instructor
  - Requires: JWT token, schoolId, instructorId, updated instructor data
  - Headers: X-API-Key, X-CSRF-Token
  - Returns: Updated instructor object
  - Permissions: sys_admin, school_admin

- [ ] `DELETE /api/schools/[schoolId]/instructors/[instructorId]` - Delete an instructor
  - Requires: JWT token, schoolId, instructorId
  - Headers: X-API-Key, X-CSRF-Token
  - Returns: Success message
  - Permissions: sys_admin, school_admin

## Program Management

- [ ] `GET /api/schools/[schoolId]/programs` - List all programs for a school
  - Requires: JWT token, schoolId
  - Headers: X-API-Key, X-CSRF-Token
  - Returns: List of programs for the specified school
  - Access: Users with access to the school

- [ ] `POST /api/schools/[schoolId]/programs` - Create a new program for a school
  - Requires: JWT token, schoolId, program data
  - Headers: X-API-Key, X-CSRF-Token
  - Returns: Created program object
  - Permissions: sys_admin, school_admin
  - Required fields: program_name, requirements

- [ ] `GET /api/schools/[schoolId]/programs/[programId]` - Get a specific program
  - Requires: JWT token, schoolId, programId
  - Headers: X-API-Key, X-CSRF-Token
  - Returns: Program object with requirements, milestones, and stages
  - Access: Users with access to the school

- [ ] `PUT /api/schools/[schoolId]/programs/[programId]` - Update a program
  - Requires: JWT token, schoolId, programId, updated program data
  - Headers: X-API-Key, X-CSRF-Token
  - Returns: Updated program object
  - Permissions: sys_admin, school_admin

- [ ] `DELETE /api/schools/[schoolId]/programs/[programId]` - Delete a program
  - Requires: JWT token, schoolId, programId
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

### Real-Time Aircraft Tracking
- **Endpoint:** `GET /api/schools/:schoolId/aircraft-tracking`
- **Description:** Gets real-time aircraft tracking data from ADSB.lol for all planes in a school
- **Headers:**
  - `x-api-key`: API key for authentication
  - `Authorization`: Bearer token for user authentication
- **Access:**
  - System administrators can access tracking for any school
  - School administrators and instructors can only access tracking for their own school
- **Response:**
  ```json
  {
    "message": "Aircraft tracking data retrieved successfully",
    "school_id": "school_id",
    "summary": {
      "total_planes": 5,
      "planes_with_tracking": 2,
      "planes_without_tracking": 3,
      "planes_in_flight": 1
    },
    "aircraft": [
      {
        "plane_id": "plane_id",
        "registration": "N12345",
        "type": "Single Engine",
        "aircraftModel": "Cessna 172",
        "status": "active",
        "tracking_data": {
          "ac": [
            {
              "hex": "a94ae5",
              "type": "adsb_icao",
              "flight": "N12345",
              "r": "N12345",
              "t": "C172",
              "alt_baro": 3500,
              "alt_geom": 3600,
              "gs": 120.5,
              "track": 180.0,
              "baro_rate": 0,
              "squawk": "1200",
              "emergency": "none",
              "category": "A1",
              "lat": 40.7128,
              "lon": -74.0060,
              "nic": 8,
              "rc": 186,
              "seen_pos": 0.5,
              "version": 2,
              "messages": 1250,
              "seen": 0.1,
              "rssi": -15.2
            }
          ],
          "msg": "No error",
          "now": 1749171642001,
          "total": 1,
          "ctime": 1749171642001,
          "ptime": 0
        },
        "last_updated": "2023-01-15T14:30:00.000Z"
      }
    ],
    "active_aircraft": [
      {
        "plane_id": "plane_id",
        "registration": "N12345",
        "tracking_data": {
          "ac": [...]
        }
      }
    ],
    "inactive_aircraft": [
      {
        "plane_id": "plane_id_2",
        "registration": "N67890",
        "tracking_data": null,
        "error": "Aircraft not currently transmitting"
      }
    ],
    "timestamp": "2023-01-15T14:30:00.000Z"
  }
  ```

## Flight Schedule Management

### List Flight Schedules for a School
- **Endpoint:** `GET /api/schools/:schoolId/flight_schedule`
- **Description:** Gets all flight schedules for a specific school with full populated data
- **Headers:**
  - `x-api-key`: API key for authentication
  - `Authorization`: Bearer token for user authentication
- **Query Parameters:**
  - `page` (optional): Page number for pagination (default: 1)
  - `limit` (optional): Number of results per page (default: 50)
  - `status` (optional): Filter by status (scheduled, confirmed, in-progress, completed, canceled, no-show)
  - `start_date` (optional): Filter by start date (ISO string)
  - `end_date` (optional): Filter by end date (ISO string)
  - `plane_id` (optional): Filter by plane ID
  - `instructor_id` (optional): Filter by instructor ID
  - `student_id` (optional): Filter by student ID
- **Response:**
  ```json
  {
    "schedules": [
      {
        "_id": "schedule_id",
        "school_id": {
          "_id": "school_id",
          "name": "Flight Academy",
          "address": {...},
          "airport": "KJFK"
        },
        "plane_id": {
          "_id": "plane_id",
          "registration": "N12345",
          "type": "Single Engine",
          "aircraftModel": "Cessna 172"
        },
        "instructor_id": {
          "_id": "instructor_id",
          "user_id": {
            "_id": "user_id",
            "first_name": "John",
            "last_name": "Smith",
            "email": "john@example.com"
          }
        },
        "student_id": {
          "_id": "student_id",
          "user_id": {
            "_id": "user_id", 
            "first_name": "Jane",
            "last_name": "Doe",
            "email": "jane@example.com"
          }
        },
        "start_time": "2025-06-06T10:00:00.000Z",
        "end_time": "2025-06-06T11:30:00.000Z",
        "flight_type": "Solo",
        "status": "scheduled",
        "duration": 1.5,
        "notes": "Practice landings",
        "created_at": "2025-01-01T00:00:00.000Z",
        "updated_at": "2025-01-01T00:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 1,
      "pages": 1
    }
  }
  ```

### Create a Flight Schedule
- **Endpoint:** `POST /api/schools/:schoolId/flight_schedule`
- **Description:** Creates a new flight schedule with automatic duration calculation
- **Headers:**
  - `x-api-key`: API key for authentication
  - `Authorization`: Bearer token for user authentication
- **Request Body:**
  ```json
  {
    "plane_id": "684238fc551d3d8d70edbeb4",
    "instructor_id": "6838ad948d13949c514ac678",
    "student_id": "6841e28c8d13949c514ac6dd",
    "start_time": "2025-06-06T10:00:00.000Z",
    "end_time": "2025-06-06T11:30:00.000Z",
    "flight_type": "Solo",
    "status": "scheduled",
    "notes": "Practice landings"
  }
  ```
- **Response:**
  ```json
  {
    "message": "Flight schedule created successfully",
    "schedule": {
      // ... populated schedule object with all related data
    }
  }
  ```

### Get a Specific Flight Schedule
- **Endpoint:** `GET /api/schools/:schoolId/flight_schedule/:scheduleId`
- **Description:** Retrieves a specific flight schedule with full populated data
- **Headers:**
  - `x-api-key`: API key for authentication
  - `Authorization`: Bearer token for user authentication
- **Response:**
  ```json
  {
    "schedule": {
      // ... populated schedule object with all related data
    }
  }
  ```

### Update a Flight Schedule
- **Endpoint:** `PUT /api/schools/:schoolId/flight_schedule/:scheduleId`
- **Description:** Updates a specific flight schedule with conflict checking
- **Headers:**
  - `x-api-key`: API key for authentication
  - `Authorization`: Bearer token for user authentication
- **Request Body:**
  ```json
  {
    "start_time": "2025-06-06T11:00:00.000Z",
    "end_time": "2025-06-06T12:30:00.000Z",
    "status": "confirmed",
    "notes": "Updated practice session"
  }
  ```
- **Response:**
  ```json
  {
    "message": "Flight schedule updated successfully",
    "schedule": {
      // ... populated updated schedule object
    }
  }
  ```

### Delete a Flight Schedule
- **Endpoint:** `DELETE /api/schools/:schoolId/flight_schedule/:scheduleId`
- **Description:** Deletes a specific flight schedule
- **Headers:**
  - `x-api-key`: API key for authentication
  - `Authorization`: Bearer token for user authentication
- **Response:**
  ```json
  {
    "message": "Flight schedule deleted successfully",
    "schedule_id": "schedule_id"
  }
  ```

## Flight Log Management

- [ ] `GET /api/schools/[schoolId]/flight-logs` - List all flight logs for a school
  - Requires: JWT token, schoolId
  - Headers: X-API-Key, X-CSRF-Token
  - Query Parameters: page, limit, student_id, instructor_id, plane_id, status, date, start_date, end_date, type
  - Returns: List of flight logs with pagination
  - Access: Users with access to the school

- [ ] `POST /api/schools/[schoolId]/flight-logs` - Create a new flight log
  - Requires: JWT token, schoolId, flight log data
  - Headers: X-API-Key, X-CSRF-Token
  - Returns: Created flight log object
  - Permissions: sys_admin, school_admin, instructor
  - Required fields: date, start_time, end_time, plane_id, student_id, instructor_id, type

- [ ] `GET /api/schools/[schoolId]/flight-logs/[flightLogId]` - Get a specific flight log
  - Requires: JWT token, schoolId, flightLogId
  - Headers: X-API-Key, X-CSRF-Token
  - Returns: Flight log object
  - Access: Users with access to the school

- [ ] `PUT /api/schools/[schoolId]/flight-logs/[flightLogId]` - Update a flight log
  - Requires: JWT token, schoolId, flightLogId, updated flight log data
  - Headers: X-API-Key, X-CSRF-Token
  - Returns: Updated flight log object
  - Permissions: sys_admin, school_admin, instructor

- [ ] `DELETE /api/schools/[schoolId]/flight-logs/[flightLogId]` - Delete a flight log
  - Requires: JWT token, schoolId, flightLogId
  - Headers: X-API-Key, X-CSRF-Token
  - Returns: Success message
  - Permissions: sys_admin, school_admin, instructor

- [ ] `GET /api/schools/[schoolId]/flight-logs/today` - Get today's flight logs
  - Requires: JWT token, schoolId
  - Headers: X-API-Key, X-CSRF-Token
  - Returns: List of flight logs for today
  - Access: Users with access to the school

## Flight Tracking Management

### Track Management
- [ ] `GET /api/track` - List all flight tracks
  - Requires: JWT token
  - Headers: X-API-Key, X-CSRF-Token
  - Query Parameters: tail_number, start_date, end_date, plane_id, school_id, instructor_id, student_id, limit, page
  - Returns: List of tracks with filtering and pagination

- [ ] `POST /api/track` - Start tracking a plane
  - Requires: JWT token, plane tracking data
  - Headers: X-API-Key, X-CSRF-Token
  - Returns: Created track object with FlightAware integration
  - Required fields: plane_id, school_id
  - Optional fields: tail_number, instructor_id, student_id, start_time

- [ ] `GET /api/track/[trackId]` - Get specific track details
  - Requires: JWT token, trackId
  - Headers: X-API-Key, X-CSRF-Token
  - Returns: Track object with detailed tracking data

- [ ] `PUT /api/track/[trackId]` - Update track information
  - Requires: JWT token, trackId, updated track data
  - Headers: X-API-Key, X-CSRF-Token
  - Returns: Updated track object

- [ ] `DELETE /api/track/[trackId]` - Delete track
  - Requires: JWT token, trackId
  - Headers: X-API-Key, X-CSRF-Token
  - Returns: Success message

### Track Data Management
- [ ] `GET /api/trackData` - Get all tracks with filtering
  - Requires: JWT token
  - Headers: X-API-Key, X-CSRF-Token
  - Query Parameters: tail_number, start_date, end_date, plane_id, school_id, instructor_id, student_id, limit, page
  - Returns: List of tracks with pagination

- [ ] `POST /api/trackData` - Create new track data
  - Requires: JWT token, track data
  - Headers: X-API-Key, X-CSRF-Token
  - Returns: Created track object
  - Required fields: tail_number

- [ ] `GET /api/trackData/[trackId]` - Get specific track data
  - Requires: JWT token, trackId
  - Headers: X-API-Key, X-CSRF-Token
  - Returns: Track object with detailed data

- [ ] `PUT /api/trackData/[trackId]` - Update track data
  - Requires: JWT token, trackId, updated track data
  - Headers: X-API-Key, X-CSRF-Token
  - Returns: Updated track object

- [ ] `DELETE /api/trackData/[trackId]` - Delete track data
  - Requires: JWT token, trackId
  - Headers: X-API-Key, X-CSRF-Token
  - Returns: Success message

## API Key Management

- [ ] `GET /api/api-keys/keys` - List API keys
  - Requires: JWT token
  - Headers: X-API-Key, X-CSRF-Token

- [ ] `POST /api/api-keys/generate` - Generate new API key
  - Requires: JWT token, label
  - Headers: X-API-Key, X-CSRF-Token

- [ ] `GET /api/api-keys/[apiKeyId]` - Get specific API key details
  - Requires: JWT token, apiKeyId
  - Headers: X-API-Key, X-CSRF-Token

- [ ] `DELETE /api/api-keys/[apiKeyId]` - Revoke API key
  - Requires: JWT token
  - Headers: X-API-Key, X-CSRF-Token

- [ ] `GET /api/api-keys/test` - Test API key functionality
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

- [ ] `GET /api/protected/test-with-key` - Test protected route with API key
  - Requires: JWT token
  - Headers: X-API-Key, X-CSRF-Token

## System Endpoints

- [ ] `GET /api/health` - System health check
  - No authentication required
  - Returns: Comprehensive health status including database, memory, and system information

- [ ] `GET /api/test` - Test API endpoint
  - No authentication required
  - Returns: Basic test response with request information

- [ ] `POST /api/test` - Test POST endpoint
  - No authentication required
  - Accepts: JSON payload
  - Returns: Echo of received data

- [ ] `GET /api/auth/test` - Test auth API
  - No authentication required

## Debug and Testing Endpoints

- [ ] `GET /api/debug-middleware` - Debug middleware functionality
  - Requires: JWT token
  - Headers: X-API-Key, X-CSRF-Token

- [ ] `GET /api/security-headers-test` - Test security headers
  - No authentication required

- [ ] `GET /api/test-csrf` - Test CSRF functionality
  - Requires: JWT token
  - Headers: X-API-Key, X-CSRF-Token

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
7. FlightAware integration is used for real-time flight tracking in the track endpoints
8. Pagination is available on list endpoints with `page` and `limit` query parameters
9. All ID parameters must be valid MongoDB ObjectIds
10. Role-based access control is enforced throughout the API 
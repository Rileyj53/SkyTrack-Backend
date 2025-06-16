# Instructors API Documentation

## Overview
The Instructors API provides comprehensive management of flight instructors within schools. It includes full CRUD operations with role-based access control, instructor certification tracking, availability management, and student assignment capabilities.

## Base URL
```
{baseUrl}/api/schools/{schoolId}/instructors
```

## Authentication
All endpoints require:
- **API Key**: Provided via `x-api-key` header
- **JWT Token**: Provided via `Authorization: Bearer {token}` header

## Access Control Matrix

| Role | List Instructors | Create Instructor | Get Instructor | Update Instructor | Delete Instructor |
|------|------------------|-------------------|----------------|-------------------|-------------------|
| **Student** | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Instructor** | ✅ | ❌ | ✅ | ✅ (Own Only) | ❌ |
| **School Admin** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **System Admin** | ✅ | ✅ | ✅ | ✅ | ✅ |

## Instructor Object Structure

```json
{
  "_id": "ObjectId",
  "school_id": "ObjectId",
  "user_id": "ObjectId (references User)",
  "contact_email": "string (required)",
  "phone": "string (required)",
  "certifications": ["string"],
  "license_number": "string (required, unique)",
  "emergency_contact": {
    "name": "string",
    "relationship": "string",
    "phone": "string"
  },
  "specialties": ["string"],
  "status": "string (default: 'Active')",
  "hourlyRates": {
    "primary": "number",
    "instrument": "number",
    "advanced": "number",
    "multiEngine": "number"
  },
  "flightHours": "number",
  "teachingHours": "number",
  "availability": "string (default: 'Full-time')",
  "students": "number",
  "utilization": "number",
  "ratings": ["object"],
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
  "documents": ["object"],
  "createdAt": "Date",
  "updatedAt": "Date"
}
```

## API Endpoints

### 1. List All Instructors
**GET** `/api/schools/{schoolId}/instructors`

Lists all instructors for a specific school with populated user information.

**Access Control:**
- Students: ❌ No access
- Instructors: ✅ Can view all instructors in their school
- School Admins: ✅ Can view instructors in their school
- System Admins: ✅ Full access

**Parameters:**
- `schoolId` (path, required): School identifier

**Response:**
```json
[
  {
    "_id": "instructor_id",
    "school_id": "school_id",
    "user_id": {
      "_id": "user_id",
      "first_name": "John",
      "last_name": "Doe",
      "email": "john.doe@example.com",
      "role": "instructor"
    },
    "contact_email": "john.doe@flyschool.com",
    "phone": "+1-555-0123",
    "license_number": "CFI123456",
    "certifications": ["CFI", "CFII", "MEI"],
    "specialties": ["Instrument Training", "Commercial Training"],
    "status": "Active",
    "hourlyRates": {
      "primary": 65,
      "instrument": 75,
      "advanced": 85,
      "multiEngine": 95
    },
    "flightHours": 2500,
    "teachingHours": 1200
  }
]
```

### 2. Create New Instructor
**POST** `/api/schools/{schoolId}/instructors`

Creates a new instructor record for a school.

**Access Control:**
- Students: ❌ No access
- Instructors: ❌ No access
- School Admins: ✅ Can create instructors in their school
- System Admins: ✅ Full access

**Parameters:**
- `schoolId` (path, required): School identifier

**Required Fields:**
- `user_id`: Valid ObjectId referencing existing user with 'instructor' role
- `contact_email`: Instructor's contact email
- `phone`: Phone number
- `license_number`: Unique instructor license number

**Request Body:**
```json
{
  "user_id": "user_object_id",
  "contact_email": "instructor@example.com",
  "phone": "+1-555-0123",
  "license_number": "CFI123456",
  "certifications": ["CFI", "CFII"],
  "emergency_contact": {
    "name": "Jane Doe",
    "relationship": "Spouse",
    "phone": "+1-555-0124"
  },
  "specialties": ["Primary Training", "Instrument Training"],
  "hourlyRates": {
    "primary": 65,
    "instrument": 75,
    "advanced": 85,
    "multiEngine": 95
  },
  "availability_time": {
    "monday": ["09:00-17:00"],
    "tuesday": ["09:00-17:00"],
    "wednesday": ["09:00-17:00"],
    "thursday": ["09:00-17:00"],
    "friday": ["09:00-17:00"],
    "saturday": ["08:00-12:00"],
    "sunday": []
  }
}
```

**Success Response (201 Created):**
```json
{
  "message": "Instructor created successfully",
  "instructor": { /* full instructor object */ },
  "status": "success"
}
```

### 3. Get Specific Instructor
**GET** `/api/schools/{schoolId}/instructors/{instructorId}`

Retrieves a specific instructor with populated user information.

**Access Control:**
- Students: ❌ No access
- Instructors: ✅ Can view any instructor in their school
- School Admins: ✅ Can view instructors in their school
- System Admins: ✅ Full access

**Parameters:**
- `schoolId` (path, required): School identifier
- `instructorId` (path, required): Instructor identifier

**Success Response (200 OK):**
```json
{
  "_id": "instructor_id",
  "school_id": "school_id",
  "user_id": {
    "_id": "user_id",
    "first_name": "John",
    "last_name": "Doe",
    "email": "john.doe@example.com",
    "role": "instructor"
  },
  "contact_email": "john.doe@flyschool.com",
  "phone": "+1-555-0123",
  "license_number": "CFI123456",
  "certifications": ["CFI", "CFII", "MEI"],
  "emergency_contact": {
    "name": "Jane Doe",
    "relationship": "Spouse",
    "phone": "+1-555-0124"
  },
  "specialties": ["Instrument Training", "Commercial Training"],
  "status": "Active",
  "hourlyRates": {
    "primary": 65,
    "instrument": 75,
    "advanced": 85,
    "multiEngine": 95
  },
  "flightHours": 2500,
  "teachingHours": 1200,
  "availability": "Full-time",
  "students": 12,
  "utilization": 85,
  "ratings": [],
  "availability_time": {
    "monday": ["09:00-17:00"],
    "tuesday": ["09:00-17:00"],
    "wednesday": ["09:00-17:00"],
    "thursday": ["09:00-17:00"],
    "friday": ["09:00-17:00"],
    "saturday": ["08:00-12:00"],
    "sunday": []
  },
  "notes": "Experienced instructor specializing in instrument training",
  "documents": []
}
```

### 4. Update Instructor
**PUT** `/api/schools/{schoolId}/instructors/{instructorId}`

Updates an existing instructor record.

**Access Control:**
- Students: ❌ No access
- Instructors: ✅ Can update only their own data
- School Admins: ✅ Can update instructors in their school
- System Admins: ✅ Full access

**Parameters:**
- `schoolId` (path, required): School identifier
- `instructorId` (path, required): Instructor identifier

**Request Body:** (All fields optional for update)
```json
{
  "contact_email": "newemail@example.com",
  "phone": "+1-555-9999",
  "certifications": ["CFI", "CFII", "MEI", "ATP"],
  "license_number": "CFI789012",
  "specialties": ["Advanced Training", "Multi-Engine"],
  "status": "Active",
  "hourlyRates": {
    "primary": 70,
    "instrument": 80,
    "advanced": 90,
    "multiEngine": 100
  },
  "flightHours": 2600,
  "teachingHours": 1250,
  "availability": "Part-time",
  "notes": "Updated instructor profile"
}
```

**Success Response (200 OK):**
```json
{
  "message": "Instructor updated successfully",
  "instructor": { /* updated instructor object */ },
  "status": "success"
}
```

### 5. Delete Instructor
**DELETE** `/api/schools/{schoolId}/instructors/{instructorId}`

Deletes an instructor record.

**Access Control:**
- Students: ❌ No access
- Instructors: ❌ No access
- School Admins: ✅ Can delete instructors in their school
- System Admins: ✅ Full access

**Parameters:**
- `schoolId` (path, required): School identifier
- `instructorId` (path, required): Instructor identifier

**Success Response (200 OK):**
```json
{
  "message": "Instructor deleted successfully",
  "status": "success"
}
```

## Validation Rules

### Required Fields (Creation)
- `user_id`: Must be valid ObjectId referencing existing user
- `contact_email`: Valid email format
- `phone`: Non-empty string
- `license_number`: Non-empty string, must be unique

### Business Rules
1. **User Role Validation**: Referenced user must have 'instructor' role
2. **License Uniqueness**: License numbers must be unique across all instructors
3. **School Association**: Instructors can only be created/accessed within their associated school
4. **Single Instructor Per User**: Each user can only have one instructor record per school
5. **Self-Update Only**: Instructors can only update their own records (except admins)

### Optional Fields with Defaults
- `status`: Defaults to 'Active'
- `availability`: Defaults to 'Full-time'
- `hourlyRates`: Defaults to all zeros
- `certifications`: Defaults to empty array
- `specialties`: Defaults to empty array
- `emergency_contact`: Defaults to empty object
- `availability_time`: Defaults to empty schedule

## Error Responses

### 400 Bad Request
```json
{
  "error": "Invalid school ID or instructor ID"
}
```

```json
{
  "error": "Missing required fields: user_id, contact_email, phone, license_number"
}
```

```json
{
  "error": "Validation error",
  "details": { /* Mongoose validation errors */ }
}
```

### 401 Unauthorized
```json
{
  "error": "No token provided"
}
```

```json
{
  "error": "Invalid token"
}
```

### 403 Forbidden
```json
{
  "error": "You do not have access to this school"
}
```

```json
{
  "error": "Insufficient permissions to create instructors"
}
```

```json
{
  "error": "Forbidden: Instructors can only update their own data"
}
```

### 404 Not Found
```json
{
  "error": "Instructor not found"
}
```

```json
{
  "error": "User not found"
}
```

### 409 Conflict
```json
{
  "error": "Instructor already exists for this user in this school"
}
```

```json
{
  "error": "License number is already in use"
}
```

### 500 Internal Server Error
```json
{
  "error": "Failed to create instructor"
}
```

## Integration Points

### User Management Integration
- Instructors are linked to User accounts via `user_id`
- User must have `instructor` role to create instructor record
- User information is populated in responses (first_name, last_name, email, role)

### School Management Integration
- All instructor operations are scoped to specific schools
- School access validation ensures users can only access instructors in their schools
- School admins have full control within their school boundaries

### Flight Scheduling Integration
- Instructor availability schedules support flight booking systems
- Hourly rates support different training types and pricing
- Student assignments and utilization tracking

### Certification Tracking
- Support for multiple instructor certifications (CFI, CFII, MEI, ATP, etc.)
- License number tracking with uniqueness validation
- Document storage for certification files

## Use Cases & Scenarios

### Scenario 1: School Admin Creating New Instructor
1. School admin authenticates and provides school access
2. Selects existing user with 'instructor' role
3. Provides required contact information and license details
4. Sets hourly rates and availability schedule
5. System validates license uniqueness and creates instructor record

### Scenario 2: Instructor Updating Own Profile
1. Instructor authenticates with their credentials
2. Updates contact information, availability, or hourly rates
3. System validates they're only updating their own record
4. Changes are saved and reflected in scheduling system

### Scenario 3: System Admin Managing Instructors
1. System admin accesses any school's instructor records
2. Can create, update, or delete any instructor
3. Manages instructor certifications and specialties
4. Tracks utilization and performance metrics

### Scenario 4: Instructor License Management
1. Admin attempts to update instructor's license number
2. System validates new license number isn't already in use
3. If unique, license is updated across all related records
4. If duplicate, returns conflict error with details

### Scenario 5: Instructor Role Verification
1. Admin attempts to create instructor for existing user
2. System verifies user has 'instructor' role
3. If correct role, proceeds with instructor creation
4. If incorrect role, returns validation error 
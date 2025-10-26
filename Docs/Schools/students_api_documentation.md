# Students API Documentation

## Overview
The Students API allows you to manage student records for flight training organizations, including comprehensive search functionality and pagination.

## Enhanced Features
- **Pagination**: Efficient handling of large student lists with customizable page size
- **Search**: Comprehensive search across multiple fields including user names, emails, program details, and contact information
- **Filtering**: Multiple filter options for status, program, certifications, and enrollment dates
- **Sorting**: Results sorted by enrollment date (most recent first)

## Access Control

### Role-Based Permissions:

| Role | List Students | Create Student | View Student | Update Student | Delete Student |
|------|---------------|----------------|--------------|----------------|----------------|
| **Student** | ❌ | ❌ | ✅ Own Only | ✅ Own Only | ❌ |
| **Instructor** | ✅ Organization Only | ❌ | ✅ Organization Only | ❌ | ❌ |
| **Organization Admin** | ✅ Organization Only | ✅ | ✅ Organization Only | ✅ Organization Only | ✅ Organization Only |
| **System Admin** | ✅ All Organizations | ✅ | ✅ All | ✅ All | ✅ All |

### Security Features:
- **API key validation** required for all requests
- **JWT authentication** verifies user identity and role
- **Organization-scoped access** prevents cross-organization data access
- **Self-service restrictions** for students (own records only)

## Student Object

```json
{
  "_id": "ObjectId",
  "organization_id": "ObjectId",
  "user_id": "ObjectId", // Optional - links to User account
  "contact_email": "student@example.com",
  "phone": "555-123-4567",
  "certifications": ["private", "instrument"],
  "license_number": "STU001",
  "emergency_contact": {
    "name": "John Doe",
    "relationship": "Father",
    "phone": "555-987-6543"
  },
  "enrollmentDate": "2023-01-15T00:00:00.000Z",
  "program": "Private Pilot License",
  "status": "Active",
  "stage": "Stage 1",
  "nextMilestone": "First Solo",
  "notes": "Student notes here",
  "progress": {
    "requirements": [],
    "milestones": [],
    "stages": [],
    "lastUpdated": "2023-01-15T00:00:00.000Z"
  },
  "studentNotes": [],
  "created_at": "2023-01-15T00:00:00.000Z",
  "updated_at": "2023-01-15T00:00:00.000Z"
}
```

## Endpoints

### GET /api/organizations/{organizationId}/students
List students with enhanced pagination and search functionality.

**Query Parameters:**

**Pagination:**
- `page` - Page number (default: 1, min: 1)
- `limit` - Items per page (default: 50, min: 1, max: 200)

**Search:**
- `search` - Global search across multiple fields:
  - User first name and last name (from linked User account)
  - User email (from linked User account)
  - Contact email
  - Phone number
  - License number
  - Program name
  - Status
  - Stage
  - Next milestone
  - Notes
  - Emergency contact name and phone
  - Full name (concatenated first + last name)

**Filters:**
- `status` - Filter by status (Active, Inactive, Graduated, On Hold, Discontinued)
- `program` - Filter by program name (partial match, case-insensitive)
- `certification` - Filter by certification type (private, instrument, commercial, etc.)
- `enrollment_start_date` - Filter by enrollment date >= this date (ISO format)
- `enrollment_end_date` - Filter by enrollment date <= this date (ISO format)

**Example Requests:**

**Basic pagination:**
```
GET /api/organizations/64a1b2c3d4e5f6789012345/students?page=1&limit=25
```

**Search for students:**
```
GET /api/organizations/64a1b2c3d4e5f6789012345/students?search=john&page=1&limit=10
```

**Filter by status and program:**
```
GET /api/organizations/64a1b2c3d4e5f6789012345/students?status=Active&program=Private%20Pilot&page=1
```

**Filter by certification:**
```
GET /api/organizations/64a1b2c3d4e5f6789012345/students?certification=instrument
```

**Filter by enrollment date range:**
```
GET /api/organizations/64a1b2c3d4e5f6789012345/students?enrollment_start_date=2023-01-01&enrollment_end_date=2023-12-31
```

**Combined search and filters:**
```
GET /api/organizations/64a1b2c3d4e5f6789012345/students?search=smith&status=Active&program=Commercial&page=2&limit=15
```

**Response Format:**
```json
{
  "students": [
    {
      "_id": "ObjectId",
      "organization_id": "ObjectId",
      "user_id": {
        "_id": "ObjectId",
        "first_name": "John",
        "last_name": "Smith",
        "email": "john.smith@example.com",
        "role": "student"
      },
      "contact_email": "john.smith@example.com",
      "phone": "555-123-4567",
      "certifications": ["private"],
      "license_number": "STU001",
      "emergency_contact": {
        "name": "Jane Smith",
        "relationship": "Mother",
        "phone": "555-987-6543"
      },
      "enrollmentDate": "2023-01-15T00:00:00.000Z",
      "program": "Private Pilot License",
      "status": "Active",
      "stage": "Stage 2",
      "nextMilestone": "Cross Country Solo",
      "notes": "Progressing well",
      "progress": { /* ... */ },
      "studentNotes": [],
      "created_at": "2023-01-15T00:00:00.000Z",
      "updated_at": "2023-01-15T00:00:00.000Z"
    }
    // ... more students
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 5,
    "totalCount": 125,
    "hasNextPage": true,
    "hasPrevPage": false,
    "limit": 25
  }
}
```

### POST /api/organizations/{organizationId}/students
Create a new student record.

**Required Fields:**
- `contact_email` - Student's contact email
- `program` - Program name that exists in the organization

**Optional Fields:**
- `user_id` - Link to existing User account
- `phone` - Phone number (format: 555-123-4567)
- `certifications` - Array of certification types
- `license_number` - Student license number
- `emergency_contact` - Emergency contact information
- `enrollmentDate` - Enrollment date (defaults to current date)
- `status` - Student status (defaults to "Active")
- `stage` - Current stage in program
- `nextMilestone` - Next milestone to achieve
- `notes` - General notes about the student
- `studentNotes` - Array of detailed student notes

### GET /api/organizations/{organizationId}/students/{studentId}
Get a specific student with all details.

### PUT /api/organizations/{organizationId}/students/{studentId}
Update a student record.

### DELETE /api/organizations/{organizationId}/students/{studentId}
Delete a student record.

## Search Functionality Details

The search feature uses a comprehensive approach:

1. **User Information Search**: Searches linked User accounts for first name, last name, and email
2. **Student Field Search**: Searches across all relevant student fields
3. **Partial Matching**: All text searches are case-insensitive and support partial matches
4. **Full Name Search**: Combines first and last name for natural full name searching
5. **Emergency Contact Search**: Includes emergency contact name and phone

## Performance Considerations

- **Pagination Limits**: Maximum 200 items per page to ensure good performance
- **Search Optimization**: Uses MongoDB aggregation pipeline for efficient searching
- **Indexed Fields**: Key fields like organization_id and user_id are indexed for fast queries
- **Default Sorting**: Results sorted by enrollment date (newest first) for relevance

## Error Handling

**400 Bad Request:**
- Invalid pagination parameters
- Invalid organization ID format
- Invalid date formats

**401 Unauthorized:**
- Missing or invalid API key
- Missing or invalid authentication token

**403 Forbidden:**
- Insufficient permissions to access organization data

**500 Internal Server Error:**
- Database connection issues
- Unexpected server errors

All errors return JSON with an `error` field describing the issue.

## Status Values
- `Active` - Currently enrolled and active
- `Inactive` - Temporarily inactive
- `Graduated` - Completed program
- `On Hold` - Enrollment paused
- `Discontinued` - No longer pursuing program

## Certification Types
- `private` - Private Pilot License
- `instrument` - Instrument Rating
- `commercial` - Commercial Pilot License
- `multi-engine` - Multi-Engine Rating
- `cfi` - Certified Flight Instructor
- `cfii` - Certified Flight Instructor Instrument
- `mei` - Multi-Engine Instructor
- `atp` - Airline Transport Pilot License

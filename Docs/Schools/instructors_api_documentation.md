# Instructors API Documentation

## Overview
The Instructors API allows you to manage flight instructor records for flight training organizations, including comprehensive certification management, availability tracking, and performance analytics.

## Enhanced Features
- **Certification Management**: Track current certifications, expiration dates, and renewal requirements
- **Availability Tracking**: Manage instructor schedules and availability windows
- **Rate Management**: Flexible hourly rate structures for different services
- **Performance Analytics**: Track flight hours, student success rates, and instructor ratings
- **Status Management**: Active/Inactive status with automatic scheduling integration

## Access Control

### Role-Based Permissions:

| Role | List Instructors | Create Instructor | View Instructor | Update Instructor | Delete Instructor |
|------|------------------|-------------------|-----------------|-------------------|-------------------|
| **Student** | ✅ Organization Only | ❌ | ✅ Organization Only | ❌ | ❌ |
| **Instructor** | ✅ Organization Only | ❌ | ✅ Own + Organization | ✅ Own Only | ❌ |
| **Organization Admin** | ✅ Organization Only | ✅ | ✅ Organization Only | ✅ Organization Only | ✅ Organization Only |
| **System Admin** | ✅ All Organizations | ✅ | ✅ All | ✅ All | ✅ All |

### Security Features:
- **API key validation** required for all requests
- **JWT authentication** verifies user identity and role
- **Organization-scoped access** prevents cross-organization data access
- **Self-service capabilities** for instructors (own records only)
- **Certification tracking** with expiration alerts

## Instructor Object

```json
{
  "_id": "ObjectId",
  "organization_id": "ObjectId",
  "user_id": "ObjectId", // Optional - links to User account
  "contact_email": "instructor@example.com",
  "phone": "555-123-4567",
  "certifications": {
    "cfi": {
      "number": "CFI123456789",
      "expiration_date": "2024-12-31T23:59:59.999Z",
      "status": "active"
    },
    "cfii": {
      "number": "CFII987654321",
      "expiration_date": "2024-08-15T23:59:59.999Z",
      "status": "active"
    },
    "mei": null
  },
  "specialties": ["private_pilot", "instrument_rating", "commercial"],
  "hourlyRates": {
    "dual_instruction": 85.00,
    "ground_instruction": 65.00,
    "checkride_prep": 95.00
  },
  "availability": {
    "monday": {
      "available": true,
      "start_time": "08:00",
      "end_time": "17:00"
    },
    "tuesday": {
      "available": true,
      "start_time": "08:00",
      "end_time": "17:00"
    }
    // ... other days
  },
  "status": "Active",
  "hire_date": "2023-01-15T00:00:00.000Z",
  "total_flight_hours": 2450.5,
  "total_instruction_hours": 1250.0,
  "rating": 4.7,
  "student_success_rate": 92.3,
  "emergency_contact": {
    "name": "Emergency Contact Name",
    "relationship": "Spouse",
    "phone": "555-987-6543"
  },
  "notes": "Additional instructor notes",
  "documents": [],
  "createdAt": "2023-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-16T14:22:00.000Z"
}
```

## API Endpoints

### GET /api/organizations/{organizationId}/instructors
List all instructors for a specific organization.

### POST /api/organizations/{organizationId}/instructors
Create a new instructor record.

### GET /api/organizations/{organizationId}/instructors/{instructorId}
Get a specific instructor with all details.

### PUT /api/organizations/{organizationId}/instructors/{instructorId}
Update an instructor record.

### DELETE /api/organizations/{organizationId}/instructors/{instructorId}
Delete an instructor record.

## Validation Rules

### Required Fields
- `contact_email` - Must be valid email format
- `phone` - Valid phone number format
- `license_number` - Must be unique across all instructors

### Business Rules
1. **License Uniqueness**: License numbers must be unique
2. **Organization Association**: Instructors can only be created/accessed within their associated organization
3. **Self-Update Only**: Instructors can only update their own records (except admins)
4. **Certification Tracking**: Monitor expiration dates and renewal requirements

## Common Errors

**400 Bad Request:**
- Invalid organization ID format
- Missing required fields
- Invalid certification format

**401 Unauthorized:**
- Missing or invalid authentication token

**403 Forbidden:**
- Insufficient permissions to access organization data
- Instructors attempting to update other instructors' records

**404 Not Found:**
- Instructor not found
- Organization not found

**409 Conflict:**
- License number already in use
- Instructor already exists for this user

**500 Internal Server Error:**
- Database connection issues
- Unexpected server errors
# Flight Schedule API Documentation

## Overview
The Flight Schedule API provides comprehensive flight scheduling capabilities for flight training organizations, enabling efficient management of lessons, aircraft, and instructor assignments.

## Enhanced Features
- **Smart Scheduling**: Intelligent conflict detection and resolution
- **Resource Management**: Automatic aircraft and instructor availability checking
- **Flexible Recurrence**: Support for recurring lesson patterns
- **Real-time Updates**: Live schedule updates with conflict notifications
- **Integration Ready**: Seamless integration with billing and progress tracking

## Access Control

### Role-Based Permissions:

| Role | List Schedules | Create Schedule | View Schedule | Update Schedule | Delete Schedule |
|------|----------------|-----------------|---------------|-----------------|-----------------|
| **Student** | ✅ Own Only | ❌ | ✅ Own Only | ❌ | ❌ |
| **Instructor** | ✅ Organization Only | ✅ | ✅ Organization Only | ✅ Own Lessons | ✅ Own Lessons |
| **Organization Admin** | ✅ Organization Only | ✅ | ✅ Organization Only | ✅ Organization Only | ✅ Organization Only |
| **System Admin** | ✅ All Organizations | ✅ | ✅ All | ✅ All | ✅ All |

### Security Features:
- **API key validation** required for all requests
- **JWT authentication** verifies user identity and role
- **Organization-scoped access** prevents cross-organization data access
- **Resource conflict prevention** ensures scheduling integrity
- **Time zone handling** for accurate scheduling

## Flight Schedule Object

```json
{
  "_id": "ObjectId",
  "organization_id": "ObjectId",
  "student_id": "ObjectId",
  "instructor_id": "ObjectId",
  "aircraft_id": "ObjectId",
  "lesson_type": "dual_instruction",
  "scheduled_start": "2024-03-15T14:00:00.000Z",
  "scheduled_end": "2024-03-15T16:00:00.000Z",
  "actual_start": null,
  "actual_end": null,
  "status": "scheduled",
  "lesson_details": {
    "syllabus_item": "Cross-country navigation",
    "objectives": ["Practice pilotage", "Radio navigation", "Flight planning"],
    "requirements": ["Current medical", "Solo endorsement"],
    "weather_minimums": {
      "visibility": 5,
      "ceiling": 3000,
      "wind": 25
    }
  },
  "location": {
    "departure": "KPAE",
    "destination": "KBFI",
    "route": "Direct",
    "estimated_flight_time": 1.5
  },
  "billing": {
    "aircraft_rate": 125.00,
    "instructor_rate": 65.00,
    "estimated_cost": 255.00,
    "billable": true
  },
  "notes": "Weather permitting - check METAR before departure",
  "recurring": {
    "enabled": false,
    "pattern": "weekly",
    "end_date": null,
    "occurrences": null
  },
  "conflicts": [],
  "created_by": "ObjectId",
  "updated_by": "ObjectId",
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-20T14:22:00.000Z"
}
```

## API Endpoints

### GET /api/organizations/{organizationId}/flight_schedule
List flight schedules with filtering and pagination.

**Query Parameters:**
- `status` - Filter by schedule status
- `instructor_id` - Filter by instructor
- `student_id` - Filter by student
- `aircraft_id` - Filter by aircraft
- `start_date` - Start date filter (YYYY-MM-DD format)
- `end_date` - End date filter (YYYY-MM-DD format)
- `page` - Page number for pagination
- `limit` - Items per page
- `user_id` - Filter by user (student or instructor)
- `search` - Search term across multiple fields
- `sortField` - Field to sort by (default: scheduled_start_time)
- `sortDirection` - Sort direction: 'asc' or 'desc' (default: asc)
- `statusOrder` - Custom status order for sorting (comma-separated)

**Response Format:**
```json
{
  "success": true,
  "message": "Flight schedules retrieved successfully",
  "data": {
    "schedules": [...],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 150,
      "pages": 3,
      "statusCounts": {
        "current": 5,      // "in-progress" status
        "scheduled": 120,  // "scheduled" status
        "completed": 20,   // "completed" status
        "canceled": 5      // "canceled" or "no-show" status
      }
    },
    "search": {
      "term": "search term",
      "resultsFound": 150,
      "originalTotal": 200
    }
  },
  "auditId": "unique-audit-id",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**Status Counts:**
The `statusCounts` object in the pagination provides a breakdown of flight schedules by status for the filtered period:
- `current`: Number of flights with "in-progress" status
- `scheduled`: Number of flights with "scheduled" status  
- `completed`: Number of flights with "completed" status
- `canceled`: Number of flights with "canceled" or "no-show" status

### POST /api/organizations/{organizationId}/flight_schedule
Create a new flight schedule.

**Required Fields:**
- `student_id` - Must exist in organization
- `instructor_id` - Must exist in organization
- `aircraft_id` - Must exist in organization
- `scheduled_start` - ISO date string
- `scheduled_end` - ISO date string
- `lesson_type` - Valid lesson type

### GET /api/organizations/{organizationId}/flight_schedule/{scheduleId}
Get a specific flight schedule with all details.

### PUT /api/organizations/{organizationId}/flight_schedule/{scheduleId}
Update an existing flight schedule.

### DELETE /api/organizations/{organizationId}/flight_schedule/{scheduleId}
Delete a flight schedule.

## Validation Rules

### Time Validation
- `scheduled_end` must be after `scheduled_start`
- Minimum lesson duration: 30 minutes
- Maximum lesson duration: 8 hours
- Schedules cannot be in the past (except by admins)

### Resource Availability
- Aircraft must be available during scheduled time
- Instructor must be available during scheduled time
- Student cannot have overlapping lessons

### Business Rules
1. **Conflict Detection**: Automatic checking for resource conflicts
2. **Organization Scoping**: All resources must belong to the same organization
3. **Role Restrictions**: Students can only view their own schedules
4. **Status Workflow**: Proper status transitions (scheduled → in_progress → completed → billed)

## Common Errors

**400 Bad Request:**
- Invalid date format or time range
- Resource conflicts detected
- Missing required fields

**401 Unauthorized:**
- Missing or invalid authentication token

**403 Forbidden:**
- Insufficient permissions to access organization data
- Students attempting to access other students' schedules

**404 Not Found:**
- Schedule not found
- Referenced resource (student/instructor/aircraft) not found

**409 Conflict:**
- Resource double-booking detected
- Schedule time conflicts

**500 Internal Server Error:**
- Database connection issues
- Unexpected server errors 
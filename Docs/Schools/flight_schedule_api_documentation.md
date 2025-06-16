# Flight Schedule API Documentation

## Overview
The Flight Schedule API allows you to manage flight schedules with both scheduled and actual times. This helps track the difference between planned and actual flight times.

## Field Changes
- `start_time` → `scheduled_start_time` 
- `end_time` → `scheduled_end_time`
- `duration` → `scheduled_duration` (auto-calculated)

## New Fields
- `actual_start_time` (optional, null by default)
- `actual_end_time` (optional, null by default)  
- `actual_duration` (optional, null by default, auto-calculated)

## Flight Schedule Object

```json
{
  "_id": "ObjectId",
  "school_id": "ObjectId",
  "plane_id": "ObjectId", 
  "instructor_id": "ObjectId", // Optional - for solo flights
  "student_id": "ObjectId",
  "scheduled_start_time": "2024-01-15T10:00:00.000Z",
  "scheduled_end_time": "2024-01-15T12:00:00.000Z", 
  "scheduled_duration": 2.0, // Auto-calculated in hours
  "actual_start_time": "2024-01-15T10:05:00.000Z", // Optional
  "actual_end_time": "2024-01-15T12:10:00.000Z", // Optional
  "actual_duration": 2.083, // Auto-calculated in hours when actual times provided
  "flight_type": "Training",
  "status": "completed",
  "notes": "Great lesson on stall recovery",
  "created_at": "2024-01-14T08:00:00.000Z",
  "updated_at": "2024-01-15T12:15:00.000Z"
}
```

## Endpoints

### POST /api/schools/{schoolId}/flight_schedule
Create a new flight schedule.

**Required Fields:**
- `plane_id` - ObjectId of the aircraft
- `student_id` - ObjectId of the student
- `scheduled_start_time` - ISO date string
- `scheduled_end_time` - ISO date string
- `flight_type` - String (e.g., "Training", "Solo", "Checkride")

**Optional Fields:**
- `instructor_id` - ObjectId of instructor (omit for solo flights)
- `actual_start_time` - ISO date string
- `actual_end_time` - ISO date string
- `status` - String (default: "scheduled")
- `notes` - String

**Example Request:**
```json
{
  "plane_id": "64a1b2c3d4e5f6789012345",
  "instructor_id": "64a1b2c3d4e5f6789012346", 
  "student_id": "64a1b2c3d4e5f6789012347",
  "scheduled_start_time": "2024-01-15T10:00:00.000Z",
  "scheduled_end_time": "2024-01-15T12:00:00.000Z",
  "flight_type": "Training",
  "status": "scheduled",
  "notes": "Stall recovery practice"
}
```

### GET /api/schools/{schoolId}/flight_schedule
List flight schedules with filtering and pagination.

**Query Parameters:**
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 50)
- `status` - Filter by status
- `start_date` - Filter by scheduled start date (ISO string)
- `end_date` - Filter by scheduled end date (ISO string)
- `plane_id` - Filter by plane ObjectId
- `instructor_id` - Filter by instructor ObjectId
- `student_id` - Filter by student ObjectId

### GET /api/schools/{schoolId}/flight_schedule/{scheduleId}
Get a specific flight schedule with all populated data.

### PUT /api/schools/{schoolId}/flight_schedule/{scheduleId}
Update a flight schedule. Can update any field including actual times.

**Common Update Example (Recording Actual Times):**
```json
{
  "actual_start_time": "2024-01-15T10:05:00.000Z",
  "actual_end_time": "2024-01-15T12:10:00.000Z",
  "status": "completed",
  "notes": "Flight completed successfully. Student performed well."
}
```

### DELETE /api/schools/{schoolId}/flight_schedule/{scheduleId}
Delete a flight schedule.

## Auto-Calculated Fields

### scheduled_duration
Automatically calculated from `scheduled_start_time` and `scheduled_end_time` in hours.

### actual_duration  
Automatically calculated from `actual_start_time` and `actual_end_time` in hours when both actual times are provided.

## Validation Rules

1. **Scheduled Times**: `scheduled_end_time` must be after `scheduled_start_time`
2. **Actual Times**: `actual_end_time` must be after `actual_start_time` (when both provided)
3. **Conflicts**: System checks for scheduling conflicts with plane, instructor, and student availability
4. **Instructor Optional**: `instructor_id` is optional to support solo flights
5. **ObjectId Validation**: All ObjectId fields are validated for proper format

## Status Values
- `scheduled` - Initial state
- `confirmed` - Flight confirmed
- `in-progress` - Flight currently active
- `completed` - Flight finished
- `canceled` - Flight canceled
- `no-show` - Student/instructor didn't show up

## Use Cases

### 1. Schedule a Training Flight
```json
{
  "plane_id": "64a1b2c3d4e5f6789012345",
  "instructor_id": "64a1b2c3d4e5f6789012346",
  "student_id": "64a1b2c3d4e5f6789012347", 
  "scheduled_start_time": "2024-01-15T10:00:00.000Z",
  "scheduled_end_time": "2024-01-15T12:00:00.000Z",
  "flight_type": "Training"
}
```

### 2. Schedule a Solo Flight
```json
{
  "plane_id": "64a1b2c3d4e5f6789012345",
  "student_id": "64a1b2c3d4e5f6789012347",
  "scheduled_start_time": "2024-01-15T14:00:00.000Z", 
  "scheduled_end_time": "2024-01-15T15:00:00.000Z",
  "flight_type": "Solo"
}
```

### 3. Record Actual Flight Times
```json
{
  "actual_start_time": "2024-01-15T10:05:00.000Z",
  "actual_end_time": "2024-01-15T12:10:00.000Z",
  "status": "completed"
}
```

## Error Handling

The API returns appropriate HTTP status codes:
- `200` - Success
- `201` - Created
- `400` - Validation error
- `401` - Unauthorized (invalid API key)
- `404` - Resource not found
- `409` - Conflict (scheduling conflict)
- `500` - Internal server error

All errors include a JSON response with an `error` field describing the issue. 
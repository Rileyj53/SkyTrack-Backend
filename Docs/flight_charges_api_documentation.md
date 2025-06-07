# Flight Charges API Documentation

## Overview
The Flight Charges API manages charges for flight training activities with a built-in approval workflow. Charges start as "pending" and can be approved or rejected by authorized personnel.

## Flight Charge Object

```json
{
  "_id": "ObjectId",
  "flight_schedule_id": "ObjectId",
  "school_id": "ObjectId",
  "student_id": "ObjectId",
  "plane_id": "ObjectId",
  "instructor_id": "ObjectId",
  "duration": 0.5,
  "rate_type": "instruction",
  "rate_override": null,
  "simulator": false,
  "amount": -125.00,
  "currency": "USD",
  "status": "pending",
  "reason_rejected": null,
  "created_by": "ObjectId",
  "approved_by": null,
  "created_at": "2024-01-15T10:00:00.000Z",
  "approved_at": null,
  "updated_at": "2024-01-15T10:00:00.000Z"
}
```

## Endpoints

### POST /api/schools/{schoolId}/students/{studentId}/flight-charges
Create a new flight charge.

**Required Fields:**
- `flight_schedule_id` - ObjectId of the flight schedule
- `plane_id` - ObjectId of the aircraft used
- `duration` - Flight duration in hours (number >= 0)
- `rate_type` - Type of charge (see Rate Types below)
- `amount` - Charge amount (can be negative for credits)

**Optional Fields:**
- `instructor_id` - ObjectId of instructor (omit for solo flights)
- `rate_override` - Override standard rate (number >= 0)
- `simulator` - Boolean, true for simulator (default: false)
- `currency` - Currency code (default: "USD")
- `status` - Charge status (default: "pending")

**Example Request:**
```json
{
  "flight_schedule_id": "64a1b2c3d4e5f6789012345",
  "plane_id": "64a1b2c3d4e5f6789012346",
  "instructor_id": "64a1b2c3d4e5f6789012347",
  "duration": 1.5,
  "rate_type": "instruction",
  "rate_override": 150.00,
  "simulator": false,
  "amount": 225.00,
  "currency": "USD"
}
```

**Responses:**
- `201` - Charge created successfully
- `400` - Validation error
- `401` - Unauthorized
- `404` - Student or flight schedule not found

### GET /api/schools/{schoolId}/students/{studentId}/flight-charges
List flight charges for a student with filtering and pagination.

**Query Parameters:**
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 50)
- `status` - Filter by status ('pending', 'approved', 'rejected')
- `rate_type` - Filter by rate type
- `start_date` - Filter by creation date (ISO string)
- `end_date` - Filter by creation date (ISO string)
- `flight_schedule_id` - Filter by specific flight schedule

**Example Response:**
```json
{
  "charges": [
    {
      "_id": "64a1b2c3d4e5f6789012348",
      "flight_schedule_id": {
        "scheduled_start_time": "2024-01-15T10:00:00.000Z",
        "scheduled_end_time": "2024-01-15T11:30:00.000Z",
        "flight_type": "Training"
      },
      "amount": 225.00,
      "status": "approved",
      "created_by": {
        "first_name": "John",
        "last_name": "Instructor",
        "role": "instructor"
      },
      "approved_by": {
        "first_name": "Jane",
        "last_name": "Admin",
        "role": "school_admin"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 25,
    "pages": 1
  },
  "summary": {
    "pending": {
      "count": 5,
      "totalAmount": 750.00
    },
    "approved": {
      "count": 20,
      "totalAmount": 3000.00
    }
  }
}
```

### GET /api/schools/{schoolId}/students/{studentId}/flight-charges/{chargeId}
Get a specific flight charge with all populated data.

### PUT /api/schools/{schoolId}/students/{studentId}/flight-charges/{chargeId}
Update a flight charge or change its approval status.

#### Regular Update
Update charge details:
```json
{
  "amount": 250.00,
  "rate_override": 175.00,
  "duration": 1.75
}
```

#### Approve Charge
```json
{
  "action": "approve"
}
```

#### Reject Charge
```json
{
  "action": "reject",
  "reason_rejected": "Incorrect duration reported"
}
```

### DELETE /api/schools/{schoolId}/students/{studentId}/flight-charges/{chargeId}
Delete a flight charge.

**Permission Requirements:**
- School admins can delete pending and rejected charges
- System admins can delete any charge including approved ones
- Approved charges cannot be deleted by school admins

## Rate Types

Supported rate types:
- `instruction` - Flight instruction with instructor
- `solo` - Solo flight time
- `aircraft_rental` - Aircraft rental without instruction
- `fuel` - Fuel charges
- `landing_fee` - Airport landing fees
- `simulator` - Simulator time
- `ground_school` - Ground instruction
- `checkride` - Checkride examination
- `other` - Other miscellaneous charges

## Currency Support

Supported currencies:
- `USD` - US Dollar (default)
- `EUR` - Euro
- `GBP` - British Pound
- `CAD` - Canadian Dollar
- `AUD` - Australian Dollar
- `JPY` - Japanese Yen

## Status Workflow

### Pending → Approved
- Charge is approved by authorized personnel
- `approved_by` and `approved_at` fields are set
- Charge becomes part of student's billing

### Pending → Rejected
- Charge is rejected with a reason
- `approved_by`, `approved_at`, and `reason_rejected` fields are set
- Charge does not affect student billing

### Business Rules
- Only pending charges can be modified
- Approved charges require system admin privileges to delete
- Rejection requires a reason
- Created by user is automatically set from authentication token

## Validation Rules

### Required Fields
- `flight_schedule_id` must reference existing flight schedule for the student
- `plane_id` must be valid ObjectId
- `duration` must be non-negative number
- `rate_type` must be from supported list
- `amount` must be numeric (can be negative)

### Optional Fields
- `instructor_id` can be omitted for solo flights
- `rate_override` must be non-negative if provided
- `simulator` defaults to false
- `currency` defaults to USD

## Example Use Cases

### 1. Create Instruction Charge
```json
POST /api/schools/68389c818d13949c514ac59c/students/6841e28c8d13949c514ac6dd/flight-charges
{
  "flight_schedule_id": "64a1b2c3d4e5f6789012345",
  "plane_id": "684238fc551d3d8d70edbeb4",
  "instructor_id": "6838ad948d13949c514ac678",
  "duration": 1.5,
  "rate_type": "instruction",
  "amount": 225.00
}
```

### 2. Create Solo Flight Charge
```json
{
  "flight_schedule_id": "64a1b2c3d4e5f6789012345",
  "plane_id": "684238fc551d3d8d70edbeb4",
  "duration": 1.0,
  "rate_type": "solo",
  "amount": 120.00
}
```

### 3. Create Simulator Charge
```json
{
  "flight_schedule_id": "64a1b2c3d4e5f6789012345",
  "plane_id": "64a1b2c3d4e5f6789012346",
  "instructor_id": "6838ad948d13949c514ac678",
  "duration": 2.0,
  "rate_type": "simulator",
  "simulator": true,
  "amount": 80.00
}
```

### 4. Approve Charge
```json
PUT /api/schools/68389c818d13949c514ac59c/students/6841e28c8d13949c514ac6dd/flight-charges/64a1b2c3d4e5f6789012348
{
  "action": "approve"
}
```

### 5. Reject Charge
```json
PUT /api/schools/68389c818d13949c514ac59c/students/6841e28c8d13949c514ac6dd/flight-charges/64a1b2c3d4e5f6789012348
{
  "action": "reject",
  "reason_rejected": "Flight was canceled due to weather"
}
```

### 6. Apply Credit/Refund
```json
{
  "flight_schedule_id": "64a1b2c3d4e5f6789012345",
  "plane_id": "684238fc551d3d8d70edbeb4",
  "duration": 0,
  "rate_type": "other",
  "amount": -50.00,
  "status": "approved"
}
```

## Error Handling

Standard HTTP status codes:
- `200` - Success
- `201` - Created
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (invalid API key/auth)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found (resource not found)
- `409` - Conflict (business rule violation)
- `500` - Internal Server Error

Error responses include descriptive messages:
```json
{
  "error": "Flight schedule not found for this student"
}
```

## Security Features

- API key validation required
- JWT authentication required
- User tracking (created_by automatically set)
- Role-based permissions for deletions
- Student-school relationship validation
- Flight schedule ownership validation 
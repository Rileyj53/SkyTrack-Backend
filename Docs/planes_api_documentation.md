# Planes API Documentation

## Overview
The Planes API provides comprehensive aircraft management functionality including aircraft registration, maintenance tracking, airworthiness directives, and service bulletins. All endpoints are school-scoped with role-based access control.

## Access Control Matrix

| Role | Planes | Maintenance | Airworthiness Directives | Service Bulletins |
|------|---------|-------------|-------------------------|-------------------|
| **Student** | ✅ View Only | ❌ No Access | ❌ No Access | ❌ No Access |
| **Instructor** | ✅ View Only | ✅ View Only | ✅ View Only | ✅ View Only |
| **School Admin** | ✅ Full CRUD | ✅ Full CRUD | ✅ Full CRUD | ✅ Full CRUD |
| **System Admin** | ✅ Full CRUD | ✅ Full CRUD | ✅ Full CRUD | ✅ Full CRUD |

## Plane Object Structure

```json
{
  "id": "ObjectId",
  "registration": "N123AB",
  "type": "Single Engine",
  "model": "Cessna 172",
  "year": 2020,
  "engineHours": 1250.5,
  "tach_time": 1248.2,
  "hopps_time": 1252.8,
  "lastMaintenance": "2024-01-15T00:00:00.000Z",
  "nextMaintenance": "2024-04-15T00:00:00.000Z",
  "status": "Available",
  "hourlyRates": {
    "wet": 150.00,
    "dry": 120.00,
    "block": 140.00,
    "instruction": 175.00,
    "weekend": 160.00,
    "solo": 130.00,
    "checkride": 200.00
  },
  "specialRates": [
    {
      "name": "Multi-Engine Training",
      "rate": 250.00,
      "conditions": "Requires multi-engine instructor"
    }
  ],
  "utilization": {
    "monthly": 45.5,
    "yearly": 520.2
  },
  "location": "Hangar A",
  "notes": "Recently overhauled engine"
}
```

## Core Planes Endpoints

### GET /api/schools/{schoolId}/planes
List all planes for a school.

**Access:** Students, Instructors, School Admins, System Admins

**Student Access:** Students can view basic plane information including registration, model, status, rates, and location. This allows them to see available aircraft for booking and understand training fleet.

**Response:**
```json
{
  "planes": [
    {
      "id": "64a1b2c3d4e5f6789012345",
      "registration": "N123AB",
      "type": "Single Engine",
      "model": "Cessna 172",
      "year": 2020,
      "status": "Available",
      "hourlyRates": {
        "wet": 150.00,
        "dry": 120.00,
        "instruction": 175.00
      },
      "location": "Hangar A"
    }
  ]
}
```

### POST /api/schools/{schoolId}/planes
Create a new plane.

**Access:** School Admins, System Admins

**Required Fields:**
- `registration` - Aircraft registration (automatically converted to uppercase)
- `type` - Aircraft type (e.g., "Single Engine", "Multi Engine")
- `model` - Aircraft model
- `year` - Manufacturing year
- `engineHours` - Current engine hours
- `status` - Current status
- `location` - Current location
- `hourlyRates` - Complete hourly rates object

**Example Request:**
```json
{
  "registration": "n456cd",
  "type": "Single Engine",
  "model": "Piper Cherokee",
  "year": 2018,
  "engineHours": 890.5,
  "status": "Available",
  "location": "Ramp B",
  "hourlyRates": {
    "wet": 140.00,
    "dry": 110.00,
    "block": 130.00,
    "instruction": 165.00,
    "weekend": 150.00,
    "solo": 120.00,
    "checkride": 190.00
  },
  "specialRates": [],
  "notes": "Recently purchased"
}
```

### GET /api/schools/{schoolId}/planes/{planeId}
Get a specific plane with all details.

**Access:** Students, Instructors, School Admins, System Admins

**Student Access:** Students can view basic plane details for aircraft at their school. This is essential for flight planning and understanding the aircraft they'll be training in.

### PUT /api/schools/{schoolId}/planes/{planeId}
Update a plane's information.

**Access:** School Admins, System Admins

**Validation:**
- All hourly rate fields must be present if `hourlyRates` is provided
- `specialRates` must be an array
- Automatic removal of `_id` fields from `specialRates`

### DELETE /api/schools/{schoolId}/planes/{planeId}
Delete a plane.

**Access:** School Admins, System Admins

## Maintenance Endpoints

### GET /api/schools/{schoolId}/planes/{planeId}/maintenance
Get all maintenance records for a plane.

**Access:** Instructors, School Admins, System Admins

**Response:**
```json
[
  {
    "_id": "64a1b2c3d4e5f6789012348",
    "aircraftId": "64a1b2c3d4e5f6789012345",
    "date": "2024-01-15T00:00:00.000Z",
    "type": "100 Hour Inspection",
    "description": "Routine 100-hour inspection",
    "workPerformed": ["Engine inspection", "Control surfaces check"],
    "partsReplaced": ["Oil filter", "Spark plugs"],
    "technician": "John Smith A&P",
    "aircraftHours": 1250.5,
    "nextDue": "2024-02-15T00:00:00.000Z",
    "status": "Completed",
    "referenceDocuments": ["Log entry 245", "Work order 1023"],
    "notes": "All systems operating normally"
  }
]
```

### POST /api/schools/{schoolId}/planes/{planeId}/maintenance
Create a new maintenance record.

**Access:** Instructors, School Admins, System Admins

**Required Fields:**
- `date` - Maintenance date
- `type` - Type of maintenance
- `description` - Maintenance description
- `technician` - Technician information
- `status` - Maintenance status

### PUT /api/schools/{schoolId}/planes/{planeId}/maintenance/{logId}
Update a maintenance record.

**Access:** Instructors, School Admins, System Admins

### DELETE /api/schools/{schoolId}/planes/{planeId}/maintenance/{logId}
Delete a maintenance record.

**Access:** Instructors, School Admins, System Admins

## Maintenance Schedule Endpoints

### GET /api/schools/{schoolId}/planes/{planeId}/maintenance-schedule
Get the maintenance schedule for a plane.

**Access:** Instructors, School Admins, System Admins

**Response:**
```json
{
  "_id": "64a1b2c3d4e5f6789012349",
  "plane_id": "64a1b2c3d4e5f6789012345",
  "school_id": "64a1b2c3d4e5f6789012340",
  "maintenance_type": "100 Hour Inspection",
  "frequency_hours": 100,
  "frequency_days": 365,
  "last_maintenance": "2024-01-15T00:00:00.000Z",
  "next_maintenance": "2024-04-15T00:00:00.000Z",
  "notes": "Standard inspection schedule"
}
```

### POST /api/schools/{schoolId}/planes/{planeId}/maintenance-schedule
Create a maintenance schedule for a plane.

**Access:** School Admins, System Admins

**Business Rules:**
- Only one maintenance schedule per plane
- Returns 400 error if schedule already exists

### PUT /api/schools/{schoolId}/planes/{planeId}/maintenance-schedule
Update the maintenance schedule for a plane.

**Access:** School Admins, System Admins

## Airworthiness Directives Endpoints

### GET /api/schools/{schoolId}/planes/{planeId}/airworthiness-directives
Get all airworthiness directives for a plane.

**Access:** Instructors, School Admins, System Admins

**Response:**
```json
{
  "airworthinessDirectives": [
    {
      "_id": "64a1b2c3d4e5f6789012350",
      "aircraftId": "64a1b2c3d4e5f6789012345",
      "adNumber": "2024-02-15",
      "title": "Fuel System Component Replacement",
      "description": "Mandatory replacement of fuel selector valve",
      "status": "Compliant",
      "complianceDate": "2024-05-15T00:00:00.000Z",
      "nextDueDate": "2025-05-15T00:00:00.000Z",
      "notes": "Completed during annual inspection"
    }
  ]
}
```

### POST /api/schools/{schoolId}/planes/{planeId}/airworthiness-directives
Create a new airworthiness directive.

**Access:** School Admins, System Admins

**Required Fields:**
- `adNumber` - AD number (must be unique per aircraft)
- `title` - AD title
- `description` - AD description
- `status` - AD status ("Compliant", "Pending", "Not Applicable")

**Validation:**
- Status must be one of the valid enum values
- Date fields must be valid ISO dates
- Duplicate AD numbers return 409 error

### PUT /api/schools/{schoolId}/planes/{planeId}/airworthiness-directives/{adId}
Update an airworthiness directive.

**Access:** School Admins, System Admins

### DELETE /api/schools/{schoolId}/planes/{planeId}/airworthiness-directives/{adId}
Delete an airworthiness directive.

**Access:** School Admins, System Admins

## Service Bulletins Endpoints

### GET /api/schools/{schoolId}/planes/{planeId}/service-bulletins
Get all service bulletins for a plane.

**Access:** Instructors, School Admins, System Admins

**Response:**
```json
{
  "serviceBulletins": [
    {
      "_id": "64a1b2c3d4e5f6789012351",
      "aircraftId": "64a1b2c3d4e5f6789012345",
      "sbNumber": "SB-2024-01",
      "title": "Propeller Inspection",
      "description": "Mandatory inspection of propeller blades",
      "status": "Completed",
      "completionDate": "2024-06-15T00:00:00.000Z",
      "notes": "Inspection completed, no issues found"
    }
  ]
}
```

### POST /api/schools/{schoolId}/planes/{planeId}/service-bulletins
Create a new service bulletin.

**Access:** School Admins, System Admins

**Required Fields:**
- `sbNumber` - Service bulletin number (must be unique per aircraft)
- `title` - SB title
- `description` - SB description
- `status` - SB status ("Completed", "Pending", "Not Applicable")

**Validation:**
- Status must be one of the valid enum values
- `completionDate` must be valid ISO date if provided
- Duplicate SB numbers return 409 error

### PUT /api/schools/{schoolId}/planes/{planeId}/service-bulletins/{sbId}
Update a service bulletin.

**Access:** School Admins, System Admins

### DELETE /api/schools/{schoolId}/planes/{planeId}/service-bulletins/{sbId}
Delete a service bulletin.

**Access:** School Admins, System Admins

## Status Values

### Plane Status
- `Available` - Ready for flight
- `Maintenance` - Under maintenance
- `Out of Service` - Not airworthy
- `Reserved` - Reserved for specific use

### Maintenance Status
- `Scheduled` - Maintenance scheduled
- `In Progress` - Currently being worked on
- `Completed` - Maintenance finished
- `Overdue` - Past due date

### AD/SB Status
- `Compliant` - Requirement met
- `Pending` - Awaiting compliance
- `Not Applicable` - Does not apply to this aircraft

## Validation Rules

### Aircraft Registration
- Automatically converted to uppercase
- Must be unique within school
- Cannot be changed once created

### Hourly Rates
- All required rate types must be provided:
  - `wet`, `dry`, `block`, `instruction`, `weekend`, `solo`, `checkride`
- Must be numeric values >= 0

### Dates
- All dates must be valid ISO 8601 format
- Compliance dates are optional but validated if provided

### School Scoping
- All aircraft belong to a specific school
- Cross-school access is prevented
- Students can only view aircraft at their enrolled school
- System admins can access all schools

## Error Handling

### Common Error Responses

**400 - Validation Error:**
```json
{
  "error": "Missing required fields",
  "details": ["registration is required", "type is required"],
  "example": {
    "registration": "N123AB",
    "type": "Single Engine"
  }
}
```

**403 - Access Denied:**
```json
{
  "error": "Forbidden: Students cannot view maintenance records"
}
```

**404 - Not Found:**
```json
{
  "error": "Plane not found in this school"
}
```

**409 - Duplicate:**
```json
{
  "error": "Duplicate airworthiness directive",
  "details": "An AD with number 2024-02-15 already exists for this aircraft"
}
```

## Business Logic

### Aircraft Management
- Registration numbers are automatically uppercased
- Duplicate registrations within a school are prevented
- Aircraft deletion removes all associated maintenance records

### Maintenance Tracking
- Maintenance records are linked to specific aircraft
- Historical maintenance data is preserved
- Maintenance schedules track recurring requirements

### Compliance Management
- Airworthiness Directives track mandatory compliance
- Service Bulletins track recommended improvements
- Status tracking ensures regulatory compliance

## Integration Points

### Flight Scheduling
- Aircraft status affects scheduling availability
- Maintenance periods block scheduling
- Engine hours updated from flight records

### Financial System
- Hourly rates used for flight charge calculations
- Special rates override standard rates
- Maintenance costs tracked separately

### Regulatory Compliance
- AD compliance ensures airworthiness
- Maintenance logs provide audit trail
- Service bulletin tracking enhances safety

## Use Cases

### 1. Aircraft Registration
```json
POST /api/schools/{schoolId}/planes
{
  "registration": "n789gh",
  "type": "Multi Engine",
  "model": "Beechcraft Baron",
  "year": 2022,
  "engineHours": 245.8,
  "status": "Available",
  "location": "Hangar C",
  "hourlyRates": {
    "wet": 350.00,
    "dry": 280.00,
    "block": 320.00,
    "instruction": 400.00,
    "weekend": 375.00,
    "solo": 300.00,
    "checkride": 450.00
  }
}
```

### 2. Maintenance Record Creation
```json
POST /api/schools/{schoolId}/planes/{planeId}/maintenance
{
  "date": "2024-01-20",
  "type": "Annual Inspection",
  "description": "FAA required annual inspection",
  "workPerformed": ["Complete aircraft inspection"],
  "technician": "Bob Wilson A&P/IA",
  "aircraftHours": 1255.2,
  "status": "Completed"
}
```

### 3. Airworthiness Directive Compliance
```json
POST /api/schools/{schoolId}/planes/{planeId}/airworthiness-directives
{
  "adNumber": "2024-03-22",
  "title": "Engine Mount Inspection",
  "description": "Inspect engine mount for cracks",
  "status": "Pending",
  "complianceDate": "2024-06-30",
  "notes": "Scheduled for next 100-hour inspection"
}
```

### 4. Service Bulletin Implementation
```json
POST /api/schools/{schoolId}/planes/{planeId}/service-bulletins
{
  "sbNumber": "SB-2024-05",
  "title": "Avionics Software Update",
  "description": "Update GPS navigation software",
  "status": "Completed",
  "completionDate": "2024-02-15",
  "notes": "Updated to version 6.2.1"
}
```

## Security Features

- **Role-based Access Control:** Different permissions for students, instructors, and admins
- **School Isolation:** Aircraft data isolated by school; students limited to their enrolled school
- **API Key Authentication:** Required for all requests
- **JWT Validation:** User identity verification
- **Input Validation:** Comprehensive data validation
- **Audit Trail:** All changes tracked with timestamps
- **Student Data Protection:** Students can view aircraft information but cannot access sensitive maintenance or compliance data 
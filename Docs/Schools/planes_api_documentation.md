# Aircraft/Planes API Documentation

## Overview
The Aircraft API provides comprehensive fleet management capabilities for flight training organizations, including aircraft registration, maintenance tracking, scheduling, and performance monitoring.

## Enhanced Features
- **Fleet Management**: Complete aircraft inventory with detailed specifications
- **Maintenance Tracking**: Scheduled and unscheduled maintenance records
- **Availability Management**: Real-time aircraft availability for scheduling
- **Performance Monitoring**: Flight hours, utilization rates, and operational metrics
- **Compliance Tracking**: Registration, insurance, and certification management

## Access Control

### Role-Based Permissions:

| Role | List Aircraft | Create Aircraft | View Aircraft | Update Aircraft | Delete Aircraft |
|------|---------------|-----------------|---------------|-----------------|-----------------|
| **Student** | ✅ Organization Only | ❌ | ✅ Organization Only | ❌ | ❌ |
| **Instructor** | ✅ Organization Only | ❌ | ✅ Organization Only | ❌ | ❌ |
| **Organization Admin** | ✅ Organization Only | ✅ | ✅ Organization Only | ✅ Organization Only | ✅ Organization Only |
| **System Admin** | ✅ All Organizations | ✅ | ✅ All | ✅ All | ✅ All |

### Security Features:
- **API key validation** required for all requests
- **JWT authentication** verifies user identity and role
- **Organization-scoped access** prevents cross-organization data access
- **Maintenance alerts** for proactive fleet management
- **Insurance tracking** with expiration notifications

## Aircraft Object

```json
{
  "_id": "ObjectId",
  "organization_id": "ObjectId",
  "registration": "N12345A",
  "make": "Cessna",
  "model": "172S",
  "year": 2018,
  "serial_number": "172S12345",
  "category": "airplane",
  "class": "single_engine_land",
  "complex": false,
  "high_performance": false,
  "turbine": false,
  "retractable_gear": false,
  "engine": {
    "type": "piston",
    "manufacturer": "Lycoming",
    "model": "IO-360-L2A",
    "horsepower": 180,
    "fuel_type": "100LL"
  },
  "avionics": {
    "gps": "Garmin G1000",
    "autopilot": true,
    "transponder": "Mode S",
    "ads_b": true
  },
  "status": "Available",
  "hourly_rate": 125.00,
  "total_time": 2450.7,
  "time_since_overhaul": 450.2,
  "next_annual": "2024-08-15T00:00:00.000Z",
  "next_100hr": "2024-03-01T00:00:00.000Z",
  "insurance": {
    "company": "AOPA Insurance",
    "policy_number": "INS123456",
    "expiration": "2024-12-31T23:59:59.999Z",
    "coverage_amount": 1000000
  },
  "maintenance_notes": "Recent annual inspection completed",
  "utilization": {
    "daily_hours": 6.5,
    "monthly_hours": 85.2,
    "capacity_percentage": 78.5
  }
}
```

## Core Aircraft Endpoints

### GET /api/organizations/{organizationId}/aircraft
List all aircraft for an organization.

**Access:** Students, Instructors, Organization Admins, System Admins

**Student Access:** Students can view basic aircraft information including registration, model, status, rates, and location. This allows them to see available aircraft for booking and understand training fleet.

**Response:**
```json
{
  "aircraft": [
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

### POST /api/organizations/{organizationId}/aircraft
Create a new aircraft.

**Access:** Organization Admins, System Admins

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

### GET /api/organizations/{organizationId}/aircraft/{aircraftId}
Get a specific aircraft with all details.

**Access:** Students, Instructors, Organization Admins, System Admins

**Student Access:** Students can view basic aircraft details for aircraft at their organization. This is essential for flight planning and understanding the aircraft they'll be training in.

### PUT /api/organizations/{organizationId}/aircraft/{aircraftId}
Update an aircraft's information.

**Access:** Organization Admins, System Admins

**Validation:**
- All hourly rate fields must be present if `hourlyRates` is provided
- `specialRates` must be an array
- Automatic removal of `_id` fields from `specialRates`

### DELETE /api/organizations/{organizationId}/aircraft/{aircraftId}
Delete an aircraft.

**Access:** Organization Admins, System Admins

## Records System

The Records system provides a unified approach to tracking all aircraft maintenance, airworthiness directives, and service bulletins. All records are associated with specific aircraft and support flexible categorization.

### Record Object Structure

```json
{
  "id": "ObjectId",
  "plane_id": "ObjectId",
  "record_type": "maintenance",
  "title": "100-hour Inspection",
  "description": "Replaced spark plugs and checked oil",
  "status": "completed",
  "date": "2024-01-10T00:00:00.000Z",
  "nextDue": "2024-04-10T00:00:00.000Z",
  "aircraftHours": 1250.5,
  "partsReplaced": ["Oil filter", "Brake pads"],
  "notes": "All clear",
  "attachments": [
    {
      "url": "https://s3.url/logbook-entry.pdf",
      "name": "Logbook Entry",
      "uploaded_at": "2024-01-10T12:30:00.000Z"
    }
  ],
  "created_at": "2024-01-10T12:00:00.000Z",
  "updated_at": "2024-01-10T12:00:00.000Z"
}
```

### Record Types
- `maintenance` - General maintenance activities, inspections, repairs
- `airworthiness` - Airworthiness directives and compliance tracking
- `service_bulletin` - Service bulletin implementation and tracking

## Records Collection Endpoints

### GET /api/organizations/{organizationId}/aircraft/{aircraftId}/records
Get all records for a specific aircraft.

**Access:** Instructors, Organization Admins, System Admins

**Query Parameters:**
- `record_type` - Filter by record type (`maintenance`, `airworthiness`, `service_bulletin`)
- `status` - Filter by status
- `limit` - Number of records to return (default: 50)
- `offset` - Number of records to skip (default: 0)

**Example Request:**
```
GET /api/organizations/{organizationId}/aircraft/{aircraftId}/records?record_type=maintenance&status=completed&limit=10&offset=0
```

**Response:**
```json
{
  "records": [
    {
      "id": "64a1b2c3d4e5f6789012348",
      "plane_id": "64a1b2c3d4e5f6789012345",
      "record_type": "maintenance",
      "title": "100-hour Inspection",
      "description": "Routine 100-hour inspection completed",
      "status": "completed",
      "date": "2024-01-15T00:00:00.000Z",
      "nextDue": "2024-04-15T00:00:00.000Z",
      "aircraftHours": 1250.5,
      "partsReplaced": ["Oil filter", "Spark plugs"],
      "notes": "All systems operating normally",
      "attachments": [],
      "created_at": "2024-01-15T12:00:00.000Z",
      "updated_at": "2024-01-15T12:00:00.000Z"
    }
  ],
  "total": 25,
  "limit": 10,
  "offset": 0
}
```

### POST /api/organizations/{organizationId}/aircraft/{aircraftId}/records
Create a new record for an aircraft.

**Access:** Instructors, Organization Admins, System Admins

**Required Fields:**
- `description` - Record description

**Optional Fields:**
- `record_type` - Type of record (`maintenance`, `airworthiness`, `service_bulletin`)
- `title` - Record title
- `status` - Record status
- `date` - Date of work/compliance
- `nextDue` - Next due date
- `aircraftHours` - Aircraft hours at time of record
- `partsReplaced` - Array of parts replaced
- `notes` - Additional notes
- `attachments` - Array of attachment objects

**Example Request:**
```json
{
  "record_type": "maintenance",
  "title": "Oil Change",
  "description": "Changed engine oil and filter",
  "status": "completed",
  "date": "2024-02-01T00:00:00.000Z",
  "aircraftHours": 1275.8,
  "partsReplaced": ["Oil filter"],
  "notes": "Used Mobil 1 aviation oil",
  "attachments": [
    {
      "url": "https://s3.amazonaws.com/bucket/oil-change-receipt.pdf",
      "name": "Oil Change Receipt"
    }
  ]
}
```

### PUT /api/organizations/{organizationId}/aircraft/{aircraftId}/records
Bulk update multiple records for an aircraft.

**Access:** Organization Admins, System Admins

**Request Body:**
```json
{
  "filter": {
    "record_type": "maintenance",
    "status": "pending"
  },
  "update": {
    "status": "completed",
    "notes": "Bulk completion update"
  }
}
```

**Response:**
```json
{
  "message": "Records updated successfully",
  "updated_count": 3
}
```

### DELETE /api/organizations/{organizationId}/aircraft/{aircraftId}/records
Bulk delete records for an aircraft.

**Access:** Organization Admins, System Admins

**Query Parameters:**
- `ids` - Comma-separated list of record IDs to delete
- `record_type` - Delete all records of this type
- `status` - Delete all records with this status

**Example Requests:**
```
DELETE /api/organizations/{organizationId}/aircraft/{aircraftId}/records?ids=id1,id2,id3
DELETE /api/organizations/{organizationId}/aircraft/{aircraftId}/records?record_type=maintenance&status=draft
```

**Response:**
```json
{
  "message": "Records deleted successfully",
  "deleted_count": 5
}
```

## Individual Record Endpoints

### GET /api/organizations/{organizationId}/aircraft/{aircraftId}/records/{recordId}
Get a specific record.

**Access:** Instructors, Organization Admins, System Admins

**Response:**
```json
{
  "record": {
    "id": "64a1b2c3d4e5f6789012348",
    "plane_id": "64a1b2c3d4e5f6789012345",
    "record_type": "airworthiness",
    "title": "AD 2024-02-15",
    "description": "Fuel system component replacement",
    "status": "compliant",
    "date": "2024-01-20T00:00:00.000Z",
    "nextDue": "2025-01-20T00:00:00.000Z",
    "aircraftHours": 1260.2,
    "notes": "Completed during annual inspection",
    "attachments": [
      {
        "url": "https://s3.amazonaws.com/bucket/ad-compliance-cert.pdf",
        "name": "Compliance Certificate",
        "uploaded_at": "2024-01-20T14:30:00.000Z"
      }
    ],
    "created_at": "2024-01-20T12:00:00.000Z",
    "updated_at": "2024-01-20T14:30:00.000Z"
  }
}
```

### PUT /api/organizations/{organizationId}/aircraft/{aircraftId}/records/{recordId}
Update a specific record.

**Access:** Instructors, Organization Admins, System Admins

**Example Request:**
```json
{
  "status": "completed",
  "notes": "Work completed ahead of schedule",
  "attachments": [
    {
      "url": "https://s3.amazonaws.com/bucket/completion-photo.jpg",
      "name": "Completion Photo"
    }
  ]
}
```

### DELETE /api/organizations/{organizationId}/aircraft/{aircraftId}/records/{recordId}
Delete a specific record.

**Access:** Organization Admins, System Admins

**Response:**
```json
{
  "message": "Record deleted successfully"
}
```

## Status Values

### Aircraft Status
- `Available` - Ready for flight
- `Maintenance` - Under maintenance
- `Out of Service` - Not airworthy
- `Reserved` - Reserved for specific use

### Record Status
- `pending` - Awaiting action
- `in_progress` - Currently being worked on
- `completed` - Work finished
- `compliant` - Requirement met
- `overdue` - Past due date
- `not_applicable` - Does not apply

## Validation Rules

### Aircraft Registration
- Automatically converted to uppercase
- Must be unique within organization
- Cannot be changed once created

### Hourly Rates
- All required rate types must be provided:
  - `wet`, `dry`, `block`, `instruction`, `weekend`, `solo`, `checkride`
- Must be numeric values >= 0

### Records
- `description` field is required for all records
- `record_type` must be one of: `maintenance`, `airworthiness`, `service_bulletin`
- All date fields must be valid ISO 8601 format
- `partsReplaced` must be an array of strings
- `attachments` must be an array of objects with `url` and `name` fields

### Organization Scoping
- All aircraft belong to a specific organization
- Cross-organization access is prevented
- Students can only view aircraft at their enrolled organization
- System admins can access all organizations

## Error Handling

### Common Error Responses

**400 - Validation Error:**
```json
{
  "error": "Missing required field: description"
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
  "error": "Aircraft not found or does not belong to this organization"
}
```

**404 - Record Not Found:**
```json
{
  "error": "Record not found"
}
```

## Business Logic

### Aircraft Management
- Registration numbers are automatically uppercased
- Duplicate registrations within an organization are prevented
- Aircraft deletion removes all associated records

### Records Management
- Records are linked to specific aircraft and organizations
- Historical record data is preserved
- Flexible categorization supports different record types
- Bulk operations support efficient data management

### Compliance Tracking
- Records can track mandatory compliance (airworthiness directives)
- Service bulletin implementation tracking
- Status tracking ensures regulatory compliance
- Attachment support for documentation

## Integration Points

### Flight Scheduling
- Aircraft status affects scheduling availability
- Maintenance periods block scheduling
- Engine hours updated from flight records

### Financial System
- Hourly rates used for flight charge calculations
- Special rates override standard rates
- Maintenance costs tracked in records

### Regulatory Compliance
- Records provide comprehensive audit trail
- Attachment system supports documentation requirements
- Flexible categorization supports various compliance needs

## Use Cases

### 1. Aircraft Registration
```json
POST /api/organizations/{organizationId}/aircraft
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
POST /api/organizations/{organizationId}/aircraft/{aircraftId}/records
{
  "record_type": "maintenance",
  "title": "Annual Inspection",
  "description": "FAA required annual inspection completed",
  "status": "completed",
  "date": "2024-01-20T00:00:00.000Z",
  "aircraftHours": 1255.2,
  "partsReplaced": ["Battery", "Tire"],
  "notes": "All systems checked and approved",
  "attachments": [
    {
      "url": "https://s3.amazonaws.com/bucket/annual-inspection-cert.pdf",
      "name": "Annual Inspection Certificate"
    }
  ]
}
```

### 3. Airworthiness Directive Compliance
```json
POST /api/organizations/{organizationId}/aircraft/{aircraftId}/records
{
  "record_type": "airworthiness",
  "title": "AD 2024-03-22",
  "description": "Engine mount inspection for cracks completed",
  "status": "compliant",
  "date": "2024-02-15T00:00:00.000Z",
  "nextDue": "2025-02-15T00:00:00.000Z",
  "aircraftHours": 1265.5,
  "notes": "No cracks found, mount in good condition"
}
```

### 4. Service Bulletin Implementation
```json
POST /api/organizations/{organizationId}/aircraft/{aircraftId}/records
{
  "record_type": "service_bulletin",
  "title": "SB 2024-05 - Avionics Update",
  "description": "GPS navigation software updated to version 6.2.1",
  "status": "completed",
  "date": "2024-02-15T00:00:00.000Z",
  "aircraftHours": 1270.1,
  "notes": "Software update successful, all functions tested"
}
```

### 5. Bulk Status Update
```json
PUT /api/organizations/{organizationId}/aircraft/{aircraftId}/records
{
  "filter": {
    "record_type": "maintenance",
    "status": "pending"
  },
  "update": {
    "status": "in_progress",
    "notes": "Maintenance team assigned"
  }
}
```

## Security Features

- **Role-based Access Control:** Different permissions for students, instructors, and admins
- **Organization Isolation:** Aircraft and records isolated by organization; students limited to their enrolled organization
- **API Key Authentication:** Required for all requests
- **JWT Validation:** User identity verification
- **Input Validation:** Comprehensive data validation
- **Audit Trail:** All changes tracked with timestamps
- **Student Data Protection:** Students can view aircraft information but cannot access maintenance records
 
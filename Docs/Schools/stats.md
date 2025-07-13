# GET /api/schools/{schoolId}/stats

## 🎯 Overview
Retrieves comprehensive statistics and metrics for a specific school including flight operations, aircraft efficiency, instructor performance, student metrics, and maintenance records.

## 🔐 Security
- **Requires Auth**: ✅ (JWT Bearer token)
- **Requires API Key**: ✅ (X-API-Key header)
- **Requires CSRF Token**: ✅ (X-CSRF-Token header)
- **Allowed Roles**: `['school_admin', 'instructor']`
- **School Access Required**: ✅ (must have access to specified school)
- **Fraud Detection**: ✅ Enabled
- **Risk Scoring**: ✅ Enabled
- **Data Classification**: `confidential`
- **Rate Limiting**: 100 requests per minute

## 📥 Request

**Method**: `GET`  
**Path**: `/api/schools/{schoolId}/stats`

### Path Parameters
- `schoolId` (string, required): The unique identifier of the school

### Query Parameters
- `range` (string, optional): Time range for statistics
  - `7` - Last 7 days
  - `30` - Last 30 days (default)
  - `90` - Last 90 days
  - `365` - Last 365 days
- `include_financials` (boolean, optional): Whether to include financial metrics (default: false)

### Headers
- `Authorization: Bearer <token>` (required): JWT authentication token
- `X-API-Key: <key>` (required): Valid API key
- `X-CSRF-Token: <token>` (required): CSRF protection token

## 📤 Response

### Success Response (200)
```json
{
  "success": true,
  "message": "School statistics retrieved successfully",
  "data": {
    "stats": {
      "overview": {
        "school_name": "Demo Flight School",
        "total_students": 20,
        "active_students": 20,
        "total_instructors": 2,
        "active_instructors": 2,
        "total_planes": 4,
        "active_planes": 4,
        "upcoming_lessons": 0,
        "upcoming_lessons_next_7_days": 0
      },
      "flight_operations": {
        "total_flights_period": 17,
        "completed_flights": 1,
        "completion_rate": 5.88,
        "recent_flights_7_days": 1,
        "schedule_adherence_percentage": 100,
        "avg_delay_minutes": 5,
        "flight_status_breakdown": [...],
        "flight_type_breakdown": [...],
        "peak_operating_hours": [...]
      },
      "aircraft_efficiency": {
        "plane_status_breakdown": [...],
        "detailed_plane_stats": [...],
        "maintenance_alerts": {
          "count": 4,
          "overdue_count": 2,
          "upcoming_count": 1,
          "alerts": [
            {
              "registration": "N531ND",
              "record_id": "64f123...",
              "record_type": "maintenance",
              "title": "100-hour inspection",
              "description": "Regular maintenance inspection",
              "status": "pending",
              "next_maintenance": "2024-12-15T00:00:00.000Z",
              "days_until_maintenance": -30,
              "aircraft_hours": 1250.5,
              "is_overdue": true
            }
          ]
        },
        "recent_maintenance_activity": [
          {
            "id": "64f123...",
            "registration": "N531ND",
            "title": "Oil change",
            "description": "Routine oil change",
            "status": "completed",
            "date": "2024-11-01T00:00:00.000Z",
            "aircraft_hours": 1200.0,
            "parts_replaced": 2
          }
        ],
        "maintenance_status_breakdown": [
          {
            "_id": "completed",
            "count": 15,
            "avgAircraftHours": 1150.5,
            "totalPartsReplaced": 25
          },
          {
            "_id": "pending",
            "count": 3,
            "avgAircraftHours": 1250.0,
            "totalPartsReplaced": 0
          }
        ],
        "maintenance_types_breakdown": [
          {
            "_id": "maintenance",
            "count": 20,
            "completed": 15,
            "pending": 3,
            "overdue": 2
          },
          {
            "_id": "airworthiness",
            "count": 5,
            "completed": 4,
            "pending": 0,
            "overdue": 1
          },
          {
            "_id": "service_bulletin",
            "count": 2,
            "completed": 2,
            "pending": 0,
            "overdue": 0
          }
        ],
        "aircraft_utilization": [...],
        "average_utilization_rate": 0
      },
      "instructor_efficiency": {...},
      "student_metrics": {...},
      "operational_metrics": {...},
      "upcoming_schedule": {...}
    },
    "metadata": {
      "school_id": "6871b9fc17dff3ed898201dc",
      "school_name": "Demo Flight School",
      "time_range_days": 30,
      "start_date": "2024-11-13T20:06:50.245Z",
      "end_date": "2024-12-13T20:06:50.245Z",
      "includes_financials": false,
      "generated_at": "2024-12-13T20:06:50.245Z",
      "processing_time_ms": 2055
    }
  },
  "auditId": "abc123...",
  "timestamp": "2024-12-13T20:06:52.300Z"
}
```

## 🔍 Key Data Sections

### **Maintenance System (Updated)**
The maintenance system now uses `PlaneRecord` entries instead of simple plane fields:

- **maintenance_alerts**: Active maintenance records with due dates
  - `count`: Total number of maintenance alerts
  - `overdue_count`: Number of overdue maintenance items
  - `upcoming_count`: Number of maintenance items due within 30 days
  - `alerts`: Array of maintenance records with details

- **recent_maintenance_activity**: Recent maintenance work performed
  - Shows completed maintenance records from the specified time range
  - Includes parts replaced count and aircraft hours

- **maintenance_status_breakdown**: Summary by maintenance status
  - Groups maintenance records by status (completed, pending, overdue, etc.)
  - Shows average aircraft hours and total parts replaced

- **maintenance_types_breakdown**: Summary by maintenance type
  - Groups by record type: `maintenance`, `airworthiness`, `service_bulletin`
  - Shows counts for completed, pending, and overdue items

### **Aircraft Efficiency**
- **plane_status_breakdown**: Aircraft grouped by operational status
- **detailed_plane_stats**: Utilization metrics and flight hours
- **aircraft_utilization**: Individual aircraft performance metrics
- **average_utilization_rate**: Overall fleet utilization percentage

### **Flight Operations**
- **flight_status_breakdown**: Flights by status (scheduled, completed, cancelled)
- **flight_type_breakdown**: Training types and durations
- **peak_operating_hours**: Busiest hours of operation
- **completion_rate**: Percentage of flights successfully completed

### **Instructor & Student Metrics**
- **instructor_efficiency**: Teaching hours, utilization rates, student loads
- **student_metrics**: Enrollment numbers, program distribution
- **instructor_workload**: Individual instructor performance metrics

### **Operational Metrics**
- **capacity_utilization**: Overall fleet and instructor utilization
- **efficiency_ratio**: Scheduled vs actual flight time comparison
- **upcoming_schedule**: Next 7 days of scheduled flights

## 🚨 Error Codes Reference
- `VALIDATION_ERROR`: Request validation failed
- `AUTHENTICATION_FAILED`: Invalid or expired token
- `ACCESS_DENIED`: Insufficient permissions
- `SCHOOL_NOT_FOUND`: Specified school does not exist
- `RATE_LIMIT_EXCEEDED`: Too many requests
- `HIGH_RISK_BLOCKED`: Request blocked due to high risk score

## 🔍 Example Request
```bash
curl -X GET "https://api.skytrack.com/api/schools/64abc123def456/stats?range=30&include_financials=true" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "X-API-Key: your-api-key" \
  -H "X-CSRF-Token: csrf-token"
```

## 📊 Maintenance System Features

### **Record Types**
- **maintenance**: Regular maintenance, oil changes, inspections
- **airworthiness**: Airworthiness directives, compliance items
- **service_bulletin**: Manufacturer service bulletins and updates

### **Status Tracking**
- **completed**: Maintenance work finished
- **pending**: Scheduled but not yet performed
- **overdue**: Past due date and not completed
- **in_progress**: Currently being worked on

### **Data Points**
- **nextDue**: When next maintenance is due
- **aircraftHours**: Aircraft hours when maintenance performed
- **partsReplaced**: List of parts replaced during maintenance
- **attachments**: Supporting documents and photos
- **notes**: Additional maintenance notes

This system provides comprehensive maintenance tracking with detailed records, status monitoring, and historical data for regulatory compliance and operational planning. 
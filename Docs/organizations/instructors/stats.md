# GET /api/organizations/{organizationId}/instructors/stats

## 🎯 Overview
Retrieves comprehensive instructor statistics for a specific organization including workload analysis, performance metrics, student assignments, efficiency tracking, and financial data.

## 🔐 Security
- **Requires Auth**: ✅ (JWT Bearer token)
- **Requires API Key**: ✅ (X-API-Key header)
- **Requires CSRF Token**: ❌ (GET operations don't need CSRF)
- **Allowed Roles**: `['sys_admin', 'school_admin', 'instructor']`
- **Organization Access Required**: ✅ (must have access to specified organization)
- **Fraud Detection**: ✅ Enabled
- **Risk Scoring**: ✅ Enabled
- **Data Classification**: `confidential`
- **Rate Limiting**: 50 requests per minute

## 📥 Request

**Method**: `GET`  
**Path**: `/api/organizations/{organizationId}/instructors/stats`

### Path Parameters
- `organizationId` (string, required): The unique identifier of the organization

### Query Parameters
- `range` (number, optional): Time range in days for statistics (default: 30, min: 1, max: 365)
- `include_financials` (boolean, optional): Include financial metrics (default: false)
- `include_workload` (boolean, optional): Include detailed workload analysis (default: false)

### Headers
- `Authorization: Bearer <token>` (required): JWT authentication token
- `X-API-Key: <key>` (required): Valid API key
- `Content-Type: application/json` (required)

## 📤 Response

### Success Response (200)
```json
{
  "success": true,
  "message": "Instructor statistics retrieved successfully",
  "data": {
    "stats": {
      "overview": {
        "total_instructors": 25,
        "active_instructors": 22,
        "new_instructors_period": 3,
        "total_teaching_hours": 8500,
        "total_flight_hours": 12500,
        "average_utilization": 78.5,
        "average_students_per_instructor": 4.2
      },
      "status_breakdown": [
        {
          "_id": "Active",
          "count": 22,
          "avgTeachingHours": 386.4,
          "avgFlightHours": 568.2,
          "avgUtilization": 78.5
        }
      ],
      "certification_breakdown": {
        "CFI": 18,
        "CFII": 12,
        "MEI": 8,
        "ATP": 5
      },
      "specialty_breakdown": {
        "Primary": 22,
        "Instrument": 15,
        "Multi-Engine": 8,
        "Complex": 12
      },
      "availability_breakdown": [
        {
          "_id": "Full-time",
          "count": 15,
          "avgUtilization": 85.2,
          "avgStudents": 5.1
        },
        {
          "_id": "Part-time",
          "count": 7,
          "avgUtilization": 65.3,
          "avgStudents": 2.8
        }
      ],
      "flight_activity": {
        "by_status": [
          {
            "_id": "Active",
            "instructorCount": 22,
            "totalFlights": 450,
            "completedFlights": 420,
            "totalHours": 12600,
            "avgFlightsPerInstructor": 20.5,
            "avgHoursPerInstructor": 572.7
          }
        ],
        "total_flights_period": 450,
        "completed_flights_period": 420,
        "total_hours_period": 12600
      },
      "student_assignments": {
        "assignments": [
          {
            "instructor_email": "instructor@example.com",
            "instructor_status": "Active",
            "student_count": 6,
            "students": [
              {
                "contact_email": "student1@example.com",
                "program": "Private Pilot"
              }
            ]
          }
        ],
        "total_assigned_students": 92,
        "average_students_per_instructor": 4.2
      },
      "performance_metrics": {
        "by_status": [
          {
            "_id": "Active",
            "instructorCount": 22,
            "totalFlights": 420,
            "totalHours": 12600,
            "avgFlightsPerInstructor": 19.1,
            "avgHoursPerInstructor": 572.7,
            "avgFlightDuration": 120,
            "onTimeRate": 0.94
          }
        ],
        "overall_on_time_rate": 0.94,
        "avg_flights_per_instructor": 19.1
      },
      "efficiency_metrics": {
        "top_performers": [
          {
            "contact_email": "top.instructor@example.com",
            "students": 8,
            "utilization": 92.5,
            "completed_flights": 45,
            "efficiency_ratio": 5.6
          }
        ],
        "average_efficiency_ratio": 4.2
      },
      "hourly_rate_analysis": {
        "avgPrimaryRate": 75.5,
        "avgInstrumentRate": 85.2,
        "avgAdvancedRate": 95.8,
        "avgMultiEngineRate": 120.5,
        "minPrimaryRate": 65.0,
        "maxPrimaryRate": 95.0,
        "minInstrumentRate": 75.0,
        "maxInstrumentRate": 100.0
      },
      "recent_activity": [
        {
          "contact_email": "instructor@example.com",
          "status": "Active",
          "availability": "Full-time",
          "students": 6,
          "utilization": 82.5,
          "teaching_hours": 450,
          "flight_hours": 650,
          "last_updated": "2024-07-20T10:30:00.000Z",
          "last_flight_date": "2024-07-19T15:00:00.000Z"
        }
      ]
    },
    "metadata": {
      "organization_id": "64abc123def456",
      "time_range_days": 30,
      "start_date": "2024-06-20T00:00:00.000Z",
      "end_date": "2024-07-20T00:00:00.000Z",
      "includes_financials": false,
      "includes_workload": false,
      "generated_at": "2024-07-20T10:30:00.000Z",
      "processing_time_ms": 1350
    }
  },
  "auditId": "string",
  "timestamp": "string (ISO date)"
}
```

### Error Responses

#### 400 - Bad Request
```json
{
  "error": {
    "message": "Invalid organization ID format",
    "code": "INVALID_ORGANIZATION_ID",
    "requestId": "string",
    "timestamp": "string (ISO date)"
  }
}
```

#### 401 - Unauthorized
```json
{
  "error": {
    "message": "Invalid or expired authentication token",
    "code": "AUTHENTICATION_FAILED",
    "requestId": "string",
    "timestamp": "string (ISO date)"
  }
}
```

#### 403 - Forbidden
```json
{
  "error": {
    "message": "Insufficient permissions or high risk score",
    "code": "ACCESS_DENIED",
    "requestId": "string",
    "timestamp": "string (ISO date)"
  },
  "securityContext": {
    "riskScore": 85,
    "fraudFlags": ["suspicious_location", "velocity_check"]
  }
}
```

#### 429 - Too Many Requests
```json
{
  "error": {
    "message": "Rate limit exceeded",
    "code": "RATE_LIMIT_EXCEEDED",
    "requestId": "string",
    "timestamp": "string (ISO date)",
    "retryAfter": 60
  }
}
```

## 🔍 Example Requests

### Basic Request
```bash
curl -X GET "https://api.skytrack.com/api/organizations/64abc123def456/instructors/stats" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json"
```

### With Financial Data
```bash
curl -X GET "https://api.skytrack.com/api/organizations/64abc123def456/instructors/stats?include_financials=true&range=90" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json"
```

### With Workload Analysis
```bash
curl -X GET "https://api.skytrack.com/api/organizations/64abc123def456/instructors/stats?include_workload=true&range=60" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json"
```

### Complete Request
```bash
curl -X GET "https://api.skytrack.com/api/organizations/64abc123def456/instructors/stats?include_financials=true&include_workload=true&range=180" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json"
```

## 🚨 Error Codes Reference
- `INVALID_ORGANIZATION_ID`: Invalid organization ID format
- `AUTHENTICATION_FAILED`: Invalid or expired token
- `ACCESS_DENIED`: Insufficient permissions or blocked by security policy
- `RATE_LIMIT_EXCEEDED`: Too many requests
- `HIGH_RISK_BLOCKED`: Request blocked due to high risk score

## 📊 Statistics Categories

### Overview Metrics
- **Total Instructors**: Complete count of all instructors
- **Active Instructors**: Instructors with 'Active' status
- **New Instructors**: Instructors added within the time range
- **Total Teaching Hours**: Combined teaching hours across all instructors
- **Total Flight Hours**: Combined flight hours across all instructors
- **Average Utilization**: Mean utilization percentage across active instructors
- **Average Students per Instructor**: Mean student assignments per instructor

### Status Breakdown
- Distribution of instructors by status (Active, Inactive, etc.)
- Average teaching hours, flight hours, and utilization by status

### Certification Breakdown
- Distribution of instructor certifications (CFI, CFII, MEI, ATP, etc.)
- Count of each certification type

### Specialty Breakdown
- Distribution of instructor specialties (Primary, Instrument, Multi-Engine, etc.)
- Count of each specialty type

### Availability Breakdown
- Instructors grouped by availability (Full-time, Part-time, etc.)
- Average utilization and student count by availability

### Flight Activity
- Flight statistics by instructor status
- Total flights, completed flights, and hours
- Average flights and hours per instructor

### Student Assignments
- Current student assignments by instructor
- Total assigned students and averages
- Detailed student lists per instructor

### Performance Metrics
- On-time performance rates
- Average flight duration
- Performance breakdown by instructor status

### Efficiency Metrics
- Top performing instructors
- Efficiency ratios based on students vs. completed flights
- Average efficiency across all instructors

### Hourly Rate Analysis
- Average rates by instruction type (Primary, Instrument, Advanced, Multi-Engine)
- Minimum and maximum rates for each type

### Recent Activity
- Latest instructor updates and activities
- Last flight dates and current status

### Workload Analysis (when enabled)
- Detailed workload scoring per instructor
- Workload factors: utilization, student count, recent flights
- Average workload scores

### Financial Metrics (when enabled)
- Revenue by instructor status
- Invoice statistics and payment rates
- Financial performance breakdown

## 🔧 Query Parameters

### Time Range
- `range`: Number of days to include in statistics (1-365)
- Default: 30 days
- Affects flight activity, recent activity, and workload analysis

### Financial Data
- `include_financials`: Include revenue and invoice statistics
- Default: false
- Adds financial_metrics section to response

### Workload Analysis
- `include_workload`: Include detailed workload scoring
- Default: false
- Adds workload_analysis section to response
- Requires additional processing time

## 📈 Performance Considerations

### Processing Time
- Basic request: ~600-1200ms
- With financials: ~900-1800ms
- With workload analysis: ~1100-2200ms
- All options enabled: ~1600-3500ms

### Data Accuracy
- Real-time instructor status and utilization data
- Flight activity based on actual completed flights
- Student assignments reflect current assignments
- Financial data reflects current invoice status

### Caching Recommendations
- Cache basic statistics for 5-10 minutes
- Cache financial data for 1-2 minutes
- Workload analysis should be real-time
- Use ETags for efficient caching

## 🎯 Use Cases

### Management Dashboard
- Overview of instructor performance and utilization
- Identification of top performers and areas for improvement
- Workload distribution analysis

### Resource Planning
- Understanding instructor capacity and availability
- Planning for new student enrollments
- Optimizing instructor assignments

### Performance Monitoring
- Tracking instructor efficiency and on-time performance
- Monitoring student-to-instructor ratios
- Analyzing certification and specialty distribution

### Financial Analysis
- Revenue generation by instructor
- Hourly rate optimization
- Financial performance tracking 
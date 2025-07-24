# GET /api/organizations/{organizationId}/students/stats

## 🎯 Overview
Retrieves comprehensive student statistics for a specific organization including enrollment trends, progress tracking, performance metrics, and financial data.

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
**Path**: `/api/organizations/{organizationId}/students/stats`

### Path Parameters
- `organizationId` (string, required): The unique identifier of the organization

### Query Parameters
- `range` (number, optional): Time range in days for statistics (default: 30, min: 1, max: 365)
- `include_financials` (boolean, optional): Include financial metrics (default: false)
- `include_progress` (boolean, optional): Include detailed progress tracking (default: false)

### Headers
- `Authorization: Bearer <token>` (required): JWT authentication token
- `X-API-Key: <key>` (required): Valid API key
- `Content-Type: application/json` (required)

## 📤 Response

### Success Response (200)
```json
{
  "success": true,
  "message": "Student statistics retrieved successfully",
  "data": {
    "stats": {
      "overview": {
        "total_students": 125,
        "active_students": 98,
        "new_enrollments_period": 15,
        "graduated_students_period": 8,
        "completion_rate": 85.5,
        "retention_rate": 92.3
      },
      "status_breakdown": [
        {
          "_id": "Active",
          "count": 98,
          "avgEnrollmentDate": "2024-03"
        },
        {
          "_id": "Graduated",
          "count": 20,
          "avgEnrollmentDate": "2023-08"
        }
      ],
      "program_breakdown": [
        {
          "_id": "Private Pilot",
          "count": 45,
          "active": 38,
          "graduated": 5,
          "inactive": 2
        }
      ],
      "enhanced_program_analysis": [
        {
          "program": "Private Pilot",
          "totalStudents": 45,
          "activeStudents": 38,
          "graduatedStudents": 5,
          "inactiveStudents": 2,
          "avgEnrollmentDate": "2024-03",
          "avgProgress": 65.5,
          "stageBreakdown": {
            "Ground School": 15,
            "Solo Flight": 20,
            "Cross Country": 8
          },
          "milestoneBreakdown": {
            "First Solo": 25,
            "Cross Country": 12,
            "Checkride": 8
          },
          "avgTimeToCurrentStage": 120,
          "completionRate": 11.1,
          "activeRate": 84.4
        }
      ],
      "enrollment_trends": [
        {
          "year": 2024,
          "month": 1,
          "enrollments": 12,
          "active": 10
        }
      ],
      "flight_activity": {
        "by_status": [
          {
            "_id": "Active",
            "studentCount": 45,
            "totalFlights": 180,
            "completedFlights": 165,
            "totalHours": 5400,
            "avgFlightsPerStudent": 4.0,
            "avgHoursPerStudent": 120.0
          }
        ],
        "total_flights_period": 180,
        "completed_flights_period": 165,
        "total_hours_period": 5400
      },
      "performance_metrics": {
        "by_status": [
          {
            "_id": "Active",
            "studentCount": 45,
            "totalFlights": 165,
            "totalHours": 5400,
            "avgFlightsPerStudent": 3.7,
            "avgHoursPerStudent": 120.0,
            "avgFlightDuration": 120,
            "onTimeRate": 0.92
          }
        ],
        "overall_on_time_rate": 0.92,
        "avg_flights_per_student": 3.7
      },
      "enrollment_duration": [
        {
          "_id": "Active",
          "count": 98,
          "avgDurationDays": 180.5,
          "minDurationDays": 30,
          "maxDurationDays": 365
        }
      ],
      "performance_trends": [
        {
          "month": "2024-07",
          "total_flights": 180,
          "total_on_time_flights": 165,
          "overall_on_time_rate": 91.7,
          "programs": [
            {
              "program": "Private Pilot",
              "totalFlights": 120,
              "onTimeFlights": 110,
              "avgDuration": 120,
              "totalHours": 14400,
              "onTimeRate": 0.92
            }
          ]
        }
      ],
      "instructor_assignment_analysis": [
        {
          "program": "Private Pilot",
          "avg_instructors_per_student": 1.2,
          "total_student_instructor_pairs": 54,
          "instructor_assignments": [
            {
              "instructor": "instructor@example.com",
              "totalFlights": 45,
              "completedFlights": 42,
              "totalHours": 5040
            }
          ]
        }
      ],
      "engagement_metrics": [
        {
          "program": "Private Pilot",
          "total_active_students": 38,
          "students_with_recent_flights": 35,
          "engagement_rate": 92.1,
          "avg_days_since_last_flight": 7.5,
          "avg_recent_flights": 3.2
        }
      ],
      "recent_activity": [
        {
          "contact_email": "student@example.com",
          "program": "Private Pilot",
          "status": "Active",
          "stage": "Solo Flight",
          "next_milestone": "Cross Country",
          "enrollment_date": "2024-01-15T00:00:00.000Z",
          "last_updated": "2024-07-20T10:30:00.000Z",
          "last_flight_date": "2024-07-19T15:00:00.000Z"
        }
      ],
      "certification_breakdown": {
        "Student Pilot": 45,
        "Private Pilot": 20,
        "Instrument Rating": 15
      }
    },
    "metadata": {
      "organization_id": "64abc123def456",
      "time_range_days": 30,
      "start_date": "2024-06-20T00:00:00.000Z",
      "end_date": "2024-07-20T00:00:00.000Z",
      "includes_financials": false,
      "includes_progress": false,
      "generated_at": "2024-07-20T10:30:00.000Z",
      "processing_time_ms": 1250
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
curl -X GET "https://api.skytrack.com/api/organizations/64abc123def456/students/stats" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json"
```

### With Financial Data
```bash
curl -X GET "https://api.skytrack.com/api/organizations/64abc123def456/students/stats?include_financials=true&range=90" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json"
```

### With Progress Tracking
```bash
curl -X GET "https://api.skytrack.com/api/organizations/64abc123def456/students/stats?include_progress=true&range=60" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json"
```

### Complete Request
```bash
curl -X GET "https://api.skytrack.com/api/organizations/64abc123def456/students/stats?include_financials=true&include_progress=true&range=180" \
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
- **Total Students**: Complete count of all students
- **Active Students**: Students with 'Active' status
- **New Enrollments**: Students enrolled within the time range
- **Graduated Students**: Students who graduated within the time range
- **Completion Rate**: Percentage of students who have graduated
- **Retention Rate**: Percentage of students retained

### Status Breakdown
- Distribution of students by status (Active, Graduated, Inactive, etc.)
- Average enrollment date for each status

### Program Breakdown
- Students grouped by program (Private Pilot, Instrument Rating, etc.)
- Status distribution within each program

### Enhanced Program Analysis
- **Students per program**: Complete breakdown including programs with zero students
- **Average progress**: Calculated progress percentage for each program
- **Stage breakdown**: Distribution of students across program stages
- **Milestone breakdown**: Distribution of students by next milestone
- **Average time to current stage**: Days from enrollment to current stage
- **Completion and active rates**: Success metrics by program

### Enrollment Trends
- Monthly enrollment trends for the current year
- Active vs. total enrollments per month

### Flight Activity
- Flight statistics by student status
- Total flights, completed flights, and hours
- Average flights and hours per student

### Performance Metrics
- On-time performance rates
- Average flight duration
- Performance breakdown by student status

### Enrollment Duration Analysis
- Average time to graduation
- Duration statistics for active vs. graduated students

### Performance Trends
- Monthly performance trends by program
- On-time rates and flight duration trends
- Program-specific performance breakdowns

### Instructor Assignment Analysis
- Average instructors per student by program
- Student-instructor pairing statistics
- Assignment distribution analysis

### Engagement Metrics
- Student engagement rates by program
- Days since last flight analysis
- Recent flight activity patterns

### Recent Activity
- Latest student updates and activities
- Last flight dates and milestone progress

### Progress Tracking (when enabled)
- Detailed progress by program
- Stage and milestone breakdowns
- Average progress percentages

### Financial Metrics (when enabled)
- Revenue by student status
- Program-based financial breakdown
- Invoice statistics and payment rates

### Certification Breakdown
- Distribution of student certifications
- Count of each certification type

## 🔧 Query Parameters

### Time Range
- `range`: Number of days to include in statistics (1-365)
- Default: 30 days
- Affects enrollment trends, flight activity, and recent activity

### Financial Data
- `include_financials`: Include revenue and invoice statistics
- Default: false
- Adds financial_metrics section to response

### Progress Tracking
- `include_progress`: Include detailed progress analysis
- Default: false
- Adds progress_tracking section to response
- Requires additional processing time

## 📈 Performance Considerations

### Processing Time
- Basic request: ~500-1000ms
- With financials: ~800-1500ms
- With progress tracking: ~1000-2000ms
- All options enabled: ~1500-3000ms

### Data Accuracy
- Real-time enrollment and status data
- Flight activity based on actual completed flights
- Financial data reflects current invoice status
- Progress tracking uses latest milestone data

### Caching Recommendations
- Cache basic statistics for 5-10 minutes
- Cache financial data for 1-2 minutes
- Progress tracking should be real-time
- Use ETags for efficient caching 
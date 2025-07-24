# GET /api/organizations/{organizationId}/planes/stats

## 🎯 Overview
Retrieves comprehensive plane statistics for an organization, including maintenance alerts, utilization metrics, financial data, and operational insights. This endpoint is designed specifically for the planes management page to provide detailed analytics and insights.

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
**Path**: `/api/organizations/{organizationId}/planes/stats`

### Path Parameters
- `organizationId` (string, required): The unique identifier of the organization

### Query Parameters
- `range` (string, optional): Time range in days for statistics (default: `30`)
- `include_financials` (boolean, optional): Include financial metrics (default: `false`)
- `include_maintenance` (boolean, optional): Include maintenance alerts and data (default: `false`)
- `status` (string, optional): Filter planes by status (e.g., `active`, `maintenance`, `inactive`)

### Headers
- `Authorization: Bearer <token>` (required): JWT authentication token
- `X-API-Key: <key>` (required): Valid API key
- `Content-Type: application/json` (required)

## 📤 Response

### Success Response (200)
```json
{
  "success": true,
  "message": "Plane statistics retrieved successfully",
  "data": {
    "stats": {
      "overview": {
        "total_planes": 15,
        "active_planes": 12,
        "inactive_planes": 3,
        "total_flight_hours": 1250.5,
        "average_utilization_rate": 0.75,
        "average_on_time_rate": 0.85
      },
      "plane_status_breakdown": [
        {
          "_id": "active",
          "count": 12,
          "totalHours": 1200.5,
          "avgUtilization": 0.78
        },
        {
          "_id": "maintenance",
          "count": 2,
          "totalHours": 45.0,
          "avgUtilization": 0.0
        },
        {
          "_id": "inactive",
          "count": 1,
          "totalHours": 5.0,
          "avgUtilization": 0.0
        }
      ],
      "plane_type_breakdown": [
        {
          "_id": "Cessna 172",
          "count": 8,
          "totalHours": 650.5,
          "avgUtilization": 0.82
        },
        {
          "_id": "Piper PA-28",
          "count": 5,
          "totalHours": 450.0,
          "avgUtilization": 0.75
        },
        {
          "_id": "Diamond DA40",
          "count": 2,
          "totalHours": 150.0,
          "avgUtilization": 0.68
        }
      ],
      "flight_operations": {
        "operations_by_plane": [
          {
            "plane_id": "64abc123def456",
            "registration": "N12345",
            "aircraftModel": "Cessna 172",
            "totalFlights": 45,
            "completedFlights": 42,
            "completionRate": 93.33,
            "totalScheduledHours": 67.5,
            "totalActualHours": 65.2,
            "avgFlightDuration": 1.45,
            "revenue": 3250.00,
            "utilizationRate": 0.82
          }
        ],
        "total_flights": 450,
        "completed_flights": 420,
        "average_completion_rate": 93.33
      },
      "utilization_metrics": {
        "utilization_by_plane": [
          {
            "registration": "N12345",
            "aircraftModel": "Cessna 172",
            "status": "active",
            "total_hours": 1200.5,
            "recentFlightsCount": 45,
            "recentFlightHours": 65.2,
            "avgFlightDuration": 1.45,
            "utilizationRate": 0.82
          }
        ],
        "top_utilized_planes": [...],
        "least_utilized_planes": [...]
      },
      "schedule_adherence": {
        "adherence_by_plane": [
          {
            "plane_id": "64abc123def456",
            "registration": "N12345",
            "total": 42,
            "onTime": 38,
            "onTimeRate": 90.48,
            "avgDelayMinutes": 5.2
          }
        ],
        "average_on_time_rate": 85.5,
        "top_performing_planes": [...],
        "planes_needing_attention": [...]
      },
      "peak_usage_times": {
        "usage_by_plane": [
          {
            "plane_id": "64abc123def456",
            "registration": "N12345",
            "peakHours": [
              { "hour": 9, "count": 12 },
              { "hour": 14, "count": 10 },
              { "hour": 16, "count": 8 }
            ],
            "totalFlights": 45
          }
        ]
      },
      "aircraft_age_analysis": {
        "age_categories": [
          {
            "_id": "new",
            "count": 3,
            "avgAge": 2.5,
            "avgHours": 150.0,
            "planes": [...]
          },
          {
            "_id": "mid-age",
            "count": 8,
            "avgAge": 10.2,
            "avgHours": 850.5,
            "planes": [...]
          },
          {
            "_id": "older",
            "count": 3,
            "avgAge": 18.7,
            "avgHours": 1200.0,
            "planes": [...]
          },
          {
            "_id": "vintage",
            "count": 1,
            "avgAge": 28.0,
            "avgHours": 2500.0,
            "planes": [...]
          }
        ],
        "fleet_age_distribution": {
          "new": 3,
          "mid-age": 8,
          "older": 3,
          "vintage": 1
        }
      },
      "operational_efficiency": {
        "efficiency_by_plane": [
          {
            "registration": "N12345",
            "aircraftModel": "Cessna 172",
            "status": "active",
            "total_hours": 1200.5,
            "recentFlightsCount": 45,
            "completedFlights": 42,
            "totalScheduledHours": 67.5,
            "totalActualHours": 65.2,
            "efficiency": 0.966
          }
        ],
        "top_efficient_planes": [...],
        "efficiency_insights": {
          "average_efficiency": 0.89,
          "high_efficiency_count": 8,
          "low_efficiency_count": 2
        }
      },
      "maintenance": {
        "alerts": [
          {
            "registration": "N12345",
            "record_id": "64def789abc123",
            "title": "Annual Inspection Due",
            "description": "Annual inspection required",
            "status": "pending",
            "next_maintenance": "2024-02-15T00:00:00.000Z",
            "days_until_maintenance": 5,
            "aircraft_hours": 1200.5,
            "is_overdue": false,
            "severity": "high"
          }
        ],
        "upcoming_maintenance": [...],
        "overdue_maintenance": [...],
        "maintenance_stats": [
          {
            "_id": "completed",
            "count": 25,
            "avgAircraftHours": 850.5,
            "totalPartsReplaced": 45
          },
          {
            "_id": "pending",
            "count": 8,
            "avgAircraftHours": 1200.0,
            "totalPartsReplaced": 0
          }
        ],
        "critical_alerts": [...],
        "high_priority_alerts": [...]
      },
      "financial_metrics": {
        "revenue_by_plane": [
          {
            "plane_id": "64abc123def456",
            "registration": "N12345",
            "totalRevenue": 3250.00,
            "invoiceCount": 42,
            "avgInvoiceValue": 77.38,
            "pendingAmount": 450.00,
            "approvedAmount": 2800.00
          }
        ],
        "total_revenue": 25000.00,
        "average_revenue_per_plane": 1666.67,
        "cost_analysis": [
          {
            "registration": "N12345",
            "total_hours": 1200.5,
            "estimatedFuelCost": 60025.00,
            "estimatedMaintenanceCost": 2500.00,
            "maintenanceRecordsCount": 5
          }
        ],
        "top_revenue_generators": [...],
        "revenue_trends": [...]
      }
    },
    "metadata": {
      "organization_id": "64abc123def456",
      "organization_name": "SkyTrack Flight School",
      "time_range_days": 30,
      "start_date": "2024-01-01T00:00:00.000Z",
      "end_date": "2024-01-31T23:59:59.999Z",
      "includes_financials": true,
      "includes_maintenance": true,
      "generated_at": "2024-01-31T12:00:00.000Z",
      "processing_time_ms": 1250
    }
  },
  "auditId": "audit_123456789",
  "timestamp": "2024-01-31T12:00:00.000Z"
}
```

### Error Responses

#### 400 - Bad Request
```json
{
  "error": {
    "message": "Invalid organization ID format",
    "code": "INVALID_ORGANIZATION_ID",
    "requestId": "audit_123456789",
    "timestamp": "2024-01-31T12:00:00.000Z"
  }
}
```

#### 401 - Unauthorized
```json
{
  "error": {
    "message": "Invalid or expired authentication token",
    "code": "AUTHENTICATION_FAILED",
    "requestId": "audit_123456789",
    "timestamp": "2024-01-31T12:00:00.000Z"
  }
}
```

#### 403 - Forbidden
```json
{
  "error": {
    "message": "Insufficient permissions or high risk score",
    "code": "ACCESS_DENIED",
    "requestId": "audit_123456789",
    "timestamp": "2024-01-31T12:00:00.000Z"
  },
  "securityContext": {
    "riskScore": 85,
    "fraudFlags": ["suspicious_location", "velocity_check"]
  }
}
```

#### 404 - Not Found
```json
{
  "error": {
    "message": "Organization not found",
    "code": "ORGANIZATION_NOT_FOUND",
    "requestId": "audit_123456789",
    "timestamp": "2024-01-31T12:00:00.000Z"
  }
}
```

#### 429 - Too Many Requests
```json
{
  "error": {
    "message": "Rate limit exceeded",
    "code": "RATE_LIMIT_EXCEEDED",
    "requestId": "audit_123456789",
    "timestamp": "2024-01-31T12:00:00.000Z",
    "retryAfter": 60
  }
}
```

## 🔍 Example Request
```bash
curl -X GET "https://api.skytrack.com/api/organizations/64abc123def456/planes/stats?range=30&include_financials=true&include_maintenance=true" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json"
```

## 📊 Statistics Categories

### Overview Metrics
- **Total Planes**: Count of all planes in the organization
- **Active Planes**: Count of planes currently available for flight
- **Inactive Planes**: Count of planes not available (maintenance, retired, etc.)
- **Total Flight Hours**: Sum of all flight hours across the fleet
- **Average Utilization Rate**: Mean utilization rate across all planes
- **Average On-Time Rate**: Mean schedule adherence rate

### Plane Status Breakdown
- Distribution of planes by status (active, maintenance, inactive, etc.)
- Total hours and average utilization per status

### Plane Type Breakdown
- Distribution of planes by aircraft model
- Performance metrics per aircraft type

### Flight Operations
- Detailed flight statistics per plane
- Completion rates, scheduled vs actual hours
- Revenue generation per plane (when financials included)

### Utilization Metrics
- Utilization rates and patterns per plane
- Top and least utilized aircraft
- Recent flight activity analysis

### Schedule Adherence
- On-time performance per plane
- Average delay times
- Planes requiring attention for scheduling issues

### Peak Usage Times
- Hourly usage patterns per plane
- Peak operating hours identification

### Aircraft Age Analysis
- Fleet age distribution (new, mid-age, older, vintage)
- Age-based performance metrics
- Maintenance correlation with age

### Operational Efficiency
- Efficiency ratios per plane
- Scheduled vs actual flight time analysis
- Performance insights and recommendations

### Maintenance Data (when `include_maintenance=true`)
- **Alerts**: All maintenance alerts with severity levels
- **Upcoming Maintenance**: Maintenance due within 30 days
- **Overdue Maintenance**: Past due maintenance items
- **Critical Alerts**: Maintenance items requiring immediate attention
- **High Priority Alerts**: Maintenance due within 7 days

### Financial Metrics (when `include_financials=true`)
- **Revenue by Plane**: Revenue generation per aircraft
- **Total Revenue**: Combined revenue across the fleet
- **Cost Analysis**: Estimated fuel and maintenance costs
- **Top Revenue Generators**: Highest earning aircraft
- **Revenue Trends**: Daily revenue patterns

## 🚨 Error Codes Reference
- `INVALID_ORGANIZATION_ID`: Invalid organization ID format
- `ORGANIZATION_NOT_FOUND`: Specified organization does not exist
- `AUTHENTICATION_FAILED`: Invalid or expired token
- `ACCESS_DENIED`: Insufficient permissions or blocked by security policy
- `RATE_LIMIT_EXCEEDED`: Too many requests
- `HIGH_RISK_BLOCKED`: Request blocked due to high risk score

## 📈 Performance Considerations
- **Processing Time**: Typically 1-3 seconds depending on data volume
- **Data Freshness**: Real-time data from database queries
- **Caching**: Consider caching results for dashboard displays
- **Filtering**: Use query parameters to reduce data volume when needed

## 🔧 Usage Tips
- Use `range` parameter to adjust time window for statistics
- Enable `include_financials=true` for revenue and cost analysis
- Enable `include_maintenance=true` for maintenance planning
- Use `status` filter to focus on specific plane categories
- Monitor `processing_time_ms` in metadata for performance insights 

# POST /api/organizations/{organizationId}/planes/stats

## 🎯 Overview
Retrieves detailed statistics for individual planes within an organization. This endpoint provides comprehensive metrics for each aircraft including maintenance history, utilization patterns, financial performance, and operational efficiency. It's designed for detailed analysis of specific planes or the entire fleet.

## 🔐 Security
- **Requires Auth**: ✅ (JWT Bearer token)
- **Requires API Key**: ✅ (X-API-Key header)
- **Requires CSRF Token**: ✅ (X-CSRF-Token header)
- **Allowed Roles**: `['sys_admin', 'school_admin', 'instructor']`
- **Organization Access Required**: ✅ (must have access to specified organization)
- **Fraud Detection**: ✅ Enabled
- **Risk Scoring**: ✅ Enabled
- **Data Classification**: `confidential`
- **Rate Limiting**: 50 requests per minute

## 📥 Request

**Method**: `POST`  
**Path**: `/api/organizations/{organizationId}/planes/stats`

### Path Parameters
- `organizationId` (string, required): The unique identifier of the organization

### Headers
- `Authorization: Bearer <token>` (required): JWT authentication token
- `X-API-Key: <key>` (required): Valid API key
- `X-CSRF-Token: <token>` (required): CSRF protection token
- `Content-Type: application/json` (required)

### Body Schema
```json
{
  "planeIds": ["string (optional)"], // Array of plane IDs to filter (optional)
  "timeRange": 90, // Number of days for analysis (optional, default: 90)
  "includeInactive": false // Whether to include inactive planes (optional, default: false)
}
```

## 📤 Response

### Success Response (200)
```json
{
  "success": true,
  "message": "Detailed plane statistics retrieved successfully",
  "data": {
    "planes": [
      {
        "planeId": "64abc123def456",
        "registration": "N12345",
        "aircraftModel": "Cessna 172",
        "type": "single-engine",
        "year": 2018,
        "age": 5,
        "status": "active",
        "location": "Hangar 3",
        
        "totalHours": 1250.5,
        "engineHours": 1250.5,
        "tachTime": 1255.2,
        "hoppsTime": 1240.8,
        
        "lastMaintenanceDate": "2023-05-15T00:00:00Z",
        "nextMaintenanceDate": "2023-08-15T00:00:00Z",
        "daysUntilMaintenance": 25,
        "maintenanceStatus": "ok",
        
        "recentActivity": {
          "totalFlights": 45,
          "completedFlights": 42,
          "cancelledFlights": 3,
          "scheduledHours": 65.5,
          "actualHours": 62.8,
          "utilizationRate": 72.5,
          "availabilityRate": 98.2,
          "onTimeRate": 92.3,
          "mostRecentFlight": {
            "date": "2023-07-20T14:30:00Z",
            "duration": 1.8,
            "status": "completed"
          }
        },
        
        "schedulingPatterns": {
          "weekdayDistribution": [
            { "day": "Sunday", "count": 5 },
            { "day": "Monday", "count": 8 },
            { "day": "Tuesday", "count": 7 },
            { "day": "Wednesday", "count": 6 },
            { "day": "Thursday", "count": 7 },
            { "day": "Friday", "count": 8 },
            { "day": "Saturday", "count": 4 }
          ],
          "hourlyDistribution": [
            { "hour": 0, "count": 0 },
            { "hour": 1, "count": 0 },
            // ... more hours
            { "hour": 13, "count": 8 },
            // ... more hours
            { "hour": 23, "count": 0 }
          ],
          "peakHour": 13,
          "peakDay": 1
        },
        
        "financialMetrics": {
          "totalRevenue": 9450.75,
          "paidRevenue": 8200.50,
          "pendingRevenue": 1250.25,
          "invoiceCount": 42,
          "revenuePerFlightHour": 150.49,
          "estimatedProfit": 3780.30,
          "estimatedProfitMargin": 40
        },
        
        "maintenanceHistory": {
          "totalRecords": 12,
          "recentMaintenanceEvents": 2,
          "lastCompletedMaintenance": {
            "date": "2023-05-15T00:00:00Z",
            "title": "100-hour inspection",
            "description": "Regular 100-hour inspection with oil change",
            "aircraftHours": 1200.5
          },
          "upcomingMaintenance": {
            "dueDate": "2023-08-15T00:00:00Z",
            "title": "Annual inspection",
            "description": "Required annual airworthiness inspection"
          }
        },
        
        "rates": {
          "wet": 150,
          "dry": 105,
          "block": 135,
          "instruction": 185,
          "weekend": 165,
          "solo": 140,
          "checkride": 200
        },
        
        "notes": "New avionics installed June 2023"
      }
      // ... more planes
    ],
    "metadata": {
      "organization_id": "64abc123def456",
      "time_range_days": 90,
      "plane_count": 15,
      "start_date": "2023-04-22T00:00:00Z",
      "end_date": "2023-07-21T00:00:00Z",
      "generated_at": "2023-07-21T15:30:45Z",
      "processing_time_ms": 1245
    }
  },
  "auditId": "audit-123-456",
  "timestamp": "2023-07-21T15:30:45Z"
}
```

### Error Responses

#### 400 - Bad Request
```json
{
  "error": {
    "message": "Invalid organization ID format",
    "code": "INVALID_ORGANIZATION_ID",
    "requestId": "audit-123-456",
    "timestamp": "2023-07-21T15:30:45Z"
  }
}
```

#### 400 - Invalid Plane IDs
```json
{
  "error": {
    "message": "No valid plane IDs provided",
    "code": "INVALID_PLANE_IDS",
    "requestId": "audit-123-456",
    "timestamp": "2023-07-21T15:30:45Z"
  }
}
```

#### 401 - Unauthorized
```json
{
  "error": {
    "message": "Invalid or expired authentication token",
    "code": "AUTHENTICATION_FAILED",
    "requestId": "audit-123-456",
    "timestamp": "2023-07-21T15:30:45Z"
  }
}
```

#### 403 - Forbidden
```json
{
  "error": {
    "message": "Insufficient permissions or high risk score",
    "code": "ACCESS_DENIED",
    "requestId": "audit-123-456",
    "timestamp": "2023-07-21T15:30:45Z"
  },
  "securityContext": {
    "riskScore": 85,
    "fraudFlags": ["suspicious_location", "velocity_check"]
  }
}
```

#### 404 - Not Found
```json
{
  "error": {
    "message": "No planes found matching criteria",
    "code": "NO_PLANES_FOUND",
    "requestId": "audit-123-456",
    "timestamp": "2023-07-21T15:30:45Z"
  }
}
```

#### 429 - Too Many Requests
```json
{
  "error": {
    "message": "Rate limit exceeded",
    "code": "RATE_LIMIT_EXCEEDED",
    "requestId": "audit-123-456",
    "timestamp": "2023-07-21T15:30:45Z",
    "retryAfter": 60
  }
}
```

## 🔍 Example Request
```bash
curl -X POST "https://api.skytrack.com/api/organizations/64abc123def456/planes/stats" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "X-API-Key: your-api-key" \
  -H "X-CSRF-Token: csrf-token" \
  -H "Content-Type: application/json" \
  -d '{
    "planeIds": ["60a7c3d4e5f6789012345678", "60b8d4e5f6789012345678a9"],
    "timeRange": 60,
    "includeInactive": false
  }'
```

## 🚨 Error Codes Reference
- `INVALID_ORGANIZATION_ID`: The organization ID format is invalid
- `INVALID_PLANE_IDS`: No valid plane IDs were provided in the request
- `NO_PLANES_FOUND`: No planes match the specified criteria
- `AUTHENTICATION_FAILED`: Invalid or expired token
- `ACCESS_DENIED`: Insufficient permissions or blocked by security policy
- `ORGANIZATION_NOT_FOUND`: Specified organization does not exist
- `RATE_LIMIT_EXCEEDED`: Too many requests
- `HIGH_RISK_BLOCKED`: Request blocked due to high risk score 
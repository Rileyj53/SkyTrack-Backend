# GET /api/organizations/{organizationId}/planes

## 🎯 Overview
Retrieves a list of planes for the specified organization with comprehensive filtering, search, and pagination capabilities.

## 🔐 Security
- **Requires Auth**: ✅ (JWT Bearer token)
- **Requires API Key**: ✅ (X-API-Key header)
- **Requires CSRF Token**: ❌ (GET operations don't need CSRF)
- **Allowed Roles**: `['sys_admin', 'school_admin', 'instructor']`
- **Organization Access Required**: ✅ (must have access to specified organization)
- **Fraud Detection**: ✅ Enabled
- **Risk Scoring**: ✅ Enabled
- **Data Classification**: `confidential`
- **Rate Limiting**: 100 requests per minute

## 📥 Request

**Method**: `GET`  
**Path**: `/api/organizations/{organizationId}/planes`

### Path Parameters
- `organizationId` (string, required): The unique identifier of the organization

### Query Parameters
- `page` (number, optional): Page number for pagination (default: 1)
- `limit` (number, optional): Number of records per page (default: 50, max: 200)
- `search` (string, optional): **Enhanced search** across plane information with intelligent matching:
  - **Registration numbers**: Exact match (highest priority), partial match, starts-with match
  - **Aircraft model**: Case-insensitive partial match
  - **Plane type**: Case-insensitive partial match
  - **Location**: Case-insensitive partial match
  - **Status**: Case-insensitive partial match
  - **Notes**: Case-insensitive partial match (for terms > 2 characters)
  - **Year**: Exact year match (if search term is 4 digits)
  - **Engine hours**: Exact match for numeric values
  - **Results are ranked by relevance** with exact registration matches appearing first
- `status` (string, optional): Filter by plane status (e.g., "Active", "Maintenance", "Out of Service")
- `type` (string, optional): Filter by plane type (case-insensitive partial match)
- `aircraftModel` (string, optional): Filter by aircraft model (case-insensitive partial match)
- `location` (string, optional): Filter by plane location (case-insensitive partial match)
- `year` (number, optional): Filter by plane year
- `minEngineHours` (number, optional): Filter planes with engine hours >= this value
- `maxEngineHours` (number, optional): Filter planes with engine hours <= this value
- `has_notes` (string, optional): Filter by notes presence ("true" or "false")
- `sortField` (string, optional): Field to sort by (default: "registration")
- `sortDirection` (string, optional): Sort direction - "asc" or "desc" (default: "asc")

### Headers
- `Authorization: Bearer <token>` (required): JWT authentication token
- `X-API-Key: <key>` (required): Valid API key

## 📤 Response

### Success Response (200)
```json
{
  "success": true,
  "message": "Planes retrieved successfully",
  "data": {
    "planes": [
      {
        "id": "string",
        "registration": "string",
        "type": "string",
        "aircraftModel": "string",
        "year": "number",
        "engineHours": "number",
        "tach_time": "number",
        "hopps_time": "number",
        "last_maintenance": "string (ISO date)",
        "next_maintenance": "string (ISO date)",
        "status": "string",
        "hourlyRates": {
          "wet": "number",
          "dry": "number",
          "block": "number",
          "instruction": "number",
          "weekend": "number",
          "solo": "number",
          "checkride": "number"
        },
        "specialRates": [
          {
            "name": "string",
            "rate": "number",
            "description": "string"
          }
        ],
        "utilization": "number",
        "location": "string",
        "notes": "string",
        "total_hours": "number"
      }
    ],
    "pagination": {
      "currentPage": "number",
      "totalPages": "number",
      "totalCount": "number",
      "hasNextPage": "boolean",
      "hasPrevPage": "boolean",
      "limit": "number",
      "uniqueLocations": ["string"],
      "uniqueTypes": ["string"],
      "searchSuggestions": ["string"] (only present when search parameter is provided)
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

#### 400 - Invalid Pagination
```json
{
  "error": {
    "message": "Invalid pagination parameters. Page must be >= 1 and limit must be between 1 and 200",
    "code": "INVALID_PAGINATION",
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
  }
}
```

## 🔍 Enhanced Search Functionality

The search parameter provides intelligent, multi-field search with relevance ranking:

### Search Capabilities
- **Registration Numbers**: 
  - Exact match (e.g., "N12345" finds exactly "N12345")
  - Partial match (e.g., "N123" finds "N12345", "N123AB")
  - Starts-with match (e.g., "N1" finds all registrations starting with "N1")
- **Aircraft Information**: Search across type, model, location, status
- **Numeric Values**: Search by year (4-digit numbers) or engine hours
- **Notes**: Search within plane notes (for terms longer than 2 characters)

### Search Ranking
Results are automatically ranked by relevance:
1. **Exact registration matches** (highest priority)
2. **Registration starts with search term**
3. **Registration contains search term**
4. **Aircraft model matches**
5. **Type matches**
6. **Location matches**
7. **Status matches**

### Search Suggestions
When a search term is provided, the response includes `searchSuggestions` with up to 10 relevant suggestions based on:
- Matching registration numbers
- Matching aircraft models
- Matching plane types
- Matching locations

### Example Search Queries
```
?search=N12345          # Exact registration
?search=N123            # Partial registration
?search=Cessna          # Aircraft type
?search=172             # Aircraft model
?search=2020            # Year
?search=1500            # Engine hours
?search=Hangar          # Location
?search=Active          # Status
```

## 🔍 Search Functionality

The `search` parameter performs a comprehensive text search across all plane data:

### **Searchable Fields:**
- **Registration**: Plane registration number (e.g., "N12345")
- **Type**: Aircraft type (e.g., "Cessna", "Piper")
- **Aircraft Model**: Specific model (e.g., "172", "PA-28")
- **Location**: Plane location (e.g., "Hangar A", "Tie-down 5")
- **Notes**: Maintenance notes, special instructions
- **Status**: Plane status (e.g., "Active", "Maintenance")

### **Search Examples:**
```bash
# Search for planes by registration
GET /api/organizations/687c208d97e9217fc09e7c40/planes?search=N12345

# Search for planes by type
GET /api/organizations/687c208d97e9217fc09e7c40/planes?search=Cessna

# Search for planes by model
GET /api/organizations/687c208d97e9217fc09e7c40/planes?search=172

# Search for planes by location
GET /api/organizations/687c208d97e9217fc09e7c40/planes?search=Hangar
```

## 🔍 Filtering Examples

### **Basic Filtering:**
```bash
# Filter by status
GET /api/organizations/687c208d97e9217fc09e7c40/planes?status=Active

# Filter by type
GET /api/organizations/687c208d97e9217fc09e7c40/planes?type=Cessna

# Filter by aircraft model
GET /api/organizations/687c208d97e9217fc09e7c40/planes?aircraftModel=172

# Filter by location
GET /api/organizations/687c208d97e9217fc09e7c40/planes?location=Hangar A
```

### **Numeric Filtering:**
```bash
# Filter by year
GET /api/organizations/687c208d97e9217fc09e7c40/planes?year=2020

# Filter by engine hours range
GET /api/organizations/687c208d97e9217fc09e7c40/planes?minEngineHours=1000&maxEngineHours=2000

# Filter planes with high engine hours
GET /api/organizations/687c208d97e9217fc09e7c40/planes?minEngineHours=5000
```

### **Boolean Filtering:**
```bash
# Filter planes with notes
GET /api/organizations/687c208d97e9217fc09e7c40/planes?has_notes=true

# Filter planes without notes
GET /api/organizations/687c208d97e9217fc09e7c40/planes?has_notes=false
```

### **Combined Filtering:**
```bash
# Active Cessna planes in Hangar A
GET /api/organizations/687c208d97e9217fc09e7c40/planes?status=Active&type=Cessna&location=Hangar A

# 172 models with low engine hours
GET /api/organizations/687c208d97e9217fc09e7c40/planes?aircraftModel=172&maxEngineHours=1000

# Planes from 2020 with notes
GET /api/organizations/687c208d97e9217fc09e7c40/planes?year=2020&has_notes=true
```

### **Sorting Examples:**
```bash
# Sort by registration (default)
GET /api/organizations/687c208d97e9217fc09e7c40/planes?sortField=registration&sortDirection=asc

# Sort by engine hours (highest first)
GET /api/organizations/687c208d97e9217fc09e7c40/planes?sortField=engineHours&sortDirection=desc

# Sort by year (newest first)
GET /api/organizations/687c208d97e9217fc09e7c40/planes?sortField=year&sortDirection=desc

# Sort by status
GET /api/organizations/687c208d97e9217fc09e7c40/planes?sortField=status&sortDirection=asc
```

## 🔍 Example Requests

### Basic Request
```bash
curl -X GET "https://api.skytrack.com/api/organizations/687c208d97e9217fc09e7c40/planes" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "X-API-Key: your-api-key"
```

### Request with Search and Filtering
```bash
curl -X GET "https://api.skytrack.com/api/organizations/687c208d97e9217fc09e7c40/planes?search=Cessna&status=Active&page=1&limit=20" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "X-API-Key: your-api-key"
```

### Request with Numeric Filtering
```bash
curl -X GET "https://api.skytrack.com/api/organizations/687c208d97e9217fc09e7c40/planes?minEngineHours=1000&maxEngineHours=3000&sortField=engineHours&sortDirection=asc" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "X-API-Key: your-api-key"
```

## 🚨 Error Codes Reference
- `INVALID_ORGANIZATION_ID`: Invalid organization ID format
- `INVALID_PAGINATION`: Invalid pagination parameters
- `AUTHENTICATION_FAILED`: Invalid or expired token
- `ACCESS_DENIED`: Insufficient permissions or blocked by security policy
- `RATE_LIMIT_EXCEEDED`: Too many requests
- `HIGH_RISK_BLOCKED`: Request blocked due to high risk score

## 📋 Role-Based Access Control

- **Instructors**: Can view planes in their organization
- **School Admins**: Can view all planes in their organization
- **System Admins**: Can view all planes across all organizations

## 📊 Available Sort Fields

- `registration` (default): Sort by registration number
- `type`: Sort by aircraft type
- `aircraftModel`: Sort by aircraft model
- `year`: Sort by plane year
- `engineHours`: Sort by engine hours
- `status`: Sort by plane status
- `location`: Sort by plane location
- `last_maintenance`: Sort by last maintenance date
- `next_maintenance`: Sort by next maintenance date
- `createdAt`: Sort by creation date
- `updatedAt`: Sort by last update date

## 📈 Pagination Information

The response includes comprehensive pagination information:

- `currentPage`: Current page number
- `totalPages`: Total number of pages
- `totalCount`: Total number of planes matching the filters
- `hasNextPage`: Whether there are more pages available
- `hasPrevPage`: Whether there are previous pages available
- `limit`: Number of planes per page
- `uniqueLocations`: Array of all unique location values across all planes in the organization (useful for building filter dropdowns)
- `uniqueTypes`: Array of all unique aircraft type values across all planes in the organization (useful for building filter dropdowns)

### **Example Pagination Response:**
```json
{
  "pagination": {
    "currentPage": 1,
    "totalPages": 3,
    "totalCount": 75,
    "hasNextPage": true,
    "hasPrevPage": false,
    "limit": 25,
    "uniqueLocations": [
      "Hangar A",
      "Hangar B", 
      "Tie-down 1",
      "Tie-down 2",
      "Maintenance Bay"
    ],
    "uniqueTypes": [
      "Cessna",
      "Piper",
      "Diamond",
      "Cirrus"
    ]
  }
}
```

## 🔧 Performance Considerations

- **Search**: Uses MongoDB aggregation pipeline for complex text search
- **Filtering**: Database-level filtering for optimal performance
- **Pagination**: Efficient skip/limit pagination
- **Sorting**: Database-level sorting with indexes
- **Caching**: Consider implementing caching for frequently accessed data 
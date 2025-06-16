# Aircraft Tracking API Documentation

## Overview
The Aircraft Tracking API provides real-time aircraft tracking capabilities for flight schools by integrating with the ADSB.lol API service. This endpoint allows schools to monitor the location, altitude, speed, and flight status of their aircraft fleet in real-time.

## Base URL
```
{baseUrl}/api/schools/{schoolId}/aircraft-tracking
```

## Authentication
All endpoints require:
- **API Key**: Provided via `x-api-key` header
- **JWT Token**: Provided via `Authorization: Bearer {token}` header

## Access Control

| Role | Aircraft Tracking Access |
|------|-------------------------|
| **Student** | ✅ Can view tracking data for their school's aircraft |
| **Instructor** | ✅ Can view tracking data for their school's aircraft |
| **School Admin** | ✅ Can view tracking data for their school's aircraft |
| **System Admin** | ✅ Full access to all schools' aircraft tracking |

## External Integration
This API integrates with **ADSB.lol** to fetch real-time aircraft tracking data:
- **External API**: `https://api.adsb.lol/v2/registration/{registration}`
- **Data Source**: ADS-B (Automatic Dependent Surveillance-Broadcast) transponder signals
- **Coverage**: Global aircraft tracking with real-time position, altitude, speed, and heading data

## Aircraft Tracking Object Structure

```json
{
  "message": "Aircraft tracking data retrieved successfully",
  "school_id": "ObjectId",
  "summary": {
    "total_planes": "number",
    "planes_with_tracking": "number", 
    "planes_without_tracking": "number",
    "planes_in_flight": "number"
  },
  "aircraft": [
    {
      "plane_id": "ObjectId",
      "registration": "string",
      "type": "string",
      "aircraftModel": "string", 
      "status": "string",
      "tracking_data": {
        "ac": [
          {
            "hex": "string",
            "flight": "string",
            "r": "string",
            "t": "string",
            "alt_baro": "number",
            "alt_geom": "number",
            "gs": "number",
            "track": "number",
            "baro_rate": "number",
            "squawk": "string",
            "emergency": "string",
            "category": "string",
            "nav_qnh": "number",
            "nav_altitude_mcp": "number",
            "lat": "number",
            "lon": "number",
            "nic": "number",
            "rc": "number",
            "seen_pos": "number",
            "version": "number",
            "nic_baro": "number",
            "nac_p": "number",
            "nac_v": "number",
            "sil": "number",
            "sil_type": "string",
            "gva": "number",
            "sda": "number",
            "alert": "boolean",
            "spi": "boolean",
            "mlat": "array",
            "tisb": "array",
            "messages": "number",
            "seen": "number",
            "rssi": "number"
          }
        ],
        "now": "number",
        "messages": "number",
        "aircraft": "number"
      },
      "last_updated": "ISO Date String"
    }
  ],
  "active_aircraft": ["Aircraft objects with tracking data"],
  "inactive_aircraft": ["Aircraft objects without tracking data"],
  "timestamp": "ISO Date String"
}
```

## API Endpoint

### Get Real-Time Aircraft Tracking
**GET** `/api/schools/{schoolId}/aircraft-tracking`

Retrieves real-time tracking data for all aircraft belonging to a specific school.

**Access Control:**
- Students: ✅ Can view their school's aircraft tracking
- Instructors: ✅ Can view their school's aircraft tracking  
- School Admins: ✅ Can view their school's aircraft tracking
- System Admins: ✅ Full access to all schools

**Parameters:**
- `schoolId` (path, required): School identifier

**Response Structure:**

#### Success Response (200 OK):
```json
{
  "message": "Aircraft tracking data retrieved successfully",
  "school_id": "68389c818d13949c514ac59c",
  "summary": {
    "total_planes": 3,
    "planes_with_tracking": 2,
    "planes_without_tracking": 1,
    "planes_in_flight": 1
  },
  "aircraft": [
    {
      "plane_id": "684238fc551d3d8d70edbeb4",
      "registration": "N166NN",
      "type": "Single Engine",
      "aircraftModel": "Cessna 172",
      "status": "Available",
      "tracking_data": {
        "ac": [
          {
            "hex": "a12345",
            "flight": "N166NN",
            "r": "N166NN",
            "t": "C172",
            "alt_baro": 3500,
            "alt_geom": 3600,
            "gs": 120.5,
            "track": 180.2,
            "baro_rate": 0,
            "squawk": "1200",
            "category": "A1",
            "lat": 47.906,
            "lon": -122.281,
            "nic": 8,
            "rc": 186,
            "seen_pos": 1.2,
            "version": 2,
            "messages": 1542,
            "seen": 0.8,
            "rssi": -25.3
          }
        ],
        "now": 1685123456.789,
        "messages": 1542,
        "aircraft": 1
      },
      "last_updated": "2025-06-07T10:30:45.123Z"
    }
  ],
  "active_aircraft": [
    {
      "plane_id": "684238fc551d3d8d70edbeb4",
      "registration": "N166NN",
      "type": "Single Engine",
      "aircraftModel": "Cessna 172",
      "status": "Available",
      "tracking_data": {
        "ac": [
          {
            "hex": "a12345",
            "flight": "N166NN",
            "alt_baro": 3500,
            "gs": 120.5,
            "lat": 47.906,
            "lon": -122.281
          }
        ]
      },
      "last_updated": "2025-06-07T10:30:45.123Z"
    }
  ],
  "inactive_aircraft": [
    {
      "plane_id": "684238fc551d3d8d70edbeb5",
      "registration": "N987XY",
      "type": "Single Engine", 
      "aircraftModel": "Piper Cherokee",
      "status": "Maintenance",
      "tracking_data": null,
      "error": "Failed to fetch tracking data: Not Found",
      "last_updated": "2025-06-07T10:30:45.123Z"
    }
  ],
  "timestamp": "2025-06-07T10:30:45.123Z"
}
```

#### No Aircraft Response (200 OK):
```json
{
  "message": "No planes found for this school",
  "school_id": "68389c818d13949c514ac59c",
  "aircraft": [],
  "total": 0,
  "timestamp": "2025-06-07T10:30:45.123Z"
}
```

## Tracking Data Fields Explanation

### Aircraft Position & Movement
- **`lat`/`lon`**: GPS coordinates (latitude/longitude) in decimal degrees
- **`alt_baro`**: Barometric altitude in feet above sea level
- **`alt_geom`**: Geometric altitude in feet (GPS-derived)
- **`gs`**: Ground speed in knots
- **`track`**: Track angle in degrees (0-360, where 0 is North)
- **`baro_rate`**: Rate of climb/descent in feet per minute

### Aircraft Identification
- **`hex`**: Unique ICAO 24-bit aircraft identifier
- **`flight`**: Flight number or callsign
- **`r`**: Aircraft registration (tail number)
- **`t`**: Aircraft type code
- **`squawk`**: Transponder squawk code

### Data Quality & Timing
- **`seen`**: Seconds since last message received
- **`seen_pos`**: Seconds since last position update
- **`messages`**: Total number of messages received
- **`rssi`**: Received signal strength indicator
- **`nic`**: Navigation Integrity Category (position accuracy)

### Flight Status
- **`emergency`**: Emergency squawk code if applicable
- **`alert`**: Emergency alert flag
- **`spi`**: Special Position Identification (ident button pressed)

## Summary Statistics

The API provides summary statistics for quick fleet overview:

- **`total_planes`**: Total number of aircraft registered to the school
- **`planes_with_tracking`**: Aircraft currently visible on ADS-B network
- **`planes_without_tracking`**: Aircraft not currently transmitting or out of coverage
- **`planes_in_flight`**: Aircraft currently airborne (altitude > 0 feet)

## Data Categories

### Active Aircraft
Aircraft with current tracking data from the ADS-B network. These planes are:
- Powered on with transponder active
- Within range of ADS-B receivers
- Transmitting position, altitude, and flight data

### Inactive Aircraft  
Aircraft without current tracking data. Reasons may include:
- Aircraft powered down or transponder off
- Out of ADS-B receiver coverage area
- Maintenance or storage status
- Technical issues with tracking service

## Error Responses

### 400 Bad Request
```json
{
  "error": "Invalid school ID format"
}
```

### 401 Unauthorized
```json
{
  "error": "Invalid API key"
}
```

```json
{
  "error": "Invalid or missing authentication token"
}
```

### 403 Forbidden
```json
{
  "error": "You do not have access to this school"
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal server error"
}
```

## Integration Details

### ADSB.lol API Integration
- **API Endpoint**: `https://api.adsb.lol/v2/registration/{registration}`
- **Method**: GET
- **Rate Limits**: Respectful usage recommended
- **Data Freshness**: Real-time updates (typically 1-10 second delays)
- **Coverage**: Global ADS-B receiver network

### Error Handling
The API gracefully handles external service failures:
- Individual aircraft tracking failures don't affect other aircraft
- Network timeouts are handled with appropriate error messages
- Failed requests are logged for monitoring
- Partial data is still returned for available aircraft

## Use Cases & Scenarios

### Scenario 1: Flight Operations Monitoring
1. Dispatch wants to monitor active flights
2. Requests aircraft tracking for school fleet
3. Receives real-time positions of airborne aircraft
4. Monitors flight progress and identifies aircraft on ground vs. in flight

### Scenario 2: Emergency Response
1. Emergency services need to locate specific aircraft
2. School admin provides aircraft registration
3. API returns last known position, altitude, and track
4. Enables rapid response coordination

### Scenario 3: Fleet Management
1. School administrator monitors fleet utilization
2. Tracks which aircraft are active vs. inactive
3. Identifies aircraft potentially ready for next flight
4. Optimizes scheduling based on aircraft locations

### Scenario 4: Student/Instructor Safety
1. Instructor wants to monitor student solo flight
2. Tracks aircraft position throughout training flight
3. Verifies aircraft returns to base airport
4. Provides peace of mind during training operations

### Scenario 5: Maintenance Coordination
1. Maintenance team needs to locate aircraft for service
2. Checks tracking data to see if aircraft is airborne
3. Coordinates ground operations when aircraft lands
4. Plans maintenance activities around flight schedules

## Technical Considerations

### Performance
- Multiple external API calls are made concurrently using `Promise.all()`
- Individual aircraft failures don't block other requests
- Response times depend on ADSB.lol API performance

### Reliability
- Graceful degradation when external service is unavailable
- Error logging for monitoring and debugging
- Fallback handling for missing or invalid tracking data

### Security
- School-level access control prevents unauthorized data access
- No sensitive flight plan or passenger information exposed
- Public ADS-B data only (already broadcast publicly)

### Data Freshness
- Real-time data with typical 1-10 second delays
- Timestamp included for data age verification
- `seen` and `seen_pos` fields indicate data freshness

## Rate Limiting Recommendations
While not currently implemented, consider:
- Limiting requests per school per minute
- Caching responses for short periods (30-60 seconds)
- Implementing request queuing for large fleets
- Monitoring external API usage patterns 
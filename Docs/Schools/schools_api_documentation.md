# Schools API Documentation

## Overview
The Schools API provides comprehensive management of flight school records within the SkyTrack system. This API allows system administrators and school administrators to view, update, and manage school information with strict access controls.

## Base URL
```
{baseUrl}/api/schools/{schoolId}
```

## Authentication
All endpoints require:
- **API Key**: Provided via `X-API-Key` header
- **JWT Token**: Provided via `Authorization: Bearer {token}` header
- **CSRF Token**: Provided via `X-CSRF-Token` header (for POST/PUT/DELETE)

## Access Control Matrix

| Role | GET School | PUT School | DELETE School |
|------|------------|------------|---------------|
| **Student** | ❌ | ❌ | ❌ |
| **Instructor** | ❌ | ❌ | ❌ |
| **School Admin** | ✅ Own School Only | ✅ Own School Only | ❌ |
| **System Admin** | ✅ All Schools | ✅ All Schools | ✅ All Schools |

## Security Features
- **API key validation** required for all requests
- **JWT authentication** verifies user identity and role
- **CSRF protection** for state-changing operations
- **School-scoped access** prevents cross-school data access
- **Role-based permissions** enforce appropriate access levels
- **Fraud detection** and risk scoring enabled
- **Advanced audit logging** for all operations

## School Object Structure

```json
{
  "_id": "ObjectId",
  "name": "SkyTrack Flight Academy",
  "address": {
    "street": "123 Aviation Way",
    "city": "Seattle",
    "state": "WA",
    "zip": "98101",
    "country": "USA"
  },
  "contact": {
    "phone": "+1-555-123-4567",
    "email": "info@skytrackacademy.com",
    "website": "https://skytrackacademy.com"
  },
  "faa_certificate": "FT123456",
  "status": "Active",
  "payment_info": {
    "stripe_customer_id": "cus_1234567890",
    "billing_address": {
      "street": "123 Aviation Way",
      "city": "Seattle",
      "state": "WA",
      "zip": "98101"
    }
  },
  "settings": {
    "timezone": "America/Los_Angeles",
    "currency": "USD",
    "tax_rate": 8.5
  },
  "created_at": "2024-01-15T08:00:00.000Z",
  "updated_at": "2024-01-20T15:30:00.000Z",
  "created_by": "ObjectId",
  "updated_by": "ObjectId"
}
```

## API Endpoints

### GET /api/schools/{schoolId}
Retrieve a specific school's information.

**Access Control:**
- **School Admins:** ✅ Can view their own school only
- **System Admins:** ✅ Can view any school
- **Students/Instructors:** ❌ No access

**Path Parameters:**
- `schoolId` (required): ObjectId of the school

**Headers Required:**
```
Authorization: Bearer {jwt_token}
X-API-Key: {api_key}
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "School retrieved successfully",
  "data": {
    "_id": "68389c818d13949c514ac59c",
    "name": "SkyTrack Flight Academy",
    "address": {
      "street": "123 Aviation Way",
      "city": "Seattle",
      "state": "WA",
      "zip": "98101",
      "country": "USA"
    },
    "contact": {
      "phone": "+1-555-123-4567",
      "email": "info@skytrackacademy.com",
      "website": "https://skytrackacademy.com"
    },
    "faa_certificate": "FT123456",
    "status": "Active",
    "settings": {
      "timezone": "America/Los_Angeles",
      "currency": "USD",
      "tax_rate": 8.5
    },
    "created_at": "2024-01-15T08:00:00.000Z",
    "updated_at": "2024-01-20T15:30:00.000Z"
  },
  "auditId": "fb180ecb6a4b1e5dd560e12e06580505",
  "timestamp": "2024-01-20T15:30:00.000Z"
}
```

**Error Responses:**

**400 Bad Request:**
```json
{
  "success": false,
  "error": "Invalid school ID",
  "auditId": "fb180ecb6a4b1e5dd560e12e06580505",
  "timestamp": "2024-01-20T15:30:00.000Z"
}
```

**401 Unauthorized:**
```json
{
  "error": {
    "message": "Invalid or missing authentication token",
    "code": "AUTHENTICATION_FAILED",
    "requestId": "fb180ecb6a4b1e5dd560e12e06580505",
    "timestamp": "2024-01-20T15:30:00.000Z"
  }
}
```

**403 Forbidden:**
```json
{
  "success": false,
  "error": "Access denied: You can only view your own school",
  "auditId": "fb180ecb6a4b1e5dd560e12e06580505",
  "timestamp": "2024-01-20T15:30:00.000Z"
}
```

**404 Not Found:**
```json
{
  "success": false,
  "error": "School not found",
  "auditId": "fb180ecb6a4b1e5dd560e12e06580505",
  "timestamp": "2024-01-20T15:30:00.000Z"
}
```

### PUT /api/schools/{schoolId}
Update a school's information.

**Access Control:**
- **School Admins:** ✅ Can update their own school only
- **System Admins:** ✅ Can update any school
- **Students/Instructors:** ❌ No access

**Path Parameters:**
- `schoolId` (required): ObjectId of the school

**Headers Required:**
```
Authorization: Bearer {jwt_token}
X-API-Key: {api_key}
X-CSRF-Token: {csrf_token}
Content-Type: application/json
```

**Request Body (all fields optional):**
```json
{
  "name": "Updated School Name",
  "address": {
    "street": "456 New Aviation Blvd",
    "city": "Bellevue",
    "state": "WA",
    "zip": "98004",
    "country": "USA"
  },
  "contact": {
    "phone": "+1-555-987-6543",
    "email": "newemail@skytrackacademy.com",
    "website": "https://newskytrackacademy.com"
  },
  "faa_certificate": "FT654321",
  "status": "Active",
  "settings": {
    "timezone": "America/Los_Angeles",
    "currency": "USD",
    "tax_rate": 9.0
  }
}
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "School updated successfully",
  "data": {
    "_id": "68389c818d13949c514ac59c",
    "name": "Updated School Name",
    "address": {
      "street": "456 New Aviation Blvd",
      "city": "Bellevue",
      "state": "WA",
      "zip": "98004",
      "country": "USA"
    },
    "contact": {
      "phone": "+1-555-987-6543",
      "email": "newemail@skytrackacademy.com",
      "website": "https://newskytrackacademy.com"
    },
    "faa_certificate": "FT654321",
    "status": "Active",
    "settings": {
      "timezone": "America/Los_Angeles",
      "currency": "USD",
      "tax_rate": 9.0
    },
    "updated_at": "2024-01-20T16:00:00.000Z",
    "updated_by": "6837ab78cce2560141dbf3a4"
  },
  "auditId": "fb180ecb6a4b1e5dd560e12e06580505",
  "timestamp": "2024-01-20T16:00:00.000Z"
}
```

**Error Responses:**

**400 Bad Request:**
```json
{
  "success": false,
  "error": "Invalid school ID",
  "auditId": "fb180ecb6a4b1e5dd560e12e06580505",
  "timestamp": "2024-01-20T16:00:00.000Z"
}
```

**403 Forbidden:**
```json
{
  "success": false,
  "error": "Forbidden: Only system administrators and school administrators can update schools",
  "auditId": "fb180ecb6a4b1e5dd560e12e06580505",
  "timestamp": "2024-01-20T16:00:00.000Z"
}
```

```json
{
  "success": false,
  "error": "Forbidden: School administrators can only update their own school",
  "auditId": "fb180ecb6a4b1e5dd560e12e06580505",
  "timestamp": "2024-01-20T16:00:00.000Z"
}
```

**409 Conflict:**
```json
{
  "success": false,
  "error": "School with this name already exists",
  "auditId": "fb180ecb6a4b1e5dd560e12e06580505",
  "timestamp": "2024-01-20T16:00:00.000Z"
}
```

### DELETE /api/schools/{schoolId}
Delete a school (System Administrators only).

**Access Control:**
- **School Admins:** ❌ Cannot delete schools
- **System Admins:** ✅ Can delete any school
- **Students/Instructors:** ❌ No access

**Path Parameters:**
- `schoolId` (required): ObjectId of the school

**Headers Required:**
```
Authorization: Bearer {jwt_token}
X-API-Key: {api_key}
X-CSRF-Token: {csrf_token}
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "School deleted successfully",
  "auditId": "fb180ecb6a4b1e5dd560e12e06580505",
  "timestamp": "2024-01-20T16:00:00.000Z"
}
```

**Error Responses:**

**403 Forbidden:**
```json
{
  "success": false,
  "error": "Forbidden: Only system administrators can delete schools",
  "auditId": "fb180ecb6a4b1e5dd560e12e06580505",
  "timestamp": "2024-01-20T16:00:00.000Z"
}
```

**404 Not Found:**
```json
{
  "success": false,
  "error": "School not found",
  "auditId": "fb180ecb6a4b1e5dd560e12e06580505",
  "timestamp": "2024-01-20T16:00:00.000Z"
}
```

## Validation Rules

### School Name
- Must be unique within the system
- Cannot be empty or null
- Maximum length: 100 characters
- Case-sensitive uniqueness validation

### Address Fields
- All address fields are optional
- State must be valid US state code (if country is USA)
- ZIP code must be valid format for the country
- Country defaults to "USA" if not specified

### Contact Information
- Email must be valid format if provided
- Phone number should follow international format
- Website URL must be valid if provided

### FAA Certificate
- Must be unique across all schools
- Format: Alphanumeric, typically starts with "FT"
- Cannot be changed once set

### Settings
- Timezone must be valid IANA timezone identifier
- Currency must be valid ISO 4217 code
- Tax rate must be between 0 and 100

## Business Logic

### School Access Control
1. **School Administrators** can only access schools they belong to
2. **System Administrators** have full access to all schools
3. **Students and Instructors** have no direct access to school management
4. **Cross-school access** is prevented for security

### Update Restrictions
1. **School name changes** trigger duplicate name validation
2. **FAA certificate changes** require uniqueness validation
3. **Payment information** is excluded from responses for security
4. **Audit trail** tracks all changes with user and timestamp

### Deletion Safety
1. **System administrators only** can delete schools
2. **Cascade deletion** should be considered for related data
3. **Soft deletion** may be implemented in future versions
4. **Backup verification** before permanent deletion

## Security Context

### Audit Information
All responses include:
- `auditId`: Unique identifier for request tracing
- `timestamp`: ISO 8601 timestamp of operation
- `securityContext`: Risk scoring and fraud detection data

### Risk Scoring
- **Low risk (0-30)**: Normal operations
- **Medium risk (31-70)**: Unusual patterns
- **High risk (71-100)**: Suspicious activity

### Fraud Detection
- **Geographic restrictions**: Unusual location access
- **Velocity checks**: Rapid successive operations
- **Pattern analysis**: Unusual access patterns
- **Session monitoring**: Suspicious session activity

## Error Codes Reference

| Code | Description | HTTP Status |
|------|-------------|-------------|
| `INVALID_SCHOOL_ID` | School ID format is invalid | 400 |
| `SCHOOL_NOT_FOUND` | School does not exist | 404 |
| `ACCESS_DENIED` | Insufficient permissions | 403 |
| `DUPLICATE_SCHOOL_NAME` | School name already exists | 409 |
| `AUTHENTICATION_FAILED` | Invalid or missing token | 401 |
| `API_KEY_INVALID` | Invalid API key | 401 |
| `CSRF_TOKEN_MISSING` | Missing CSRF token | 403 |
| `HIGH_RISK_BLOCKED` | Request blocked due to risk score | 403 |

## Use Cases & Scenarios

### Scenario 1: School Administrator Views Own School
1. **Authentication**: School admin logs in with valid credentials
2. **Authorization**: System verifies user belongs to requested school
3. **Access Grant**: User can view school details
4. **Response**: School information returned with audit trail

### Scenario 2: System Administrator Updates Any School
1. **Authentication**: System admin authenticates with elevated privileges
2. **Authorization**: System admin has full access to all schools
3. **Validation**: School name uniqueness checked
4. **Update**: School information updated with audit trail

### Scenario 3: School Administrator Attempts Cross-School Access
1. **Authentication**: Valid credentials provided
2. **Authorization Check**: User's school_id doesn't match requested school
3. **Access Denied**: 403 Forbidden response returned
4. **Audit Log**: Security event logged for monitoring

### Scenario 4: System Administrator Deletes School
1. **Authentication**: System admin with delete permissions
2. **Authorization**: Only system admins can delete schools
3. **Safety Check**: Verify no critical dependencies
4. **Deletion**: School permanently removed with audit trail

## Integration Points

### User Management
- School administrators are linked to specific schools
- User roles determine access permissions
- School-scoped operations prevent data leakage

### Financial System
- School settings affect billing and invoicing
- Tax rates and currency settings impact charges
- Payment information is securely managed

### Audit System
- All operations are logged with full context
- Risk scoring provides security monitoring
- Fraud detection prevents unauthorized access

## Performance Considerations

### Database Optimization
- School ID queries are indexed for fast lookups
- User-school relationships are efficiently cached
- Audit logs are optimized for query performance

### Security Overhead
- JWT validation adds minimal latency
- CSRF token validation is lightweight
- Risk scoring is performed asynchronously

### Caching Strategy
- School information is cached for read operations
- User permissions are cached to reduce database queries
- Audit data is buffered for batch processing

This comprehensive school management API provides secure, auditable, and efficient school administration capabilities while maintaining strict access controls and data integrity. 
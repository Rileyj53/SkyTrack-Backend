# Core Organizations Management API Documentation

## Overview
The Core Organizations Management API provides fundamental CRUD operations for managing flight training organizations (schools and flying clubs) within the SkyTrack system. This API allows system administrators to view all organizations, while organization administrators can manage their own organization information with strict access controls.

## Base URL
```
{baseUrl}/api/organizations
```

## Authentication
All endpoints require:
- **API Key**: Provided via `X-API-Key` header
- **JWT Token**: Provided via `Authorization: Bearer {token}` header
- **CSRF Token**: Provided via `X-CSRF-Token` header (for POST/PUT/DELETE)

## Access Control Matrix

| Role | List All Organizations | Create Organization | Get Organization | Update Organization | Delete Organization |
|------|------------------------|---------------------|------------------|---------------------|---------------------|
| **Student** | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Instructor** | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Organization Admin** | ❌ | ✅ | ✅ Own Organization Only | ✅ Own Organization Only | ❌ |
| **System Admin** | ✅ | ✅ | ✅ All Organizations | ✅ All Organizations | ✅ All Organizations |

## Security Features
- **API key validation** required for all requests
- **JWT authentication** verifies user identity and role
- **CSRF protection** for state-changing operations
- **Organization-scoped access** prevents cross-organization data access
- **Role-based permissions** enforce appropriate access levels
- **Fraud detection** and risk scoring enabled
- **Advanced audit logging** for all operations

## Organization Object Structure

```json
{
  "_id": "ObjectId",
  "name": "SkyTrack Flight Academy",
  "type": "school", // "school" or "club"
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
  "updated_at": "2024-01-20T15:30:00.000Z",
  "created_by": "ObjectId",
  "updated_by": "ObjectId"
}
```

## API Endpoints

### 1. List All Organizations
**GET** `/api/organizations`

Retrieve all organizations in the system. Only accessible by system administrators.

**Access Control:**
- **System Admins:** ✅ Can view all organizations
- **Organization Admins:** ❌ Cannot list all organizations
- **Students/Instructors:** ❌ No access

**Headers Required:**
```
Authorization: Bearer {jwt_token}
X-API-Key: {api_key}
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Organizations retrieved successfully",
  "data": [
    {
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
    }
  ],
  "auditId": "fb180ecb6a4b1e5dd560e12e06580505",
  "timestamp": "2024-01-20T15:30:00.000Z",
  "summary": {
    "totalOrganizations": 1,
    "accessLevel": "sys_admin"
  }
}
```

**Error Responses:**

**403 Forbidden:**
```json
{
  "success": false,
  "error": "Forbidden: Only system administrators can list all organizations",
  "auditId": "fb180ecb6a4b1e5dd560e12e06580505",
  "timestamp": "2024-01-20T15:30:00.000Z"
}
```

### 2. Create New Organization
**POST** `/api/organizations`

Create a new organization in the system. Accessible by system administrators and organization administrators.

**Access Control:**
- **System Admins:** ✅ Can create organizations
- **Organization Admins:** ✅ Can create organizations
- **Students/Instructors:** ❌ No access

**Headers Required:**
```
Authorization: Bearer {jwt_token}
X-API-Key: {api_key}
X-CSRF-Token: {csrf_token}
Content-Type: application/json
```

**Required Fields:**
- `name`: Organization name (must be unique, minimum 2 characters)

**Optional Fields:**
- `address`: Complete address object
- `contact`: Contact information object
- `faa_certificate`: FAA certificate number
- `status`: Organization status (default: "Active")
- `settings`: Organization settings object

**Request Body:**
```json
{
  "name": "New Flight Academy",
  "address": {
    "street": "456 Aviation Boulevard",
    "city": "Portland",
    "state": "OR",
    "zip": "97201",
    "country": "USA"
  },
  "contact": {
    "phone": "+1-555-987-6543",
    "email": "info@newflightacademy.com",
    "website": "https://newflightacademy.com"
  },
  "faa_certificate": "FT987654",
  "status": "Active",
  "settings": {
    "timezone": "America/Los_Angeles",
    "currency": "USD",
    "tax_rate": 8.5
  }
}
```

**Success Response (201 Created):**
```json
{
  "success": true,
  "message": "Organization created successfully",
  "data": {
    "_id": "674a1b2c3d4e5f6789012346",
    "name": "New Flight Academy",
    "address": {
      "street": "456 Aviation Boulevard",
      "city": "Portland",
      "state": "OR",
      "zip": "97201",
      "country": "USA"
    },
    "contact": {
      "phone": "+1-555-987-6543",
      "email": "info@newflightacademy.com",
      "website": "https://newflightacademy.com"
    },
    "faa_certificate": "FT987654",
    "status": "Active",
    "settings": {
      "timezone": "America/Los_Angeles",
      "currency": "USD",
      "tax_rate": 8.5
    },
    "created_by": "674a1b2c3d4e5f6789012347",
    "created_at": "2024-01-15T10:30:00.000Z",
    "updated_at": "2024-01-15T10:30:00.000Z"
  },
  "auditId": "audit_674a1b2c3d4e5f6789012349",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**Error Responses:**

**400 Bad Request:**
```json
{
  "success": false,
  "error": "Organization name is required",
  "auditId": "audit_674a1b2c3d4e5f6789012349",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**403 Forbidden:**
```json
{
  "success": false,
  "error": "Insufficient permissions: Only system administrators and organization administrators can create organizations",
  "auditId": "audit_674a1b2c3d4e5f6789012349",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**409 Conflict:**
```json
{
  "success": false,
  "error": "Organization with this name already exists",
  "auditId": "audit_674a1b2c3d4e5f6789012349",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### 3. Get Specific Organization
**GET** `/api/organizations/{organizationId}`

Retrieve a specific organization's information.

**Access Control:**
- **Organization Admins:** ✅ Can view their own organization only
- **System Admins:** ✅ Can view any organization
- **Students/Instructors:** ❌ No access

**Path Parameters:**
- `organizationId` (required): ObjectId of the organization

**Headers Required:**
```
Authorization: Bearer {jwt_token}
X-API-Key: {api_key}
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Organization retrieved successfully",
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
  "error": "Invalid organization ID",
  "auditId": "fb180ecb6a4b1e5dd560e12e06580505",
  "timestamp": "2024-01-20T15:30:00.000Z"
}
```

**403 Forbidden:**
```json
{
  "success": false,
  "error": "Access denied: You can only view your own organization",
  "auditId": "fb180ecb6a4b1e5dd560e12e06580505",
  "timestamp": "2024-01-20T15:30:00.000Z"
}
```

**404 Not Found:**
```json
{
  "success": false,
  "error": "Organization not found",
  "auditId": "fb180ecb6a4b1e5dd560e12e06580505",
  "timestamp": "2024-01-20T15:30:00.000Z"
}
```

### 4. Update Organization
**PUT** `/api/organizations/{organizationId}`

Update an organization's information.

**Access Control:**
- **Organization Admins:** ✅ Can update their own organization only
- **System Admins:** ✅ Can update any organization
- **Students/Instructors:** ❌ No access

**Path Parameters:**
- `organizationId` (required): ObjectId of the organization

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
  "name": "Updated Organization Name",
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
  "message": "Organization updated successfully",
  "data": {
    "_id": "68389c818d13949c514ac59c",
    "name": "Updated Organization Name",
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

**403 Forbidden:**
```json
{
  "success": false,
  "error": "Forbidden: Only system administrators and organization administrators can update organizations",
  "auditId": "fb180ecb6a4b1e5dd560e12e06580505",
  "timestamp": "2024-01-20T16:00:00.000Z"
}
```

**409 Conflict:**
```json
{
  "success": false,
  "error": "Organization with this name already exists",
  "auditId": "fb180ecb6a4b1e5dd560e12e06580505",
  "timestamp": "2024-01-20T16:00:00.000Z"
}
```

### 5. Delete Organization
**DELETE** `/api/organizations/{organizationId}`

Delete an organization (System Administrators only).

**Access Control:**
- **Organization Admins:** ❌ Cannot delete organizations
- **System Admins:** ✅ Can delete any organization
- **Students/Instructors:** ❌ No access

**Path Parameters:**
- `organizationId` (required): ObjectId of the organization

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
  "message": "Organization deleted successfully",
  "auditId": "fb180ecb6a4b1e5dd560e12e06580505",
  "timestamp": "2024-01-20T16:00:00.000Z"
}
```

**Error Responses:**

**403 Forbidden:**
```json
{
  "success": false,
  "error": "Forbidden: Only system administrators can delete organizations",
  "auditId": "fb180ecb6a4b1e5dd560e12e06580505",
  "timestamp": "2024-01-20T16:00:00.000Z"
}
```

**404 Not Found:**
```json
{
  "success": false,
  "error": "Organization not found",
  "auditId": "fb180ecb6a4b1e5dd560e12e06580505",
  "timestamp": "2024-01-20T16:00:00.000Z"
}
```

## Validation Rules

### Organization Name
- Must be unique within the system
- Cannot be empty or null
- Minimum length: 2 characters
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
- Must be unique across all organizations
- Format: Alphanumeric, typically starts with "FT"
- Cannot be changed once set

### Settings
- Timezone must be valid IANA timezone identifier
- Currency must be valid ISO 4217 code
- Tax rate must be between 0 and 100

## Business Logic

### Organization Access Control
1. **Organization Administrators** can only access organizations they belong to
2. **System Administrators** have full access to all organizations
3. **Students and Instructors** have no direct access to organization management
4. **Cross-organization access** is prevented for security

### Update Restrictions
1. **Organization name changes** trigger duplicate name validation
2. **FAA certificate changes** require uniqueness validation
3. **Payment information** is excluded from responses for security
4. **Audit trail** tracks all changes with user and timestamp

### Deletion Safety
1. **System administrators only** can delete organizations
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
| `INVALID_ORGANIZATION_ID` | Organization ID format is invalid | 400 |
| `ORGANIZATION_NOT_FOUND` | Organization does not exist | 404 |
| `ACCESS_DENIED` | Insufficient permissions | 403 |
| `DUPLICATE_ORGANIZATION_NAME` | Organization name already exists | 409 |
| `AUTHENTICATION_FAILED` | Invalid or missing token | 401 |
| `API_KEY_INVALID` | Invalid API key | 401 |
| `CSRF_TOKEN_MISSING` | Missing CSRF token | 403 |
| `HIGH_RISK_BLOCKED` | Request blocked due to risk score | 403 |

## Use Cases & Scenarios

### Scenario 1: System Administrator Lists All Organizations
1. **Authentication**: System admin logs in with elevated privileges
2. **Authorization**: System admin has access to all organizations
3. **Response**: Complete list of organizations with summary statistics

### Scenario 2: Organization Administrator Creates New Organization
1. **Authentication**: Valid organization admin credentials
2. **Validation**: Organization name uniqueness checked
3. **Creation**: New organization created with audit trail
4. **Response**: Organization information returned with audit ID

### Scenario 3: Organization Administrator Views Own Organization
1. **Authentication**: Organization admin logs in with valid credentials
2. **Authorization**: System verifies user belongs to requested organization
3. **Access Grant**: User can view organization details
4. **Response**: Organization information returned with audit trail

### Scenario 4: System Administrator Updates Any Organization
1. **Authentication**: System admin authenticates with elevated privileges
2. **Authorization**: System admin has full access to all organizations
3. **Validation**: Organization name uniqueness checked (if changed)
4. **Update**: Organization information updated with audit trail

### Scenario 5: System Administrator Deletes Organization
1. **Authentication**: System admin with delete permissions
2. **Authorization**: Only system admins can delete organizations
3. **Safety Check**: Verify no critical dependencies
4. **Deletion**: Organization permanently removed with audit trail

## Integration Points

### User Management
- Organization administrators are linked to specific organizations
- User roles determine access permissions
- Organization-scoped operations prevent data leakage

### Financial System
- Organization settings affect billing and invoicing
- Tax rates and currency settings impact charges
- Payment information is securely managed

### Audit System
- All operations are logged with full context
- Risk scoring provides security monitoring
- Fraud detection prevents unauthorized access

## Performance Considerations

### Database Optimization
- Organization ID queries are indexed for fast lookups
- User-organization relationships are efficiently cached
- Audit logs are optimized for query performance

### Security Overhead
- JWT validation adds minimal latency
- CSRF token validation is lightweight
- Risk scoring is performed asynchronously

### Caching Strategy
- Organization information is cached for read operations
- User permissions are cached to reduce database queries
- Audit data is buffered for batch processing

This comprehensive core organizations management API provides secure, auditable, and efficient organization administration capabilities while maintaining strict access controls and data integrity. 
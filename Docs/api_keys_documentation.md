# API Keys Management API Documentation

## Overview
The API Keys Management API provides comprehensive functionality for creating, listing, and managing API keys within the SkyTrack system. These endpoints allow system administrators to generate API keys for users, monitor key usage, and revoke keys as needed.

**Base URL**: `/api/api-keys`

**Total Endpoints**: 4 API key management endpoints
- **Key Generation**: Create new API keys with custom expiration
- **Key Management**: List, revoke, and monitor API keys
- **Administrative**: System admin controls

**Note**: Debug and testing functionality for API keys is available via the Debug API at `/api/debug/api-keys`

## Authentication Requirements
- **JWT Token**: Required for all endpoints via `Authorization: Bearer <token>` header
- **System Admin Role**: Most endpoints require `sys_admin` role for access
- **User Ownership**: Key revocation allows users to revoke their own keys

---

## API Keys Endpoints

### 1. List All API Keys (Admin)
**GET** `/api/api-keys`

Get a comprehensive list of all API keys in the system (system administrators only).

#### Headers
- `Authorization: Bearer <token>` (sys_admin role required)

#### Success Response (200)
```json
{
  "status": "success",
  "data": [
    {
      "_id": "674a1b2c3d4e5f6789012345",
      "user": "674a1b2c3d4e5f6789012346",
      "label": "Development Key",
      "lastSix": "abc123",
      "isActive": true,
      "created_at": "2024-01-15T10:30:00.000Z",
      "expiresAt": "2024-12-31T23:59:59.999Z"
    },
    {
      "_id": "674a1b2c3d4e5f6789012347",
      "user": "674a1b2c3d4e5f6789012348",
      "label": "Production Key",
      "lastSix": "xyz789",
      "isActive": true,
      "created_at": "2024-01-10T08:15:00.000Z",
      "expiresAt": "2025-01-10T08:15:00.000Z"
    }
  ]
}
```

#### Error Responses
- **401**: Unauthorized (missing or invalid JWT token)
- **403**: Forbidden (non-admin user)
- **500**: Internal server error

#### Use Cases
- Administrative oversight of all API keys
- Monitor API key usage across the system
- Audit key distribution and expiration dates
- System security monitoring

#### Security Note
🔒 **Restricted Access**: Only system administrators can access this endpoint. The actual API key values are excluded from responses for security.

---

### 2. Generate New API Key
**POST** `/api/api-keys/generate`

Generate a new API key with custom label and expiration settings (system administrators only).

#### Headers
- `Authorization: Bearer <token>` (sys_admin role required)
- `Content-Type: application/json`

#### Request Body
```json
{
  "label": "Production API Key",
  "durationValue": 6,
  "durationType": "months"
}
```

#### Request Parameters
- **label** (required): Descriptive label for the API key
- **durationValue** (required): Numeric value for expiration duration
- **durationType** (required): Duration unit - must be one of: `days`, `months`, `years`

#### Success Response (200)
```json
{
  "status": "success",
  "message": "API key generated successfully",
  "data": {
    "apiKey": "sk_prod_1234567890abcdef1234567890abcdef",
    "label": "Production API Key",
    "expiresAt": "2024-07-15T10:30:00.000Z"
  }
}
```

#### Error Responses
- **400**: Missing required fields or invalid duration type
- **401**: Unauthorized (missing or invalid JWT token)
- **403**: Forbidden (non-admin user)
- **404**: User not found
- **500**: Internal server error

#### Use Cases
- Create API keys for new users or services
- Generate temporary keys for testing
- Set up production keys with appropriate expiration
- Manage key lifecycle and rotation

#### Security Features
- **Secure Generation**: Uses cryptographically secure random generation
- **Hashed Storage**: API keys are hashed using SHA-256 before database storage
- **Expiration Control**: Configurable expiration dates
- **Admin-Only Creation**: Only system administrators can generate keys

#### Example Duration Configurations
```json
// 30 days expiration
{
  "label": "Testing Key",
  "durationValue": 30,
  "durationType": "days"
}

// 1 year expiration
{
  "label": "Annual Service Key",
  "durationValue": 1,
  "durationType": "years"
}

// 3 months expiration
{
  "label": "Quarterly Access Key",
  "durationValue": 3,
  "durationType": "months"
}
```

---

### 3. List User API Keys
**GET** `/api/api-keys/keys`

Get API keys associated with the requesting administrator (system administrators only).

#### Headers
- `Authorization: Bearer <token>` (sys_admin role required)

#### Success Response (200)
```json
{
  "status": "success",
  "data": [
    {
      "_id": "674a1b2c3d4e5f6789012345",
      "user": "674a1b2c3d4e5f6789012346",
      "label": "Admin Development Key",
      "lastSix": "def456",
      "isActive": true,
      "created_at": "2024-01-15T10:30:00.000Z",
      "expiresAt": "2024-06-15T10:30:00.000Z"
    }
  ]
}
```

#### Error Responses
- **401**: Unauthorized (missing or invalid JWT token)
- **403**: Forbidden (non-admin user)
- **500**: Internal server error

#### Use Cases
- View personal API keys for administrators
- Check expiration dates of own keys
- Monitor personal key usage
- Manage individual key inventory

---

### 4. Revoke API Key
**DELETE** `/api/api-keys/{apiKeyId}`

Revoke a specific API key by its ID. Users can revoke their own keys.

#### Headers
- `Authorization: Bearer <token>`

#### URL Parameters
- **apiKeyId** (required): The unique identifier of the API key to revoke

#### Success Response (200)
```json
{
  "message": "API key revoked successfully"
}
```

#### Error Responses
- **401**: Unauthorized (missing or invalid JWT token)
- **404**: API key not found or already revoked
- **500**: Internal server error

#### Use Cases
- Revoke compromised API keys immediately
- Remove access for terminated users or services
- Clean up expired or unused keys
- Emergency security response

#### Security Features
- **User Ownership**: Users can only revoke their own API keys
- **Immediate Effect**: Revocation takes effect immediately
- **Audit Trail**: Revocation actions are logged for security purposes

#### Example Request
```bash
DELETE /api/api-keys/674a1b2c3d4e5f6789012345
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

### 5. API Keys Debug Endpoint
**GET** `/api/debug/api-keys`

Debug endpoint to verify API keys functionality and get comprehensive API key information (system administrators only).

**Note**: This endpoint has been moved to the debug structure for better organization.

#### Headers
- `Authorization: Bearer <token>` (sys_admin role required)

#### Success Response (200)
```json
{
  "status": "success",
  "data": [
    {
      "_id": "674a1b2c3d4e5f6789012345",
      "user": "674a1b2c3d4e5f6789012346",
      "label": "Development Key",
      "lastSix": "abc123",
      "isActive": true,
      "createdAt": "2024-01-15T10:30:00.000Z",
      "expiresAt": "2024-12-31T23:59:59.999Z"
    }
  ],
  "debugInfo": {
    "userId": "674a1b2c3d4e5f6789012346",
    "userRole": "sys_admin",
    "endpoint": "/api/debug/api-keys",
    "method": "GET"
  }
}
```

#### Error Responses
- **401**: Unauthorized (missing or invalid JWT token)
- **403**: Forbidden (non-admin user)
- **500**: Internal server error

#### Use Cases
- Verify API keys service functionality
- Debug API key issues and configurations
- Administrative oversight of all API keys
- Development and testing support
- System health monitoring

---

## Security Considerations

### Access Control
- **Role-Based Access**: Most endpoints require `sys_admin` role
- **User Ownership**: Users can only manage their own API keys (revocation)
- **Token Validation**: All endpoints require valid JWT tokens

### API Key Security
- **Secure Generation**: Cryptographically secure random key generation
- **Hashed Storage**: Keys are SHA-256 hashed before database storage
- **Limited Exposure**: Actual key values never returned in list operations
- **Last Six Display**: Only last 6 characters shown for identification

### Data Protection
```javascript
// Example of key hashing implementation
const encoder = new TextEncoder();
const data = encoder.encode(apiKey);
const hashBuffer = await crypto.subtle.digest('SHA-256', data);
const hashedKey = Array.from(new Uint8Array(hashBuffer))
  .map(b => b.toString(16).padStart(2, '0')).join('');
```

### Expiration Management
- **Configurable Expiration**: Support for days, months, and years
- **Automatic Cleanup**: Expired keys can be automatically disabled
- **Renewal Process**: New keys can be generated before expiration

---

## Error Handling

### Standard Error Response Format
```json
{
  "error": "Error message description"
}
```

### Common HTTP Status Codes
- **200**: Success
- **400**: Bad Request (invalid parameters)
- **401**: Unauthorized (missing or invalid JWT token)
- **403**: Forbidden (insufficient permissions)
- **404**: Not Found (API key or user not found)
- **500**: Internal Server Error

### Error Scenarios
1. **Invalid Duration Type**: Must be 'days', 'months', or 'years'
2. **Missing Required Fields**: Label, durationValue, and durationType are required
3. **Key Not Found**: API key doesn't exist or was already revoked
4. **Permission Denied**: Non-admin trying to access admin endpoints

---

## API Key Lifecycle

### 1. Generation Process
```mermaid
graph TD
    A[Admin Request] --> B[Validate Admin Role]
    B --> C[Generate Secure Key]
    C --> D[Hash Key for Storage]
    D --> E[Calculate Expiration]
    E --> F[Save to Database]
    F --> G[Return Plain Key to Admin]
```

### 2. Usage Validation
```mermaid
graph TD
    A[API Request with Key] --> B[Hash Incoming Key]
    B --> C[Compare with Stored Hash]
    C --> D{Match Found?}
    D -->|Yes| E[Check Expiration]
    D -->|No| F[Return 403 Forbidden]
    E --> G{Still Valid?}
    G -->|Yes| H[Allow Access]
    G -->|No| I[Return 401 Expired]
```

### 3. Revocation Process
```mermaid
graph TD
    A[Revocation Request] --> B[Validate Token]
    B --> C[Check Key Ownership]
    C --> D[Mark Key as Revoked]
    D --> E[Log Revocation Event]
    E --> F[Return Success]
```

---

## Best Practices

### For System Administrators
- **Regular Audits**: Review all API keys periodically
- **Expiration Management**: Set appropriate expiration dates
- **Key Rotation**: Encourage regular key renewal
- **Monitor Usage**: Track key usage patterns for security

### For API Key Management
- **Descriptive Labels**: Use clear, descriptive labels for easy identification
- **Appropriate Expiration**: Set reasonable expiration dates based on use case
- **Immediate Revocation**: Revoke compromised keys immediately
- **Documentation**: Keep records of key purposes and owners

### Security Guidelines
- **Never Log Plain Keys**: Log only hashed versions or last 6 characters
- **Secure Transmission**: Always use HTTPS for key-related operations
- **Rate Limiting**: Implement rate limiting on key generation endpoints
- **Audit Trails**: Maintain comprehensive logs of key operations

---

## Integration Examples

### Generate API Key (cURL)
```bash
curl -X POST "http://localhost:3000/api/api-keys/generate" \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "label": "Production Service Key",
    "durationValue": 12,
    "durationType": "months"
  }'
```

### List All API Keys (cURL)
```bash
curl -X GET "http://localhost:3000/api/api-keys" \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN"
```

### Revoke API Key (cURL)
```bash
curl -X DELETE "http://localhost:3000/api/api-keys/674a1b2c3d4e5f6789012345" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## Development and Testing

### Testing Strategy
1. **Admin Access Testing**: Verify role-based access controls
2. **Key Generation**: Test various duration configurations
3. **Key Listing**: Verify proper data filtering and security
4. **Key Revocation**: Test ownership validation and immediate effect
5. **Error Handling**: Test various error scenarios

### Development Workflow
1. Use debug endpoint (`/api/debug/api-keys`) to verify service functionality and get comprehensive API key information
2. Generate test keys with short expiration for development
3. Test key validation with generated keys
4. Verify revocation functionality
5. Monitor logs for proper security measures

This comprehensive API Keys management system provides secure, scalable key management for the SkyTrack platform with proper administrative controls and security measures. 
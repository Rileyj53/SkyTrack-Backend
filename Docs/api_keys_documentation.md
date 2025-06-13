# API Keys Management API Documentation

## Overview
The API Keys Management API provides comprehensive functionality for creating, listing, and managing API keys within the SkyTrack system. These endpoints allow system administrators to generate API keys for users, monitor key usage, and revoke keys as needed.

**Base URL**: `/api/api-keys`

**Total Endpoints**: 4 API key management endpoints
- **Key Generation**: Create new API keys with custom expiration
- **Key Management**: List, revoke, and monitor API keys
- **Administrative**: System admin controls

**Note**: Debug and testing functionality for API keys is available via the Debug API at `/api/debug/api-keys`

## 🔐 Enterprise Security Features

All API key endpoints implement enterprise-grade security with the following features:

### Security Middleware
- **Comprehensive Authentication**: JWT tokens, API keys, and CSRF protection
- **Fraud Detection**: Real-time risk scoring and suspicious activity monitoring
- **Rate Limiting**: Sliding window rate limiting with configurable thresholds
- **Request Signing**: Advanced request signature verification
- **Geographic Restrictions**: IP-based geo-blocking capabilities
- **Session Management**: Configurable session timeouts
- **Audit Logging**: Comprehensive audit trails with unique audit IDs

### Data Protection
- **Data Classification**: All endpoints classified as 'restricted' level
- **Encryption**: AES-256 encryption for sensitive data
- **Request Size Limits**: Protection against large payload attacks
- **HTTPS Enforcement**: Mandatory HTTPS for all operations

## Authentication Requirements

All API key endpoints now require comprehensive authentication:

### Required Headers
- **`Authorization: Bearer <token>`** - JWT authentication token (required)
- **`X-API-Key: <api-key>`** - API key validation (required)
- **`X-CSRF-Token: <csrf-token>`** - CSRF protection token (required for POST/DELETE)
- **`Content-Type: application/json`** - For POST requests

### Role Requirements
- **System Admin Role**: All endpoints require `sys_admin` role
- **HTTPS Only**: All requests must use HTTPS
- **Session Timeout**: 15-minute session timeout for security

### Rate Limiting
- **Generation**: 5 requests per 5 minutes (ultra-strict for key generation)
- **Listing**: 20 requests per minute
- **Revocation**: 10 requests per minute

---

## API Keys Endpoints

### 1. List All API Keys (Admin)
**GET** `/api/api-keys`

Get a comprehensive list of all API keys in the system (system administrators only).

#### Security Configuration
- **Data Classification**: Restricted
- **Rate Limiting**: 20 requests/minute
- **Fraud Detection**: Enabled
- **Session Timeout**: 15 minutes

#### Required Headers
```http
Authorization: Bearer <jwt-token>
X-API-Key: <api-key>
```

#### Success Response (200)
```json
{
  "success": true,
  "message": "API keys retrieved successfully",
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
  ],
  "auditId": "audit_674a1b2c3d4e5f6789012349",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "securityContext": {
    "sessionId": "session_674a1b2c3d4e5f6789012350",
    "riskScore": 15,
    "encryptionLevel": "AES-256"
  }
}
```

#### Error Responses
- **400**: Bad Request (invalid parameters)
- **401**: Unauthorized (missing or invalid JWT token/API key)
- **403**: Forbidden (insufficient permissions or high risk score)
- **429**: Too Many Requests (rate limit exceeded)
- **500**: Internal server error

#### Enhanced Error Response Format
```json
{
  "error": {
    "message": "Detailed error description",
    "code": "ERROR_CODE",
    "requestId": "audit_674a1b2c3d4e5f6789012349",
    "timestamp": "2024-01-15T10:30:00.000Z"
  },
  "securityContext": {
    "riskScore": 85,
    "fraudFlags": ["SUSPICIOUS_IP", "HIGH_VELOCITY"]
  }
}
```

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

#### Security Configuration
- **Data Classification**: Restricted
- **Rate Limiting**: 5 requests per 5 minutes (ultra-strict)
- **Request Signing**: Required
- **Fraud Detection**: Enabled with risk blocking (>50 risk score)
- **Request Size Limit**: 1KB maximum

#### Required Headers
```http
Authorization: Bearer <jwt-token>
X-API-Key: <api-key>
X-CSRF-Token: <csrf-token>
Content-Type: application/json
```

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
- **durationValue** (required): Numeric value for expiration duration (1-365 days, 1-12 months, 1-5 years)
- **durationType** (required): Duration unit - must be one of: `days`, `months`, `years`

#### Success Response (200)
```json
{
  "success": true,
  "message": "API key generated successfully",
  "data": {
    "apiKey": "sk_prod_1234567890abcdef1234567890abcdef",
    "apiKeyId": "674a1b2c3d4e5f6789012345",
    "label": "Production API Key",
    "lastSix": "abcdef",
    "expiresAt": "2024-07-15T10:30:00.000Z",
    "createdAt": "2024-01-15T10:30:00.000Z"
  },
  "auditId": "audit_674a1b2c3d4e5f6789012349",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "securityContext": {
    "sessionId": "session_674a1b2c3d4e5f6789012350",
    "riskScore": 25,
    "encryptionLevel": "AES-256"
  }
}
```

#### Error Responses
- **400**: Missing required fields, invalid duration type, or invalid duration value
- **401**: Unauthorized (missing or invalid JWT token/API key)
- **403**: Forbidden (insufficient permissions, high risk score >50, or blocked by fraud detection)
- **404**: User not found
- **413**: Request too large (>1KB)
- **429**: Too Many Requests (rate limit exceeded)
- **500**: Internal server error

#### Enhanced Validation
- **Duration Limits**: 
  - Days: 1-365
  - Months: 1-12
  - Years: 1-5
- **Risk Assessment**: Requests with risk score >50 are automatically blocked
- **Fraud Detection**: Real-time monitoring for suspicious patterns

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

#### Security Configuration
- **Data Classification**: Restricted
- **Rate Limiting**: 20 requests/minute
- **Fraud Detection**: Enabled
- **Session Timeout**: 15 minutes

#### Required Headers
```http
Authorization: Bearer <jwt-token>
X-API-Key: <api-key>
```

#### Success Response (200)
```json
{
  "success": true,
  "message": "API keys retrieved successfully",
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
  ],
  "auditId": "audit_674a1b2c3d4e5f6789012349",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "securityContext": {
    "sessionId": "session_674a1b2c3d4e5f6789012350",
    "riskScore": 20,
    "encryptionLevel": "AES-256"
  }
}
```

#### Error Responses
- **401**: Unauthorized (missing or invalid JWT token/API key)
- **403**: Forbidden (insufficient permissions)
- **429**: Too Many Requests (rate limit exceeded)
- **500**: Internal server error

#### Use Cases
- View personal API keys for administrators
- Check expiration dates of own keys
- Monitor personal key usage
- Manage individual key inventory

---

### 4. Revoke API Key
**DELETE** `/api/api-keys/{apiKeyId}`

Revoke a specific API key by its ID. System administrators can revoke any API key.

#### Security Configuration
- **Data Classification**: Restricted
- **Rate Limiting**: 10 requests/minute
- **Fraud Detection**: Enabled
- **Session Timeout**: 15 minutes

#### Required Headers
```http
Authorization: Bearer <jwt-token>
X-API-Key: <api-key>
X-CSRF-Token: <csrf-token>
```

#### URL Parameters
- **apiKeyId** (required): The unique identifier of the API key to revoke

#### Success Response (200)
```json
{
  "success": true,
  "message": "API key revoked successfully",
  "data": {
    "apiKeyId": "674a1b2c3d4e5f6789012345",
    "revokedAt": "2024-01-15T10:30:00.000Z"
  },
  "auditId": "audit_674a1b2c3d4e5f6789012349",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "securityContext": {
    "sessionId": "session_674a1b2c3d4e5f6789012350",
    "riskScore": 30,
    "encryptionLevel": "AES-256"
  }
}
```

#### Error Responses
- **400**: Invalid API key ID provided
- **401**: Unauthorized (missing or invalid JWT token/API key)
- **403**: Forbidden (insufficient permissions)
- **404**: API key not found or already revoked
- **429**: Too Many Requests (rate limit exceeded)
- **500**: Internal server error

#### Enhanced Validation
- **Parameter Validation**: API key ID format validation
- **Comprehensive Logging**: Detailed audit logs for revocation attempts
- **Immediate Effect**: Revocation takes effect immediately

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

## 🛡️ Security Considerations

### Enterprise Security Features
- **Multi-Factor Authentication**: Ready for MFA integration
- **Request Signing**: Cryptographic request signature verification
- **Geographic Restrictions**: IP-based geo-blocking capabilities
- **Session Management**: Configurable session timeouts
- **PCI Compliance**: Ready for payment card industry compliance

### Fraud Detection
- **Real-time Risk Scoring**: Dynamic risk assessment for each request
- **Behavioral Analysis**: Pattern recognition for suspicious activity
- **Automatic Blocking**: High-risk requests (>50-80 score) automatically blocked
- **Fraud Flags**: Detailed fraud indicators for security monitoring

### Access Control
- **Role-Based Access**: All endpoints require `sys_admin` role
- **Multi-Header Authentication**: JWT + API Key + CSRF token validation
- **HTTPS Enforcement**: Mandatory secure connections
- **Session Timeout**: 15-minute timeout for enhanced security

### API Key Security
- **Secure Generation**: Cryptographically secure random key generation
- **SHA-256 Hashing**: Keys are hashed before database storage
- **Limited Exposure**: Actual key values never returned in list operations
- **One-Time Display**: Generated keys shown only once during creation

### Data Protection
```javascript
// Enhanced key hashing with audit logging
const encoder = new TextEncoder();
const data = encoder.encode(apiKey);
const hashBuffer = await crypto.subtle.digest('SHA-256', data);
const hashedKey = Array.from(new Uint8Array(hashBuffer))
  .map(b => b.toString(16).padStart(2, '0')).join('');

// Comprehensive logging with audit ID
console.log(JSON.stringify({
  level: 'INFO',
  message: 'API key generated and hashed',
  auditId: securityContext.auditId,
  userId: securityContext.user?.userId,
  timestamp: new Date().toISOString()
}));
```

### Expiration Management
- **Configurable Expiration**: Support for days, months, and years
- **Automatic Cleanup**: Expired keys can be automatically disabled
- **Renewal Process**: New keys can be generated before expiration

---

## 📊 Enhanced Error Handling

### Standardized Error Response Format
```json
{
  "error": {
    "message": "Detailed error description",
    "code": "SPECIFIC_ERROR_CODE",
    "requestId": "audit_674a1b2c3d4e5f6789012349",
    "timestamp": "2024-01-15T10:30:00.000Z"
  },
  "securityContext": {
    "riskScore": 85,
    "fraudFlags": ["SUSPICIOUS_IP", "HIGH_VELOCITY", "UNUSUAL_PATTERN"]
  }
}
```

### Enhanced HTTP Status Codes
- **200**: Success
- **400**: Bad Request (MISSING_REQUIRED_FIELDS, INVALID_DURATION_TYPE, INVALID_DURATION_VALUE, etc.)
- **401**: Unauthorized (INVALID_JWT, EXPIRED_TOKEN, MISSING_API_KEY)
- **403**: Forbidden (INSUFFICIENT_PERMISSIONS, HIGH_RISK_BLOCKED, FRAUD_DETECTED)
- **404**: Not Found (API_KEY_NOT_FOUND, USER_NOT_FOUND)
- **413**: Request Too Large (PAYLOAD_TOO_LARGE)
- **429**: Too Many Requests (RATE_LIMIT_EXCEEDED)
- **500**: Internal Server Error

### Security-Specific Error Codes
- **HIGH_RISK_BLOCKED**: Request blocked due to high risk score
- **FRAUD_DETECTED**: Suspicious activity detected
- **RATE_LIMIT_EXCEEDED**: Too many requests in time window
- **INVALID_API_KEY_ID**: Malformed API key identifier
- **SESSION_EXPIRED**: Security session has expired

---

## 🔄 Enhanced API Key Lifecycle

### 1. Generation Process with Security
```mermaid
graph TD
    A[Admin Request] --> B[Validate Security Headers]
    B --> C[Risk Assessment]
    C --> D{Risk Score > 50?}
    D -->|Yes| E[Block Request]
    D -->|No| F[Validate Admin Role]
    F --> G[Input Validation]
    G --> H[Generate Secure Key]
    H --> I[Hash Key for Storage]
    I --> J[Calculate Expiration]
    J --> K[Save to Database]
    K --> L[Audit Logging]
    L --> M[Return Key to Admin]
```

### 2. Enhanced Usage Validation
```mermaid
graph TD
    A[API Request] --> B[Rate Limit Check]
    B --> C[Security Headers Validation]
    C --> D[Hash Incoming Key]
    D --> E[Database Lookup]
    E --> F{Match Found?}
    F -->|Yes| G[Check Expiration]
    F -->|No| H[Log Failed Attempt]
    G --> I{Still Valid?}
    I -->|Yes| J[Fraud Detection]
    I -->|No| K[Return 401 Expired]
    J --> L{Risk Assessment}
    L -->|Low Risk| M[Allow Access]
    L -->|High Risk| N[Block & Log]
```

---

## 🔧 Integration Examples

### Generate API Key with Full Security (cURL)
```bash
curl -X POST "https://api.skytrack.com/api/api-keys/generate" \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN" \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "X-CSRF-Token: YOUR_CSRF_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "label": "Production Service Key",
    "durationValue": 12,
    "durationType": "months"
  }'
```

### List All API Keys with Security Headers (cURL)
```bash
curl -X GET "https://api.skytrack.com/api/api-keys" \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN" \
  -H "X-API-Key: YOUR_API_KEY"
```

### Revoke API Key with Security (cURL)
```bash
curl -X DELETE "https://api.skytrack.com/api/api-keys/674a1b2c3d4e5f6789012345" \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN" \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "X-CSRF-Token: YOUR_CSRF_TOKEN"
```

---

## 📈 Monitoring and Audit

### Audit Logging Features
- **Unique Audit IDs**: Every request gets a unique identifier
- **Risk Scoring**: Real-time risk assessment logging
- **Security Events**: Fraud detection and blocking events
- **Performance Metrics**: Request processing time tracking
- **Geographic Tracking**: IP location and geo-blocking events

### Structured Logging Format
```json
{
  "level": "INFO",
  "message": "API key generation request initiated",
  "auditId": "audit_674a1b2c3d4e5f6789012349",
  "userId": "674a1b2c3d4e5f6789012346",
  "riskScore": 25,
  "endpoint": "/api/api-keys/generate",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "geoLocation": {
    "country": "US",
    "region": "CA",
    "city": "San Francisco"
  }
}
```

### Security Event Monitoring
- **Failed Authentication**: Invalid tokens or API keys
- **Rate Limiting**: Requests exceeding limits
- **Fraud Detection**: Suspicious activity patterns
- **High Risk Blocking**: Requests blocked due to risk scores
- **Geographic Violations**: Requests from blocked regions

---

## 🎯 Best Practices

### For System Administrators
- **Security Headers**: Always include all required security headers
- **Rate Limiting**: Monitor rate limits and adjust as needed
- **Risk Monitoring**: Regular review of risk scores and fraud flags
- **Audit Reviews**: Regular review of audit logs for security events
- **Key Rotation**: Implement regular API key rotation policies

### For API Integration
- **Error Handling**: Implement comprehensive error handling for all error codes
- **Retry Logic**: Implement exponential backoff for rate-limited requests
- **Security Context**: Monitor and respond to security context information
- **Audit Tracking**: Use audit IDs for request tracing and debugging

### Security Guidelines
- **Never Log Plain Keys**: Use structured logging with automatic sanitization
- **Monitor Risk Scores**: Alert on high risk scores or fraud flags
- **Geographic Restrictions**: Configure appropriate geo-blocking rules
- **Session Management**: Implement proper session timeout handling
- **Comprehensive Monitoring**: Set up monitoring for all security events

This enhanced API Keys management system provides enterprise-grade security with comprehensive fraud detection, audit logging, and risk management for the SkyTrack platform. 
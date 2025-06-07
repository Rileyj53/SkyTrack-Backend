# Debug API Documentation

## Overview
The Debug API provides testing and debugging utilities for developers and system administrators. These endpoints are designed for development, testing, and troubleshooting purposes.

**Base URL**: `/api/debug`

**Total Endpoints**: 18 debug endpoints organized into categories:
- **Basic Testing** (4): General API, API key validation, general test, API key headers
- **Security & Auth** (6): MFA debug, JWT analysis, protected endpoints, CSRF, security headers  
- **System Health** (4): Health check, database testing, performance benchmarking, environment config
- **Services** (3): Email testing, API keys debug, API keys information
- **Development** (1): Middleware testing

## Authentication Requirements
- **API Key**: Required for all endpoints via `X-API-Key` header
- **JWT Token**: Required for authenticated endpoints via `Authorization: Bearer <token>` header

---

## Debug Endpoints

### 1. General API Test
**GET** `/api/debug/test`

Test basic API functionality and connectivity.

#### Headers
- `X-API-Key: <api_key>`

#### Success Response (200)
```json
{
  "status": "success",
  "message": "API is working correctly",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "environment": "development"
}
```

#### Error Responses
- **403**: Missing or invalid API key
- **500**: Internal server error

#### Use Cases
- Health checks for API monitoring
- Development environment validation
- Basic connectivity testing
- Environment verification

---

### 2. API Key Validation Test
**GET** `/api/debug/test-api-key`

Test API key validation and user authentication flow.

#### Headers
- `Authorization: Bearer <token>`
- `X-API-Key: <api_key>`

#### Success Response (200)
```json
{
  "message": "API key is valid",
  "userId": "ObjectId",
  "email": "user@example.com",
  "userRole": "student",
  "isActive": true,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

#### Error Responses
- **401**: Authentication required (missing or invalid JWT token)
- **403**: Missing or invalid API key
- **404**: User not found
- **500**: Error testing API key

#### Use Cases
- Validate JWT token and API key combination
- Test authentication middleware functionality
- Debug user authentication issues
- Verify user account status and permissions

---

### 3. MFA Debug Information
**GET** `/api/debug/mfa`

Get detailed MFA configuration and status for debugging.

#### Headers
- `Authorization: Bearer <token>`
- `X-API-Key: <api_key>`

#### Success Response (200)
```json
{
  "mfaEnabled": true,
  "mfaVerified": true,
  "mfaSecret": "JBSWY3DPEHPK3PXP",
  "mfaBackupCodes": [
    {
      "code": "123456789",
      "used": false
    },
    {
      "code": "987654321",
      "used": true
    }
  ],
  "userId": "ObjectId",
  "email": "user@example.com",
  "backupCodesCount": 10,
  "unusedBackupCodes": 9,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

#### Error Responses
- **401**: Authentication required
- **403**: Missing or invalid API key
- **404**: User not found
- **500**: Error getting MFA debug info

#### Use Cases
- Debug MFA setup issues
- Verify MFA secret and backup codes
- Check backup code usage status
- Troubleshoot MFA verification problems

#### Security Note
⚠️ **WARNING**: This endpoint exposes sensitive MFA secrets and should only be used in development or controlled debugging scenarios. Never use in production without proper access controls.

---

### 4. API Keys Debug Information
**GET** `/api/debug/api-keys`

Get information about all API keys in the system (existing endpoint).

#### Success Response (200)
```json
{
  "status": "success",
  "data": [
    {
      "_id": "ObjectId",
      "user": "ObjectId",
      "label": "Development Key",
      "key": "sk_test_abc...",
      "lastSix": "...xyz123",
      "isActive": true,
      "createdAt": "2024-01-15T10:30:00.000Z",
      "expiresAt": "2024-12-31T23:59:59.999Z"
    }
  ]
}
```

#### Error Responses
- **500**: Internal server error

#### Use Cases
- View all API keys in the system
- Debug API key issues
- Monitor API key usage and status
- Administrative oversight of access keys

---

### 5. Middleware Debug Test
**GET** `/api/debug/middleware`

Test middleware functionality and error handling.

#### Headers
- `X-API-Key: <api_key>`

#### Query Parameters
- `error` (optional): Add to trigger test error

#### Success Response (200)
```json
{
  "message": "Debug middleware endpoint",
  "headers": [
    ["host", "localhost:3000"],
    ["x-api-key", "api_key_here"]
  ],
  "requestUrl": "http://localhost:3000/api/debug/middleware",
  "method": "GET",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "searchParams": {}
}
```

#### Error Response (400) - When ?error query param is present
```json
{
  "error": "This is a test error for middleware debugging",
  "details": {
    "param": "error"
  }
}
```

#### Use Cases
- Test middleware error handling
- Debug request processing flow
- Validate API handler functionality
- Test custom error responses

---

### 6. Health Check
**GET** `/api/debug/health`

Comprehensive system health check including database, memory, and performance metrics.

#### Success Response (200)
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 12345.67,
  "environment": "development",
  "database": {
    "status": "ok",
    "connectionState": 1,
    "responseTime": 15
  },
  "memory": {
    "used": 45,
    "total": 128,
    "percentage": 35
  },
  "system": {
    "platform": "darwin",
    "nodeVersion": "v18.17.0",
    "cpus": 8
  },
  "api": {
    "responseTime": 25,
    "status": "ok"
  }
}
```

#### Error Response (500) - System issues detected
```json
{
  "status": "error",
  "database": {
    "status": "error",
    "message": "Connection timeout"
  },
  "api": {
    "status": "error"
  }
}
```

#### Use Cases
- Monitor system health and performance
- Check database connectivity
- Monitor memory usage
- API uptime monitoring
- Performance benchmarking

---

### 7. Database Testing
**GET** `/api/debug/database`
**POST** `/api/debug/database`

Comprehensive database testing including collection access, CRUD operations, and performance metrics.

#### Headers
- `Authorization: Bearer <token>` (sys_admin role required)
- `X-API-Key: <api_key>`
- `Content-Type: application/json` (POST only)

#### Request Body (POST only)
```json
{
  "operation": "performance_test",
  "collection": "users",
  "iterations": 100
}
```

#### Success Response (200) - GET Request
```json
{
  "status": "success",
  "message": "Database debug information",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "database": {
    "name": "skytrack",
    "collections": [
      {
        "name": "users",
        "count": 150,
        "size": "2.5MB",
        "avgDocumentSize": 1024,
        "indexes": ["_id", "email", "apiKey.key"]
      },
      {
        "name": "apikeys",  
        "count": 45,
        "size": "156KB",
        "avgDocumentSize": 512,
        "indexes": ["_id", "user", "key"]
      }
    ],
    "stats": {
      "totalCollections": 5,
      "totalDocuments": 500,
      "totalSize": "15.2MB",
      "avgQueryTime": 12.5
    }
  },
  "performance": {
    "insertTest": {
      "duration": 145,
      "status": "success",
      "documentsInserted": 10
    },
    "queryTest": {
      "duration": 23,
      "status": "success",
      "documentsFound": 150
    }
  }
}
```

#### Success Response (200) - POST Request
```json
{
  "status": "success",
  "message": "Database operation completed",
  "operation": "performance_test",
  "collection": "users",
  "results": {
    "duration": 2500,
    "iterations": 100,
    "avgResponseTime": 25,
    "successRate": 100,
    "errors": 0
  },
  "recommendations": [
    "Consider adding compound index on email + role",
    "Query performance is within acceptable range"
  ]
}
```

#### Error Responses
- **401**: Authentication required
- **403**: Forbidden (sys_admin role required)
- **500**: Database operation failed

#### Use Cases
- Database health monitoring
- Collection statistics analysis
- Performance benchmarking
- Index optimization recommendations
- CRUD operation testing

---

### 8. Email Service Testing
**GET** `/api/debug/email`
**POST** `/api/debug/email`

Test email service configuration and functionality.

#### Headers
- `Authorization: Bearer <token>` (sys_admin role required)
- `X-API-Key: <api_key>`
- `Content-Type: application/json` (POST only)

#### Request Body (POST only)
```json
{
  "to": "test@example.com",
  "subject": "Email Service Test",
  "template": "test",
  "data": {
    "userName": "Test User",
    "testMessage": "This is a test email"
  }
}
```

#### Success Response (200) - GET Request
```json
{
  "status": "success",
  "message": "Email service configuration",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "smtp": {
    "host": "smtp.gmail.com",
    "port": 587,
    "secure": false,
    "configured": true,
    "authMethod": "OAuth2"
  },
  "templates": {
    "available": ["welcome", "reset_password", "mfa_setup", "test"],
    "total": 4
  },
  "stats": {
    "emailsSentToday": 25,
    "emailsFailedToday": 1,
    "lastEmailSent": "2024-01-15T09:45:00.000Z",
    "successRate": 96
  }
}
```

#### Success Response (200) - POST Request
```json
{
  "status": "success",
  "message": "Test email sent successfully",
  "emailId": "email_12345",
  "recipient": "test@example.com",
  "subject": "Email Service Test",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "delivery": {
    "status": "sent",
    "duration": 1250,
    "messageId": "<message-id@domain.com>"
  }
}
```

#### Error Responses
- **401**: Authentication required
- **403**: Forbidden (sys_admin role required)
- **400**: Invalid email configuration or request
- **500**: Email service error

#### Use Cases
- Email service health monitoring
- SMTP configuration validation
- Template availability checking
- Email delivery testing
- Service statistics monitoring

---

### 9. JWT Token Analysis
**GET** `/api/debug/jwt`
**POST** `/api/debug/jwt`

Analyze and test JWT token functionality.

#### Headers
- `Authorization: Bearer <token>` (sys_admin role required)
- `X-API-Key: <api_key>`
- `Content-Type: application/json` (POST only)

#### Request Body (POST only)
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "operation": "validate"
}
```

#### Success Response (200) - GET Request
```json
{
  "status": "success",
  "message": "JWT token analysis",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "sampleToken": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "header": {
      "alg": "HS256",
      "typ": "JWT"
    },
    "payload": {
      "userId": "sample_user_id",
      "email": "sample@example.com",
      "role": "student",
      "iat": 1642248000,
      "exp": 1642334400
    },
    "isValid": true,
    "expiresIn": "24 hours"
  },
  "tokenConfig": {
    "algorithm": "HS256",
    "expirationTime": "24h",
    "issuer": "SkyTrack API",
    "secretConfigured": true
  }
}
```

#### Success Response (200) - POST Request
```json
{
  "status": "success",
  "message": "JWT token validation completed",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "analysis": {
    "isValid": true,
    "isExpired": false,
    "algorithm": "HS256",
    "issuer": "SkyTrack API"
  },
  "header": {
    "alg": "HS256",
    "typ": "JWT"
  },
  "payload": {
    "userId": "ObjectId",
    "email": "user@example.com",
    "role": "student",
    "iat": 1642248000,
    "exp": 1642334400,
    "remainingTime": "23 hours 45 minutes"
  },
  "user": {
    "exists": true,
    "isActive": true,
    "email": "user@example.com",
    "role": "student",
    "lastLogin": "2024-01-15T08:30:00.000Z"
  }
}
```

#### Error Responses
- **401**: Authentication required
- **403**: Forbidden (sys_admin role required)
- **400**: Invalid token format
- **500**: Token analysis failed

#### Use Cases
- JWT token validation and debugging
- Token expiration monitoring
- Signature verification testing
- User lookup from token claims
- Authentication troubleshooting

---

### 10. Environment Configuration
**GET** `/api/debug/environment`

Get environment configuration and system information (sys_admin only).

#### Headers
- `Authorization: Bearer <token>` (sys_admin role required)
- `X-API-Key: <api_key>`

#### Success Response (200)
```json
{
  "status": "success",
  "message": "Environment configuration",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "environment": {
    "NODE_ENV": "development",
    "API_VERSION": "1.0.0",
    "PORT": "3000",
    "DATABASE_NAME": "skytrack",
    "FRONTEND_URL": "http://localhost:3001"
  },
  "system": {
    "platform": "darwin",
    "arch": "x64",
    "nodeVersion": "v18.17.0",
    "npmVersion": "9.6.7",
    "uptime": 12345.67,
    "memory": {
      "used": "45MB",
      "total": "128MB",
      "percentage": 35
    }
  },
  "services": {
    "database": {
      "connected": true,
      "host": "localhost:27017",
      "name": "skytrack"
    },
    "email": {
      "configured": true,
      "provider": "Gmail SMTP"
    },
    "jwt": {
      "configured": true,
      "algorithm": "HS256"
    }
  },
  "security": {
    "httpsEnabled": false,
    "corsEnabled": true,
    "csrfProtection": true,
    "rateLimiting": true
  },
  "recommendations": [
    "Enable HTTPS in production",
    "Configure proper CORS origins for production",
    "Set up proper logging and monitoring"
  ]
}
```

#### Error Responses
- **401**: Authentication required
- **403**: Forbidden (sys_admin role required)
- **500**: Error retrieving environment information

#### Use Cases
- System configuration auditing
- Environment variable verification
- Service status monitoring
- Security configuration review
- Development environment setup validation

#### Security Note
⚠️ **WARNING**: This endpoint is restricted to system administrators only and should never be accessible in production without proper security controls.

---

### 11. Performance Benchmarking
**GET** `/api/debug/performance`
**POST** `/api/debug/performance`

Performance testing and benchmarking utilities.

#### Headers
- `Authorization: Bearer <token>` (sys_admin role required)
- `X-API-Key: <api_key>`
- `Content-Type: application/json` (POST only)

#### Request Body (POST only)
```json
{
  "testType": "stress_test",
  "iterations": 1000,
  "concurrent": 10,
  "endpoint": "/api/auth/user"
}
```

#### Success Response (200) - GET Request
```json
{
  "status": "success",
  "message": "Performance benchmark test",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "singleTest": {
    "apiCall": {
      "endpoint": "/api/debug/health",
      "method": "GET",
      "duration": 25,
      "status": "success"
    },
    "database": {
      "operation": "findOne",
      "collection": "users",
      "duration": 12,
      "status": "success"
    },
    "memory": {
      "before": "45MB",
      "after": "45MB",
      "delta": "0MB"
    }
  },
  "systemMetrics": {
    "cpuUsage": 15.5,
    "memoryUsage": 35.2,
    "activeConnections": 8,
    "responseTime": 25
  }
}
```

#### Success Response (200) - POST Request
```json
{
  "status": "success",
  "message": "Stress test completed",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "testConfig": {
    "testType": "stress_test",
    "iterations": 1000,
    "concurrent": 10,
    "endpoint": "/api/auth/user"
  },
  "results": {
    "totalDuration": 45000,
    "averageResponseTime": 45,
    "minResponseTime": 12,
    "maxResponseTime": 125,
    "successfulRequests": 985,
    "failedRequests": 15,
    "successRate": 98.5,
    "requestsPerSecond": 22.2
  },
  "performance": {
    "excellent": {
      "threshold": "<50ms",
      "count": 800,
      "percentage": 80
    },
    "good": {
      "threshold": "50-100ms", 
      "count": 185,
      "percentage": 18.5
    },
    "poor": {
      "threshold": ">100ms",
      "count": 15,
      "percentage": 1.5
    }
  },
  "recommendations": [
    "API performance is within acceptable range",
    "Consider caching for frequently accessed endpoints",
    "Monitor database query optimization"
  ]
}
```

#### Error Responses
- **401**: Authentication required
- **403**: Forbidden (sys_admin role required)
- **400**: Invalid test configuration
- **500**: Performance test failed

#### Use Cases
- API performance benchmarking
- Stress testing under load
- Response time monitoring
- System capacity planning
- Performance regression testing

---

### 12. Protected Endpoint Debug
**GET** `/api/debug/protected`
**POST** `/api/debug/protected`

Test protected endpoint functionality with authentication.

#### Headers
- `Authorization: Bearer <token>`
- `X-API-Key: <api_key>`
- `Content-Type: application/json` (POST only)

#### Request Body (POST only)
```json
{
  "testData": "debug_value",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

#### Success Response (200)
```json
{
  "message": "Protected data retrieved successfully",
  "userId": "ObjectId",
  "email": "user@example.com",
  "role": "student",
  "isActive": true,
  "timestamp": "2024-01-15T10:30:00.000Z",
  "debugInfo": {
    "requestHeaders": {
      "authorization": "Bearer token...",
      "x-api-key": "api_key..."
    },
    "authMethod": "JWT Token + API Key"
  }
}
```

#### Use Cases
- Test authentication flow
- Debug JWT token validation
- Test API key authentication
- Validate protected route access

---

### 13. System Admin Protected Test
**GET** `/api/debug/protected/test`

Test system administrator role-based access control.

#### Headers
- `Authorization: Bearer <token>`
- `X-API-Key: <api_key>`

#### Success Response (200) - sys_admin role only
```json
{
  "message": "System admin protected endpoint accessed successfully",
  "userId": "ObjectId",
  "userRole": "sys_admin",
  "apiKeyLabel": "Admin Key",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "debugInfo": {
    "tokenUserId": "ObjectId",
    "tokenRole": "sys_admin",
    "apiKeyUsed": true,
    "requestMethod": "GET"
  }
}
```

#### Error Response (403) - Non-admin users
```json
{
  "error": "Forbidden: Only system administrators can access this endpoint"
}
```

#### Use Cases
- Test role-based access control
- Validate system admin permissions
- Debug authorization logic
- Test JWT role claims

---

### 14. API Key Header Test
**GET** `/api/debug/protected/test-with-key`

Test different API key header formats.

#### Headers (choose one)
- `Authorization: Bearer <api_key>`
- `x-api-key: <api_key>`

#### Success Response (200)
```json
{
  "message": "API key received and validated",
  "apiKeyPrefix": "sk_t...",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "debugInfo": {
    "keySource": "Authorization header",
    "keyLength": 32,
    "requestHeaders": ["authorization", "user-agent", "accept"]
  }
}
```

#### Error Response (401) - Missing API key
```json
{
  "error": "API key is required. Use either Authorization: Bearer <token> or x-api-key header.",
  "debugInfo": {
    "availableHeaders": ["user-agent", "accept"],
    "hasAuthHeader": false,
    "hasXApiKey": false
  }
}
```

#### Use Cases
- Test different API key formats
- Debug header parsing
- Validate API key detection
- Test authentication flexibility

---

### 15. Security Headers Test
**GET** `/api/debug/security-headers`

Test and verify security headers implementation.

#### Success Response (200)
```json
{
  "status": "success",
  "message": "Security headers debug endpoint",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "environment": "development",
  "headersApplied": [
    "Content-Security-Policy",
    "X-Content-Type-Options",
    "X-Frame-Options",
    "X-XSS-Protection",
    "Referrer-Policy",
    "Permissions-Policy",
    "Feature-Policy",
    "Strict-Transport-Security",
    "Cache-Control",
    "Cross-Origin-Embedder-Policy",
    "Cross-Origin-Opener-Policy",
    "Cross-Origin-Resource-Policy",
    "Origin-Agent-Cluster",
    "Expect-CT"
  ]
}
```

#### Security Headers Applied
- **Content-Security-Policy**: Prevents XSS and injection attacks
- **X-Content-Type-Options**: Prevents MIME type sniffing
- **X-Frame-Options**: Prevents clickjacking
- **X-XSS-Protection**: Basic XSS protection
- **Referrer-Policy**: Controls referrer information
- **Permissions-Policy**: Restricts browser features
- **Strict-Transport-Security**: Enforces HTTPS
- **Cross-Origin policies**: Prevent cross-origin attacks

#### Use Cases
- Verify security header implementation
- Test browser security features
- Validate CSP policies
- Security compliance checking

---

### 16. General Test Endpoint
**GET** `/api/debug/test-general`
**POST** `/api/debug/test-general`

General purpose testing endpoint for basic functionality.

#### Request Body (POST only)
```json
{
  "testData": "sample_value",
  "nested": {
    "field": "value"
  }
}
```

#### Success Response (200)
```json
{
  "message": "General test API endpoint",
  "requestId": "req_12345",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "method": "GET",
  "url": "http://localhost:3000/api/debug/test-general",
  "headers": {
    "user-agent": "Mozilla/5.0...",
    "accept": "application/json"
  },
  "debugInfo": {
    "userAgent": "Mozilla/5.0...",
    "origin": "http://localhost:3000",
    "referer": null,
    "acceptLanguage": "en-US,en;q=0.9"
  }
}
```

#### Use Cases
- Basic API functionality testing
- Request/response debugging
- Header inspection
- Middleware testing

---

### 17. CSRF Protection Test
**GET** `/api/debug/test-csrf`
**POST** `/api/debug/test-csrf`

Test CSRF token validation and cookie handling.

#### Headers (POST only)
- `X-CSRF-Token: <csrf_token>`

#### Success Response (200)
```json
{
  "message": "CSRF protection debug endpoint",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "csrfToken": "token_abc...",
  "storedToken": "token_abc...",
  "debugInfo": {
    "hasCSRFHeader": true,
    "hasCSRFCookie": true,
    "tokensMatch": true,
    "headerKeys": ["x-csrf-token", "content-type"],
    "cookieKeys": ["csrf-token", "session"]
  }
}
```

#### Use Cases
- Test CSRF protection implementation
- Debug token validation
- Verify cookie handling
- Security testing

---

## Security Considerations

### Access Control
- Debug endpoints should be restricted in production environments
- Consider implementing additional authorization checks for sensitive debug information
- Monitor usage of debug endpoints for security purposes

### Data Exposure
- MFA debug endpoint exposes sensitive authentication secrets
- API keys endpoint shows partial key information for security
- User information is included in responses for debugging purposes

### Environment Restrictions
```javascript
// Example middleware to restrict debug endpoints in production
if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_DEBUG_ENDPOINTS) {
  return NextResponse.json(
    { error: 'Debug endpoints disabled in production' },
    { status: 403 }
  );
}
```

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
- **401**: Unauthorized (missing or invalid JWT token)
- **403**: Forbidden (missing or invalid API key)
- **404**: Not Found (user or resource not found)
- **500**: Internal Server Error

---

## Development Workflow

### Testing Authentication Flow
1. Call `/api/debug/test` to verify basic API connectivity
2. Call `/api/debug/test-api-key` to test full authentication
3. Use response data to verify user permissions and account status

### MFA Troubleshooting
1. Call `/api/debug/mfa` to get current MFA configuration
2. Verify `mfaEnabled` and `mfaVerified` status
3. Check backup codes count and usage
4. Use secret to manually generate test tokens

### API Key Management
1. Call `/api/debug/api-keys` to list all system API keys
2. Verify key status and expiration dates
3. Check for inactive or expired keys
4. Monitor key usage patterns

---

## Integration Points

### Monitoring Systems
- Health check endpoints for uptime monitoring
- Status verification for automated testing
- Error tracking and debugging support

### Development Tools
- Postman/Insomnia collection testing
- Automated test suite integration
- CI/CD pipeline health checks

### Administrative Tools
- System administration dashboards
- User account troubleshooting
- Security audit and compliance checking

---

## Best Practices

### Development Usage
- Use debug endpoints during development and testing phases
- Implement proper error handling for debug endpoint failures
- Log debug endpoint usage for security monitoring

### Production Considerations
- Disable or restrict debug endpoints in production
- Implement additional authentication for sensitive debug information
- Monitor and audit access to debug endpoints

### Security Guidelines
- Never expose MFA secrets in client-side applications
- Implement rate limiting on debug endpoints
- Use secure logging practices for debug information 
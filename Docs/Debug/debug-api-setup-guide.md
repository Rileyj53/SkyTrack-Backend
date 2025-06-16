# Debug API Setup Guide

## 📋 Overview

This guide will help you set up and use the Debug API endpoints for development, testing, and troubleshooting. The debug API provides comprehensive tools for validating system functionality, testing security features, and monitoring system health.

## 🚀 Quick Start

### 1. Import Postman Collection

1. **Import the Collection**:
   - Open Postman
   - Click "Import" → "Upload Files"
   - Select `debug.postman_collection.json`

2. **Configure Collection Variables**:
   - After importing, click on the collection
   - Go to the "Variables" tab
   ```json
   {
     "base_url": "http://localhost:3000",
     "api_key": "your-actual-api-key",
     "jwt_token": "your-jwt-token",
     "csrf_token": "your-csrf-token",
     "test_email": "your-test-email@example.com"
   }
   ```

### 2. Get Your API Credentials

#### Option A: Using the Main API
```bash
# 1. Register or login to get JWT token
curl -X POST "http://localhost:3000/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your-email@example.com",
    "password": "your-password"
  }'

# 2. Create an API key (requires JWT)
curl -X POST "http://localhost:3000/api/api-keys" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "label": "Debug Testing Key"
  }'
```

#### Option B: Using Environment Variables
If you have direct database access, you can create credentials directly:
```javascript
// In your database console
db.users.findOne({ email: "admin@example.com" })
db.apikeys.find({ user: ObjectId("your-user-id") })
```

## 🛠️ Testing Workflow

### Step 1: Basic Connectivity
Start with these endpoints to verify your setup:

1. **General API Test** (`GET /api/debug/test`)
   - Tests basic API connectivity
   - Only requires API key
   - Should return 200 status

2. **API Key Validation** (`GET /api/debug/test-api-key`)
   - Tests API key authentication
   - Validates user lookup
   - Returns user information

### Step 2: Security Testing
Test authentication and security features:

3. **Protected Endpoint** (`GET /api/debug/protected`)
   - Requires both API key and JWT token
   - Tests full authentication flow
   - Returns user data and security context

4. **System Admin Test** (`GET /api/debug/protected/test`)
   - Requires `sys_admin` role
   - Tests role-based access control
   - May return 403 for non-admin users

### Step 3: System Health
Monitor system health and performance:

5. **Health Check** (`GET /api/debug/health`)
   - Database connectivity
   - Memory usage
   - System metrics

6. **Database Testing** (`GET /api/debug/database`)
   - Collection statistics
   - Query performance
   - Index information

### Step 4: Advanced Features
Test specialized functionality:

7. **JWT Analysis** (`POST /api/debug/jwt`)
   - Token validation
   - Payload inspection
   - User lookup from token

8. **Email Testing** (`POST /api/debug/email`)
   - SMTP configuration
   - Send test emails
   - Service validation

## 🔐 Authentication Levels

### Level 1: API Key Only
- Basic connectivity tests
- Public information endpoints
- System health checks

**Headers Required**:
```
X-API-Key: your-api-key
```

### Level 2: API Key + JWT Token
- User-specific operations
- Protected data access
- Personal debug information

**Headers Required**:
```
X-API-Key: your-api-key
Authorization: Bearer your-jwt-token
```

### Level 3: System Administrator
- System-wide information
- All API keys listing
- Environment configuration
- Sensitive debug data

**Requirements**:
- Valid API key
- Valid JWT token
- User role: `sys_admin`

## 📊 Understanding Responses

### Success Response Structure
```json
{
  "success": true,
  "message": "Operation completed",
  "auditId": "audit_abc123",
  "data": {
    // Endpoint-specific data
  },
  "timestamp": "2024-01-15T10:30:00.000Z",
  "debugInfo": {
    "securityContext": {
      "riskScore": 15,
      "sessionId": "session_xyz789",
      "geoLocation": "US-CA",
      "fraudFlags": []
    }
  }
}
```

### Key Fields Explained

- **`auditId`**: Unique identifier for request tracking and logging
- **`riskScore`**: Fraud detection score (0-100, lower is better)
- **`sessionId`**: Session tracking identifier
- **`geoLocation`**: Geographic location code
- **`fraudFlags`**: Array of any fraud detection triggers

## 🚨 Common Issues & Solutions

### 1. 403 Forbidden - Invalid API Key
```json
{
  "error": "Invalid or missing API key",
  "auditId": "audit_123"
}
```

**Solution**: 
- Verify your API key is correct
- Check if the key is active and not expired
- Ensure you're using the `X-API-Key` header

### 2. 401 Unauthorized - Invalid JWT
```json
{
  "error": "Invalid or expired JWT token",
  "auditId": "audit_456"  
}
```

**Solution**:
- Check if your JWT token is expired
- Verify the token format (should start with `eyJ`)
- Ensure you're using `Authorization: Bearer <token>`

### 3. 403 Forbidden - Insufficient Role
```json
{
  "error": "Insufficient permissions",
  "auditId": "audit_789"
}
```

**Solution**:
- Check if your user has the required role
- Some endpoints require `sys_admin` role
- Verify role permissions in the user record

### 4. 429 Too Many Requests
```json
{
  "error": "Rate limit exceeded",
  "retryAfter": 60,
  "auditId": "audit_101"
}
```

**Solution**:
- Wait for the retry period
- Reduce request frequency
- Check rate limiting configuration

## 📈 Performance Testing

### Benchmarking Endpoints
Use these for performance testing:

1. **Performance Benchmark** (`GET /api/debug/performance`)
   - Single request performance
   - Memory usage analysis
   - CPU performance testing

2. **Stress Testing** (`POST /api/debug/performance`)
   ```json
   {
     "iterations": 10,
     "includeDatabase": true,
     "includeComputation": true
   }
   ```

### Monitoring Endpoints
For continuous monitoring:

1. **Health Check** (`GET /api/debug/health`)
   - Use for uptime monitoring
   - Database connectivity checks
   - System resource monitoring

2. **Database Status** (`GET /api/debug/database`)
   - Collection statistics
   - Performance metrics
   - Query optimization insights

## 🛡️ Security Best Practices

### Development Environment
- Use test API keys and tokens
- Avoid using production credentials
- Monitor debug endpoint usage

### Production Environment
- Disable debug endpoints (`ALLOW_DEBUG_ENDPOINTS=false`)
- Restrict network access to debug endpoints
- Monitor for unauthorized access attempts

### API Key Security
- Store API keys securely (environment variables)
- Rotate keys regularly
- Use different keys for different environments
- Monitor key usage patterns

## 📝 Logging & Debugging

### Request Logging
All debug endpoints automatically log:
- Request details with audit IDs
- Security context information
- Performance metrics
- Error details with stack traces

### Vercel Logging
In Vercel environments, logs are automatically captured:
```javascript
// Structured logging format
{
  "level": "INFO",
  "message": "Debug endpoint accessed",
  "auditId": "audit_123",
  "endpoint": "/api/debug/test",
  "riskScore": 15,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### Local Development
For local debugging:
1. Check browser developer tools
2. Monitor server console output
3. Use Postman console for request/response logging
4. Enable debug mode with `DEBUG=true`

## 🔧 Troubleshooting Checklist

Before reporting issues, verify:

- [ ] API key is valid and active
- [ ] JWT token is not expired
- [ ] Required headers are included
- [ ] Request body format is correct (for POST requests)
- [ ] User has required role permissions
- [ ] Rate limiting is not exceeded
- [ ] Network connectivity to the API server
- [ ] Environment variables are correctly configured
- [ ] Database is accessible and healthy

## 📚 Additional Resources

- **Full API Documentation**: `debug_api_documentation.md`
- **Postman Collection**: `debug.postman_collection.json`
- **Security Guidelines**: Main API documentation
- **Development Standards**: Backend development rules

## 💡 Tips for Effective Testing

1. **Start Simple**: Begin with basic endpoints before advanced features
2. **Use Collections**: Organize tests in Postman folders by functionality
3. **Monitor Responses**: Check audit IDs and security context
4. **Test Error Cases**: Intentionally trigger errors to test error handling
5. **Performance Baseline**: Establish performance baselines for monitoring
6. **Security Testing**: Verify access controls and rate limiting
7. **Documentation**: Keep track of test results and findings

## 🔄 Continuous Integration

For automated testing:
```bash
# Example CI test script
newman run debug.postman_collection.json \
  --reporters cli,json \
  --reporter-json-export results.json
```

This setup enables automated testing of debug endpoints in CI/CD pipelines. 
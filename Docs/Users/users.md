# Users API Documentation

## 🎯 Overview
The Users API provides comprehensive user management capabilities including retrieving user information and updating user profiles with enterprise-grade security and role-based access control.

**Base URL**: `/api/users`

## 🔐 Enterprise Security Features

All user endpoints implement enterprise-grade security with the following features:

### Security Middleware
- **Comprehensive Authentication**: JWT tokens, API keys, and CSRF protection
- **Fraud Detection**: Real-time risk scoring and suspicious activity monitoring  
- **Rate Limiting**: Sliding window rate limiting with configurable thresholds
- **Advanced Audit Logging**: Comprehensive audit trails with unique audit IDs
- **Role-Based Access Control**: Fine-grained permissions based on user roles
- **School-Scoped Access**: Users can only access data within their authorized schools

### Data Protection
- **Data Classification**: Endpoints classified as 'confidential' level
- **Access Control**: Users can only view/modify their own profiles unless they have admin privileges
- **Input Validation**: Comprehensive validation for all user data fields
- **Sensitive Data Protection**: Automatic sanitization of sensitive information

## 🔧 Authentication Requirements
- **JWT Token**: Required for all endpoints via `Authorization: Bearer <token>` header
- **API Key**: Required for all endpoints via `X-API-Key` header
- **CSRF Token**: Required for PUT operations via `X-CSRF-Token` header

---

## User Management Endpoints

# GET /api/users/{userId}

## 🎯 Overview
Retrieve detailed information about a specific user account with role-based access control and security validation.

## 🔐 Security
- **Requires Auth**: ✅ (JWT Bearer token)
- **Requires API Key**: ✅ (X-API-Key header)
- **Requires CSRF Token**: ❌ (Not required for GET operations)
- **Allowed Roles**: `['sys_admin', 'school_admin', 'instructor', 'student']`
- **Access Control**: Users can only view their own profile unless they are admin/instructor
- **School Access Required**: ✅ (for non-system admins)
- **Fraud Detection**: ✅ Enabled
- **Risk Scoring**: ✅ Enabled
- **Data Classification**: `confidential`
- **Rate Limiting**: 100 requests per minute

## 📥 Request

**Method**: `GET`  
**Path**: `/api/users/{userId}`

### Path Parameters
- `userId` (string, required): The unique identifier of the user (ObjectId format)

### Headers
- `Authorization: Bearer <token>` (required): JWT authentication token
- `X-API-Key: <key>` (required): Valid API key
- `Content-Type: application/json` (required)

## 📤 Response

### Success Response (200)
```json
{
  "success": true,
  "message": "User information retrieved successfully",
  "data": {
    "user": {
      "_id": "674a1b2c3d4e5f6789012345",
      "email": "user@example.com",
      "first_name": "John",
      "last_name": "Doe",
      "role": "student",
      "school_id": "674a1b2c3d4e5f6789012346",
      "isActive": true,
      "emailVerified": true,
      "mfaEnabled": false,
      "mfaVerified": false,
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z"
    }
  },
  "auditId": "audit_674a1b2c3d4e5f6789012349",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### Error Responses

#### 400 - Bad Request
```json
{
  "error": {
    "message": "Invalid user ID format",
    "code": "INVALID_USER_ID",
    "requestId": "audit_674a1b2c3d4e5f6789012349",
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

#### 401 - Unauthorized
```json
{
  "error": {
    "message": "Invalid or expired authentication token",
    "code": "AUTHENTICATION_FAILED",
    "requestId": "audit_674a1b2c3d4e5f6789012349",
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

#### 403 - Forbidden
```json
{
  "error": {
    "message": "Insufficient permissions to view this user",
    "code": "INSUFFICIENT_PERMISSIONS",
    "requestId": "audit_674a1b2c3d4e5f6789012349",
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

#### 404 - Not Found
```json
{
  "error": {
    "message": "User not found",
    "code": "USER_NOT_FOUND",
    "requestId": "audit_674a1b2c3d4e5f6789012349",
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

#### 429 - Too Many Requests
```json
{
  "error": {
    "message": "Rate limit exceeded",
    "code": "RATE_LIMIT_EXCEEDED",
    "requestId": "audit_674a1b2c3d4e5f6789012349",
    "timestamp": "2024-01-15T10:30:00.000Z",
    "retryAfter": 60
  }
}
```

## 🔍 Example Request

> **Note**: The SkyTrack Postman collection uses colon notation for path variables (e.g., `:userId`) while cURL examples show curly brace notation (e.g., `{userId}`) for clarity.

```bash
curl -X GET "https://api.skytrack.com/api/users/674a1b2c3d4e5f6789012345" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json"
```

## 🚨 Error Codes Reference
- `INVALID_USER_ID`: User ID format is invalid (not a valid ObjectId)
- `AUTHENTICATION_FAILED`: Invalid or expired JWT token
- `INSUFFICIENT_PERMISSIONS`: User lacks permission to view this user
- `USER_NOT_FOUND`: Specified user does not exist
- `RATE_LIMIT_EXCEEDED`: Too many requests

---

# PUT /api/users/{userId}

## 🎯 Overview
Update user information with comprehensive validation, role-based access control, and security checks.

## 🔐 Security
- **Requires Auth**: ✅ (JWT Bearer token)
- **Requires API Key**: ✅ (X-API-Key header)
- **Requires CSRF Token**: ✅ (X-CSRF-Token header)
- **Allowed Roles**: `['sys_admin', 'school_admin', 'instructor', 'student']`
- **Access Control**: Users can only update their own profile unless they are admin
- **School Access Required**: ✅ (for non-system admins)
- **Fraud Detection**: ✅ Enabled
- **Risk Scoring**: ✅ Enabled
- **Data Classification**: `confidential`
- **Rate Limiting**: 50 requests per minute

## 📥 Request

**Method**: `PUT`  
**Path**: `/api/users/{userId}`

### Path Parameters
- `userId` (string, required): The unique identifier of the user (ObjectId format)

### Headers
- `Authorization: Bearer <token>` (required): JWT authentication token
- `X-API-Key: <key>` (required): Valid API key
- `X-CSRF-Token: <token>` (required): CSRF protection token
- `Content-Type: application/json` (required)

### Body Schema
```json
{
  "email": "string (optional, valid email format, max 254 chars)",
  "first_name": "string (optional, 1-50 chars)",
  "last_name": "string (optional, 1-50 chars)",
  "role": "string (optional, valid role - requires sys_admin permission)",
  "school_id": "string (optional, ObjectId format)",
  "isActive": "boolean (optional)",
  "emailVerified": "boolean (optional)",
  "mfaEnabled": "boolean (optional)",
  "mfaVerified": "boolean (optional)"
}
```

### Valid Roles
- `sys_admin` - System Administrator
- `school_admin` - School Administrator  
- `instructor` - Flight Instructor
- `student` - Student

### Field Restrictions
- **Role Changes**: Only `sys_admin` can change user roles
- **Email Changes**: Must be unique across the system
- **School Access**: School admins can only update users within their school
- **Self-Update**: Users can always update their own profile (except role)

## 📤 Response

### Success Response (200)
```json
{
  "success": true,
  "message": "User updated successfully",
  "data": {
    "user": {
      "_id": "674a1b2c3d4e5f6789012345",
      "email": "updated@example.com",
      "first_name": "John",
      "last_name": "Smith",
      "role": "student",
      "school_id": "674a1b2c3d4e5f6789012346",
      "isActive": true,
      "emailVerified": true,
      "mfaEnabled": false,
      "mfaVerified": false,
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T12:45:00.000Z"
    }
  },
  "auditId": "audit_674a1b2c3d4e5f6789012349",
  "timestamp": "2024-01-15T12:45:00.000Z"
}
```

### Error Responses

#### 400 - Bad Request
```json
{
  "error": {
    "message": "Invalid user ID format",
    "code": "INVALID_USER_ID",
    "requestId": "audit_674a1b2c3d4e5f6789012349",
    "timestamp": "2024-01-15T12:45:00.000Z"
  }
}
```

#### 400 - Invalid Email Format
```json
{
  "error": {
    "message": "Invalid email format",
    "code": "INVALID_EMAIL_FORMAT",
    "requestId": "audit_674a1b2c3d4e5f6789012349",
    "timestamp": "2024-01-15T12:45:00.000Z"
  }
}
```

#### 400 - Invalid Role
```json
{
  "error": {
    "message": "Invalid role specified",
    "code": "INVALID_ROLE",
    "requestId": "audit_674a1b2c3d4e5f6789012349",
    "timestamp": "2024-01-15T12:45:00.000Z"
  }
}
```

#### 401 - Unauthorized
```json
{
  "error": {
    "message": "Invalid or expired authentication token",
    "code": "AUTHENTICATION_FAILED",
    "requestId": "audit_674a1b2c3d4e5f6789012349",
    "timestamp": "2024-01-15T12:45:00.000Z"
  }
}
```

#### 403 - Forbidden (Insufficient Permissions)
```json
{
  "error": {
    "message": "Insufficient permissions to update this user",
    "code": "INSUFFICIENT_PERMISSIONS",
    "requestId": "audit_674a1b2c3d4e5f6789012349",
    "timestamp": "2024-01-15T12:45:00.000Z"
  }
}
```

#### 403 - Forbidden (Role Change)
```json
{
  "error": {
    "message": "Only system administrators can change user roles",
    "code": "ROLE_CHANGE_FORBIDDEN",
    "requestId": "audit_674a1b2c3d4e5f6789012349",
    "timestamp": "2024-01-15T12:45:00.000Z"
  }
}
```

#### 404 - Not Found
```json
{
  "error": {
    "message": "User not found",
    "code": "USER_NOT_FOUND",
    "requestId": "audit_674a1b2c3d4e5f6789012349",
    "timestamp": "2024-01-15T12:45:00.000Z"
  }
}
```

#### 409 - Conflict
```json
{
  "error": {
    "message": "Email already in use",
    "code": "EMAIL_ALREADY_EXISTS",
    "requestId": "audit_674a1b2c3d4e5f6789012349",
    "timestamp": "2024-01-15T12:45:00.000Z"
  }
}
```

#### 429 - Too Many Requests
```json
{
  "error": {
    "message": "Rate limit exceeded",
    "code": "RATE_LIMIT_EXCEEDED",
    "requestId": "audit_674a1b2c3d4e5f6789012349",
    "timestamp": "2024-01-15T12:45:00.000Z",
    "retryAfter": 60
  }
}
```

#### 500 - Internal Server Error
```json
{
  "error": {
    "message": "Failed to update user",
    "code": "UPDATE_FAILED",
    "requestId": "audit_674a1b2c3d4e5f6789012349",
    "timestamp": "2024-01-15T12:45:00.000Z"
  }
}
```

## 🔍 Example Request

```bash
curl -X PUT "https://api.skytrack.com/api/users/674a1b2c3d4e5f6789012345" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "X-API-Key: your-api-key" \
  -H "X-CSRF-Token: your-csrf-token" \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "John",
    "last_name": "Smith",
    "email": "updated@example.com"
  }'
```

## 🚨 Error Codes Reference
- `INVALID_USER_ID`: User ID format is invalid (not a valid ObjectId)
- `INVALID_EMAIL_FORMAT`: Email format is invalid
- `INVALID_ROLE`: Specified role is not valid
- `INVALID_SCHOOL_ID`: School ID format is invalid
- `AUTHENTICATION_FAILED`: Invalid or expired JWT token
- `INSUFFICIENT_PERMISSIONS`: User lacks permission to update this user
- `ROLE_CHANGE_FORBIDDEN`: Only system administrators can change user roles
- `USER_NOT_FOUND`: Specified user does not exist
- `EMAIL_ALREADY_EXISTS`: Email is already in use by another user
- `UPDATE_FAILED`: Server error during user update
- `RATE_LIMIT_EXCEEDED`: Too many requests

---

## 🔐 Access Control Matrix

| User Role | Can View Own Profile | Can Update Own Profile | Can View Other Users | Can Update Other Users | Can Change Roles |
|-----------|---------------------|------------------------|---------------------|----------------------|------------------|
| `sys_admin` | ✅ | ✅ | ✅ All users | ✅ All users | ✅ All users |
| `school_admin` | ✅ | ✅ | ✅ Users in their school | ✅ Users in their school | ❌ |
| `instructor` | ✅ | ✅ | ✅ Users in their school | ❌ | ❌ |
| `student` | ✅ | ✅ | ❌ | ❌ | ❌ |

## 🔄 Security Features

### Fraud Detection
- Real-time risk scoring for all user operations
- Suspicious activity monitoring and blocking
- Geographic and velocity-based fraud detection
- Automatic blocking of high-risk operations

### Audit Logging
- Comprehensive audit trails for all user operations
- Unique audit IDs for request tracking
- Security event logging for unauthorized access attempts
- Performance metrics and processing time tracking

### Data Protection
- Automatic sanitization of sensitive data in responses
- Secure handling of personally identifiable information (PII)
- Encryption of sensitive data at rest and in transit
- Role-based field access restrictions

### Rate Limiting
- Sliding window rate limiting to prevent abuse
- Different limits for read vs. write operations
- Automatic throttling based on risk scores
- Configurable rate limits per user role

---

## 📋 Field Definitions

### User Object Fields
- `_id`: Unique user identifier (ObjectId)
- `email`: User's email address (unique, validated)
- `first_name`: User's first name (1-50 characters)
- `last_name`: User's last name (1-50 characters)
- `role`: User's role in the system (enum: sys_admin, school_admin, instructor, student)
- `school_id`: Associated school identifier (ObjectId, nullable)
- `isActive`: Account status (boolean)
- `emailVerified`: Email verification status (boolean)
- `mfaEnabled`: Multi-factor authentication enabled (boolean)
- `mfaVerified`: Multi-factor authentication verified (boolean)
- `createdAt`: Account creation timestamp (ISO date)
- `updatedAt`: Last update timestamp (ISO date)

### Security Context Fields
- `auditId`: Unique audit identifier for tracking
- `riskScore`: Computed risk score (0-100)
- `sessionId`: Session identifier
- `encryptionLevel`: Data encryption level applied
- `processingTime`: Request processing duration (ms)

---

## 🔧 Integration Points

### Authentication System
- JWT token validation and user context extraction
- Role-based access control enforcement
- Session management and token refresh

### School Management
- School-scoped data access validation
- School administrator permission checks
- Cross-school access prevention

### Audit System
- Comprehensive logging of all user operations
- Security event detection and alerting
- Performance monitoring and metrics

### Email Services
- Email validation and verification
- Notification services for account changes
- Security alerts for suspicious activities

---

## 📊 Use Cases & Scenarios

### Profile Management
1. **User Profile View**: Users can view their own profile information
2. **Profile Updates**: Users can update their own profile data
3. **Admin Management**: Administrators can manage user accounts within their scope

### Role Management
1. **Role Assignment**: System admins can assign roles to users
2. **Permission Validation**: System validates role-based permissions
3. **Role Restrictions**: Non-admin users cannot change roles

### School Administration
1. **School User Management**: School admins can manage users within their school
2. **Cross-School Prevention**: Users cannot access data from other schools
3. **Instructor Access**: Instructors can view but not modify other users in their school

### Security Operations
1. **Fraud Detection**: System monitors for suspicious user operations
2. **Access Control**: Fine-grained permission checking for all operations
3. **Audit Compliance**: Comprehensive logging for compliance requirements

---

## 🛡️ Security Best Practices

### For API Consumers
1. **Always use HTTPS** for all API requests
2. **Implement proper token management** with secure storage
3. **Validate CSRF tokens** for all state-changing operations
4. **Handle rate limiting** gracefully with exponential backoff
5. **Log security events** for monitoring and alerting

### For Developers
1. **Follow principle of least privilege** for user permissions
2. **Implement comprehensive input validation** for all user data
3. **Use secure error handling** without exposing sensitive information
4. **Monitor for suspicious patterns** in user operations
5. **Regularly audit user permissions** and access patterns

### For System Administrators
1. **Regularly review user roles** and permissions
2. **Monitor audit logs** for suspicious activities
3. **Implement proper backup** and recovery procedures
4. **Keep security configurations** up to date
5. **Test security controls** regularly

---

## 📈 Performance Considerations

### Optimization Strategies
- **Database indexing** on frequently queried fields (userId, email, school_id)
- **Caching strategies** for frequently accessed user data
- **Connection pooling** for database operations
- **Rate limiting** to prevent system overload

### Monitoring Metrics
- **Response times** for user operations
- **Success/failure rates** for user operations
- **Rate limiting** effectiveness
- **Security event** frequency and patterns

### Scalability Features
- **Horizontal scaling** support for high-traffic environments
- **Load balancing** across multiple instances
- **Database sharding** for large user bases
- **CDN integration** for global performance 
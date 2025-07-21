# PUT /api/auth/update-profile

## 🎯 Overview
Updates the authenticated user's profile information including name, email, phone, and emergency contact details. Password updates are handled separately through the password reset flow.

## 🔐 Security
- **Requires Auth**: ✅ (JWT Bearer token)
- **Requires API Key**: ✅ (X-API-Key header)
- **Requires CSRF Token**: ✅ (X-CSRF-Token header)
- **Allowed Roles**: `['sys_admin', 'school_admin', 'instructor', 'student']`
- **School Access Required**: ❌ (users can update their own profile)
- **Fraud Detection**: ✅ Enabled
- **Risk Scoring**: ✅ Enabled (threshold: 75)
- **Data Classification**: `confidential`
- **Rate Limiting**: 20 requests per minute

## 📥 Request

**Method**: `PUT`  
**Path**: `/api/auth/update-profile`

### Headers
- `Authorization: Bearer <token>` (required): JWT authentication token
- `X-API-Key: <key>` (required): Valid API key
- `X-CSRF-Token: <token>` (required): CSRF protection token
- `Content-Type: application/json` (required)

### Body Schema
```json
{
  "first_name": "string (optional, 1-50 chars)",
  "last_name": "string (optional, 1-50 chars)",
  "email": "string (optional, valid email format)",
  "phone": "string (optional, stored directly in User model)",
  "avatar": "string (optional, valid URL for profile picture)",
  "emergency_contact": "object (optional, encrypted when stored in Student/Instructor models)"
}
```

**Note**: At least one field must be provided for update.

## 📤 Response

### Success Response (200)
```json
{
  "success": true,
  "message": "Profile updated successfully",
  "data": {
          "user": {
        "id": "string",
        "first_name": "string",
        "last_name": "string",
        "email": "string",
        "phone": "string",
        "avatar": "string",
        "role": "string",
        "organization_id": "string",
        "isActive": true,
        "emailVerified": false,
        "mfaEnabled": true,
        "createdAt": "string (ISO date)",
        "updatedAt": "string (ISO date)"
      }
  },
  "auditId": "string",
  "timestamp": "string (ISO date)",
  "securityContext": {
    "sessionId": "string",
    "riskScore": 25,
    "encryptionLevel": "AES-256"
  }
}
```

**Note**: If email is updated, `emailVerified` will be reset to `false` and the message will include a verification notice.

### Error Responses

#### 400 - Bad Request
```json
{
  "error": {
    "message": "At least one field must be provided for update",
    "code": "NO_UPDATE_FIELDS",
    "requestId": "string",
    "timestamp": "string (ISO date)"
  }
}
```

```json
{
  "error": {
    "message": "Invalid email format",
    "code": "INVALID_EMAIL_FORMAT",
    "requestId": "string",
    "timestamp": "string (ISO date)"
  }
}
```

```json
{
  "error": {
    "message": "First name must be between 1 and 50 characters",
    "code": "INVALID_FIRST_NAME",
    "requestId": "string",
    "timestamp": "string (ISO date)"
  }
}
```

```json
{
  "error": {
    "message": "Avatar must be a valid URL",
    "code": "INVALID_AVATAR_URL",
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
    "message": "Profile update blocked due to security policy",
    "code": "HIGH_RISK_PROFILE_UPDATE",
    "requestId": "string",
    "timestamp": "string (ISO date)"
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
    "message": "User not found",
    "code": "USER_NOT_FOUND",
    "requestId": "string",
    "timestamp": "string (ISO date)"
  }
}
```

#### 409 - Conflict
```json
{
  "error": {
    "message": "Email address is already in use",
    "code": "EMAIL_ALREADY_EXISTS",
    "requestId": "string",
    "timestamp": "string (ISO date)"
  }
}
```

#### 429 - Too Many Requests
```json
{
  "error": {
    "message": "Rate limit exceeded",
    "code": "RATE_LIMIT_EXCEEDED",
    "requestId": "string",
    "timestamp": "string (ISO date)",
    "retryAfter": 60
  }
}
```

## 🔍 Example Request
```bash
curl -X PUT "https://api.skytrack.com/api/auth/update-profile" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "X-API-Key: your-api-key" \
  -H "X-CSRF-Token: csrf-token" \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "John",
    "last_name": "Doe",
    "email": "john.doe.new@example.com",
    "phone": "+1-555-123-4567",
    "avatar": "https://example.com/avatars/john-doe.jpg",
    "emergency_contact": {
      "name": "Jane Doe",
      "relationship": "spouse",
      "phone": "+1-555-987-6543",
      "email": "jane.doe@example.com"
    }
  }'
```

## 🔐 Security Features

### Data Encryption
- **Phone numbers** are encrypted using AES-256 before storage
- **Emergency contact** information is encrypted as JSON before storage
- **Sensitive fields** are automatically sanitized in audit logs

### Email Change Security
- When email is updated, `emailVerified` is reset to `false`
- User must verify the new email address before it becomes fully active
- Duplicate email validation prevents conflicts

### Fraud Detection
- Risk scoring monitors update patterns and frequency
- Geographic location and device fingerprinting
- Automatic blocking of high-risk update attempts (score > 75)

### Access Control
- Users can only update their own profile information
- No school access validation required (personal data)
- All user roles have update permissions for their own profile

## 📊 Data Handling

### User Model Updates
- `first_name`, `last_name`, `email`, `phone`, `avatar` are updated directly in the User collection
- Email verification status is reset when email changes
- Phone numbers are stored as plain text in User model for easy access
- Avatar URLs are validated before storage
- Profile updates are logged with full audit trails

### Related Model Updates
- **Students**: Emergency contact stored in Student collection (encrypted)
- **Instructors**: Emergency contact stored in Instructor collection (encrypted)
- Emergency contact data is encrypted before storage in related collections

### Validation Rules
- **Names**: 1-50 characters, trimmed
- **Email**: Valid email format, unique across system
- **Phone**: No format validation (flexibility for international numbers), stored in User model
- **Avatar**: Must be a valid URL format if provided
- **Emergency Contact**: Flexible object structure, encrypted as JSON in related models

## 🚨 Error Codes Reference
- `NO_UPDATE_FIELDS`: No fields provided for update
- `INVALID_EMAIL_FORMAT`: Email format validation failed
- `INVALID_FIRST_NAME`: First name length validation failed
- `INVALID_LAST_NAME`: Last name length validation failed
- `INVALID_AVATAR_URL`: Avatar URL format validation failed
- `AUTHENTICATION_FAILED`: Invalid or expired token
- `HIGH_RISK_PROFILE_UPDATE`: Request blocked by security policy
- `USER_NOT_FOUND`: User account not found
- `EMAIL_ALREADY_EXISTS`: Email address already in use
- `RATE_LIMIT_EXCEEDED`: Too many update requests

## 🔗 Related Endpoints
- `GET /api/auth/me` - Retrieve current user profile
- `POST /api/auth/reset-password/request` - Change password
- `GET /api/auth/mfa/status` - Check MFA settings
- `POST /api/auth/logout` - End current session 
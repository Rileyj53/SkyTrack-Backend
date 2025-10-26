# Authentication API Documentation

## 🎯 Overview
The Authentication API provides comprehensive user authentication and authorization features including traditional login/logout, multi-factor authentication (MFA), magic links, password management, and account security features with enterprise-grade security.

**Base URL**: `/api/auth`

## 🔐 Enterprise Security Features

All authentication endpoints implement enterprise-grade security with the following features:

### Security Middleware
- **Comprehensive Authentication**: JWT tokens, API keys, and CSRF protection
- **Fraud Detection**: Real-time risk scoring and suspicious activity monitoring  
- **Rate Limiting**: Sliding window rate limiting with configurable thresholds
- **Geographic Restrictions**: IP-based geo-blocking capabilities
- **Session Management**: Configurable session timeouts
- **Audit Logging**: Comprehensive audit trails with unique audit IDs

### Data Protection
- **Data Classification**: Endpoints classified from 'public' to 'restricted' level
- **Encryption**: AES-256 encryption for sensitive data
- **Request Size Limits**: Protection against large payload attacks
- **HTTPS Enforcement**: Mandatory HTTPS for all operations

## 🔧 Authentication Requirements
- **API Key**: Required for all endpoints via `X-API-Key` header
- **JWT Token**: Required for authenticated endpoints via `Authorization: Bearer <token>` header
- **CSRF Token**: Required for state-changing operations via `X-CSRF-Token` header

---

## Core Authentication Endpoints

# POST /api/auth/register

## 🎯 Overview
Register a new user account with role-based access control and enhanced security validation.

## 🔐 Security
- **Requires Auth**: ❌ (Public registration)
- **Requires API Key**: ✅ (X-API-Key header)
- **Requires CSRF Token**: ❌ (Not required for registration)
- **Allowed Roles**: Public (creates new user)
- **Fraud Detection**: ✅ Enabled (blocks high-risk registrations)
- **Risk Scoring**: ✅ Enabled (>75 risk score blocked)
- **Data Classification**: `confidential`
- **Rate Limiting**: 5 requests per 5 minutes

## 📥 Request

**Method**: `POST`  
**Path**: `/api/auth/register`

### Headers
- `X-API-Key: <key>` (required): Valid API key
- `Content-Type: application/json` (required)

### Body Schema
```json
{
  "email": "string (required, valid email format, max 254 chars)",
  "password": "string (required, 8-128 chars, complex requirements)",
  "first_name": "string (required, 1-50 chars)",
  "last_name": "string (required, 1-50 chars)",
  "role": "string (optional, default: 'student')",
  "school_id": "string (optional, ObjectId)",
  "student_id": "string (optional, ObjectId)",
  "instructor_id": "string (optional, ObjectId)"
}
```

### Password Requirements
- Minimum 8 characters, maximum 128 characters
- Contains uppercase and lowercase letters
- Contains numbers and special characters
- No sequential patterns (123, abc, qwe)
- No more than 2 consecutive identical characters

### Valid Roles
- `sys_admin` - System Administrator
- `school_admin` - School Administrator  
- `instructor` - Flight Instructor
- `student` - Student (default)

## 📤 Response

### Success Response (201)
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": {
      "id": "674a1b2c3d4e5f6789012345",
      "email": "user@example.com",
      "first_name": "John",
      "last_name": "Doe",
      "role": "student",
      "school_id": "674a1b2c3d4e5f6789012346",
      "student_id": "674a1b2c3d4e5f6789012347",
      "instructor_id": null,
      "isActive": true,
      "emailVerified": true,
      "mfaEnabled": false
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "csrfToken": "csrf_token_here"
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

### Error Responses

#### 400 - Bad Request
```json
{
  "error": {
    "message": "Validation failed",
    "code": "VALIDATION_ERROR",
    "details": [
      "Password must contain at least one uppercase letter",
      "Email format is invalid"
    ],
    "requestId": "audit_674a1b2c3d4e5f6789012349",
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

#### 403 - Forbidden (High Risk)
```json
{
  "error": {
    "message": "Registration blocked due to security policy",
    "code": "HIGH_RISK_REGISTRATION",
    "requestId": "audit_674a1b2c3d4e5f6789012349",
    "timestamp": "2024-01-15T10:30:00.000Z"
  },
  "securityContext": {
    "riskScore": 85,
    "fraudFlags": ["SUSPICIOUS_IP", "HIGH_VELOCITY"]
  }
}
```

#### 409 - Conflict
```json
{
  "error": {
    "message": "User already exists",
    "code": "USER_EXISTS",
    "requestId": "audit_674a1b2c3d4e5f6789012349",
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

#### 429 - Too Many Requests
```json
{
  "error": {
    "message": "Too many registration attempts",
    "code": "RATE_LIMIT_EXCEEDED",
    "requestId": "audit_674a1b2c3d4e5f6789012349",
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

## 🔍 Example Request

> **Note**: The SkyTrack Postman collection uses colon notation for path variables (e.g., `:token`) while cURL examples show curly brace notation (e.g., `{token}`) for clarity.

```bash
curl -X POST "https://api.skytrack.com/api/auth/register" \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john.doe@example.com",
    "password": "SecurePassword123!",
    "first_name": "John",
    "last_name": "Doe",
    "role": "student"
  }'
```

## 🚨 Error Codes Reference
- `VALIDATION_ERROR`: Request validation failed
- `HIGH_RISK_REGISTRATION`: Registration blocked due to high risk score  
- `USER_EXISTS`: Email already registered
- `RATE_LIMIT_EXCEEDED`: Too many registration attempts
- `DATABASE_ERROR`: Server error during registration

---

### 1. User Registration (Legacy Format)
**POST** `/api/auth/register`

Register a new user account with role-based access control.

---

### 2. User Login
**POST** `/api/auth/login`

Authenticate user with email/password and optional MFA token.

#### Request Body
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "token": "123456" // Optional MFA token
}
```

#### Success Response (200)
```json
{
  "message": "Login successful",
  "token": "jwt_token_here",
  "csrfToken": "csrf_token_here"
}
```

#### MFA Required Response (401)
```json
{
  "message": "MFA verification required",
  "requiresMFA": true
}
```

#### Error Responses
- **400**: Email/password required
- **401**: Invalid credentials, invalid MFA token
- **500**: MFA secret not found, user document not found

---

### 3. User Logout
**POST** `/api/auth/logout`

Logout user and blacklist JWT token.

#### Headers
- `Authorization: Bearer <token>`
- `X-API-Key: <api_key>`

#### Success Response (200)
```json
{
  "message": "Logged out successfully"
}
```

#### Error Responses
- **401**: Unauthorized
- **500**: Internal server error

---

### 4. Get Current User
**GET** `/api/auth/me`

Get current authenticated user information with associated data.

#### Headers
- `Authorization: Bearer <token>`
- `X-CSRF-Token: <csrf_token>`

#### Success Response (200)
```json
{
  "user": {
    "_id": "ObjectId",
    "email": "user@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "role": "student",
    "school_id": "ObjectId",
    "student_id": "ObjectId",
    "instructor_id": "ObjectId",
    "isActive": true,
    "emailVerified": true,
    "mfaEnabled": false,
    "mfaVerified": false,
    "school": {
      "_id": "ObjectId",
      "name": "Flight School",
      // ... school details
    },
    "student": {
      "_id": "ObjectId",
      "first_name": "John",
      "last_name": "Doe",
      // ... student details
    },
    "instructor": null
  }
}
```

#### Error Responses
- **401**: Unauthorized, token not found, invalid token
- **403**: Invalid CSRF token
- **404**: User not found
- **500**: Internal server error

---

## Multi-Factor Authentication (MFA)

### 5. MFA Setup
**POST** `/api/auth/mfa/setup`

Initialize MFA for the authenticated user.

#### Headers
- `Authorization: Bearer <token>`
- `X-API-Key: <api_key>`

#### Success Response (200)
```json
{
  "message": "MFA setup initiated",
  "qrCode": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
  "qrCodeType": "data:image/png;base64",
  "backupCodes": [
    "123456789",
    "987654321",
    // ... 10 backup codes total
  ],
  "secret": "JBSWY3DPEHPK3PXP",
  "instructions": [
    "Option 1 - Scan QR Code:",
    "   a. Copy the entire qrCode string (including \"data:image/png;base64,\")",
    "   b. Open a new browser tab and paste the entire string in the address bar",
    "   c. The QR code will be displayed in the browser",
    "   d. Scan the displayed QR code with your authenticator app",
    "",
    "Option 2 - Manual Entry:",
    "   a. Open your authenticator app",
    "   b. Choose \"Enter setup key\" or \"Manual entry\"",
    "   c. Enter the secret key shown above",
    "",
    "After setup:",
    "1. You will see a 6-digit code in your app",
    "2. Use that code to verify your MFA setup",
    "3. Save your backup codes in a secure place"
  ]
}
```

#### Error Responses
- **400**: MFA is already enabled
- **401**: Authentication required
- **404**: User not found
- **500**: Error setting up MFA

---

### 6. MFA Verification
**POST** `/api/auth/mfa/verify`

Verify MFA setup with authenticator token.

#### Headers
- `Authorization: Bearer <token>`
- `X-API-Key: <api_key>`

#### Request Body
```json
{
  "token": "123456"
}
```

#### Success Response (200)
```json
{
  "message": "MFA verification successful",
  "mfaEnabled": true,
  "mfaVerified": true
}
```

#### Error Responses
- **400**: Token required, invalid token format, invalid MFA state, invalid verification code
- **401**: Authentication required
- **404**: User not found
- **500**: Error verifying MFA

---

### 7. MFA Status
**GET** `/api/auth/mfa/status`

Get current MFA status for authenticated user.

#### Headers
- `Authorization: Bearer <token>`
- `X-API-Key: <api_key>`

#### Success Response (200)
```json
{
  "mfaEnabled": true,
  "mfaVerified": true
}
```

#### Error Responses
- **401**: Authentication required
- **404**: User not found
- **500**: Error getting MFA status

---

### 8. MFA Disable
**POST** `/api/auth/mfa/disable`

Disable MFA for authenticated user.

#### Headers
- `Authorization: Bearer <token>`
- `X-API-Key: <api_key>`

#### Request Body
```json
{
  "token": "123456"
}
```

#### Success Response (200)
```json
{
  "message": "MFA disabled successfully"
}
```

#### Error Responses
- **400**: Token required, invalid token format, MFA not enabled, invalid verification code
- **401**: Authentication required
- **404**: User not found
- **500**: Error disabling MFA

---

### 9. MFA Login Verification
**POST** `/api/auth/mfa/verify-login`

Complete login process with MFA verification.

#### Headers
- `Authorization: Bearer <token>`
- `X-API-Key: <api_key>`

#### Request Body
```json
{
  "token": "123456"
}
```

#### Success Response (200)
```json
{
  "message": "MFA verification successful",
  "userId": "ObjectId",
  "email": "user@example.com"
}
```

#### Error Responses
- **400**: Token required, invalid token format
- **401**: Authentication required, invalid MFA token
- **404**: User not found
- **500**: Error verifying MFA token

---

## Magic Link Authentication

### 10. Request Magic Link
**POST** `/api/auth/magic-link/request`

Request a magic link for passwordless authentication.

#### Headers
- `X-API-Key: <api_key>`

#### Request Body
```json
{
  "email": "user@example.com"
}
```

#### Success Response (200)
```json
{
  "message": "Magic login link and code sent to your email."
}
```

#### Error Responses
- **400**: Email required, user with email does not exist
- **500**: Internal server error

---

### 11. Magic Link Login
**POST** `/api/auth/magic-link/login`

Login using magic link token or code.

#### Headers
- `X-API-Key: <api_key>`

#### Request Body
```json
{
  "token": "magic_token_here",
  "code": "123456" // Alternative to token
}
```

#### Success Response (200)
```json
{
  "message": "Logged in successfully",
  "token": "jwt_token_here",
  "csrfToken": {
    "token": "csrf_token_here",
    "expires": 1640995200000
  }
}
```

#### Error Responses
- **400**: Token or code required, invalid or expired magic link or code
- **500**: Internal server error

---

## Password Management

### 12. Request Password Reset
**POST** `/api/auth/reset-password/request`

Request password reset email.

#### Headers
- `X-API-Key: <api_key>`

#### Request Body
```json
{
  "email": "user@example.com"
}
```

#### Success Response (200)
```json
{
  "message": "If your email is registered, you will receive a password reset link."
}
```

#### Error Responses
- **400**: Email required
- **403**: Account is deactivated
- **500**: Internal server error

---

### 13. Complete Password Reset
**POST** `/api/auth/reset-password/complete`

Complete password reset with token.

#### Headers
- `X-API-Key: <api_key>`

#### Request Body
```json
{
  "token": "reset_token_here",
  "password": "NewSecurePassword123!",
  "newPassword": "NewSecurePassword123!" // Alternative field name
}
```

#### Success Response (200)
```json
{
  "message": "Password has been reset successfully"
}
```

#### Error Responses
- **400**: Token and password required, invalid or expired reset token
- **500**: Internal server error

---

## Account Management

### 14. Unlock Account
**POST** `/api/auth/unlock-account`

Request account unlock email for locked accounts.

#### Headers
- `X-API-Key: <api_key>`

#### Request Body
```json
{
  "email": "user@example.com"
}
```

#### Success Response (200)
```json
{
  "message": "If your email is registered, you will receive unlock instructions."
}
```

#### Error Responses
- **400**: Email required
- **500**: Internal server error

---

### 15. Get CSRF Token
**GET** `/api/auth/csrf-token`

Get a new CSRF token for secure requests.

#### Headers
- `X-API-Key: <api_key>`

#### Success Response (200)
```json
{
  "token": "csrf_token_here",
  "expires": 1640995200000
}
```

#### Error Responses
- **500**: Failed to generate CSRF token

---

## Security Features

### JWT Token Management
- **Token Expiration**: 7 days
- **Token Blacklisting**: Logout adds token to blacklist
- **Cookie Security**: HTTP-only, Secure in production, SameSite strict

### CSRF Protection
- **Token Generation**: Cryptographically secure tokens
- **Token Validation**: Required for state-changing operations
- **Cookie Storage**: Non-HTTP-only for JavaScript access

### Password Security
- **Hashing**: bcrypt with salt rounds
- **Validation**: Complex password requirements
- **Reset Tokens**: Cryptographically secure, 1-hour expiration

### Account Security
- **Failed Login Tracking**: Account lockout after multiple failures
- **IP Address Logging**: Audit trail for security events
- **Password History**: Track password changes with metadata

### MFA Security
- **TOTP**: Time-based One-Time Password (RFC 6238)
- **Backup Codes**: 10 single-use recovery codes
- **QR Code Generation**: For easy authenticator app setup

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
- **201**: Created (registration)
- **400**: Bad Request (validation errors)
- **401**: Unauthorized (authentication failed)
- **403**: Forbidden (insufficient permissions)
- **404**: Not Found (user/resource not found)
- **500**: Internal Server Error

---

## Integration Points

### User Management
- Links to User model for profile data
- Role-based access control integration
- School and student/instructor associations

### Session Management
- JWT token generation and validation
- CSRF token management
- Session state tracking

### Email Services
- Password reset notifications
- Magic link delivery
- Account unlock instructions
- MFA setup notifications

### Audit Logging
- Login/logout events
- Password changes
- MFA setup/disable events
- Failed authentication attempts

---

## Use Cases & Scenarios

### Standard Login Flow
1. User submits credentials to `/api/auth/login`
2. System validates email/password
3. If MFA enabled, system returns `requiresMFA: true`
4. User submits MFA token to `/api/auth/login` with token
5. System returns JWT and CSRF tokens
6. Client stores tokens for subsequent requests

### MFA Setup Flow
1. User calls `/api/auth/mfa/setup`
2. System generates secret and QR code
3. User scans QR code with authenticator app
4. User calls `/api/auth/mfa/verify` with token
5. System confirms MFA is active

### Password Reset Flow
1. User requests reset via `/api/auth/reset-password/request`
2. System sends email with reset token
3. User clicks link and submits new password to `/api/auth/reset-password/complete`
4. System updates password and clears reset token

### Magic Link Flow
1. User requests magic link via `/api/auth/magic-link/request`
2. System sends email with magic token and 6-digit code
3. User clicks link or enters code via `/api/auth/magic-link/login`
4. System returns JWT and CSRF tokens 
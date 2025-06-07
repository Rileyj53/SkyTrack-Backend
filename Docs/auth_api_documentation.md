# Authentication API Documentation

## Overview
The Authentication API provides comprehensive user authentication and authorization features including traditional login/logout, multi-factor authentication (MFA), magic links, password management, and account security features.

**Base URL**: `/api/auth`

## Authentication Requirements
- **API Key**: Required for all endpoints via `X-API-Key` header
- **JWT Token**: Required for authenticated endpoints via `Authorization: Bearer <token>` header
- **CSRF Token**: Required for state-changing operations via `X-CSRF-Token` header

---

## Core Authentication Endpoints

### 1. User Registration
**POST** `/api/auth/register`

Register a new user account with role-based access control.

#### Request Body
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "first_name": "John",
  "last_name": "Doe",
  "role": "student",
  "school_id": "ObjectId (optional)",
  "student_id": "ObjectId (optional)",
  "instructor_id": "ObjectId (optional)"
}
```

#### Password Requirements
- Minimum 8 characters
- Contains uppercase letters
- Contains lowercase letters
- Contains numbers
- Contains special characters

#### Valid Roles
- `sys_admin` - System Administrator
- `school_admin` - School Administrator
- `instructor` - Flight Instructor
- `student` - Student (default)

#### Success Response (201)
```json
{
  "message": "User registered successfully",
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
    "emailVerified": true
  },
  "token": "jwt_token_here",
  "csrfToken": "csrf_token_here"
}
```

#### Error Responses
- **400**: Email/password required, password validation failed, invalid role, user already exists
- **500**: Internal server error

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
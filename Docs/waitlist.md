# POST /api/waitlist

## 🎯 Overview
Allows users to join the waitlist by submitting their email address. This is a public endpoint designed for lead generation and user registration interest tracking. Upon successful signup, users receive a confirmation email with details about SkyTrack and next steps.

## 🔐 Security
- **Requires Auth**: ❌ (Public endpoint)
- **Requires API Key**: ✅ (X-API-Key header)
- **Requires CSRF Token**: ❌ (Public endpoint)
- **Allowed Roles**: `public` (No authentication required)
- **School Access Required**: ❌ (Public endpoint)
- **Fraud Detection**: ✅ Enabled
- **Risk Scoring**: ✅ Enabled (blocks requests with risk score > 85)
- **Data Classification**: `public`
- **Rate Limiting**: 50 requests per minute

## 📥 Request

**Method**: `POST`  
**Path**: `/api/waitlist`

### Headers
- `X-API-Key: <key>` (required): Valid API key
- `Content-Type: application/json` (required)

### Body Schema
```json
{
  "email": "string (required, valid email format)",
  "source": "string (optional, default: 'waitlist_form')"
}
```

### Validation Rules
- **email**: Must be a valid email format (username@domain.extension)
- **source**: Optional tracking field to identify signup source (e.g., 'landing_page', 'marketing_campaign', 'social_media')

## 📤 Response

### Success Response (200)
```json
{
  "success": true,
  "message": "Successfully joined the waitlist! We'll be in touch soon.",
  "auditId": "string",
  "timestamp": "string (ISO date)"
}
```

### Error Responses

#### 400 - Bad Request (Missing Email)
```json
{
  "error": {
    "message": "Email is required",
    "code": "EMAIL_REQUIRED",
    "requestId": "string",
    "timestamp": "string (ISO date)"
  }
}
```

#### 400 - Bad Request (Invalid Email Format)
```json
{
  "error": {
    "message": "Please enter a valid email address",
    "code": "INVALID_EMAIL_FORMAT", 
    "requestId": "string",
    "timestamp": "string (ISO date)"
  }
}
```

#### 401 - Unauthorized (Missing/Invalid API Key)
```json
{
  "error": {
    "message": "Invalid or missing API key",
    "code": "AUTHENTICATION_FAILED",
    "requestId": "string",
    "timestamp": "string (ISO date)"
  }
}
```

#### 403 - Forbidden (High Risk Score)
```json
{
  "error": {
    "message": "Request blocked due to security policy",
    "code": "HIGH_RISK_BLOCKED",
    "requestId": "string", 
    "timestamp": "string (ISO date)"
  },
  "securityContext": {
    "riskScore": 90,
    "fraudFlags": ["suspicious_ip", "bot_detected"]
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

#### 500 - Internal Server Error
```json
{
  "error": {
    "message": "An internal server error occurred",
    "code": "INTERNAL_ERROR",
    "requestId": "string",
    "timestamp": "string (ISO date)"
  }
}
```

## 🔍 Example Request
```bash
curl -X POST "https://api.skytrack.com/api/waitlist" \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john.doe@example.com",
    "source": "landing_page"
  }'
```

## 🔍 Example Response
```json
{
  "success": true,
  "message": "Successfully joined the waitlist! We'll be in touch soon.",
  "auditId": "aud_1234567890abcdef",
  "timestamp": "2024-01-15T10:30:45.123Z"
}
```

## 🚨 Error Codes Reference
- `EMAIL_REQUIRED`: Email field is missing from request body
- `INVALID_EMAIL_FORMAT`: Email does not match valid email format
- `AUTHENTICATION_FAILED`: Invalid or missing API key
- `HIGH_RISK_BLOCKED`: Request blocked due to high fraud risk score
- `RATE_LIMIT_EXCEEDED`: Too many requests from this IP/API key
- `DATABASE_ERROR`: Error saving to database
- `INTERNAL_ERROR`: Unexpected server error

## 🔒 Security Features
- **Duplicate Prevention**: Email addresses are automatically deduplicated (returns success for duplicates to prevent email enumeration)
- **Fraud Detection**: Advanced fraud detection analyzes IP reputation, request patterns, and bot detection
- **Rate Limiting**: Sliding window rate limiting prevents abuse while allowing legitimate signups
- **Risk Scoring**: Requests with high risk scores (>85) are automatically blocked
- **IP Tracking**: Request IP and user agent are logged for security monitoring
- **Data Sanitization**: Email addresses are automatically trimmed and converted to lowercase

## 📊 Tracking & Analytics
- **Source Tracking**: Optional `source` field allows tracking signup origins
- **Audit Logging**: All requests are logged with unique audit IDs for tracking
- **Performance Monitoring**: Request processing times are logged
- **Geographic Tracking**: IP-based location tracking for analytics

## 🎯 Use Cases
- **Landing Page Signups**: Capture emails from marketing landing pages
- **Pre-Launch Interest**: Gauge interest before product launches
- **Lead Generation**: Build email lists for marketing campaigns
- **Feature Requests**: Allow users to express interest in new features
- **Beta Access**: Manage beta program signups

## 📧 Email Confirmation
Upon successful waitlist signup, users receive an automated confirmation email containing:
- Welcome message and next steps
- Overview of SkyTrack features and benefits
- Information about when they'll be contacted
- Professional HTML-formatted design with SkyTrack branding

**Email Features:**
- **Non-blocking**: Email sending doesn't affect API response time or success
- **Error Handling**: Email failures are logged but don't cause request failures
- **Personalization**: Includes the user's email and signup source in the message
- **Professional Design**: Mobile-responsive HTML template with aviation theming
- **Security**: Uses existing SMTP configuration with proper error handling

## 📝 Implementation Notes
- Returns success message even for duplicate emails to prevent email enumeration attacks
- Automatically captures request metadata (IP, user agent) for tracking and security
- Uses fraud detection to block suspicious signups while maintaining user experience
- Implements proper database connection retry logic for reliability
- Follows SkyTrack logging standards for Vercel compatibility
- Sends confirmation emails asynchronously without blocking the response
- Email failures are gracefully handled and logged for monitoring 
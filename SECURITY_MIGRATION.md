# Bank-Grade Security Migration Guide

## Overview
This guide helps you migrate from the scattered middleware files to the consolidated bank-grade security system.

## Files to Consolidate/Replace

### ✅ Can be DELETED after migration:
- `src/middleware/apiKeyAuth.ts` → Integrated into `security.ts`
- `src/middleware/auth.ts` → Integrated into `security.ts`
- `src/middleware/csrf.ts` → Integrated into `security.ts`
- `src/middleware/csrfProtection.ts` → Duplicate, can be deleted
- `src/middleware/maintenanceAuth.ts` → Use `secureApiRoute` with role checks
- `src/middleware/permissions.ts` → Integrated into `security.ts`
- `src/middleware/schoolAccess.ts` → Integrated into `security.ts`
- `src/middleware/withPermissions.ts` → Replaced by `secureApiRoute`

### ✅ Keep and enhance:
- `src/middleware/cors.ts` → Keep for global CORS handling
- `src/middleware/securityHeaders.ts` → Keep for global security headers
- `src/lib/apiKeys.ts` → Keep for API key management utilities
- `src/lib/auth.ts` → Keep for authentication utilities
- `src/lib/jwt.ts` → Keep for JWT utilities
- `src/lib/encryption.ts` → Keep for encryption utilities

## Migration Steps

### 1. Update your API routes

**Before:**
```typescript
// Old way with multiple middleware imports
import { validateApiKey } from '@/middleware/apiKeyAuth';
import { authenticateRequest } from '@/middleware/auth';
import { checkSchoolAccess } from '@/middleware/schoolAccess';

export async function GET(request: NextRequest, { params }: { params: { schoolId: string } }) {
  // Manual security checks
  const apiKeyResult = await validateApiKey(request);
  if (apiKeyResult.error) {
    return NextResponse.json({ error: apiKeyResult.error }, { status: 401 });
  }
  
  const authResult = authenticateRequest(request);
  if (!authResult.success) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const schoolAccessResult = await checkSchoolAccess(request, params.schoolId);
  if (schoolAccessResult) {
    return schoolAccessResult;
  }
  
  // Your actual logic here
  return NextResponse.json({ data: 'success' });
}
```

**After:**
```typescript
// New way with consolidated security
import { secureApiRoute, SecurityConfig } from '@/middleware/security';

const SECURITY_CONFIG: SecurityConfig = {
  requireAuth: true,
  requireApiKey: true,
  requireSchoolAccess: true,
  allowedRoles: ['school_admin', 'instructor'],
  enableFraudDetection: true,
  enableAdvancedAudit: true,
  rateLimiting: {
    maxRequests: 100,
    windowMs: 60000,
    slidingWindow: true
  }
};

export const GET = secureApiRoute(async (request, { params, securityContext }) => {
  // Security is already handled - you have access to:
  // - securityContext.user
  // - securityContext.permissions
  // - securityContext.schoolId
  // - securityContext.riskScore
  // - securityContext.auditId
  
  // Your actual logic here
  return NextResponse.json({ 
    data: 'success',
    user: securityContext.user.email,
    schoolId: securityContext.schoolId
  });
}, SECURITY_CONFIG);
```

### 2. Bank-Grade Security Configurations

#### Payment Processing Endpoints
```typescript
const PAYMENT_CONFIG: SecurityConfig = {
  requireAuth: true,
  requireCSRF: true,
  requireHttpsOnly: true,
  requireRequestSigning: true,
  requireTwoFactor: true,
  enableFraudDetection: true,
  enableGeoBlocking: true,
  allowedCountries: ['US', 'CA', 'GB'],
  allowedRoles: ['school_admin'],
  pciCompliance: true,
  dataClassification: 'restricted',
  maxRequestSize: 1024 * 1024, // 1MB
  rateLimiting: {
    maxRequests: 10,
    windowMs: 60000,
    slidingWindow: true
  },
  sessionTimeout: 15
};
```

#### Sensitive Data Endpoints
```typescript
const SENSITIVE_DATA_CONFIG: SecurityConfig = {
  requireAuth: true,
  requireCSRF: true,
  requireSchoolAccess: true,
  enableFraudDetection: true,
  enableAdvancedAudit: true,
  dataClassification: 'confidential',
  allowedRoles: ['school_admin', 'instructor'],
  rateLimiting: {
    maxRequests: 50,
    windowMs: 60000
  }
};
```

#### Public API Endpoints
```typescript
const PUBLIC_API_CONFIG: SecurityConfig = {
  requireApiKey: true,
  enableFraudDetection: true,
  dataClassification: 'public',
  rateLimiting: {
    maxRequests: 1000,
    windowMs: 60000
  }
};
```

### 3. Environment Variables

Add these to your `.env` file for bank-grade security:

```env
# Request signing (for payment endpoints)
REQUEST_SIGNING_SECRET=your-super-secure-signing-secret-here

# Encryption key (must be exactly 32 characters)
ENCRYPTION_KEY=your-32-character-encryption-key!!

# JWT secret
JWT_SECRET=your-jwt-secret-here

# Database encryption
DATABASE_ENCRYPTION_KEY=your-database-encryption-key-here
```

### 4. Update Global Middleware

Update `src/middleware.ts` to use the new security system:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { cors } from './middleware/cors';
import { securityHeaders } from './middleware/securityHeaders';
import { withSecurity } from './middleware/security';

export async function middleware(request: NextRequest) {
  // Apply global security features
  const basicSecurityConfig = {
    enableFraudDetection: true,
    enableAdvancedAudit: true,
    rateLimiting: {
      maxRequests: 1000,
      windowMs: 60000
    }
  };

  const securityResult = await withSecurity(basicSecurityConfig)(request);
  if (securityResult.response) {
    return securityResult.response;
  }

  // Apply CORS
  const corsResponse = cors(request);
  if (corsResponse.status !== 200) {
    return corsResponse;
  }

  // Apply security headers
  return securityHeaders(request);
}
```

## Bank-Grade Security Features

### 1. Advanced Rate Limiting
- Sliding window algorithm
- IP-based limiting
- User-agent fingerprinting
- Velocity checks

### 2. Fraud Detection
- Risk scoring (0-100)
- Suspicious user agent detection
- Unusual timing pattern detection
- Multiple IP detection
- Missing security headers detection

### 3. Geo-blocking
- Country-based restrictions
- High-risk country blocking
- IP geolocation validation

### 4. Request Integrity
- HMAC signature verification
- Timestamp validation (5-minute window)
- Nonce validation to prevent replay attacks

### 5. Advanced Session Management
- Session timeout enforcement
- Concurrent session detection
- Session fingerprinting

### 6. PCI Compliance
- Card number masking
- CVV storage prevention
- Encryption validation
- Data sanitization

### 7. Advanced Audit Logging
- Comprehensive request logging
- Security event tracking
- Risk score logging
- Performance metrics

### 8. Data Classification
- Public, Internal, Confidential, Restricted
- Automatic data sanitization
- Field-level redaction

## Testing Your Migration

### 1. Test Payment Endpoints
```bash
# Should require HTTPS, signature, and MFA
curl -X POST https://your-api.com/api/payments \
  -H "Authorization: Bearer your-jwt-token" \
  -H "X-CSRF-Token: your-csrf-token" \
  -H "X-Signature: your-hmac-signature" \
  -H "X-Timestamp: $(date +%s)000" \
  -H "X-Nonce: $(openssl rand -hex 16)" \
  -d '{"amount": 100, "cardNumber": "4111111111111111"}'
```

### 2. Test Rate Limiting
```bash
# Should be rate limited after 10 requests
for i in {1..15}; do
  curl -X GET https://your-api.com/api/protected \
    -H "X-API-Key: your-api-key"
done
```

### 3. Test Fraud Detection
```bash
# Should trigger fraud detection
curl -X POST https://your-api.com/api/payments \
  -H "User-Agent: BadBot/1.0 (scanner)" \
  -H "Authorization: Bearer your-jwt-token"
```

## Performance Considerations

### Production Optimizations
1. **Use Redis** for rate limiting and session storage instead of in-memory maps
2. **Use a real geolocation service** like MaxMind instead of mock data
3. **Use a proper audit logging service** like AWS CloudTrail or similar
4. **Implement database connection pooling** for better performance
5. **Use CDN and edge caching** for static security headers

### Monitoring and Alerts
1. Set up alerts for high risk scores (>80)
2. Monitor rate limiting violations
3. Track fraud detection patterns
4. Monitor session timeout violations
5. Alert on PCI compliance violations

## Support

For questions about the migration, check:
1. The `src/examples/securePaymentRoute.ts` for implementation examples
2. The security configuration options in `SecurityConfig` interface
3. The bank-grade utility functions in `security.ts` 
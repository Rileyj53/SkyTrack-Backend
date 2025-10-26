# Organizations API Documentation

## Overview
The Organizations API provides comprehensive management of flight training organizations (schools and flying clubs) within the SkyTrack system. This API supports both traditional flight schools and flying clubs with flexible organizational structures.

## Organization Types
- **Flight Schools**: Formal training institutions with structured programs
- **Flying Clubs**: Member-owned organizations with shared aircraft and resources
- **Hybrid Organizations**: Organizations offering both school and club services

## Enhanced Features
- **Multi-Type Support**: Unified API for schools and clubs
- **Flexible Membership**: Support for various membership models
- **Resource Sharing**: Shared aircraft, instructors, and facilities
- **Billing Integration**: Automated billing for both training and club activities
- **Compliance Tracking**: FAA, insurance, and certification management

## Access Control

### Role-Based Permissions:

| Role | List Organizations | Create Organization | View Organization | Update Organization | Delete Organization |
|------|-------------------|---------------------|-------------------|---------------------|---------------------|
| **Student** | ❌ | ❌ | ✅ Own Only | ❌ | ❌ |
| **Instructor** | ❌ | ❌ | ✅ Own Only | ❌ | ❌ |
| **Organization Admin** | ❌ | ✅ | ✅ Own Only | ✅ Own Only | ❌ |
| **System Admin** | ✅ All | ✅ | ✅ All | ✅ All | ✅ All |

### Security Features:
- **API key validation** required for all requests
- **JWT authentication** verifies user identity and role
- **Organization-scoped access** prevents cross-organization data access
- **Role-based permissions** enforce appropriate access levels
- **Data classification** ensures appropriate information exposure

## Organization Object

```json
{
  "_id": "ObjectId",
  "name": "SkyTrack Flight Academy",
  "type": "school", // "school", "club", or "hybrid"
  "status": "Active",
  "address": {
    "street": "123 Aviation Way",
    "city": "Seattle",
    "state": "WA",
    "zip": "98101",
    "country": "USA"
  },
  "contact": {
    "phone": "+1-555-123-4567",
    "email": "info@skytrackacademy.com",
    "website": "https://skytrackacademy.com"
  },
  "faa_certificate": "FT123456",
  "settings": {
    "timezone": "America/Los_Angeles",
    "currency": "USD",
    "tax_rate": 8.5,
    "billing_cycle": "monthly"
  },
  "membership": {
    "model": "training", // "training", "equity", "monthly", "annual"
    "initiation_fee": 0,
    "monthly_dues": 0,
    "equity_buy_in": 0,
    "member_count": 45,
    "max_members": 100
  },
  "facilities": {
    "hangars": 2,
    "classrooms": 3,
    "maintenance_shop": true,
    "fuel_service": true,
    "runway_access": true
  },
  "created_by": "ObjectId",
  "updated_by": "ObjectId",
  "created_at": "2024-01-15T08:00:00.000Z",
  "updated_at": "2024-01-20T15:30:00.000Z"
}
```

## API Endpoints

### GET /api/organizations
List all organizations (System Admin only).

**Access:** System Admins only

**Query Parameters:**
- `type` - Filter by organization type (school, club, hybrid)
- `status` - Filter by status (Active, Inactive, Suspended)
- `state` - Filter by state/province
- `page` - Page number for pagination
- `limit` - Items per page

### POST /api/organizations
Create a new organization.

**Access:** System Admins, Organization Admins

**Required Fields:**
- `name` - Organization name (must be unique)
- `type` - Organization type (school, club, or hybrid)
- `address` - Complete address object
- `contact` - Contact information object

### GET /api/organizations/{organizationId}
Get a specific organization with all details.

**Access:** Organization members, System Admins

### PUT /api/organizations/{organizationId}
Update an organization's information.

**Access:** Organization Admins (own organization), System Admins

### DELETE /api/organizations/{organizationId}
Delete an organization (System Admin only).

**Access:** System Admins only

## Organization Statistics

### GET /api/organizations/{organizationId}/stats
Get comprehensive statistics for an organization.

**Access:** Organization Admins (own organization), System Admins

**Response includes:**
- Member/student counts
- Aircraft utilization
- Financial metrics
- Instructor performance
- Safety statistics

## Validation Rules

### Organization Name
- Must be unique within the system
- Minimum 2 characters, maximum 100 characters
- Cannot contain special characters except spaces, hyphens, and apostrophes

### Organization Type
- Must be one of: "school", "club", "hybrid"
- Cannot be changed after creation (contact support)

### FAA Certificate
- Must be unique across all organizations
- Format validation for certificate numbers
- Required for flight schools, optional for clubs

### Contact Information
- Email must be valid format
- Phone number format validation
- Website URL validation (if provided)

## Business Rules

### Access Control
1. **Organization Scoping**: Users can only access their own organization
2. **System Admin Override**: System admins have access to all organizations
3. **Member Restrictions**: Students and instructors limited to read-only access
4. **Admin Authority**: Organization admins have full control within their organization

### Membership Management
1. **Type-Based Rules**: Different rules for schools vs clubs
2. **Capacity Limits**: Enforce maximum member limits
3. **Financial Tracking**: Track dues, fees, and equity positions
4. **Status Management**: Active, inactive, and suspended memberships

## Common Errors

**400 Bad Request:**
- Invalid organization type
- Duplicate organization name
- Invalid address or contact format

**401 Unauthorized:**
- Missing or invalid authentication token

**403 Forbidden:**
- Insufficient permissions to access organization data
- Cross-organization access attempt

**404 Not Found:**
- Organization not found
- Invalid organization ID format

**409 Conflict:**
- Organization name already exists
- FAA certificate already in use

**500 Internal Server Error:**
- Database connection issues
- Unexpected server errors

## Integration Points

### User Management
- Organization administrators linked to specific organizations
- User roles determine access permissions
- Organization-scoped operations prevent data leakage

### Aircraft Management
- Aircraft belong to specific organizations
- Shared aircraft support for clubs
- Maintenance tracking per organization

### Financial System
- Organization settings affect billing and invoicing
- Tax rates and currency settings per organization
- Separate financial tracking per organization

### Training Programs
- Programs are organization-specific
- Curriculum customization per organization
- Progress tracking within organization boundaries 
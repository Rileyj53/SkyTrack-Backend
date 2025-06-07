# Flight Charges Admin Endpoints

## Overview
Dedicated endpoints for school administrators to approve and reject flight charges. These endpoints provide a cleaner REST API design compared to the generic PUT endpoint with action fields.

## Access Control
**Roles Required:** `school_admin` or `sys_admin`
- Only users with the role "school_admin" or "sys_admin" can access these endpoints
- API key validation and JWT authentication required
- 403 Forbidden returned for users with insufficient permissions

## Endpoints

### PATCH /api/schools/{schoolId}/flight-charges/{chargeId}/approve
Approve a pending flight charge.

**Required Roles:** `school_admin` or `sys_admin`

**Path Parameters:**
- `schoolId` - ObjectId of the school
- `chargeId` - ObjectId of the flight charge to approve

**Request Body:** None required

**Example Request:**
```bash
PATCH /api/schools/68389c818d13949c514ac59c/flight-charges/64a1b2c3d4e5f6789012999/approve
Authorization: Bearer {jwt_token}
X-API-Key: {api_key}
```

**Responses:**

**200 Success:**
```json
{
  "message": "Flight charge approved successfully and ledger balance updated",
  "charge": {
    "_id": "64a1b2c3d4e5f6789012999",
    "amount": 225.00,
    "status": "approved",
    "approved_by": {
      "first_name": "Jane",
      "last_name": "Admin",
      "email": "jane.admin@school.com",
      "role": "school_admin"
    },
    "approved_at": "2024-01-15T14:30:00.000Z",
    "flight_schedule_id": {
      "scheduled_start_time": "2024-01-15T10:00:00.000Z",
      "scheduled_end_time": "2024-01-15T12:00:00.000Z",
      "flight_type": "Training"
    },
    "student_id": {
      "user_id": {
        "first_name": "John",
        "last_name": "Student",
        "email": "john.student@email.com"
      }
    }
    // ... other populated fields
  }
}
```

**400 Bad Request:**
- Charge is already approved
- Charge is rejected (cannot approve rejected charges)
- Invalid ID format

**403 Forbidden:**
- User is not a school admin or system admin

**404 Not Found:**
- Flight charge not found in this school

### PATCH /api/schools/{schoolId}/flight-charges/{chargeId}/reject
Reject a pending flight charge with a reason.

**Required Roles:** `school_admin` or `sys_admin`

**Path Parameters:**
- `schoolId` - ObjectId of the school
- `chargeId` - ObjectId of the flight charge to reject

**Request Body:**
```json
{
  "reason_rejected": "Flight was canceled due to weather conditions"
}
```

**Required Fields:**
- `reason_rejected` - String, non-empty reason for rejection

**Example Request:**
```bash
PATCH /api/schools/68389c818d13949c514ac59c/flight-charges/64a1b2c3d4e5f6789012999/reject
Authorization: Bearer {jwt_token}
X-API-Key: {api_key}
Content-Type: application/json

{
  "reason_rejected": "Flight was canceled due to weather conditions"
}
```

**Responses:**

**200 Success:**
```json
{
  "message": "Flight charge rejected successfully and ledger balance updated",
  "charge": {
    "_id": "64a1b2c3d4e5f6789012999",
    "amount": 225.00,
    "status": "rejected",
    "reason_rejected": "Flight was canceled due to weather conditions",
    "approved_by": {
      "first_name": "Jane",
      "last_name": "Admin",
      "email": "jane.admin@school.com",
      "role": "school_admin"
    },
    "approved_at": "2024-01-15T14:30:00.000Z",
    // ... other populated fields
  }
}
```

**400 Bad Request:**
- Missing or empty `reason_rejected`
- Charge is already rejected
- Charge is approved (cannot reject approved charges)
- Invalid ID format

**403 Forbidden:**
- User is not a school admin or system admin

**404 Not Found:**
- Flight charge not found in this school

## Business Logic

### Approval Process
1. **Validation**: Checks charge status and permissions
2. **State Change**: Updates charge status to "approved"
3. **Ledger Integration**: Automatically updates student ledger
4. **Balance Recalculation**: Recalculates balance from ALL approved charges
5. **Audit Trail**: Records who approved and when

### Rejection Process
1. **Validation**: Checks charge status, permissions, and rejection reason
2. **State Change**: Updates charge status to "rejected"
3. **Ledger Integration**: Removes charge from student ledger
4. **Balance Recalculation**: Recalculates balance from remaining approved charges
5. **Audit Trail**: Records who rejected, when, and why

### State Restrictions
- **Cannot approve rejected charges**: Must create new charge instead
- **Cannot reject approved charges**: Consider creating credit entry instead
- **Cannot change status twice**: Each charge can only be approved/rejected once

## Ledger Integration

Both endpoints automatically integrate with the student ledger system:

### On Approval:
- Charge added to ledger charges array (if not already present)
- **Balance recalculated** from ALL approved charges
- Ledger `last_updated` timestamp updated

### On Rejection:
- Charge removed from ledger charges array
- **Balance recalculated** from remaining approved charges
- Ledger `last_updated` timestamp updated

### Balance Accuracy
- Every approval/rejection triggers full balance recalculation
- Ensures mathematical accuracy regardless of previous state
- Self-correcting system prevents balance drift

## Error Handling

### Permission Errors
```json
{
  "error": "Insufficient permissions. Only school administrators or system administrators can approve charges."
}
```

```json
{
  "error": "Insufficient permissions. Only school administrators or system administrators can reject charges."
}
```

### Status Validation Errors
```json
{
  "error": "Flight charge is already approved"
}
```

```json
{
  "error": "Cannot reject an approved charge. Consider creating a credit entry instead."
}
```

### Validation Errors
```json
{
  "error": "Reason for rejection is required and must be a non-empty string"
}
```

```json
{
  "error": "Invalid JSON in request body"
}
```

## Use Cases

### Typical Approval Workflow
1. Instructor creates flight charge (status: "pending")
2. School admin or system admin reviews charge details
3. Admin calls approve endpoint
4. Student ledger balance automatically updated
5. Student sees approved charge in their billing

### Charge Correction Workflow
1. Instructor creates incorrect flight charge
2. School admin or system admin reviews and identifies error
3. Admin calls reject endpoint with reason
4. Instructor creates corrected charge
5. Admin approves corrected charge

### System Admin Override
1. School admin rejects a valid charge by mistake
2. System admin reviews the situation
3. System admin can create new corrected charge
4. System admin approves the corrected charge
5. Balance automatically recalculated

## Security Features

- **Hierarchical access control**: School admins and system admins
- **API key validation**: Prevents unauthorized access
- **JWT authentication**: Verifies user identity
- **Audit trail**: Tracks all approval/rejection actions with user information
- **Comprehensive logging**: Detailed operation logs

## Integration with Existing System

These endpoints complement the existing PUT endpoint:
- **Legacy support**: Existing PUT endpoint with actions still works
- **Improved UX**: Dedicated endpoints provide cleaner API design
- **Same functionality**: Both approaches provide identical results
- **Consistent behavior**: Both use same ledger integration logic

Choose the approach that best fits your frontend architecture. 
# Flight Charges & Student Ledger Integration

## Overview
The Flight Charges and Student Ledger systems are fully integrated to provide accurate financial tracking for flight training activities. This integration ensures that only approved charges affect student balances while maintaining complete audit trails for all financial transactions.

**🔑 Key Business Rule:** Only **approved** charges affect student balances. Pending charges are tracked but do not impact billing until approved.

**⚖️ Balance Accuracy:** The system automatically recalculates balances from scratch whenever charge statuses change, ensuring mathematical accuracy and preventing balance drift.

## Integration Architecture

### Automatic Ledger Management
- **Auto-Creation** - Student ledgers are created automatically when first charge is added
- **Real-Time Updates** - Ledger changes occur immediately with charge status changes
- **Balance Recalculation** - Complete balance recalculation on every status change
- **Audit Logging** - Comprehensive logging of all integration actions

### Financial Workflow
```
Charge Created (Pending) → Added to Ledger → Balance UNCHANGED
Charge Approved → Balance RECALCULATED from ALL approved charges
Charge Rejected → Removed from Ledger → Balance RECALCULATED
Charge Deleted → Removed from Ledger → Balance RECALCULATED
```

## Integration Points

### 1. Flight Charge Creation Integration
**Triggered by:** `POST /api/schools/{schoolId}/students/{studentId}/flight-charges`

**Process:**
1. Flight charge created with "pending" status
2. Student ledger auto-created if it doesn't exist
3. Charge ID added to ledger's `charges` array
4. **Balance remains unchanged** (pending charges don't affect balance)
5. Ledger `last_updated` timestamp updated

**Ledger Auto-Creation Structure:**
```json
{
  "school_id": "ObjectId",
  "student_id": "ObjectId",
  "balance": 0.00,
  "charges": ["newChargeId"],
  "payments": [],
  "last_updated": "2024-01-15T10:30:00.000Z",
  "created_at": "2024-01-15T10:30:00.000Z"
}
```

**API Response Enhancement:**
```json
{
  "message": "Flight charge created successfully and added to student ledger",
  "charge": {
    "_id": "64a1b2c3d4e5f6789012999",
    "amount": 225.00,
    "status": "pending"
    // ... other charge fields
  }
}
```

### 2. Flight Charge Approval Integration
**Triggered by:** 
- `PUT /api/schools/{schoolId}/students/{studentId}/flight-charges/{chargeId}` with `{"action": "approve"}`
- `PATCH /api/schools/{schoolId}/flight-charges/{chargeId}/approve`

**Enhanced Process:**
1. Charge status updated to "approved"
2. **Complete balance recalculation** from ALL approved charges
3. Ledger balance updated with recalculated amount
4. Audit log entry created
5. `approved_by` and `approved_at` fields populated

**Balance Recalculation Logic:**
```javascript
// Pseudocode for balance calculation
const approvedCharges = await FlightCharge.find({
  student_id: studentId,
  status: 'approved'
});

const newBalance = approvedCharges.reduce((sum, charge) => sum + charge.amount, 0);
await ledger.updateOne({ balance: newBalance });
```

**API Response Enhancement:**
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
      "role": "school_admin"
    },
    "approved_at": "2024-01-15T14:30:00.000Z"
  }
}
```

### 3. Flight Charge Rejection Integration
**Triggered by:**
- `PUT /api/schools/{schoolId}/students/{studentId}/flight-charges/{chargeId}` with `{"action": "reject"}`
- `PATCH /api/schools/{schoolId}/flight-charges/{chargeId}/reject`

**Enhanced Process:**
1. Charge status updated to "rejected"
2. Charge removed from ledger's `charges` array
3. **Balance recalculated** from remaining approved charges
4. Rejection reason and audit trail recorded

**API Response Enhancement:**
```json
{
  "message": "Flight charge rejected successfully and ledger balance updated",
  "charge": {
    "_id": "64a1b2c3d4e5f6789012999",
    "amount": 225.00,
    "status": "rejected",
    "reason_rejected": "Flight was canceled due to weather conditions"
  }
}
```

### 4. Flight Charge Deletion Integration
**Triggered by:** `DELETE /api/schools/{schoolId}/students/{studentId}/flight-charges/{chargeId}`

**Enhanced Process:**
1. Charge permanently removed from database
2. Charge removed from ledger's `charges` array
3. **Balance recalculated** if charge was previously approved
4. Complete financial record cleanup

**API Response Enhancement:**
```json
{
  "message": "Flight charge deleted successfully and ledger balance recalculated",
  "charge_id": "64a1b2c3d4e5f6789012999"
}
```

## Balance Accuracy System

### Automatic Recalculation Engine
Every charge status change triggers a complete balance recalculation:

**Process:**
1. **Query all approved charges** for the student
2. **Calculate total amount** from approved charges only
3. **Update ledger balance** with calculated amount
4. **Log recalculation** for audit trail
5. **Verify data integrity** with cross-validation

**Benefits:**
- **Self-Correcting** - Automatically fixes balance discrepancies
- **Mathematically Accurate** - Always reflects true approved charge total
- **Audit Compliant** - Complete logging of all balance changes
- **Error Resistant** - Handles system errors and data inconsistencies

### Manual Recalculation Endpoint
**Endpoint:** `POST /api/schools/{schoolId}/students/{studentId}/ledger/recalculate`

**Purpose:** Administrative tool for balance verification and correction

**Access Control:** School administrators and system administrators only

**Use Cases:**
- Periodic balance verification
- Resolving reported discrepancies
- Data migration validation
- Audit compliance checks
- Financial reconciliation

**Request:**
```bash
POST /api/schools/68389c818d13949c514ac59c/students/6841e28c8d13949c514ac6dd/ledger/recalculate
Authorization: Bearer {jwt_token}
X-API-Key: {api_key}
```

**Response:**
```json
{
  "message": "Ledger balance recalculated successfully",
  "recalculation": {
    "old_balance": 450.00,
    "new_balance": 475.00,
    "difference": 25.00,
    "approved_charges_count": 3,
    "total_charges_in_ledger": 5,
    "recalculated_at": "2024-01-15T16:45:00.000Z"
  }
}
```

## Business Logic Rules

### Balance Calculation Rules
| Charge Status | Affects Balance | In Charges Array | Description |
|---------------|----------------|------------------|-------------|
| **Pending** | ❌ No | ✅ Yes | Tracked but not billed |
| **Approved** | ✅ Yes | ✅ Yes | Added to student balance |
| **Rejected** | ❌ No | ❌ No | Removed from all tracking |
| **Deleted** | ❌ No* | ❌ No | *Unless previously approved |

### Ledger Array Management
**The `charges` array contains:**
- ✅ All pending charge IDs (for tracking)
- ✅ All approved charge IDs (for billing)
- ❌ NO rejected charge IDs
- ❌ NO deleted charge IDs

### Data Integrity Checks
- **Referential Integrity** - All charge IDs in ledger must exist
- **Balance Accuracy** - Balance must equal sum of approved charges
- **Status Consistency** - Ledger state must match charge statuses
- **Audit Trail** - All changes must be logged

## Error Handling

### Resilient Integration Design
The integration is designed to handle failures gracefully:

**Non-Fatal Errors:**
- Ledger update failure during charge creation - charge still created
- Balance calculation errors - logged for manual review
- Network timeouts - retry logic implemented

**Error Recovery:**
- Automatic retry for transient failures
- Manual recalculation for data inconsistencies
- Comprehensive error logging for debugging

### Common Error Scenarios

#### Ledger Creation Failure
```json
{
  "warning": "Charge created but ledger update failed",
  "charge_id": "64a1b2c3d4e5f6789012999",
  "action_required": "Manual ledger reconciliation recommended"
}
```

#### Balance Calculation Error
```json
{
  "error": "Balance recalculation failed",
  "ledger_id": "64a1b2c3d4e5f6789012998",
  "last_known_balance": 450.00,
  "recommended_action": "Use manual recalculation endpoint"
}
```

## Audit Logging

### Log Entry Structure
All integration actions generate detailed log entries:

```json
{
  "timestamp": "2024-01-15T14:30:00.000Z",
  "action": "charge_approved",
  "charge_id": "64a1b2c3d4e5f6789012999",
  "student_id": "6841e28c8d13949c514ac6dd",
  "school_id": "68389c818d13949c514ac59c",
  "amount": 225.00,
  "balance_before": 450.00,
  "balance_after": 675.00,
  "approved_charges_count": 4,
  "performed_by": "jane.admin@school.com"
}
```

### Log Categories
- **charge_created** - New charge added to ledger
- **charge_approved** - Charge approved, balance updated
- **charge_rejected** - Charge rejected, removed from ledger
- **charge_deleted** - Charge deleted, balance recalculated
- **balance_recalculated** - Manual balance recalculation
- **ledger_created** - Auto-creation of student ledger

## Use Cases & Scenarios

### Scenario 1: New Student First Flight
**Workflow:**
1. **Student Enrollment** - Student enrolled, no ledger exists
2. **First Charge Created** - Instructor creates $150 flight charge (pending)
3. **Auto-Ledger Creation** - System creates ledger with $0.00 balance
4. **Charge Tracking** - Charge ID added to charges array
5. **Charge Approval** - Admin approves charge
6. **Balance Update** - Balance becomes $150.00

**Result:** Student has accurate billing record from first transaction

### Scenario 2: Charge Correction Workflow
**Workflow:**
1. **Incorrect Charge** - $200 charge created incorrectly (pending)
2. **Balance Unchanged** - Student balance remains $0.00
3. **Charge Rejection** - Admin rejects with reason "Duplicate entry"
4. **Clean Removal** - Charge removed from ledger, balance stays $0.00
5. **Correct Charge** - New correct charge created for $125

**Result:** No billing impact from incorrect charges

### Scenario 3: Approved Charge Deletion
**Workflow:**
1. **Existing Balance** - Student has $500.00 balance from 3 approved charges
2. **Duplicate Found** - Admin finds duplicate $200 charge
3. **Charge Deletion** - Admin deletes duplicate charge
4. **Balance Recalculation** - System recalculates from remaining charges
5. **Updated Balance** - Balance becomes $300.00

**Result:** Accurate balance after removing duplicate billing

### Scenario 4: Balance Discrepancy Resolution
**Workflow:**
1. **Discrepancy Reported** - Student reports incorrect balance
2. **Manual Recalculation** - Admin uses recalculation endpoint
3. **Discrepancy Found** - Old balance $525.00, should be $500.00
4. **Automatic Correction** - System updates to correct balance
5. **Audit Trail** - Discrepancy and correction logged

**Result:** Balance accuracy restored with complete audit trail

## Integration Benefits

### 1. **Financial Accuracy**
- Only approved charges affect billing
- Real-time balance updates
- Mathematical precision guaranteed
- Self-correcting system design

### 2. **Operational Efficiency**
- Automatic ledger management
- No manual financial reconciliation required
- Immediate charge status visibility
- Streamlined approval workflows

### 3. **Audit Compliance**
- Complete transaction history
- Detailed change logging
- Balance verification tools
- Financial reconciliation support

### 4. **User Experience**
- Students see accurate balances
- Clear pending vs. billed amounts
- Reduced billing disputes
- Transparent financial tracking

### 5. **Data Integrity**
- Referential integrity maintained
- Consistent financial state
- Error detection and correction
- Reliable audit trails

This comprehensive integration ensures accurate, transparent, and auditable financial management for flight training operations while maintaining the flexibility to handle complex billing scenarios and corrections.

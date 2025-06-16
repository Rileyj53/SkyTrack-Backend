# Student Ledger API Documentation

## Overview
The Student Ledger API allows you to manage financial records for students including balances, charges, and payments. Each student can have one ledger per school that tracks their financial activity.

**🔒 Access Control:** Strict permissions ensure data privacy and security.

## Access Control

### Who Can Access Student Ledgers:

1. **👤 Students** - Can only view their own ledger (GET only)
2. **🏫 School Administrators** - Can view, create, and update ledgers for students in their school
3. **🔧 System Administrators** - Can view, create, update, and delete any ledger

### Permission Matrix:

| Role | GET (View) | POST (Create) | PUT (Update) | DELETE |
|------|------------|---------------|--------------|---------|
| Student | ✅ Own Only | ❌ | ❌ | ❌ |
| School Admin | ✅ School Only | ✅ | ✅ | ❌ |
| System Admin | ✅ All | ✅ | ✅ | ✅ |
| Instructor | ❌ | ❌ | ❌ | ❌ |

### Security Features:
- **API key validation** required for all requests
- **JWT authentication** verifies user identity and role
- **Role-based authorization** enforces access permissions
- **Resource-level permissions** prevent cross-school data access
- **403 Forbidden** returned for insufficient permissions

## Student Ledger Object

```json
{
  "_id": "ObjectId",
  "school_id": "ObjectId",
  "student_id": "ObjectId",
  "balance": -450.00,
  "charges": ["ObjectId", "ObjectId"],
  "payments": [
    {
      "payment_id": "stripe_pi_1234567890",
      "amount": 200.00,
      "timestamp": "2024-01-15T10:30:00.000Z",
      "payment_method": "stripe",
      "notes": "Online payment via credit card"
    },
    {
      "payment_id": "manual_entry_001",
      "amount": 100.00,
      "timestamp": "2024-01-16T14:20:00.000Z",
      "payment_method": "cash",
      "notes": "Cash payment at front desk"
    }
  ],
  "last_updated": "2024-01-16T14:25:00.000Z",
  "created_at": "2024-01-10T08:00:00.000Z",
  "updated_at": "2024-01-16T14:25:00.000Z"
}
```

## Endpoints

### GET /api/schools/{schoolId}/students/{studentId}/ledger
Retrieve a student's ledger with all populated data.

**Access Control:**
- **Students:** Can only access their own ledger
- **School Admins:** Can access ledgers of students in their school
- **System Admins:** Can access any ledger

**Responses:**
- `200` - Success with populated ledger data
- `401` - Unauthorized (invalid API key or token)
- `403` - Forbidden (insufficient permissions)
- `404` - Student or ledger not found

**Example Error Responses:**
```json
{
  "error": "Students can only access their own ledger"
}
```

```json
{
  "error": "Insufficient permissions to access student ledger"
}
```

### POST /api/schools/{schoolId}/students/{studentId}/ledger
Create a new student ledger.

**Access Control:**
- **Students:** ❌ Cannot create ledgers
- **School Admins:** ✅ Can create ledgers for students in their school
- **System Admins:** ✅ Can create any ledger

**Required Parameters:**
- `schoolId` - ObjectId of the school
- `studentId` - ObjectId of the student

**Optional Body Fields:**
- `balance` - Number (can be negative, default: 0.00)
- `charges` - Array of ObjectIds referencing charge records
- `payments` - Array of payment objects

**Payment Object Structure:**
```json
{
  "payment_id": "string", // Required: unique identifier (e.g., Stripe payment ID)
  "amount": 100.00, // Required: positive number
  "timestamp": "2024-01-15T10:30:00.000Z", // Optional: defaults to current time
  "payment_method": "stripe", // Optional: 'stripe', 'cash', 'check', 'bank_transfer', 'credit_card', 'other'
  "notes": "Payment description" // Optional: additional notes
}
```

**Example Request:**
```json
{
  "balance": -150.00,
  "charges": ["64a1b2c3d4e5f6789012345", "64a1b2c3d4e5f6789012346"],
  "payments": [
    {
      "payment_id": "stripe_pi_1234567890",
      "amount": 200.00,
      "timestamp": "2024-01-15T10:30:00.000Z",
      "payment_method": "stripe",
      "notes": "Online payment"
    }
  ]
}
```

**Responses:**
- `201` - Ledger created successfully
- `400` - Validation error
- `401` - Unauthorized
- `403` - Forbidden (insufficient permissions)
- `404` - Student not found
- `409` - Ledger already exists

**Example Error Response:**
```json
{
  "error": "Insufficient permissions. Only school administrators or system administrators can create ledgers."
}
```

### PUT /api/schools/{schoolId}/students/{studentId}/ledger
Update an existing student ledger.

**Access Control:**
- **Students:** ❌ Cannot update ledgers
- **School Admins:** ✅ Can update ledgers for students in their school
- **System Admins:** ✅ Can update any ledger

**Optional Body Fields:**
- `balance` - Number (can be negative)
- `charges` - Array of ObjectIds
- `payments` - Array of payment objects

**Common Use Cases:**

#### Adding a New Payment:
```json
{
  "payments": [
    {
      "payment_id": "stripe_pi_9876543210",
      "amount": 150.00,
      "payment_method": "stripe",
      "notes": "Monthly payment"
    }
  ]
}
```

#### Updating Balance:
```json
{
  "balance": -300.00
}
```

#### Adding Charges:
```json
{
  "charges": ["64a1b2c3d4e5f6789012350", "64a1b2c3d4e5f6789012351"]
}
```

**Responses:**
- `200` - Ledger updated successfully
- `400` - Validation error
- `401` - Unauthorized
- `403` - Forbidden (insufficient permissions)
- `404` - Ledger not found

**Example Error Response:**
```json
{
  "error": "Insufficient permissions. Only school administrators or system administrators can update ledgers."
}
```

### DELETE /api/schools/{schoolId}/students/{studentId}/ledger
Delete a student ledger. **Restricted to system administrators only.**

**Access Control:**
- **Students:** ❌ Cannot delete ledgers
- **School Admins:** ❌ Cannot delete ledgers
- **System Admins:** ✅ Can delete any ledger

**Responses:**
- `200` - Ledger deleted successfully
- `401` - Unauthorized
- `403` - Insufficient permissions (only system admins)
- `404` - Ledger not found

## Validation Rules

### Balance
- Must be a number (can be negative for outstanding balances)
- No minimum or maximum limits

### Charges
- Must be an array of valid ObjectIds
- Each ObjectId must reference an existing charge record

### Payments
- Each payment must have `payment_id` and `amount`
- `amount` must be a positive number
- `timestamp` must be a valid ISO date string (optional)
- `payment_method` must be one of: 'stripe', 'cash', 'check', 'bank_transfer', 'credit_card', 'other'

### Business Rules
- Each student can have only one ledger per school
- Ledgers automatically track `last_updated` timestamp
- Only system administrators can delete ledgers
- Student must exist and belong to the specified school

## Payment Methods

Supported payment methods:
- `stripe` - Online payments via Stripe
- `cash` - Cash payments
- `check` - Check payments
- `bank_transfer` - Bank transfers
- `credit_card` - Direct credit card payments
- `other` - Other payment methods

## Error Handling

All endpoints return appropriate HTTP status codes:
- `200` - Success
- `201` - Created
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (invalid API key or authentication)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found (student or ledger not found)
- `409` - Conflict (ledger already exists)
- `500` - Internal Server Error

Error responses include a JSON object with an `error` field:
```json
{
  "error": "Student not found in this school"
}
```

## Use Cases

### 1. Create Initial Ledger
```json
POST /api/schools/68389c818d13949c514ac59c/students/6841e28c8d13949c514ac6dd/ledger
{
  "balance": 0.00
}
```

### 2. Record Stripe Payment
```json
PUT /api/schools/68389c818d13949c514ac59c/students/6841e28c8d13949c514ac6dd/ledger
{
  "payments": [
    {
      "payment_id": "pi_1234567890",
      "amount": 300.00,
      "payment_method": "stripe",
      "notes": "Online payment for flight training"
    }
  ]
}
```

### 3. Add Cash Payment
```json
PUT /api/schools/68389c818d13949c514ac59c/students/6841e28c8d13949c514ac6dd/ledger
{
  "payments": [
    {
      "payment_id": "cash_receipt_001",
      "amount": 50.00,
      "payment_method": "cash",
      "notes": "Fuel surcharge payment"
    }
  ]
}
```

### 4. Update Balance After Charges
```json
PUT /api/schools/68389c818d13949c514ac59c/students/6841e28c8d13949c514ac6dd/ledger
{
  "balance": -450.00,
  "charges": ["64a1b2c3d4e5f6789012349", "64a1b2c3d4e5f6789012350"]
}
```

## Security Features

- API key validation required for all endpoints
- JWT authentication required
- Student-school relationship validation
- System admin permission required for DELETE operations
- Input validation and sanitization
- MongoDB injection protection 
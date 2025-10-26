# Flight Invoice API Documentation

## Overview
The Flight Invoice API provides detailed itemized billing for flight training activities. This system allows you to create invoices with multiple line items (aircraft rental, instruction, fees, etc.) before converting them to flight charges in the student ledger.

**🔗 Integration:** Flight Invoices replace the Flight Charges system and integrate seamlessly with the Student Ledger system.

## Flight Invoice Workflow

1. **Create Invoice** - Generate invoice from flight schedule with line items (status: `draft`)
2. **Edit Invoice** - Modify line items, rates, and details (draft status only)
3. **Finalize Invoice** - Submit invoice for approval (status changes to `pending`)
4. **Approve/Reject** - Admin approves or rejects with reason (status: `approved` or `rejected`)
5. **Add to Ledger** - Approved invoices automatically added to student ledger

## Flight Invoice Object

```json
{
  "_id": "ObjectId",
  "flight_schedule_id": "ObjectId",
  "school_id": "ObjectId",
  "student_id": "ObjectId",
  "plane_id": "ObjectId",
  "instructor_id": "ObjectId",
  
  "invoice_number": "INV-2024-000123",
  "invoice_date": "2024-01-15T10:00:00.000Z",
  "due_date": "2024-02-15T00:00:00.000Z",
  
  "line_items": [
    {
      "name": "Aircraft Rental (Wet)",
      "description": "N123AB - Cessna 172 (1.5h)",
      "quantity": 1.5,
      "unit_rate": 120.00,
      "total_amount": 180.00,
      "notes": "Includes fuel"
    },
    {
      "name": "Flight Instruction",
      "description": "Flight Instruction (1.5h)",
      "quantity": 1.5,
      "unit_rate": 60.00,
      "total_amount": 90.00
    },
    {
      "name": "Platform Fee",
      "description": "Platform Fee (5% of flight costs)",
      "quantity": 1,
      "unit_rate": 13.50,
      "total_amount": 13.50
    }
  ],
  
  "subtotal": 283.50,
  "tax_rate": 8.5,
  "tax_amount": 24.10,
  "total_amount": 307.60,
  "currency": "USD",
  
  "status": "draft", // draft, pending, approved, rejected
  "reason_rejected": null,
  "approved_by": null,
  "approved_at": null,
  
  "created_by": "ObjectId",
  "sent_at": null,
  "paid_at": null,
  "notes": "Standard training flight",
  
  "created_at": "2024-01-15T10:00:00.000Z",
  "updated_at": "2024-01-15T10:00:00.000Z"
}
```

## Line Item Object

```json
{
  "name": "Aircraft Rental (Wet)",
  "description": "N123AB - Cessna 172 (1.5h)",
  "quantity": 1.5,
  "unit_rate": 120.00,
  "total_amount": 180.00,
  "notes": "Optional additional notes"
}
```

## Endpoints

### POST /api/schools/{schoolId}/students/{studentId}/flight-invoices
Create a new flight invoice for a completed flight.

**Required Fields:**
- `flight_schedule_id` - ObjectId of the flight schedule

**Optional Fields:**
- `line_items` - Array of line items (auto-generated if not provided)
- `tax_rate` - Tax percentage (0-100)
- `currency` - Currency code (default: "USD")
- `due_date` - Payment due date (ISO string)
- `notes` - Additional notes

**Example Request (Auto-generate line items):**
```json
{
  "flight_schedule_id": "64a1b2c3d4e5f6789012345",
  "tax_rate": 8.5,
  "due_date": "2024-02-15T00:00:00.000Z",
  "notes": "Standard training flight"
}
```

**Example Request (Custom line items):**
```json
{
  "flight_schedule_id": "64a1b2c3d4e5f6789012345",
  "line_items": [
    {
      "name": "Aircraft Rental",
      "description": "N123AB - Cessna 172 (1.5h)",
      "quantity": 1.5,
      "unit_rate": 120.00
    },
    {
      "name": "Flight Instruction",
      "description": "Dual instruction (1.5h)",
      "quantity": 1.5,
      "unit_rate": 65.00
    },
    {
      "name": "Landing Fees",
      "description": "Airport landing fees",
      "quantity": 2,
      "unit_rate": 15.00
    }
  ],
  "tax_rate": 8.5,
  "currency": "USD"
}
```

**Responses:**
- `201` - Invoice created successfully
- `400` - Validation error
- `404` - Flight schedule not found
- `409` - Invoice already exists for this flight

### GET /api/schools/{schoolId}/students/{studentId}/flight-invoices
List flight invoices for a student with filtering and pagination.

**Query Parameters:**
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 50)
- `status` - Filter by status
- `start_date` - Filter by invoice date (ISO string)
- `end_date` - Filter by invoice date (ISO string)
- `flight_schedule_id` - Filter by specific flight schedule

**Example Response:**
```json
{
  "invoices": [
    {
      "_id": "64a1b2c3d4e5f6789012349",
      "invoice_number": "INV-2024-000123",
      "invoice_date": "2024-01-15T10:00:00.000Z",
      "total_amount": 307.60,
      "status": "pending",
      "flight_schedule_id": {
        "scheduled_start_time": "2024-01-15T10:00:00.000Z",
        "flight_type": "Training"
      },
      "plane_id": {
        "registration": "N123AB",
        "type": "Cessna 172"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 15,
    "pages": 1
  },
  "summary": {
    "draft": {
      "count": 3,
      "totalAmount": 850.00
    },
    "pending": {
      "count": 10,
      "totalAmount": 2340.00
    },
    "sent": {
      "count": 2,
      "totalAmount": 615.00
    }
  }
}
```

### GET /api/schools/{schoolId}/students/{studentId}/flight-invoices/{invoiceId}
Get a specific flight invoice with all populated data.

### PUT /api/schools/{schoolId}/students/{studentId}/flight-invoices/{invoiceId}
Update a flight invoice. Only draft invoices can have their line items modified.

**Editable Fields (draft status only):**
- `line_items` - Array of line items
- `tax_rate` - Tax percentage
- `currency` - Currency code
- `due_date` - Payment due date
- `notes` - Additional notes

**Status Updates (all statuses):**
- `status` - Update invoice status (with validation)

**Example Request (Update line items):**
```json
{
  "line_items": [
    {
      "name": "Aircraft Rental (Wet)",
      "description": "N123AB - Cessna 172 (2.0h)",
      "quantity": 2.0,
      "unit_rate": 120.00
    },
    {
      "name": "Flight Instruction",
      "description": "Dual instruction (2.0h)",
      "quantity": 2.0,
      "unit_rate": 65.00
    }
  ],
  "tax_rate": 10.0
}
```

**Example Request (Update status):**
```json
{
  "status": "sent"
}
```

### POST /api/schools/{schoolId}/students/{studentId}/flight-invoices/{invoiceId}/finalize
Submit a draft invoice for approval (changes status to pending).

**Permission Requirements:**
- Students, instructors, and administrators can finalize their invoices
- System administrators can finalize any invoice

**Business Rules:**
- Only draft invoices can be finalized
- Changes status from "draft" to "pending"
- Pending invoices await admin approval

**Example Response:**
```json
{
  "message": "Invoice submitted for approval successfully",
  "invoice": {
    "_id": "64a1b2c3d4e5f6789012349",
    "status": "pending",
    "updated_at": "2024-01-15T16:00:00.000Z"
  }
}
```

### POST /api/schools/{schoolId}/students/{studentId}/flight-invoices/{invoiceId}/approve
Approve a pending invoice and add it to the student ledger.

**Permission Requirements:**
- School administrators can approve invoices
- System administrators can approve invoices

**Business Rules:**
- Only pending invoices can be approved
- Approved invoices are automatically added to student ledger
- Changes status from "pending" to "approved"

**Example Response:**
```json
{
  "message": "Invoice approved successfully and added to student ledger",
  "invoice": {
    "_id": "64a1b2c3d4e5f6789012349",
    "status": "approved",
    "approved_by": {
      "first_name": "Admin",
      "last_name": "User",
      "email": "admin@example.com",
      "role": "school_admin"
    },
    "approved_at": "2024-01-15T16:00:00.000Z"
  }
}
```

### POST /api/schools/{schoolId}/students/{studentId}/flight-invoices/{invoiceId}/reject
Reject a pending invoice with a reason.

**Permission Requirements:**
- School administrators can reject invoices
- System administrators can reject invoices

**Required Fields:**
- `reason_rejected` - Explanation for rejection

**Business Rules:**
- Only pending invoices can be rejected
- Changes status from "pending" to "rejected"
- Rejected invoices can be edited and resubmitted

**Example Request:**
```json
{
  "reason_rejected": "Incorrect flight duration - please update and resubmit"
}
```

**Example Response:**
```json
{
  "message": "Invoice rejected successfully",
  "invoice": {
    "_id": "64a1b2c3d4e5f6789012349",
    "status": "rejected",
    "reason_rejected": "Incorrect flight duration - please update and resubmit",
    "approved_by": {
      "first_name": "Admin",
      "last_name": "User",
      "email": "admin@example.com",
      "role": "school_admin"
    },
    "approved_at": "2024-01-15T16:00:00.000Z"
  }
}
```

### DELETE /api/schools/{schoolId}/students/{studentId}/flight-invoices/{invoiceId}
Delete a flight invoice.

**Permission Requirements:**
- School administrators can delete draft/cancelled invoices
- System administrators can delete any invoice

**Business Rules:**
- Only draft or cancelled invoices can be deleted
- Cannot delete finalized invoices (those with flight_charge_id)

## Invoice Status Workflow

### Status Transitions

| From | To | Description |
|------|-----|-------------|
| draft | pending | Manual status update |
| draft | cancelled | Cancel before finalization |
| pending | sent | Invoice sent to student |
| pending | cancelled | Cancel after pending |
| sent | paid | Payment received |
| sent | overdue | Past due date |
| sent | cancelled | Cancel after sending |
| overdue | paid | Payment received (late) |
| overdue | cancelled | Cancel overdue invoice |

### Status Timestamps
- `sent` → Sets `sent_at` timestamp
- `paid` → Sets `paid_at` timestamp

## Auto-Generated Line Items

When no line items are provided, the system auto-generates them based on:

1. **Aircraft Rental** - From plane hourly rates (wet/dry)
2. **Flight Instruction** - If instructor present, from instruction rates
3. **Platform Fee** - Percentage of flight costs (configurable)

**Default Rates:**
- Aircraft Rental: $120/hour (if no plane rates configured)
- Flight Instruction: $60/hour (if no instruction rates configured)
- Platform Fee: 5% of flight costs

## Validation Rules

### Line Items
- `name` - Required, max 100 characters
- `description` - Required, max 500 characters
- `quantity` - Required, non-negative number
- `unit_rate` - Required, non-negative number
- `notes` - Optional, max 250 characters

### Invoice
- Must have at least one line item
- Tax rate: 0-100%
- Currency: USD, EUR, GBP, CAD, AUD, JPY
- Only one invoice per flight schedule

### Business Rules
- Invoice number auto-generated: `INV-YYYY-NNNNNN`
- Totals calculated automatically
- Only draft invoices can be edited
- Finalization creates approved flight charge

## Integration with Existing Systems

### Flight Charges
- Finalized invoices create approved flight charges
- Rate type set to "other" for itemized invoices
- Duration calculated from line items or flight schedule

### Student Ledger
- Approved charges immediately affect balance
- Charge reference added to charges array
- Creates ledger if it doesn't exist

### Flight Schedule
- Invoice linked to completed flight schedule
- Uses actual or scheduled duration
- Prevents duplicate invoices

## Example Use Cases

### 1. Standard Training Flight Invoice
```json
POST /api/schools/68389c818d13949c514ac59c/students/6841e28c8d13949c514ac6dd/flight-invoices
{
  "flight_schedule_id": "64a1b2c3d4e5f6789012345",
  "tax_rate": 8.5
}
```

### 2. Custom Line Items with Fees
```json
{
  "flight_schedule_id": "64a1b2c3d4e5f6789012345",
  "line_items": [
    {
      "name": "Aircraft Rental (Dry)",
      "description": "N456CD - Piper Cherokee (2.0h)",
      "quantity": 2.0,
      "unit_rate": 95.00
    },
    {
      "name": "Fuel Surcharge",
      "description": "Current fuel prices",
      "quantity": 20,
      "unit_rate": 6.50
    },
    {
      "name": "Night Flying Fee",
      "description": "Additional night operations fee",
      "quantity": 1,
      "unit_rate": 25.00
    }
  ]
}
```

### 3. Finalize and Convert to Charge
```json
POST /api/schools/68389c818d13949c514ac59c/students/6841e28c8d13949c514ac6dd/flight-invoices/64a1b2c3d4e5f6789012349/finalize
```

## Error Handling

Common error responses:

```json
{
  "error": "Only draft invoices can be finalized"
}
```

```json
{
  "error": "Invoice already exists for this flight schedule"
}
```

```json
{
  "error": "Each line item must have name, description, quantity, and unit_rate"
}
```

## Security Features

- API key validation required
- JWT authentication required
- Role-based permissions for finalization
- Student-school relationship validation
- Flight schedule ownership validation
- Input validation and sanitization 
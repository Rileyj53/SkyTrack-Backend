# Students API Documentation

## Overview
The Students API manages student records within flight schools, including enrollment, progress tracking, contact information, and academic progression through flight training programs.

## Access Control

### Role-Based Permissions:

| Role | List Students | Create Student | View Student | Update Student | Delete Student |
|------|---------------|----------------|--------------|----------------|----------------|
| **Student** | ❌ | ❌ | ✅ Own Only | ✅ Own Only | ❌ |
| **Instructor** | ✅ School Only | ❌ | ✅ School Only | ❌ | ❌ |
| **School Admin** | ✅ School Only | ✅ | ✅ School Only | ✅ School Only | ✅ School Only |
| **System Admin** | ✅ All Schools | ✅ | ✅ All | ✅ All | ✅ All |

### Security Features:
- **API key validation** required for all requests
- **JWT authentication** verifies user identity and role
- **School-scoped access** prevents cross-school data access
- **Self-service restrictions** for students (own records only)

## Student Object

```json
{
  "_id": "ObjectId",
  "school_id": "ObjectId",
  "user_id": "ObjectId", // Optional - links to User account
  "contact_email": "student@email.com",
  "phone": "+1-555-0123",
  "certifications": ["Private Pilot", "Instrument Rating"],
  "license_number": "P12345678",
  "emergency_contact": {
    "name": "John Doe",
    "phone": "+1-555-0124",
    "relationship": "Father"
  },
  "enrollmentDate": "2024-01-15T00:00:00.000Z",
  "program": "Private Pilot License",
  "status": "Active",
  "stage": "Solo Phase",
  "nextMilestone": "First Solo Flight",
  "notes": "Excellent progress in navigation skills",
  "studentNotes": [
    {
      "_id": "ObjectId",
      "student_id": "ObjectId",
      "title": "Flight Review Session",
      "content": "Reviewed stall recovery procedures",
      "created_at": "2024-01-20T10:30:00.000Z",
      "updated_at": "2024-01-20T10:30:00.000Z"
    }
  ],
  "progress": {
    "requirements": [
      {
        "name": "Dual Instruction",
        "total_hours": 40,
        "completed_hours": 25,
        "type": "flight_time"
      },
      {
        "name": "Solo Flight Time",
        "total_hours": 10,
        "completed_hours": 3,
        "type": "solo_time"
      }
    ],
    "milestones": [
      {
        "name": "First Solo Flight",
        "description": "Complete first supervised solo flight",
        "order": 1,
        "completed": false
      }
    ],
    "stages": [
      {
        "name": "Ground School",
        "description": "Complete theoretical knowledge requirements",
        "order": 1,
        "completed": true
      },
      {
        "name": "Solo Phase",
        "description": "Build solo flight experience",
        "order": 2,
        "completed": false
      }
    ],
    "lastUpdated": "2024-01-20T15:45:00.000Z"
  },
  "created_at": "2024-01-15T08:00:00.000Z",
  "updated_at": "2024-01-20T15:45:00.000Z"
}
```

## Endpoints

### GET /api/schools/{schoolId}/students
List all students for a specific school.

**Access Control:**
- **Students:** ❌ Cannot list other students
- **Instructors:** ✅ Can list students in their school
- **School Admins:** ✅ Can list students in their school  
- **System Admins:** ✅ Can list students in any school

**Path Parameters:**
- `schoolId` - ObjectId of the school

**Response:**
```json
{
  "students": [
    {
      "_id": "6841e28c8d13949c514ac6dd",
      "school_id": "68389c818d13949c514ac59c",
      "contact_email": "john.student@email.com",
      "program": "Private Pilot License",
      "status": "Active",
      "user_id": {
        "first_name": "John",
        "last_name": "Student",
        "email": "john.student@email.com",
        "role": "student"
      }
      // ... other fields
    }
  ]
}
```

**Error Responses:**
- `401` - Unauthorized (invalid API key or token)
- `403` - Access denied (insufficient permissions)
- `400` - Invalid school ID format
- `500` - Internal server error

### POST /api/schools/{schoolId}/students
Create a new student for a school.

**Access Control:**
- **Students:** ❌ Cannot create student records
- **Instructors:** ❌ Cannot create student records
- **School Admins:** ✅ Can create students in their school
- **System Admins:** ✅ Can create students in any school

**Required Fields:**
- `contact_email` - Student's contact email address
- `program` - Program name (must exist in school's programs)

**Optional Fields:**
- `user_id` - ObjectId linking to User account
- `phone` - Contact phone number
- `certifications` - Array of existing certifications
- `license_number` - Pilot license number
- `emergency_contact` - Emergency contact object
- `enrollmentDate` - Enrollment date (defaults to current date)
- `status` - Student status (defaults to "Active")
- `stage` - Current training stage
- `nextMilestone` - Next milestone to achieve
- `notes` - General notes about the student
- `studentNotes` - Array of detailed note objects

**Example Request:**
```json
{
  "contact_email": "jane.pilot@email.com",
  "phone": "+1-555-0125",
  "program": "Private Pilot License",
  "emergency_contact": {
    "name": "Mary Pilot",
    "phone": "+1-555-0126", 
    "relationship": "Mother"
  },
  "enrollmentDate": "2024-01-15T00:00:00.000Z",
  "notes": "Highly motivated student with previous aviation experience"
}
```

**Response:**
```json
{
  "message": "Student created successfully",
  "student": {
    "_id": "6841e28c8d13949c514ac6dd",
    "school_id": "68389c818d13949c514ac59c",
    "contact_email": "jane.pilot@email.com",
    "program": "Private Pilot License",
    "status": "Active",
    "stage": "Ground School",
    "nextMilestone": "Written Exam",
    "progress": {
      "requirements": [
        {
          "name": "Dual Instruction",
          "total_hours": 40,
          "completed_hours": 0,
          "type": "flight_time"
        }
      ],
      "milestones": [
        {
          "name": "Written Exam",
          "description": "Pass FAA written examination",
          "order": 1,
          "completed": false
        }
      ],
      "stages": [
        {
          "name": "Ground School", 
          "description": "Complete theoretical knowledge requirements",
          "order": 1,
          "completed": false
        }
      ]
    }
    // ... other populated fields
  }
}
```

**Automatic Progress Initialization:**
When a student is created, the system automatically:
1. **Looks up the specified program** in the school's program database
2. **Initializes progress tracking** with program requirements, milestones, and stages
3. **Sets initial stage and milestone** from program configuration
4. **Creates completion tracking** for all program elements

**Error Responses:**
- `400` - Missing required fields or invalid school ID format
- `401` - Unauthorized (invalid API key or token)
- `403` - Insufficient permissions
- `404` - Program not found for this school
- `500` - Internal server error

### GET /api/schools/{schoolId}/students/{studentId}
Get a specific student by ID.

**Access Control:**
- **Students:** ✅ Can only view their own record
- **Instructors:** ✅ Can view students in their school
- **School Admins:** ✅ Can view students in their school
- **System Admins:** ✅ Can view any student

**Path Parameters:**
- `schoolId` - ObjectId of the school
- `studentId` - ObjectId of the student

**Response:**
```json
{
  "_id": "6841e28c8d13949c514ac6dd",
  "school_id": "68389c818d13949c514ac59c",
  "user_id": {
    "first_name": "John",
    "last_name": "Student", 
    "email": "john.student@email.com",
    "role": "student"
  },
  "contact_email": "john.student@email.com",
  "phone": "+1-555-0123",
  "program": "Private Pilot License",
  "status": "Active",
  "progress": {
    // ... complete progress tracking
  }
  // ... all other student fields
}
```

**Error Responses:**
- `400` - Invalid student ID format
- `401` - Unauthorized
- `403` - Access denied (insufficient permissions)
- `404` - Student not found
- `500` - Internal server error

### PUT /api/schools/{schoolId}/students/{studentId}
Update a student's information.

**Access Control:**
- **Students:** ✅ Can only update their own record
- **Instructors:** ❌ Cannot update student records
- **School Admins:** ✅ Can update students in their school
- **System Admins:** ✅ Can update any student

**Path Parameters:**
- `schoolId` - ObjectId of the school
- `studentId` - ObjectId of the student

**Updatable Fields:**
- `contact_email` - Contact email address
- `phone` - Phone number
- `certifications` - Array of certifications
- `license_number` - Pilot license number
- `emergency_contact` - Emergency contact object
- `enrollmentDate` - Enrollment date
- `program` - Training program
- `status` - Student status
- `stage` - Current training stage
- `nextMilestone` - Next milestone
- `notes` - General notes
- `progress` - Progress tracking object
- `studentNotes` - Array of note objects

**Example Request:**
```json
{
  "phone": "+1-555-0127",
  "status": "Active",
  "stage": "Solo Phase",
  "nextMilestone": "Cross Country Solo",
  "notes": "Progressing well, ready for solo cross-country",
  "studentNotes": [
    {
      "title": "Solo Flight Review",
      "content": "Completed first solo flight successfully. Excellent aircraft control and decision making.",
      "created_at": "2024-01-25T14:30:00.000Z"
    }
  ]
}
```

**Special Note Handling:**
The system automatically handles student notes by:
- **Removing temporary IDs** from new notes
- **Preserving existing notes** with valid MongoDB ObjectIds
- **Adding timestamps** to new notes
- **Linking notes** to the student record

**Response:**
```json
{
  "message": "Student updated successfully",
  "student": {
    // ... updated student object with all fields
  },
  "status": "success"
}
```

**Error Responses:**
- `400` - Invalid student ID format
- `401` - Unauthorized
- `403` - Insufficient permissions ("You can only update your own student record" for students)
- `404` - Student not found
- `500` - Internal server error

### DELETE /api/schools/{schoolId}/students/{studentId}
Delete a student record.

**Access Control:**
- **Students:** ❌ Cannot delete student records
- **Instructors:** ❌ Cannot delete student records  
- **School Admins:** ✅ Can delete students in their school
- **System Admins:** ✅ Can delete any student

**Path Parameters:**
- `schoolId` - ObjectId of the school
- `studentId` - ObjectId of the student to delete

**Response:**
```json
{
  "message": "Student deleted successfully",
  "status": "success"
}
```

**Error Responses:**
- `400` - Invalid school ID or student ID format
- `401` - Unauthorized
- `403` - Insufficient permissions to delete students
- `404` - Student not found
- `500` - Internal server error

## Student Status Values

Common student status values:
- `Active` - Currently enrolled and attending
- `Inactive` - Temporarily not attending
- `Graduated` - Successfully completed program
- `Withdrawn` - Left program before completion
- `Suspended` - Temporarily suspended from program
- `On Hold` - Program paused (medical, financial, etc.)

## Progress Tracking System

### Requirements Tracking
Each student's progress includes detailed tracking of:
- **Flight Time Requirements** - Dual instruction, solo time, cross-country, etc.
- **Ground School Requirements** - Theoretical knowledge areas
- **Practical Requirements** - Checkrides, endorsements, etc.

### Milestone Management
- **Ordered Progression** - Milestones have a specific sequence
- **Completion Tracking** - Boolean completion status for each milestone
- **Descriptions** - Detailed explanation of requirements

### Stage Progression
- **Training Phases** - Ground school, pre-solo, solo, cross-country, etc.
- **Sequential Order** - Stages must be completed in order
- **Status Tracking** - Current stage and completion status

## Integration with Other Systems

### User Account Linking
Students can be linked to User accounts via the `user_id` field:
- **Optional Linking** - Not all students need user accounts
- **Authentication Access** - Linked students can log into the system
- **Self-Service** - Students can view/update their own records

### Program Integration
Student creation automatically integrates with the school's program system:
- **Requirement Initialization** - All program requirements are set up
- **Progress Structure** - Milestones and stages from program definition
- **Customization** - Schools can modify requirements per student

### Financial Integration
Students are linked to the financial system:
- **Ledger Creation** - Automatic ledger creation when needed
- **Charge Tracking** - Flight charges linked to student records
- **Balance Management** - Financial status integrated with academic progress

## Error Handling

### Permission Errors
```json
{
  "error": "You can only update your own student record"
}
```

```json
{
  "error": "Insufficient permissions to delete students"
}
```

### Validation Errors
```json
{
  "error": "Missing required fields: contact_email and program are required"
}
```

```json
{
  "error": "Program not found for this school"
}
```

### Access Control Errors
```json
{
  "error": "You do not have access to this school"
}
```

## Use Cases

### Scenario 1: New Student Enrollment
1. **School admin creates student** with required contact info and program
2. **System initializes progress** with all program requirements 
3. **Student gets access** to view their progress and requirements
4. **Instructors can track** student advancement through stages

### Scenario 2: Student Self-Service Updates
1. **Student logs in** and views their own record
2. **Updates contact information** like phone or emergency contact
3. **Views progress tracking** to see completion status
4. **Cannot modify** academic progression or program requirements

### Scenario 3: Academic Progress Management
1. **Instructor updates stage** as student advances
2. **Admin tracks milestones** and sets next objectives  
3. **System maintains** complete progression history
4. **Progress feeds into** scheduling and financial systems

This comprehensive student management system provides complete lifecycle tracking from enrollment through graduation while maintaining appropriate access controls and integration with other flight school systems. 
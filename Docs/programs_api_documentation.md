# Programs API Documentation

## Overview
The Programs API manages flight training program definitions within flight schools. Programs define the curriculum structure including requirements, milestones, and training stages that students must complete to achieve their certification goals.

## Access Control

### Role-Based Permissions:

| Role | List Programs | Create Program | View Program | Update Program | Delete Program |
|------|---------------|----------------|--------------|----------------|----------------|
| **Student** | ✅ School Only | ❌ | ✅ School Only | ❌ | ❌ |
| **Instructor** | ✅ School Only | ❌ | ✅ School Only | ❌ | ❌ |
| **School Admin** | ✅ School Only | ✅ | ✅ School Only | ✅ School Only | ✅ School Only |
| **System Admin** | ✅ All Schools | ✅ | ✅ All | ✅ All | ✅ All |

### Security Features:
- **API key validation** required for all requests
- **JWT authentication** verifies user identity and role
- **School-scoped access** prevents cross-school data access
- **Program curriculum management** restricted to administrators

## Program Object

```json
{
  "_id": "ObjectId",
  "school_id": "ObjectId",
  "program_name": "Private Pilot License",
  "description": "Complete training program for Private Pilot License certification",
  "duration": "6 months",
  "cost": 12000,
  "requirements": [
    {
      "name": "Total Flight Time",
      "hours": 40.0,
      "type": "Standard"
    },
    {
      "name": "Dual Instruction",
      "hours": 20.0,
      "type": "Key"
    },
    {
      "name": "Solo Flight Time",
      "hours": 10.0,
      "type": "Standard"
    },
    {
      "name": "Cross Country Time",
      "hours": 5.0,
      "type": "Custom"
    }
  ],
  "milestones": [
    {
      "name": "Written Exam",
      "description": "Pass FAA written examination",
      "order": 1
    },
    {
      "name": "First Solo",
      "description": "Complete first supervised solo flight",
      "order": 2
    },
    {
      "name": "Cross Country Solo",
      "description": "Complete solo cross-country flight",
      "order": 3
    },
    {
      "name": "Checkride",
      "description": "Pass practical examination with DPE",
      "order": 4
    }
  ],
  "stages": [
    {
      "name": "Ground School",
      "description": "Complete theoretical knowledge requirements",
      "order": 1
    },
    {
      "name": "Pre-Solo",
      "description": "Dual instruction leading to first solo",
      "order": 2
    },
    {
      "name": "Solo Phase",
      "description": "Building solo flight experience",
      "order": 3
    },
    {
      "name": "Cross Country",
      "description": "Navigation and cross-country training",
      "order": 4
    },
    {
      "name": "Checkride Prep",
      "description": "Final preparation for practical exam",
      "order": 5
    }
  ],
  "created_at": "2024-01-15T08:00:00.000Z",
  "updated_at": "2024-01-20T15:45:00.000Z"
}
```

## Endpoints

### GET /api/schools/{schoolId}/programs
List all training programs for a specific school.

**Access Control:**
- **Students:** ✅ Can view programs in their school
- **Instructors:** ✅ Can view programs in their school
- **School Admins:** ✅ Can view programs in their school
- **System Admins:** ✅ Can view programs in any school

**Path Parameters:**
- `schoolId` - ObjectId of the school

**Response:**
```json
{
  "programs": [
    {
      "_id": "6841e28c8d13949c514ac6dd",
      "school_id": "68389c818d13949c514ac59c",
      "program_name": "Private Pilot License",
      "description": "Complete PPL training program",
      "duration": "6 months",
      "cost": 12000,
      "requirements": [
        {
          "name": "Total Flight Time",
          "hours": 40.0,
          "type": "Standard"
        }
      ],
      "milestones": [
        {
          "name": "First Solo",
          "description": "Complete first solo flight",
          "order": 1
        }
      ],
      "stages": [
        {
          "name": "Pre-Solo",
          "description": "Training before first solo",
          "order": 1
        }
      ]
    }
  ]
}
```

**Sorting:** Programs are automatically sorted alphabetically by `program_name`

**Error Responses:**
- `400` - Invalid school ID format
- `401` - Unauthorized (invalid API key or token)
- `404` - School not found
- `500` - Internal server error

### POST /api/schools/{schoolId}/programs
Create a new training program for a school.

**Access Control:**
- **Students:** ❌ Cannot create programs
- **Instructors:** ❌ Cannot create programs
- **School Admins:** ✅ Can create programs in their school
- **System Admins:** ✅ Can create programs in any school

**Required Fields:**
- `program_name` - Name of the training program (must be unique within school)
- `requirements` - Array of training requirements

**Optional Fields:**
- `description` - Detailed program description
- `duration` - Expected completion time
- `cost` - Program cost in local currency
- `milestones` - Array of achievement milestones
- `stages` - Array of training stages

**Example Request:**
```json
{
  "program_name": "Instrument Rating",
  "description": "Advanced training for instrument flight rules certification",
  "duration": "3 months",
  "cost": 8500,
  "requirements": [
    {
      "name": "Instrument Flight Time",
      "hours": 40.0,
      "type": "Key"
    },
    {
      "name": "Cross Country IFR",
      "hours": 15.0,
      "type": "Standard"
    },
    {
      "name": "Simulated Instrument",
      "hours": 20.0,
      "type": "Standard"
    }
  ],
  "milestones": [
    {
      "name": "IFR Written Exam",
      "description": "Pass instrument rating written exam",
      "order": 1
    },
    {
      "name": "IPC Completion",
      "description": "Complete instrument proficiency check",
      "order": 2
    }
  ],
  "stages": [
    {
      "name": "Instrument Ground",
      "description": "Theoretical instrument knowledge",
      "order": 1
    },
    {
      "name": "Hood Work",
      "description": "Simulated instrument training",
      "order": 2
    },
    {
      "name": "Actual IMC",
      "description": "Real instrument conditions training",
      "order": 3
    }
  ]
}
```

**Response:**
```json
{
  "message": "Program created successfully",
  "program": {
    "_id": "6841e28c8d13949c514ac6dd",
    "school_id": "68389c818d13949c514ac59c",
    "program_name": "Instrument Rating",
    "description": "Advanced training for instrument flight rules certification",
    "duration": "3 months",
    "cost": 8500,
    "requirements": [
      {
        "name": "Instrument Flight Time",
        "hours": 40.0,
        "type": "Key"
      }
    ],
    "milestones": [
      {
        "name": "IFR Written Exam",
        "description": "Pass instrument rating written exam",
        "order": 1
      }
    ],
    "stages": [
      {
        "name": "Instrument Ground",
        "description": "Theoretical instrument knowledge",
        "order": 1
      }
    ],
    "created_at": "2024-01-15T14:30:00.000Z",
    "updated_at": "2024-01-15T14:30:00.000Z"
  }
}
```

**Requirements Validation Rules:**
- Each requirement must have `name` (string) and `hours` (number ≥ 0)
- Optional `type` field: "Standard", "Key", or "Custom"
- `hours` must be a positive number or zero

**Milestones Validation Rules:**
- Each milestone must have `name` (string) and `order` (number ≥ 0)
- Optional `description` field for detailed explanation
- `order` determines sequence of achievement

**Stages Validation Rules:**
- Each stage must have `name` (string) and `order` (number ≥ 0)
- Optional `description` field for stage details
- `order` determines training progression sequence

**Error Responses:**
- `400` - Missing required fields or validation errors
- `401` - Unauthorized
- `404` - School not found
- `409` - Duplicate program name
- `500` - Internal server error

### GET /api/schools/{schoolId}/programs/{programId}
Get a specific training program by ID.

**Access Control:**
- **Students:** ✅ Can view programs in their school
- **Instructors:** ✅ Can view programs in their school
- **School Admins:** ✅ Can view programs in their school
- **System Admins:** ✅ Can view any program

**Path Parameters:**
- `schoolId` - ObjectId of the school
- `programId` - ObjectId of the program

**Response:**
```json
{
  "program": {
    "_id": "6841e28c8d13949c514ac6dd",
    "school_id": "68389c818d13949c514ac59c",
    "program_name": "Commercial Pilot License",
    "description": "Advanced commercial pilot training program",
    "duration": "12 months",
    "cost": 25000,
    "requirements": [
      {
        "name": "Total Flight Time",
        "hours": 250.0,
        "type": "Key"
      },
      {
        "name": "Cross Country Time",
        "hours": 50.0,
        "type": "Standard"
      },
      {
        "name": "Night Flying",
        "hours": 10.0,
        "type": "Standard"
      },
      {
        "name": "Complex Aircraft",
        "hours": 10.0,
        "type": "Custom"
      }
    ],
    "milestones": [
      {
        "name": "Commercial Written",
        "description": "Pass commercial pilot written exam",
        "order": 1
      },
      {
        "name": "Complex Endorsement",
        "description": "Obtain complex aircraft endorsement",
        "order": 2
      },
      {
        "name": "Commercial Checkride",
        "description": "Pass commercial pilot practical exam",
        "order": 3
      }
    ],
    "stages": [
      {
        "name": "Time Building",
        "description": "Accumulate required flight hours",
        "order": 1
      },
      {
        "name": "Commercial Maneuvers",
        "description": "Master commercial pilot maneuvers",
        "order": 2
      },
      {
        "name": "Checkride Preparation",
        "description": "Final preparation for practical exam",
        "order": 3
      }
    ],
    "created_at": "2024-01-10T09:00:00.000Z",
    "updated_at": "2024-01-15T16:30:00.000Z"
  }
}
```

**Error Responses:**
- `400` - Invalid school ID or program ID format
- `401` - Unauthorized
- `404` - School or program not found
- `500` - Internal server error

### PUT /api/schools/{schoolId}/programs/{programId}
Update an existing training program.

**Access Control:**
- **Students:** ❌ Cannot update programs
- **Instructors:** ❌ Cannot update programs
- **School Admins:** ✅ Can update programs in their school
- **System Admins:** ✅ Can update any program

**Path Parameters:**
- `schoolId` - ObjectId of the school
- `programId` - ObjectId of the program to update

**Updatable Fields:**
- `program_name` - Program name
- `description` - Program description
- `duration` - Expected completion duration
- `cost` - Program cost
- `requirements` - Training requirements array
- `milestones` - Achievement milestones array
- `stages` - Training stages array

**Example Request:**
```json
{
  "description": "Updated comprehensive training for Private Pilot License with enhanced safety focus",
  "duration": "8 months",
  "cost": 14000,
  "requirements": [
    {
      "name": "Total Flight Time",
      "hours": 45.0,
      "type": "Key"
    },
    {
      "name": "Dual Instruction",
      "hours": 25.0,
      "type": "Standard"
    },
    {
      "name": "Solo Flight Time",
      "hours": 15.0,
      "type": "Standard"
    },
    {
      "name": "Night Flying",
      "hours": 3.0,
      "type": "Custom"
    }
  ],
  "milestones": [
    {
      "name": "Medical Certificate",
      "description": "Obtain valid medical certificate",
      "order": 1
    },
    {
      "name": "Written Exam",
      "description": "Pass FAA written examination",
      "order": 2
    },
    {
      "name": "First Solo",
      "description": "Complete first supervised solo flight",
      "order": 3
    },
    {
      "name": "Solo Cross Country",
      "description": "Complete required cross-country solo",
      "order": 4
    },
    {
      "name": "Practical Exam",
      "description": "Pass checkride with DPE",
      "order": 5
    }
  ]
}
```

**Response:**
```json
{
  "message": "Program updated successfully",
  "program": {
    "_id": "6841e28c8d13949c514ac6dd",
    "school_id": "68389c818d13949c514ac59c",
    "program_name": "Private Pilot License",
    "description": "Updated comprehensive training for Private Pilot License with enhanced safety focus",
    "duration": "8 months",
    "cost": 14000,
    "requirements": [
      {
        "name": "Total Flight Time",
        "hours": 45.0,
        "type": "Key"
      }
    ],
    "milestones": [
      {
        "name": "Medical Certificate",
        "description": "Obtain valid medical certificate",
        "order": 1
      }
    ],
    "stages": [
      // ... existing stages preserved if not updated
    ],
    "updated_at": "2024-01-20T11:45:00.000Z"
  }
}
```

**Validation Rules:** Same validation rules apply as in POST request

**Error Responses:**
- `400` - Invalid ID format or validation errors
- `401` - Unauthorized
- `404` - School or program not found
- `500` - Internal server error

### DELETE /api/schools/{schoolId}/programs/{programId}
Delete a training program.

**Access Control:**
- **Students:** ❌ Cannot delete programs
- **Instructors:** ❌ Cannot delete programs
- **School Admins:** ✅ Can delete programs in their school
- **System Admins:** ✅ Can delete any program

**Path Parameters:**
- `schoolId` - ObjectId of the school
- `programId` - ObjectId of the program to delete

**Response:**
```json
{
  "message": "Program deleted successfully"
}
```

**⚠️ Important Considerations:**
- Deleting a program may affect existing students enrolled in that program
- Consider the impact on student progress tracking before deletion
- Ensure no active students are currently enrolled before deletion

**Error Responses:**
- `400` - Invalid school ID or program ID format
- `401` - Unauthorized
- `404` - School or program not found
- `500` - Internal server error

## Program Structure Components

### Requirements Types
Programs support three types of training requirements:

- **Standard** - Regular training requirements (dual time, solo time, etc.)
- **Key** - Critical requirements that must be emphasized
- **Custom** - School-specific or specialized requirements

### Milestone Progression
Milestones represent major achievements in the training program:
- **Ordered Sequence** - Milestones have a specific order of completion
- **Achievement Tracking** - Students can track milestone completion
- **Progress Indicators** - Visual progress through the program

### Training Stages
Stages represent phases of training progression:
- **Sequential Training** - Stages must be completed in order
- **Phase Management** - Clear training phase boundaries
- **Instructor Guidance** - Helps instructors plan training progression

## Integration with Student System

### Automatic Progress Initialization
When students are enrolled in a program, the system automatically:

1. **Copies Program Structure** - All requirements, milestones, and stages
2. **Initializes Progress Tracking** - Sets completion status to false/0
3. **Creates Student Progress** - Individual tracking for each student
4. **Establishes Baseline** - Starting point for training progression

### Student Progress Integration
Programs serve as templates for student progress tracking:
- **Requirement Hours** - Total vs. completed hours tracking
- **Milestone Completion** - Boolean completion status
- **Stage Progression** - Current stage and advancement tracking

## Business Logic

### Program Uniqueness
- Program names must be unique within each school
- Different schools can have programs with the same name
- Case-sensitive name matching for uniqueness validation

### Curriculum Structure
- **Requirements** define what students must complete
- **Milestones** mark significant achievements
- **Stages** organize training into logical phases

### Data Validation
- All numeric fields (hours, order) must be non-negative
- Array fields (requirements, milestones, stages) must be properly formatted
- Required fields must be present and valid

## Error Handling

### Validation Errors
```json
{
  "error": "Missing required fields",
  "details": ["program_name is required", "requirements is required"],
  "example": {
    "program_name": "Private Pilot License",
    "requirements": [
      {
        "name": "Total Flight Time",
        "hours": 40.0,
        "type": "Standard"
      }
    ]
  }
}
```

### Duplicate Program Error
```json
{
  "error": "Duplicate program",
  "details": "A program with name \"Private Pilot License\" already exists for this school"
}
```

### Invalid Format Errors
```json
{
  "error": "Invalid requirement format",
  "details": "Each requirement must have a name (string) and hours (number >= 0)",
  "example": {
    "name": "Total Flight Time",
    "hours": 40.0,
    "type": "Standard"
  }
}
```

## Use Cases & Scenarios

### Scenario 1: Creating New Training Program
**Workflow:**
1. **School Admin** designs new training curriculum
2. **Define Requirements** - Set flight hours and training types
3. **Establish Milestones** - Create achievement checkpoints
4. **Structure Stages** - Organize training phases
5. **Program Creation** - Save program to school's curriculum

**Result:** New program available for student enrollment

### Scenario 2: Updating Existing Program
**Workflow:**
1. **Regulatory Changes** - FAA updates training requirements
2. **Program Review** - Admin reviews current program structure
3. **Update Requirements** - Modify hours or add new requirements
4. **Adjust Milestones** - Update achievement criteria
5. **Save Changes** - Program updated for future students

**Result:** Updated program reflects current regulations

### Scenario 3: Student Enrollment Integration
**Workflow:**
1. **Student Enrolls** - Selects training program
2. **Progress Initialization** - System copies program structure
3. **Tracking Setup** - Individual progress tracking created
4. **Training Begins** - Student starts working through requirements
5. **Progress Updates** - Hours and milestones tracked against program

**Result:** Structured training progression with clear goals

### Scenario 4: Program Retirement
**Workflow:**
1. **Program Review** - Admin identifies outdated program
2. **Student Check** - Verify no active enrollments
3. **Data Backup** - Preserve historical program data
4. **Program Deletion** - Remove from active programs list
5. **Archive Management** - Maintain records for completed students

**Result:** Clean program catalog with historical preservation

## Integration Benefits

### 1. **Standardized Training**
- Consistent curriculum across all students
- Clear training requirements and objectives
- Structured progression through certification

### 2. **Progress Transparency**
- Students understand training requirements
- Clear milestones and achievement goals
- Visual progress tracking capabilities

### 3. **Administrative Control**
- Centralized curriculum management
- Easy program updates and modifications
- Compliance with regulatory changes

### 4. **Instructor Guidance**
- Clear training structure for lesson planning
- Milestone-based progress evaluation
- Stage-appropriate training activities

### 5. **Quality Assurance**
- Comprehensive training requirements
- Standardized achievement criteria
- Consistent training outcomes

This comprehensive program management system provides the foundation for structured, trackable, and compliant flight training while maintaining flexibility for school-specific curriculum customization. 
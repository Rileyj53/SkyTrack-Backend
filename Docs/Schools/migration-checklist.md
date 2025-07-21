# Documentation Migration Checklist - School to Organization

## 🎯 Migration Strategy

### **Automated Find & Replace Operations**

For each remaining documentation file, apply these systematic find/replace operations:

## **1. API Path Updates**
- Find: `/api/schools/`
- Replace: `/api/organizations/`

- Find: `/{schoolId}/`
- Replace: `/{organizationId}/`

- Find: `:schoolId`
- Replace: `:organizationId`

## **2. Field Name Updates**
- Find: `school_id`
- Replace: `organization_id`

- Find: `schoolId`
- Replace: `organizationId`

## **3. Terminology Updates**
- Find: `School Admin`
- Replace: `Organization Admin`

- Find: `school admin`
- Replace: `organization admin`

- Find: `School Admins`
- Replace: `Organization Admins`

- Find: `school administrators`
- Replace: `organization administrators`

- Find: `School Only`
- Replace: `Organization Only`

- Find: `school only`
- Replace: `organization only`

- Find: `specific school`
- Replace: `specific organization`

- Find: `flight school`
- Replace: `flight training organization`

- Find: `flight schools`
- Replace: `flight training organizations`

- Find: `school's`
- Replace: `organization's`

- Find: `School-scoped`
- Replace: `Organization-scoped`

- Find: `school-scoped`
- Replace: `organization-scoped`

- Find: `Cross-school`
- Replace: `Cross-organization`

- Find: `cross-school`
- Replace: `cross-organization`

## **4. Title and Header Updates**
- Find: `# Schools`
- Replace: `# Organizations`

- Find: `## Schools`
- Replace: `## Organizations`

- Find: `School Object`
- Replace: `Organization Object`

- Find: `Schools API`
- Replace: `Organizations API`

## **5. Documentation File Renames**
1. `schools_api_documentation.md` → `organizations_api_documentation.md`
2. `core_schools_management_api_documentation.md` → `core_organizations_management_api_documentation.md`
3. `Schools.postman_collection.json` → `Organizations.postman_collection.json`

## **6. Variable and Parameter Updates**
- Find: `{{schoolId}}`
- Replace: `{{organizationId}}`

- Find: `"schoolId"`
- Replace: `"organizationId"`

- Find: `'schoolId'`
- Replace: `'organizationId'`

- Find: `pm.collectionVariables.get('schoolId')`
- Replace: `pm.collectionVariables.get('organizationId')`

## **🗂️ Files Requiring Updates**

### **Documentation Files:**
- [ ] `flight_invoice_api_documentation.md`
- [ ] `programs_api_documentation.md`
- [ ] `student_ledger_api_documentation.md`
- [ ] `aircraft_tracking_api_documentation.md`
- [ ] `stats.md`

### **Postman Collection:**
- [ ] `Schools.postman_collection.json` (2611 lines)
  - Update all endpoint URLs
  - Update all variable references
  - Update all test cases
  - Update collection name and description

## **📝 Specific Updates for Individual Files**

### **Flight Invoice API (`flight_invoice_api_documentation.md`)**
```bash
# Key URLs to update:
/api/schools/{schoolId}/students/{studentId}/flight-invoices
↓
/api/organizations/{organizationId}/students/{studentId}/flight-invoices
```

### **Programs API (`programs_api_documentation.md`)**
```bash
# Key URLs to update:
/api/schools/{schoolId}/programs
↓
/api/organizations/{organizationId}/programs
```

### **Student Ledger API (`student_ledger_api_documentation.md`)**
```bash
# Key URLs to update:
/api/schools/{schoolId}/students/{studentId}/ledger
↓
/api/organizations/{organizationId}/students/{studentId}/ledger
```

### **Aircraft Tracking API (`aircraft_tracking_api_documentation.md`)**
```bash
# Key URLs to update:
/api/schools/{schoolId}/aircraft-tracking
↓
/api/organizations/{organizationId}/aircraft-tracking
```

### **Stats Documentation (`stats.md`)**
```bash
# Key URLs to update:
/api/schools/{schoolId}/stats
↓
/api/organizations/{organizationId}/stats
```

## **🔧 Batch Update Script**

### **For VS Code or Text Editor:**
1. Open each file
2. Use Find & Replace (Ctrl+H / Cmd+H)
3. Apply each find/replace operation systematically
4. Verify JSON syntax for collection files

### **For Command Line (Mac/Linux):**
```bash
# Example for single file
sed -i 's/\/api\/schools\//\/api\/organizations\//g' filename.md
sed -i 's/{schoolId}/{organizationId}/g' filename.md
sed -i 's/school_id/organization_id/g' filename.md
```

## **✅ Verification Checklist**

After updating each file, verify:

- [ ] All `/api/schools/` changed to `/api/organizations/`
- [ ] All `schoolId` parameters changed to `organizationId`
- [ ] All `school_id` fields changed to `organization_id`
- [ ] All access control descriptions updated
- [ ] All example requests/responses updated
- [ ] Collection variables updated (for Postman)
- [ ] JSON syntax valid (for collection files)

## **🚀 Priority Order**

1. **High Priority** (most commonly used):
   - `flight_invoice_api_documentation.md`
   - `programs_api_documentation.md`
   - `Schools.postman_collection.json`

2. **Medium Priority**:
   - `student_ledger_api_documentation.md`
   - `aircraft_tracking_api_documentation.md`

3. **Low Priority**:
   - `stats.md`

## **🎯 Expected Results**

After completion:
- **100% organization-agnostic** documentation
- **Consistent API paths** across all docs
- **Updated Postman collection** ready for testing
- **Unified terminology** throughout system
- **Backward compatibility** maintained where needed

## **🚨 Important Notes**

1. **Backup First**: Always backup original files before mass updates
2. **Test Incrementally**: Update and test one file at a time
3. **Validate JSON**: Check Postman collection syntax after updates
4. **Review Context**: Some phrases may need manual review for context
5. **Update Variables**: Don't forget to update collection variables 
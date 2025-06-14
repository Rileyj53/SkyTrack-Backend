
# 📘 SkyTrack Backend Documentation Standards

## 📝 API Documentation (REQUIRED FOR EVERY ENDPOINT)

Each file in `src/app/api/**` **must** have a corresponding documentation file in `Docs/` following the same folder structure and name.

### Required Structure in `Docs/`:

Each `.md` file must contain:

- **Title**: Endpoint and method (e.g., `POST /api/schools/{id}/students`)
- **Security Section**:
  - Required: Auth, API key, CSRF
  - Allowed roles
  - Risk scoring or fraud detection enabled?
- **Request Section**:
  - Method
  - Path parameters
  - Query parameters
  - Required headers (list, but not hardcoded values)
  - JSON body schema
- **Rate limits** (if applicable)
- **Security context fields** (if returned: `auditId`, `riskScore`, etc.)

### 📄 Example Doc Layout:

## POST /api/schools/{schoolId}/students

### 🔐 Security
- Requires Auth: ✅
- Requires API Key: ✅
- Requires CSRF Token: ✅
- Allowed Roles: `['school_admin']`

### 📥 Request

Path: `/api/schools/{schoolId}/students`  
Method: `POST`

Body:
```json
{
  "firstName": "string",
  "lastName": "string",
  "email": "string"
}
```

---

## 🧩 Postman Collection Coverage

- Maintain a **single unified Postman collection** for the SkyTrack backend in `Docs/SkyTrack.postman_collection.json`
- Every documented route in `Docs/` **must be present** in the Postman collection
- Folder structure in Postman must mirror API route groups (e.g., `api/schools` → “Schools” folder)
- Each request in Postman should:
  - Match the documented method and path
  - Include example body where applicable

> 🔄 Tip: Use scripts or automation to ensure the collection stays in sync with implemented endpoints and documentation.

---

## ✅ Documentation Checklist (for every endpoint)

- [ ] Doc file created under `Docs/`
- [ ] Matches route structure (e.g. `/schools/route.ts` → `Docs/schools.md`)
- [ ] Includes required metadata: method, roles, risk flags
- [ ] Contains schema for body
- [ ] Lists all status codes used by endpoint
- [ ] Includes `auditId` or `riskScore` if used
- [ ] Entry added to Postman collection

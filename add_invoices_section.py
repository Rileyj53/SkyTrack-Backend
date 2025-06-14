import json

# Flight Invoices section to add
flight_invoices_section = {
    "name": "Flight Invoices",
    "item": [
        {
            "name": "Create Flight Invoice",
            "request": {
                "method": "POST",
                "header": [
                    {"key": "X-CSRF-Token", "value": "{{csrfToken}}", "type": "text"},
                    {"key": "X-API-Key", "value": "{{apiKey}}", "type": "text"},
                    {"key": "Content-Type", "value": "application/json", "type": "text"}
                ],
                "body": {
                    "mode": "raw",
                    "raw": '{"flight_schedule_id": "{{flightScheduleId}}", "tax_rate": 8.5}'
                },
                "url": {
                    "raw": "{{baseURL}}/api/schools/{{schoolId}}/students/{{studentId}}/flight-invoices",
                    "host": ["{{baseURL}}"],
                    "path": ["api", "schools", "{{schoolId}}", "students", "{{studentId}}", "flight-invoices"]
                }
            },
            "response": [{
                "name": "201 Success",
                "status": "Created",
                "code": 201,
                "body": '{"message": "Flight invoice created successfully"}'
            }]
        },
        {
            "name": "List Flight Invoices",
            "request": {
                "method": "GET",
                "header": [
                    {"key": "X-CSRF-Token", "value": "{{csrfToken}}", "type": "text"},
                    {"key": "X-API-Key", "value": "{{apiKey}}", "type": "text"}
                ],
                "url": {
                    "raw": "{{baseURL}}/api/schools/{{schoolId}}/students/{{studentId}}/flight-invoices",
                    "host": ["{{baseURL}}"],
                    "path": ["api", "schools", "{{schoolId}}", "students", "{{studentId}}", "flight-invoices"]
                }
            },
            "response": [{
                "name": "200 Success",
                "status": "OK",
                "code": 200,
                "body": '{"invoices": []}'
            }]
        },
        {
            "name": "Finalize Flight Invoice",
            "request": {
                "method": "POST",
                "header": [
                    {"key": "X-CSRF-Token", "value": "{{csrfToken}}", "type": "text"},
                    {"key": "X-API-Key", "value": "{{apiKey}}", "type": "text"}
                ],
                "url": {
                    "raw": "{{baseURL}}/api/schools/{{schoolId}}/students/{{studentId}}/flight-invoices/{{invoiceId}}/finalize",
                    "host": ["{{baseURL}}"],
                    "path": ["api", "schools", "{{schoolId}}", "students", "{{studentId}}", "flight-invoices", "{{invoiceId}}", "finalize"]
                }
            },
            "response": [{
                "name": "200 Success",
                "status": "OK",
                "code": 200,
                "body": '{"message": "Invoice submitted for approval"}'
            }]
        },
        {
            "name": "Approve Flight Invoice",
            "request": {
                "method": "POST",
                "header": [
                    {"key": "X-CSRF-Token", "value": "{{csrfToken}}", "type": "text"},
                    {"key": "X-API-Key", "value": "{{apiKey}}", "type": "text"}
                ],
                "url": {
                    "raw": "{{baseURL}}/api/schools/{{schoolId}}/students/{{studentId}}/flight-invoices/{{invoiceId}}/approve",
                    "host": ["{{baseURL}}"],
                    "path": ["api", "schools", "{{schoolId}}", "students", "{{studentId}}", "flight-invoices", "{{invoiceId}}", "approve"]
                }
            },
            "response": [{
                "name": "200 Success",
                "status": "OK", 
                "code": 200,
                "body": '{"message": "Invoice approved and added to ledger"}'
            }]
        },
        {
            "name": "Reject Flight Invoice",
            "request": {
                "method": "POST",
                "header": [
                    {"key": "X-CSRF-Token", "value": "{{csrfToken}}", "type": "text"},
                    {"key": "X-API-Key", "value": "{{apiKey}}", "type": "text"},
                    {"key": "Content-Type", "value": "application/json", "type": "text"}
                ],
                "body": {
                    "mode": "raw",
                    "raw": '{"reason_rejected": "Please provide reason"}'
                },
                "url": {
                    "raw": "{{baseURL}}/api/schools/{{schoolId}}/students/{{studentId}}/flight-invoices/{{invoiceId}}/reject",
                    "host": ["{{baseURL}}"],
                    "path": ["api", "schools", "{{schoolId}}", "students", "{{studentId}}", "flight-invoices", "{{invoiceId}}", "reject"]
                }
            },
            "response": [{
                "name": "200 Success",
                "status": "OK",
                "code": 200,
                "body": '{"message": "Invoice rejected successfully"}'
            }]
        }
    ]
}

# Read the JSON file
with open('Docs/Albatross API.postman_collection.json', 'r') as f:
    data = json.load(f)

# Find the index of the Flight Schedule section and insert after it
items = data.get('item', [])
for i, item in enumerate(items):
    if item.get('name') == 'Flight Schedule':
        # Insert Flight Invoices after Flight Schedule
        items.insert(i + 1, flight_invoices_section)
        break

# Write back to file
with open('Docs/Albatross API.postman_collection.json', 'w') as f:
    json.dump(data, f, indent=4)

print('Flight Invoices section added to Postman collection') 
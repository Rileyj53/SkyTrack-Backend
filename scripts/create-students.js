#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Configuration - EDIT THESE VALUES
const CONFIG = {
    BASE_URL: 'http://localhost:3000',
    ORGANIZATION_ID: '687c208d97e9217fc09e7c40',
    API_KEY: 'pk_36ff65d9-b8650bff-663cf72e-e9976e75',
    // Get these from your browser after logging in:
    JWT_TOKEN: '', // Required: Copy from browser cookies after login
    CSRF_TOKEN: '', // Required: Copy from browser cookies after login
};

async function createStudent(studentData) {
    const url = `${CONFIG.BASE_URL}/api/organizations/${CONFIG.ORGANIZATION_ID}/students`;

    const requestData = {
        contact_email: studentData.contact_email,
        phone: studentData.phone,
        certifications: studentData.certifications || [],
        license_number: studentData.license_number,
        emergency_contact: studentData.emergency_contact,
        enrollmentDate: studentData.enrollmentDate,
        program: studentData.program,
        status: studentData.status || 'Active',
        stage: studentData.stage,
        nextMilestone: studentData.nextMilestone,
        notes: studentData.notes || '',
        user_id: studentData.user_id, // Link to User record if exists
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': CONFIG.API_KEY,
                'Authorization': `Bearer ${CONFIG.JWT_TOKEN}`,
                'X-CSRF-Token': CONFIG.CSRF_TOKEN,
            },
            body: JSON.stringify(requestData),
        });

        const result = await response.json();

        return {
            success: response.ok,
            status: response.status,
            data: result,
            email: studentData.contact_email,
        };
    } catch (error) {
        return {
            success: false,
            error: error.message,
            email: studentData.contact_email,
        };
    }
}

async function main() {
    console.log('🚀 Creating Demo Students...\n');

    // Validate configuration
    if (!CONFIG.JWT_TOKEN || !CONFIG.CSRF_TOKEN) {
        console.error('❌ Error: JWT_TOKEN and CSRF_TOKEN are required!');
        console.log('\n💡 How to get tokens:');
        console.log('1. Login to your app at http://localhost:3000');
        console.log('2. Open browser Developer Tools (F12)');
        console.log('3. Go to Application tab → Cookies');
        console.log('4. Copy "token" value to JWT_TOKEN in this script');
        console.log('5. Copy "csrf-token" value to CSRF_TOKEN in this script');
        process.exit(1);
    }

    // Load students data
    const dataPath = path.join(__dirname, '..', 'demo_data', 'demo-students.json');
    let studentsData;

    try {
        const rawData = fs.readFileSync(dataPath, 'utf8');
        studentsData = JSON.parse(rawData);
    } catch (error) {
        console.error('❌ Error loading demo-students.json:', error.message);
        process.exit(1);
    }

    console.log(`📊 Found ${studentsData.length} students to create\n`);

    const results = [];

    // Create students one by one
    for (let i = 0; i < studentsData.length; i++) {
        const student = studentsData[i];
        const progress = `[${i + 1}/${studentsData.length}]`;

        console.log(`${progress} Creating ${student.contact_email}...`);

        const result = await createStudent(student);
        results.push(result);

        if (result.success) {
            console.log(`${progress} ✅ Success: ${student.contact_email}`);
        } else {
            const errorMsg = result.data ? .error ? .message || result.error || 'Unknown error';
            console.log(`${progress} ❌ Failed: ${student.contact_email} - ${errorMsg}`);
        }

        // Small delay to avoid overwhelming the server
        if (i < studentsData.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    // Summary
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    console.log('\n📊 SUMMARY');
    console.log('═'.repeat(50));
    console.log(`✅ Successfully created: ${successful.length} students`);
    console.log(`❌ Failed to create: ${failed.length} students`);
    console.log(`📝 Total processed: ${results.length} students`);

    if (failed.length > 0) {
        console.log('\n❌ Failed Students:');
        failed.forEach((result, index) => {
            const errorMsg = result.data ? .error ? .message || result.error || 'Unknown error';
            console.log(`${index + 1}. ${result.email} - ${errorMsg}`);
        });
    }

    if (successful.length > 0) {
        console.log('\n✅ Successfully Created:');
        successful.forEach((result, index) => {
            console.log(`${index + 1}. ${result.email}`);
        });
    }

    process.exit(failed.length > 0 ? 1 : 0);
}

// Run the script
main().catch(error => {
    console.error('❌ Script failed:', error.message);
    process.exit(1);
});
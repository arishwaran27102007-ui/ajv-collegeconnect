const db = require('./db');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, "..", "data");
const DB_JSON_PATH = path.join(DATA_DIR, "db.json");

describe('Database Tests', () => {
  beforeAll(async () => {
    // Delete existing db.json to start fresh if needed, or just let db.js load it.
    // We will initialize the DB.
    await db.initDb();
  });

  test('Database health check', async () => {
    const health = await db.getHealth();
    expect(health.ok).toBe(true);
    expect(health.backend).toBe('online');
  });

  test('Create Student User', async () => {
    const student = await db.createStudentUser({
      fullName: 'Test Student',
      phone: '1234567890',
      parentName: 'Test Parent',
      dob: '2000-01-01',
      gender: 'Male',
      department: 'Computer Science',
      year: 'I Year',
      section: 'A',
      address: 'Test Address'
    });

    expect(student).toBeDefined();
    expect(student.fullName).toBe('Test Student');
    expect(student.role).toBe('student');
    expect(student.status).toBe('pending');
    expect(student.loginId).toMatch(/^AJVSTU\d{3}$/);
  });

  test('Find User by ID and Approve', async () => {
    // Re-fetch students
    const pending = await db.listPendingStudents();
    const student = pending.find(s => s.fullName === 'Test Student');
    expect(student).toBeDefined();

    // Approve
    const approval = await db.approveStudent(student.id);
    expect(approval.user.status).toBe('active');
    expect(approval.generatedEmail).toMatch(/teststudent\d{4}@ajv.edu/);
  });
});

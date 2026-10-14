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

  test('Cloud Database status check and WORM retention guarantee', async () => {
    const status = await db.getCloudDbStatus();
    expect(status.ok).toBe(true);
    expect(status.connected).toBe(true);
    expect(status.retentionGuarantee).toContain('Permanent WORM');
    expect(status.antiDeletionProtection).toContain('Enforced');
    expect(status.totalArchivedStudents).toBeGreaterThan(0);
  });

  test('Multi-Decade Retrieval: fetch records from 10-12+ years ago (2012-2016 and 2014-2018)', async () => {
    // 12-14 years ago
    const batch2012 = await db.getArchivedRecords({ batch: '2012-2016' });
    expect(batch2012.length).toBeGreaterThanOrEqual(1);
    expect(batch2012[0].registerNo).toBe('12IT001');
    expect(batch2012[0].studentName).toBe('Rajesh Kannan V');
    expect(batch2012[0].decadeCategory).toContain('12-14 Years Ago');

    // 10-12 years ago
    const batch2014 = await db.getArchivedRecords({ batch: '2014-2018' });
    expect(batch2014.length).toBeGreaterThanOrEqual(2);
    expect(batch2014.some(r => r.registerNo === '14IT018')).toBe(true);
    expect(batch2014.some(r => r.registerNo === '14EC032')).toBe(true);
  });

  test('Retrieve complete historical academic dossier & marksheets', async () => {
    const record = await db.getArchivedRecordById(1);
    expect(record).toBeDefined();
    expect(record.registerNo).toBe('12IT001');
    expect(record.academicRecords.length).toBeGreaterThan(0);
    expect(record.isLocked).toBe(true);
  });

  test('Cryptographic SHA-256 seal integrity verification', async () => {
    const verification = await db.verifyRecordIntegrity(1);
    expect(verification.verified).toBe(true);
    expect(verification.storedSealHash).toHaveLength(64);
    expect(verification.tamperProofStatus).toContain('100% Intact');
  });

  test('Archival safe-guard: deleteStudent never purges data, archives permanently', async () => {
    // Archive and deactivate student
    const pending = await db.listPendingStudents();
    if (pending.length > 0) {
      const studentToArchive = pending[0];
      const deleted = await db.deleteStudent(studentToArchive.id);
      expect(deleted).toBe(true);

      // Verify the student status is archived rather than dropped
      const user = await db.findUserById(studentToArchive.id);
      expect(user.status).toBe('archived');
    }
  });

  test('Audit Ledger records tamper-evident chained entries', async () => {
    const ledger = await db.getAuditLedger(10);
    expect(ledger.length).toBeGreaterThanOrEqual(1);
    expect(ledger[0].dataHash).toBeDefined();
    expect(ledger[0].prevHash).toBeDefined();
  });
});

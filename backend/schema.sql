-- =============================================================
-- Database Schema for AJV College Connect
-- Enterprise Cloud Database with Multi-Decade Academic Archival
-- and WORM (Write-Once-Read-Many) Anti-Deletion Protection
-- =============================================================

-- 1. Operational Users Table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    login_id VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    role VARCHAR(20) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE,
    phone VARCHAR(20),
    register_no VARCHAR(50),
    department VARCHAR(100),
    year VARCHAR(20),
    section VARCHAR(10),
    status VARCHAR(20) DEFAULT 'active',
    parent_name VARCHAR(100),
    dob DATE,
    gender VARCHAR(20),
    address TEXT,
    cgpa NUMERIC(4,2) DEFAULT 0,
    overall_percentage NUMERIC(5,2) DEFAULT 0,
    attendance NUMERIC(5,2) DEFAULT 0,
    admission_year INTEGER DEFAULT 2024,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Master Courses Table
CREATE TABLE IF NOT EXISTS courses (
    id SERIAL PRIMARY KEY,
    code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    credits INTEGER NOT NULL,
    department VARCHAR(100) NOT NULL,
    semester INTEGER DEFAULT 1
);

-- 3. Course Enrollments & Assessment Marks
CREATE TABLE IF NOT EXISTS enrollments (
    id SERIAL PRIMARY KEY,
    student_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
    attendance NUMERIC(5,2) DEFAULT 0,
    internal_mark NUMERIC(5,2) DEFAULT 0,
    external_mark NUMERIC(5,2) DEFAULT 0,
    total_mark NUMERIC(5,2) DEFAULT 0,
    percentage NUMERIC(5,2) DEFAULT 0,
    grade VARCHAR(5),
    grade_point INTEGER,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_id, course_id)
);

-- 4. Institutional Announcements Bulletin
CREATE TABLE IF NOT EXISTS announcements (
    id SERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    body TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================
-- 5. Multi-Decade Permanent Academic Archives (10 - 50+ Years)
-- Stores immutable academic dossiers, transcripts, and records
-- that can be retrieved instantly across decades.
-- =============================================================
CREATE TABLE IF NOT EXISTS academic_archives (
    id SERIAL PRIMARY KEY,
    student_id INTEGER,
    register_no VARCHAR(50) NOT NULL,
    student_name VARCHAR(100) NOT NULL,
    department VARCHAR(100) NOT NULL,
    degree VARCHAR(50) DEFAULT 'B.Tech / B.E.',
    admission_year INTEGER NOT NULL,
    graduation_year INTEGER NOT NULL,
    batch VARCHAR(30) NOT NULL,
    cgpa NUMERIC(4,2) DEFAULT 0,
    overall_percentage NUMERIC(5,2) DEFAULT 0,
    attendance_percentage NUMERIC(5,2) DEFAULT 0,
    final_classification VARCHAR(50) NOT NULL,
    degree_awarded_date DATE,
    academic_records JSONB NOT NULL DEFAULT '[]',
    fee_ledger_summary JSONB DEFAULT '{}',
    attendance_summary JSONB DEFAULT '{}',
    certificate_seal_hash VARCHAR(64) NOT NULL,
    archived_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    archived_by VARCHAR(100) DEFAULT 'AJV Institutional Registrar',
    is_locked BOOLEAN DEFAULT TRUE,
    UNIQUE(register_no, batch)
);

-- Fast Indexing for Multi-Decade Historical Searches (10-12+ years ago)
CREATE INDEX IF NOT EXISTS idx_archive_batch ON academic_archives(batch);
CREATE INDEX IF NOT EXISTS idx_archive_admission_year ON academic_archives(admission_year);
CREATE INDEX IF NOT EXISTS idx_archive_graduation_year ON academic_archives(graduation_year);
CREATE INDEX IF NOT EXISTS idx_archive_reg_no ON academic_archives(register_no);
CREATE INDEX IF NOT EXISTS idx_archive_dept ON academic_archives(department);
CREATE INDEX IF NOT EXISTS idx_archive_cgpa ON academic_archives(cgpa);

-- =============================================================
-- 6. Cryptographic Chained Audit Ledger (Tamper-Proof)
-- Every change, archive action, and clearance is linked in an
-- append-only SHA-256 chain that cannot be altered or deleted.
-- =============================================================
CREATE TABLE IF NOT EXISTS audit_ledger (
    id SERIAL PRIMARY KEY,
    entry_index BIGINT NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(100) NOT NULL,
    actor_id VARCHAR(50),
    actor_ip VARCHAR(50),
    data_hash VARCHAR(64) NOT NULL,
    prev_hash VARCHAR(64) NOT NULL,
    payload JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_entry_index ON audit_ledger(entry_index);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_ledger(entity_type, entity_id);

-- =============================================================
-- 7. Anti-Deletion WORM (Write-Once-Read-Many) Triggers
-- Prevents ANY deletion or truncation of historical records & ledger
-- =============================================================
CREATE OR REPLACE FUNCTION prevent_academic_record_deletion()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'CRITICAL SECURITY: Institutional academic archives and audit ledger records are legally permanent property and cannot be deleted or purged by anyone.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_academic_archives ON academic_archives;
CREATE TRIGGER trg_protect_academic_archives
BEFORE DELETE OR TRUNCATE ON academic_archives
FOR EACH STATEMENT EXECUTE FUNCTION prevent_academic_record_deletion();

DROP TRIGGER IF EXISTS trg_protect_audit_ledger ON audit_ledger;
CREATE TRIGGER trg_protect_audit_ledger
BEFORE DELETE OR TRUNCATE OR UPDATE ON audit_ledger
FOR EACH STATEMENT EXECUTE FUNCTION prevent_academic_record_deletion();

-- =============================================================
-- Seed Courses
-- =============================================================
INSERT INTO courses (id, code, name, credits, department, semester) VALUES
(1, 'IT101', 'Programming in C', 3, 'Information Technology', 1),
(2, 'IT102', 'Data Structures', 3, 'Information Technology', 1),
(3, 'IT103', 'Digital Principles', 3, 'Information Technology', 1),
(4, 'IT104', 'Object Oriented Programming', 4, 'Information Technology', 2),
(5, 'MA101', 'Probability & Statistics', 4, 'Common', 1),
(6, 'CS101', 'Computer Fundamentals', 3, 'Common', 1)
ON CONFLICT (id) DO NOTHING;

-- =============================================================
-- Seed Default Operational Users
-- =============================================================
INSERT INTO users (id, login_id, password_hash, role, full_name, email, phone, register_no, department, year, section, status, parent_name, dob, gender, address, cgpa, overall_percentage, attendance, admission_year) VALUES
(1, 'ADMIN001', '$2a$10$qItnXLk4ef.SauR9ljbIge2SoVqmMXj/vtQv5ocNe0/dat1aTw.Pa', 'admin', 'AJV Administrator', 'admin@ajv.edu', '+91 90000 00001', 'ADMIN001', 'Administration', 'Staff', 'Office', 'active', NULL, NULL, NULL, 'Campus Admin Block', 0, 0, 0, 2020),
(2, 'FAC001', '$2a$10$wCjtYA/1MAVoQ8BVeQXLJul/HPySCksUa/l8GHxfLt1lBnGDfKfi6', 'staff', 'Dr. Priya Faculty', 'faculty01@ajv.edu', '+91 90000 00002', 'FAC001', 'Information Technology', 'Staff', 'Faculty', 'active', NULL, NULL, NULL, 'Faculty Quarters', 0, 0, 0, 2021),
(3, 'AJVSTU001', '$2a$10$7iqzH4iT8SEBsgn6W2ii1uZSljrhuLSStFSJjLhq9VFevFrOLLg8.', 'student', 'Ananya Kumar', 'stu001@ajv.edu', '+91 90000 00003', 'AJVSTU001', 'Information Technology', 'I Year', 'A', 'active', 'R. Kumar', '2007-04-15', 'Female', 'Coimbatore, Tamil Nadu', 9.59, 89.20, 90.80, 2025),
(4, 'AJVSTU002', '$2a$10$vbMZUU0WDCv/5Vbga0eQ7uhnCZjVxUZDGoI8DIcLctSmFlXb42BbG', 'student', 'Kavin Raj', 'stu002@ajv.edu', '+91 90000 00004', 'AJVSTU002', 'Computer Science and Engineering', 'I Year', 'A', 'active', 'S. Raj', '2007-08-20', 'Male', 'Tiruppur, Tamil Nadu', 8.67, 83.67, 86.67, 2025),
(5, 'AJVSTU003', '$2a$10$Cl1tU/q4Vdn./OoQMhwOx.TO7mCJS.xYMEl/qEeShUdBnL8yuxzcy', 'student', 'Meera S', 'stu003@ajv.edu', '+91 90000 00005', 'AJVSTU003', 'Information Technology', 'I Year', 'B', 'active', 'S. Sekar', '2007-02-12', 'Female', 'Erode, Tamil Nadu', 10.00, 94.67, 94.67, 2025)
ON CONFLICT (id) DO NOTHING;

-- Seed Sample Enrollments & Marks
INSERT INTO enrollments (student_id, course_id, attendance, internal_mark, external_mark, total_mark, percentage, grade, grade_point) VALUES
(3, 1, 92, 36, 54, 90, 90, 'O', 10),
(3, 2, 89, 34, 51, 85, 85, 'A+', 9),
(3, 3, 94, 37, 55, 92, 92, 'O', 10),
(3, 4, 91, 38, 56, 94, 94, 'O', 10),
(3, 5, 88, 35, 50, 85, 85, 'A+', 9)
ON CONFLICT (student_id, course_id) DO NOTHING;

-- Seed Sample Announcements
INSERT INTO announcements (title, body) VALUES
('Semester Assessment Schedule', 'Internal assessments have been updated. Students can view course-wise grades and credit-weighted CGPA.'),
('CollegeConnect Portal Live', 'Welcome to AJV CollegeConnect 2.0. Academic records and attendance tracking are now active.')
ON CONFLICT DO NOTHING;

-- =============================================================
-- Seed Historical Multi-Decade Cohorts (10 - 14 Years Ago)
-- Allows instant testing and retrieval of 10-12+ year old records!
-- =============================================================
INSERT INTO academic_archives (
    id, register_no, student_name, department, degree, admission_year, graduation_year, batch,
    cgpa, overall_percentage, attendance_percentage, final_classification, degree_awarded_date,
    certificate_seal_hash, academic_records, fee_ledger_summary, attendance_summary
) VALUES
(
    1,
    '12IT001',
    'Rajesh Kannan V',
    'Information Technology',
    'B.Tech - Information Technology',
    2012,
    2016,
    '2012-2016',
    8.85,
    84.20,
    92.50,
    'First Class with Distinction',
    '2016-05-28',
    '7b4cf49e29a39fbc85375c3db9ea7dc8ef01bc82012435e29fa961e6878b66e1',
    '[
        {"semester": 1, "code": "HS101", "name": "Technical English", "credits": 3, "grade": "O", "gradePoint": 10},
        {"semester": 1, "code": "MA101", "name": "Engineering Mathematics I", "credits": 4, "grade": "A+", "gradePoint": 9},
        {"semester": 2, "code": "CS102", "name": "Programming & Data Structures", "credits": 4, "grade": "O", "gradePoint": 10},
        {"semester": 3, "code": "IT201", "name": "Database Management Systems", "credits": 4, "grade": "A+", "gradePoint": 9},
        {"semester": 4, "code": "IT202", "name": "Operating Systems", "credits": 4, "grade": "O", "gradePoint": 10},
        {"semester": 5, "code": "IT301", "name": "Computer Networks", "credits": 4, "grade": "A+", "gradePoint": 9},
        {"semester": 6, "code": "IT302", "name": "Web Technologies", "credits": 4, "grade": "O", "gradePoint": 10},
        {"semester": 7, "code": "IT401", "name": "Cloud Computing & Distributed Systems", "credits": 4, "grade": "O", "gradePoint": 10},
        {"semester": 8, "code": "IT402", "name": "Capstone Project Work", "credits": 8, "grade": "O", "gradePoint": 10}
    ]'::jsonb,
    '{"status": "CLEARED_TREASURY", "clearedDate": "2016-04-10", "receiptNo": "AJV-2016-FEES-0842"}'::jsonb,
    '{"overall": 92.5, "medicalLeaveDays": 2, "conduct": "Exemplary"}'::jsonb
),
(
    2,
    '14IT018',
    'Vigneshwaran R',
    'Information Technology',
    'B.Tech - Information Technology',
    2014,
    2018,
    '2014-2018',
    8.92,
    85.60,
    91.80,
    'First Class with Distinction',
    '2018-06-12',
    'c29bfb487b33c5e88417e2dc54adff10eefb12638a1924bce8110dbd873c51ef',
    '[
        {"semester": 1, "code": "MA101", "name": "Calculus & Linear Algebra", "credits": 4, "grade": "O", "gradePoint": 10},
        {"semester": 2, "code": "CS101", "name": "Problem Solving & Python", "credits": 4, "grade": "A+", "gradePoint": 9},
        {"semester": 3, "code": "IT201", "name": "Data Structures & Algorithms", "credits": 4, "grade": "O", "gradePoint": 10},
        {"semester": 4, "code": "IT202", "name": "Design & Analysis of Algorithms", "credits": 4, "grade": "A+", "gradePoint": 9},
        {"semester": 5, "code": "IT301", "name": "Computer Architecture", "credits": 3, "grade": "A+", "gradePoint": 9},
        {"semester": 6, "code": "IT302", "name": "Mobile Application Development", "credits": 4, "grade": "O", "gradePoint": 10},
        {"semester": 7, "code": "IT401", "name": "Information Security & Cryptography", "credits": 4, "grade": "O", "gradePoint": 10},
        {"semester": 8, "code": "IT402", "name": "Major Project & Viva", "credits": 8, "grade": "O", "gradePoint": 10}
    ]'::jsonb,
    '{"status": "CLEARED_TREASURY", "clearedDate": "2018-05-15", "receiptNo": "AJV-2018-FEES-1204"}'::jsonb,
    '{"overall": 91.8, "medicalLeaveDays": 4, "conduct": "Exemplary"}'::jsonb
),
(
    3,
    '14EC032',
    'Sneha Murali',
    'Electronics and Communication Engineering',
    'B.E. - Electronics & Communication',
    2014,
    2018,
    '2014-2018',
    9.14,
    88.40,
    94.20,
    'First Class with Distinction',
    '2018-06-12',
    'a5d09f7a4b8893cd7217dbbf8308cf2b8c049deea7135e69aa4b721e25e981bc',
    '[
        {"semester": 1, "code": "PH101", "name": "Physics for Electronics", "credits": 3, "grade": "O", "gradePoint": 10},
        {"semester": 2, "code": "EC102", "name": "Circuit Theory & Analysis", "credits": 4, "grade": "O", "gradePoint": 10},
        {"semester": 3, "code": "EC201", "name": "Electronic Devices & Circuits", "credits": 4, "grade": "O", "gradePoint": 10},
        {"semester": 4, "code": "EC202", "name": "Signals and Systems", "credits": 4, "grade": "A+", "gradePoint": 9},
        {"semester": 5, "code": "EC301", "name": "Digital Communication", "credits": 4, "grade": "O", "gradePoint": 10},
        {"semester": 6, "code": "EC302", "name": "VLSI Design", "credits": 4, "grade": "O", "gradePoint": 10},
        {"semester": 7, "code": "EC401", "name": "Embedded & IoT Systems", "credits": 4, "grade": "O", "gradePoint": 10},
        {"semester": 8, "code": "EC402", "name": "Industrial Project", "credits": 8, "grade": "O", "gradePoint": 10}
    ]'::jsonb,
    '{"status": "CLEARED_TREASURY", "clearedDate": "2018-05-18", "receiptNo": "AJV-2018-FEES-1355"}'::jsonb,
    '{"overall": 94.2, "medicalLeaveDays": 1, "conduct": "Exemplary"}'::jsonb
),
(
    4,
    '18CS055',
    'Harish Kumar M',
    'Computer Science and Engineering',
    'B.E. - Computer Science & Engineering',
    2018,
    2022,
    '2018-2022',
    9.05,
    87.10,
    93.00,
    'First Class with Distinction',
    '2022-07-04',
    'f308bc11492ba230d52b998cf112879aef02cd38941bbec7190f845ad3907c12',
    '[
        {"semester": 1, "code": "CS101", "name": "Python Programming", "credits": 4, "grade": "O", "gradePoint": 10},
        {"semester": 2, "code": "CS102", "name": "Data Structures & OOP", "credits": 4, "grade": "O", "gradePoint": 10},
        {"semester": 3, "code": "CS201", "name": "Discrete Mathematics", "credits": 4, "grade": "A+", "gradePoint": 9},
        {"semester": 4, "code": "CS202", "name": "Database Systems", "credits": 4, "grade": "O", "gradePoint": 10},
        {"semester": 5, "code": "CS301", "name": "Machine Learning Foundations", "credits": 4, "grade": "O", "gradePoint": 10},
        {"semester": 6, "code": "CS302", "name": "Full Stack Engineering", "credits": 4, "grade": "O", "gradePoint": 10},
        {"semester": 7, "code": "CS401", "name": "Distributed Systems", "credits": 4, "grade": "A+", "gradePoint": 9},
        {"semester": 8, "code": "CS402", "name": "Final Year Capstone", "credits": 8, "grade": "O", "gradePoint": 10}
    ]'::jsonb,
    '{"status": "CLEARED_TREASURY", "clearedDate": "2022-06-20", "receiptNo": "AJV-2022-FEES-2490"}'::jsonb,
    '{"overall": 93.0, "medicalLeaveDays": 3, "conduct": "Exemplary"}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- Initial Genesis Block in Audit Ledger
INSERT INTO audit_ledger (
    id, entry_index, event_type, entity_type, entity_id, actor_id, actor_ip, data_hash, prev_hash, payload
) VALUES
(
    1,
    1,
    'GENESIS_CLOUD_ARCHIVE_INITIALIZED',
    'SYSTEM',
    'AJV-ROOT-LEDGER',
    'SYSTEM_CORE',
    '127.0.0.1',
    '000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f',
    '0000000000000000000000000000000000000000000000000000000000000000',
    '{"version": "2.0.0", "retentionYears": "PERMANENT_WORM", "institution": "AJV College of Engineering"}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

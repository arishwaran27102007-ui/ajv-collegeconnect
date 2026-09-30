-- Database Schema for AJV College Connect

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
    attendance NUMERIC(5,2) DEFAULT 0
);

CREATE TABLE IF NOT EXISTS courses (
    id SERIAL PRIMARY KEY,
    code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    credits INTEGER NOT NULL,
    department VARCHAR(100) NOT NULL
);

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
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_id, course_id)
);

CREATE TABLE IF NOT EXISTS announcements (
    id SERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    body TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed Courses
INSERT INTO courses (id, code, name, credits, department) VALUES
(1, 'IT101', 'Programming in C', 3, 'Information Technology'),
(2, 'IT102', 'Data Structures', 3, 'Information Technology'),
(3, 'IT103', 'Digital Principles', 3, 'Information Technology'),
(4, 'IT104', 'Object Oriented Programming', 4, 'Information Technology'),
(5, 'MA101', 'Probability & Statistics', 4, 'Common'),
(6, 'CS101', 'Computer Fundamentals', 3, 'Common')
ON CONFLICT (id) DO NOTHING;

-- Seed Default Demo Users
-- Admin: ADMIN001 / Admin@123
-- Staff: FAC001 / Faculty@123
-- Student: AJVSTU001 / Student@123
INSERT INTO users (id, login_id, password_hash, role, full_name, email, phone, register_no, department, year, section, status, parent_name, dob, gender, address, cgpa, overall_percentage, attendance) VALUES
(1, 'ADMIN001', '$2a$10$qItnXLk4ef.SauR9ljbIge2SoVqmMXj/vtQv5ocNe0/dat1aTw.Pa', 'admin', 'AJV Administrator', 'admin@ajv.edu', '+91 90000 00001', 'ADMIN001', 'Administration', 'Staff', 'Office', 'active', NULL, NULL, NULL, 'Campus Admin Block', 0, 0, 0),
(2, 'FAC001', '$2a$10$wCjtYA/1MAVoQ8BVeQXLJul/HPySCksUa/l8GHxfLt1lBnGDfKfi6', 'staff', 'Dr. Priya Faculty', 'faculty01@ajv.edu', '+91 90000 00002', 'FAC001', 'Information Technology', 'Staff', 'Faculty', 'active', NULL, NULL, NULL, 'Faculty Quarters', 0, 0, 0),
(3, 'AJVSTU001', '$2a$10$7iqzH4iT8SEBsgn6W2ii1uZSljrhuLSStFSJjLhq9VFevFrOLLg8.', 'student', 'Ananya Kumar', 'stu001@ajv.edu', '+91 90000 00003', 'AJVSTU001', 'Information Technology', 'I Year', 'A', 'active', 'R. Kumar', '2007-04-15', 'Female', 'Coimbatore, Tamil Nadu', 9.59, 89.20, 90.80),
(4, 'AJVSTU002', '$2a$10$vbMZUU0WDCv/5Vbga0eQ7uhnCZjVxUZDGoI8DIcLctSmFlXb42BbG', 'student', 'Kavin Raj', 'stu002@ajv.edu', '+91 90000 00004', 'AJVSTU002', 'Computer Science and Engineering', 'I Year', 'A', 'active', 'S. Raj', '2007-08-20', 'Male', 'Tiruppur, Tamil Nadu', 8.67, 83.67, 86.67),
(5, 'AJVSTU003', '$2a$10$Cl1tU/q4Vdn./OoQMhwOx.TO7mCJS.xYMEl/qEeShUdBnL8yuxzcy', 'student', 'Meera S', 'stu003@ajv.edu', '+91 90000 00005', 'AJVSTU003', 'Information Technology', 'I Year', 'B', 'active', 'S. Sekar', '2007-02-12', 'Female', 'Erode, Tamil Nadu', 10.00, 94.67, 94.67)
ON CONFLICT (id) DO NOTHING;

-- Seed Sample Enrollments & Marks for AJVSTU001
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

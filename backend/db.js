const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const { Pool } = require("pg");

const DATA_DIR = path.join(__dirname, "..", "data");
const DB_JSON_PATH = path.join(DATA_DIR, "db.json");

let pool = null;
let dbMode = "json"; // "postgres" or "json"
let jsonDb = null;

// Helper to calculate academic grades and points
function gradeFor(total) {
  if (total >= 90) return { grade: "O", point: 10 };
  if (total >= 80) return { grade: "A+", point: 9 };
  if (total >= 70) return { grade: "A", point: 8 };
  if (total >= 60) return { grade: "B+", point: 7 };
  if (total >= 50) return { grade: "B", point: 6 };
  if (total >= 40) return { grade: "C", point: 5 };
  return { grade: "RA", point: 0 };
}

// Convert PostgreSQL user row to standard camelCase object
function formatPgUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    loginId: row.login_id,
    passwordHash: row.password_hash,
    role: row.role,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    registerNo: row.register_no,
    department: row.department,
    year: row.year,
    section: row.section,
    status: row.status,
    parentName: row.parent_name,
    dob: row.dob ? new Date(row.dob).toISOString().split("T")[0] : null,
    gender: row.gender,
    address: row.address,
    cgpa: Number(row.cgpa || 0),
    overallPercentage: Number(row.overall_percentage || 0),
    attendance: Number(row.attendance || 0)
  };
}

// JSON file database utilities
function loadJsonDb() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (fs.existsSync(DB_JSON_PATH)) {
    try {
      jsonDb = JSON.parse(fs.readFileSync(DB_JSON_PATH, "utf8"));
      if (!jsonDb.announcements) jsonDb.announcements = [];
      if (!jsonDb.counters) jsonDb.counters = { student: 3, faculty: 1 };
      if (!jsonDb.resultsPublication) {
        jsonDb.resultsPublication = {
          "1": { isPublished: true, publishedAt: "2026-09-15T10:00:00.000Z", publishedBy: "AJV Controller of Examinations" },
          "2": { isPublished: true, publishedAt: "2026-09-20T11:00:00.000Z", publishedBy: "AJV Controller of Examinations" },
          "3": { isPublished: false, publishedAt: null, publishedBy: null },
          "4": { isPublished: false, publishedAt: null, publishedBy: null },
          "5": { isPublished: false, publishedAt: null, publishedBy: null },
          "6": { isPublished: false, publishedAt: null, publishedBy: null },
          "7": { isPublished: false, publishedAt: null, publishedBy: null },
          "8": { isPublished: false, publishedAt: null, publishedBy: null }
        };
      }
      return jsonDb;
    } catch (e) {
      console.error("[Database] Failed to read db.json, creating initial backup:", e.message);
    }
  }

  // Initial seed dataset for JSON mode
  jsonDb = {
    meta: { college: "AJV College of Engineering", version: 4 },
    counters: { student: 3, faculty: 1 },
    users: [
      {
        id: 1,
        loginId: "ADMIN001",
        passwordHash: "$2a$10$qItnXLk4ef.SauR9ljbIge2SoVqmMXj/vtQv5ocNe0/dat1aTw.Pa",
        role: "admin",
        fullName: "AJV Administrator",
        email: "admin@ajv.edu",
        phone: "+91 90000 00001",
        registerNo: "ADMIN001",
        department: "Administration",
        year: "Staff",
        section: "Office",
        status: "active"
      },
      {
        id: 2,
        loginId: "FAC001",
        passwordHash: "$2a$10$wCjtYA/1MAVoQ8BVeQXLJul/HPySCksUa/l8GHxfLt1lBnGDfKfi6",
        role: "staff",
        fullName: "Dr. Priya Faculty",
        email: "faculty01@ajv.edu",
        phone: "+91 90000 00002",
        registerNo: "FAC001",
        department: "Information Technology",
        year: "Staff",
        section: "Faculty",
        status: "active"
      },
      {
        id: 3,
        loginId: "AJVSTU001",
        passwordHash: "$2a$10$7iqzH4iT8SEBsgn6W2ii1uZSljrhuLSStFSJjLhq9VFevFrOLLg8.",
        role: "student",
        fullName: "Ananya Kumar",
        email: "ananya0001@ajv.edu",
        phone: "+91 90000 00003",
        parentName: "R. Kumar",
        dob: "2007-04-15",
        gender: "Female",
        registerNo: "AJVSTU001",
        department: "Information Technology",
        year: "I Year",
        section: "A",
        address: "Coimbatore, Tamil Nadu",
        cgpa: 9.59,
        overallPercentage: 89.2,
        attendance: 90.8,
        status: "active"
      }
    ],
    courses: [
      { id: 1, code: "IT101", name: "Programming in C", credits: 3, department: "Information Technology" },
      { id: 2, code: "IT102", name: "Data Structures", credits: 3, department: "Information Technology" },
      { id: 3, code: "IT103", name: "Digital Principles", credits: 3, department: "Information Technology" },
      { id: 4, code: "IT104", name: "Object Oriented Programming", credits: 4, department: "Information Technology" },
      { id: 5, code: "MA101", name: "Probability & Statistics", credits: 4, department: "Common" },
      { id: 6, code: "CS101", name: "Computer Fundamentals", credits: 3, department: "Common" }
    ],
    enrollments: [
      { id: 1, studentId: 3, courseId: 1, attendance: 92, internalMark: 36, externalMark: 54, totalMark: 90, percentage: 90, grade: "O", gradePoint: 10 },
      { id: 2, studentId: 3, courseId: 2, attendance: 89, internalMark: 34, externalMark: 51, totalMark: 85, percentage: 85, grade: "A+", gradePoint: 9 },
      { id: 3, studentId: 3, courseId: 3, attendance: 94, internalMark: 37, externalMark: 55, totalMark: 92, percentage: 92, grade: "O", gradePoint: 10 },
      { id: 4, studentId: 3, courseId: 4, attendance: 91, internalMark: 38, externalMark: 56, totalMark: 94, percentage: 94, grade: "O", gradePoint: 10 },
      { id: 5, studentId: 3, courseId: 5, attendance: 88, internalMark: 35, externalMark: 50, totalMark: 85, percentage: 85, grade: "A+", gradePoint: 9 }
    ],
    announcements: [
      { id: 1, title: "Semester Assessment Schedule", body: "Internal assessments have been updated. Students can view course-wise grades and credit-weighted CGPA.", createdAt: new Date().toISOString() },
      { id: 2, title: "CollegeConnect Portal Live", body: "Welcome to AJV CollegeConnect 2.0. Academic records and attendance tracking are now active.", createdAt: new Date().toISOString() }
    ]
  };

  saveJsonDb();
  return jsonDb;
}

function saveJsonDb() {
  try {
    fs.writeFileSync(DB_JSON_PATH, JSON.stringify(jsonDb, null, 2), "utf8");
  } catch (err) {
    console.error("[Database] Error writing to db.json:", err.message);
  }
}

// Initialize database connection
async function initDb() {
  const dbUrl = process.env.DATABASE_URL;

  if (dbUrl) {
    try {
      pool = new Pool({
        connectionString: dbUrl,
        connectionTimeoutMillis: 3000
      });
      const client = await pool.connect();
      client.release();
      dbMode = "postgres";
      console.log("[Database] Connected successfully to PostgreSQL.");

      const schemaFile = path.join(__dirname, "schema.sql");
      if (fs.existsSync(schemaFile)) {
        try {
          const sql = fs.readFileSync(schemaFile, "utf8");
          await pool.query(sql);
          console.log("[Database] PostgreSQL tables verified.");
        } catch (e) {
          console.warn("[Database] Schema check warning:", e.message);
        }
      }
      return;
    } catch (e) {
      console.warn(`[Database] PostgreSQL connection failed (${e.message}). Falling back to JSON database.`);
    }
  }

  dbMode = "json";
  loadJsonDb();
  console.log(`[Database] Running in Zero-Config persistent JSON mode (${DB_JSON_PATH}).`);
}

// -------------------------------------------------------------
// Core Database Queries
// -------------------------------------------------------------

async function getHealth() {
  if (dbMode === "postgres") {
    await pool.query("SELECT 1");
    return { ok: true, backend: "online", database: "postgresql", college: "AJV College of Engineering" };
  }
  return { ok: true, backend: "online", database: "json", college: "AJV College of Engineering", records: jsonDb.users.length };
}

async function findUserByLoginId(loginIdOrEmail, requestedRole) {
  const cleanId = String(loginIdOrEmail || "").trim();
  if (dbMode === "postgres") {
    const res = await pool.query(
      `SELECT * FROM users 
       WHERE (LOWER(login_id) = LOWER($1) OR LOWER(email) = LOWER($1)) 
       AND role = $2`,
      [cleanId, requestedRole]
    );
    return formatPgUser(res.rows[0]);
  }

  const u = jsonDb.users.find(
    x => ((x.loginId && x.loginId.toLowerCase() === cleanId.toLowerCase()) ||
          (x.email && x.email.toLowerCase() === cleanId.toLowerCase())) &&
         x.role === requestedRole
  );
  return u ? { ...u } : null;
}

async function findUserById(id) {
  const numId = Number(id);
  if (dbMode === "postgres") {
    const res = await pool.query("SELECT * FROM users WHERE id = $1", [numId]);
    return formatPgUser(res.rows[0]);
  }

  const u = jsonDb.users.find(x => x.id === numId);
  return u ? { ...u } : null;
}

async function findUserByEmail(email) {
  if (!email) return null;
  const cleanEmail = String(email).trim().toLowerCase();
  if (dbMode === "postgres") {
    const res = await pool.query("SELECT id FROM users WHERE LOWER(email) = $1", [cleanEmail]);
    return res.rows[0] ? formatPgUser(res.rows[0]) : null;
  }

  const u = jsonDb.users.find(x => x.email && x.email.toLowerCase() === cleanEmail);
  return u ? { ...u } : null;
}

// Student registration (no email and password required at submission time)
async function createStudentUser(userData) {
  if (dbMode === "postgres") {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const countRes = await client.query("SELECT COUNT(*) FROM users WHERE role = 'student'");
      const studentNumber = parseInt(countRes.rows[0].count) + 1;
      const loginId = `AJVSTU${String(studentNumber).padStart(3, "0")}`;

      const insertRes = await client.query(
        `INSERT INTO users (login_id, password_hash, role, full_name, email, phone, parent_name, dob, gender, register_no, department, year, section, address, status)
         VALUES ($1, NULL, 'student', $2, NULL, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'pending')
         RETURNING *`,
        [
          loginId,
          userData.fullName,
          userData.phone,
          userData.parentName,
          userData.dob,
          userData.gender,
          loginId,
          userData.department,
          userData.year,
          userData.section,
          userData.address
        ]
      );
      await client.query("COMMIT");
      return formatPgUser(insertRes.rows[0]);
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }

  // JSON mode
  if (!jsonDb.counters) jsonDb.counters = {};
  const currentCount = jsonDb.counters.student || jsonDb.users.filter(u => u.role === "student").length;
  const nextNum = currentCount + 1;
  jsonDb.counters.student = nextNum;

  const loginId = `AJVSTU${String(nextNum).padStart(3, "0")}`;
  const maxId = jsonDb.users.reduce((m, u) => Math.max(m, u.id || 0), 0);

  const newUser = {
    id: maxId + 1,
    loginId,
    passwordHash: null,
    role: "student",
    fullName: userData.fullName,
    email: null,
    phone: userData.phone,
    parentName: userData.parentName,
    dob: userData.dob,
    gender: userData.gender,
    registerNo: loginId,
    department: userData.department,
    year: userData.year,
    section: userData.section,
    address: userData.address,
    status: "pending",
    cgpa: 0,
    overallPercentage: 0,
    attendance: 0
  };

  jsonDb.users.push(newUser);
  saveJsonDb();
  return { ...newUser };
}

// Approve student: generates unique email <name><last4digits>@ajv.edu and temporary password ajv@123
async function approveStudent(studentId) {
  const student = await findUserById(studentId);
  if (!student) throw new Error("Student not found.");

  // Generate unique official email
  // Example: clean name + last 4 digits of student ID (e.g. ananyakumar0004@ajv.edu)
  const cleanName = student.fullName.toLowerCase().replace(/[^a-z0-9]/g, "");
  const numDigits = student.loginId.replace(/\D/g, "");
  const last4 = numDigits ? numDigits.padStart(4, "0").slice(-4) : student.loginId.slice(-4).toLowerCase();
  const generatedEmail = `${cleanName}${last4}@ajv.edu`;

  // Default initial password
  const tempPassword = "ajv@123";
  const passwordHash = bcrypt.hashSync(tempPassword, 10);

  const updated = await updateUser(student.id, {
    status: "active",
    email: generatedEmail,
    passwordHash,
    mustChangePassword: true
  });

  return {
    user: updated,
    generatedEmail,
    temporaryPassword: tempPassword
  };
}

// Issue Faculty ID (Admin only)
async function createFacultyUser(facultyData) {
  const tempPassword = facultyData.password || "Faculty@123";
  const passwordHash = bcrypt.hashSync(tempPassword, 10);

  if (dbMode === "postgres") {
    const countRes = await pool.query("SELECT COUNT(*) FROM users WHERE role = 'staff'");
    const facultyNum = parseInt(countRes.rows[0].count) + 1;
    const loginId = `FAC${String(facultyNum).padStart(3, "0")}`;

    const insertRes = await pool.query(
      `INSERT INTO users (login_id, password_hash, role, full_name, email, phone, register_no, department, year, section, status)
       VALUES ($1, $2, 'staff', $3, $4, $5, $6, $7, 'Staff', $8, 'active')
       RETURNING *`,
      [
        loginId,
        passwordHash,
        facultyData.fullName,
        facultyData.email,
        facultyData.phone,
        loginId,
        facultyData.department,
        facultyData.section || "Faculty"
      ]
    );
    return formatPgUser(insertRes.rows[0]);
  }

  // JSON mode
  if (!jsonDb.counters) jsonDb.counters = {};
  const currentCount = jsonDb.counters.faculty || jsonDb.users.filter(u => u.role === "staff").length;
  const nextNum = currentCount + 1;
  jsonDb.counters.faculty = nextNum;

  const loginId = `FAC${String(nextNum).padStart(3, "0")}`;
  const maxId = jsonDb.users.reduce((m, u) => Math.max(m, u.id || 0), 0);

  const newFaculty = {
    id: maxId + 1,
    loginId,
    passwordHash,
    role: "staff",
    fullName: facultyData.fullName,
    email: facultyData.email,
    phone: facultyData.phone,
    registerNo: loginId,
    department: facultyData.department,
    year: "Staff",
    section: facultyData.section || "Faculty",
    status: "active",
    cgpa: 0,
    overallPercentage: 0,
    attendance: 0
  };

  jsonDb.users.push(newFaculty);
  saveJsonDb();
  return { ...newFaculty };
}

async function listFaculty() {
  if (dbMode === "postgres") {
    const res = await pool.query("SELECT * FROM users WHERE role = 'staff' ORDER BY login_id ASC");
    return res.rows.map(formatPgUser);
  }
  return jsonDb.users.filter(u => u.role === "staff").map(u => ({ ...u }));
}

async function deleteFaculty(id) {
  const numId = Number(id);
  if (dbMode === "postgres") {
    const res = await pool.query("DELETE FROM users WHERE id = $1 AND role = 'staff' RETURNING id", [numId]);
    return res.rowCount > 0;
  }
  const initLen = jsonDb.users.length;
  jsonDb.users = jsonDb.users.filter(u => !(u.id === numId && u.role === "staff"));
  saveJsonDb();
  return jsonDb.users.length < initLen;
}

async function deleteStudent(id) {
  const numId = Number(id);
  if (dbMode === "postgres") {
    await pool.query("DELETE FROM enrollments WHERE student_id = $1", [numId]);
    const res = await pool.query("DELETE FROM users WHERE id = $1 AND role = 'student' RETURNING id", [numId]);
    return res.rowCount > 0;
  }
  const initLen = jsonDb.users.length;
  jsonDb.users = jsonDb.users.filter(u => !(u.id === numId && u.role === "student"));
  jsonDb.enrollments = (jsonDb.enrollments || []).filter(e => Number(e.studentId) !== numId);
  saveJsonDb();
  return jsonDb.users.length < initLen;
}

async function updateUser(id, updates) {
  const numId = Number(id);
  if (dbMode === "postgres") {
    const keys = Object.keys(updates);
    if (!keys.length) return findUserById(numId);

    const mapField = {
      passwordHash: "password_hash",
      fullName: "full_name",
      email: "email",
      phone: "phone",
      status: "status",
      cgpa: "cgpa",
      overallPercentage: "overall_percentage",
      attendance: "attendance"
    };

    const setClauses = [];
    const values = [];
    keys.forEach((k, idx) => {
      const col = mapField[k] || k;
      setClauses.push(`${col} = $${idx + 1}`);
      values.push(updates[k]);
    });
    values.push(numId);

    const res = await pool.query(
      `UPDATE users SET ${setClauses.join(", ")} WHERE id = $${values.length} RETURNING *`,
      values
    );
    return formatPgUser(res.rows[0]);
  }

  const u = jsonDb.users.find(x => x.id === numId);
  if (!u) return null;
  Object.assign(u, updates);
  saveJsonDb();
  return { ...u };
}

async function listStudents() {
  if (dbMode === "postgres") {
    const res = await pool.query("SELECT * FROM users WHERE role = 'student' ORDER BY register_no ASC");
    return res.rows.map(formatPgUser);
  }
  return jsonDb.users
    .filter(u => u.role === "student")
    .map(u => ({ ...u }))
    .sort((a, b) => String(a.registerNo || "").localeCompare(String(b.registerNo || "")));
}

async function listPendingStudents() {
  if (dbMode === "postgres") {
    const res = await pool.query("SELECT * FROM users WHERE role = 'student' AND status = 'pending' ORDER BY id ASC");
    return res.rows.map(formatPgUser);
  }
  return jsonDb.users
    .filter(u => u.role === "student" && u.status === "pending")
    .map(u => ({ ...u }));
}

async function getCourses(semester = null, department = null) {
  if (dbMode === "postgres") {
    let query = "SELECT * FROM courses WHERE 1=1";
    const params = [];
    if (semester) {
      params.push(Number(semester));
      query += ` AND semester = $${params.length}`;
    }
    if (department && department !== "All") {
      params.push(department);
      query += ` AND (department = $${params.length} OR department = 'Common')`;
    }
    query += " ORDER BY semester ASC, id ASC";
    const res = await pool.query(query, params);
    return res.rows;
  }

  let list = [...jsonDb.courses];
  if (semester) {
    list = list.filter(c => Number(c.semester) === Number(semester));
  }
  if (department && department !== "All") {
    list = list.filter(c => c.department === department || c.department === "Common");
  }
  return list;
}

async function getCourseRecords(studentId, semester = null) {
  const numId = Number(studentId);
  const numSem = semester ? Number(semester) : null;

  if (dbMode === "postgres") {
    let q = `
      SELECT e.*, c.code, c.name, c.credits, c.semester as course_semester, c.department as course_department
      FROM enrollments e
      JOIN courses c ON e.course_id = c.id
      WHERE e.student_id = $1
    `;
    const p = [numId];
    if (numSem) {
      p.push(numSem);
      q += ` AND (e.semester = $2 OR c.semester = $2)`;
    }
    q += " ORDER BY c.code ASC";
    const res = await pool.query(q, p);

    return res.rows.map(r => ({
      id: r.id,
      semester: Number(r.semester || r.course_semester || 1),
      attendance: Number(r.attendance),
      internalMark: Number(r.internal_mark),
      externalMark: Number(r.external_mark),
      totalMark: Number(r.total_mark),
      percentage: Number(r.percentage),
      grade: r.grade,
      gradePoint: Number(r.grade_point),
      course: {
        id: r.course_id,
        code: r.code,
        name: r.name,
        credits: Number(r.credits),
        semester: Number(r.course_semester || 1),
        department: r.course_department
      }
    }));
  }

  // JSON mode
  const records = jsonDb.enrollments.filter(e => Number(e.studentId) === numId);
  const mapped = records.map(r => {
    const c = jsonDb.courses.find(x => x.id === Number(r.courseId)) || {};
    const sem = Number(r.semester || c.semester || 1);
    return {
      id: r.id,
      semester: sem,
      attendance: Number(r.attendance || 0),
      internalMark: Number(r.internalMark || 0),
      externalMark: Number(r.externalMark || 0),
      totalMark: Number(r.totalMark || 0),
      percentage: Number(r.percentage || 0),
      grade: r.grade,
      gradePoint: Number(r.gradePoint || 0),
      course: {
        id: c.id || r.courseId,
        code: c.code || "",
        name: c.name || "",
        credits: Number(c.credits || 3),
        semester: Number(c.semester || sem),
        department: c.department || ""
      }
    };
  });

  if (numSem) {
    return mapped.filter(r => r.semester === numSem || r.course.semester === numSem);
  }
  return mapped;
}

async function upsertEnrollment(studentId, courseId, data) {
  const sId = Number(studentId);
  const cId = Number(courseId);
  const totalMark = Number(data.internalMark || 0) + Number(data.externalMark || 0);
  const g = gradeFor(totalMark);

  // Find course to get default semester
  const course = (jsonDb.courses || []).find(c => c.id === cId) || {};
  const semester = Number(data.semester || course.semester || 1);

  if (dbMode === "postgres") {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const existing = await client.query("SELECT id FROM enrollments WHERE student_id = $1 AND course_id = $2", [sId, cId]);
      let recId;
      if (existing.rows.length > 0) {
        recId = existing.rows[0].id;
        await client.query(`
          UPDATE enrollments
          SET attendance = $1, internal_mark = $2, external_mark = $3, total_mark = $4, percentage = $5, grade = $6, grade_point = $7, semester = $8, updated_at = CURRENT_TIMESTAMP
          WHERE id = $9
        `, [data.attendance, data.internalMark, data.externalMark, totalMark, totalMark, g.grade, g.point, semester, recId]);
      } else {
        const ins = await client.query(`
          INSERT INTO enrollments (student_id, course_id, attendance, internal_mark, external_mark, total_mark, percentage, grade, grade_point, semester)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id
        `, [sId, cId, data.attendance, data.internalMark, data.externalMark, totalMark, totalMark, g.grade, g.point, semester]);
        recId = ins.rows[0].id;
      }
      await client.query("COMMIT");
      return recId;
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }

  // JSON mode
  let rec = jsonDb.enrollments.find(e => Number(e.studentId) === sId && Number(e.courseId) === cId);
  if (rec) {
    rec.attendance = data.attendance;
    rec.internalMark = data.internalMark;
    rec.externalMark = data.externalMark;
    rec.totalMark = totalMark;
    rec.percentage = totalMark;
    rec.grade = g.grade;
    rec.gradePoint = g.point;
    rec.semester = semester;
    rec.updatedAt = new Date().toISOString();
  } else {
    const maxId = jsonDb.enrollments.reduce((m, x) => Math.max(m, x.id || 0), 0);
    rec = {
      id: maxId + 1,
      studentId: sId,
      courseId: cId,
      semester,
      attendance: data.attendance,
      internalMark: data.internalMark,
      externalMark: data.externalMark,
      totalMark: totalMark,
      percentage: totalMark,
      grade: g.grade,
      gradePoint: g.point,
      updatedAt: new Date().toISOString()
    };
    jsonDb.enrollments.push(rec);
  }
  saveJsonDb();
  return rec.id;
}

// -------------------------------------------------------------
// Official Result Publishing (Admin Only) & Semester Marksheets
// -------------------------------------------------------------

async function getPublishedSemesters() {
  if (dbMode === "postgres") {
    try {
      const res = await pool.query("SELECT * FROM results_publication ORDER BY semester ASC");
      const map = {};
      res.rows.forEach(r => {
        map[String(r.semester)] = { isPublished: Boolean(r.is_published), publishedAt: r.published_at, publishedBy: r.published_by };
      });
      return map;
    } catch {
      return {};
    }
  }
  return jsonDb.resultsPublication || {};
}

async function isSemesterPublished(semester) {
  const s = String(semester);
  if (dbMode === "postgres") {
    try {
      const res = await pool.query("SELECT is_published FROM results_publication WHERE semester = $1", [Number(s)]);
      return res.rows[0] ? Boolean(res.rows[0].is_published) : false;
    } catch {
      return false;
    }
  }
  const pub = jsonDb.resultsPublication && jsonDb.resultsPublication[s];
  return pub ? Boolean(pub.isPublished) : false;
}

async function setSemesterPublishStatus(semester, isPublished, publishedBy = "AJV Controller of Examinations", sessionName = null) {
  const s = String(semester);
  const numS = Number(semester);
  const pubAt = isPublished ? new Date().toISOString() : null;
  const pubBy = isPublished ? publishedBy : null;
  const session = sessionName || "April / May 2026 End Semester Examinations";

  if (dbMode === "postgres") {
    await pool.query(`
      INSERT INTO results_publication (semester, is_published, published_at, published_by)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (semester) DO UPDATE
      SET is_published = $2, published_at = $3, published_by = $4
    `, [numS, isPublished, pubAt, pubBy]);
    return { semester: numS, isPublished: Boolean(isPublished), publishedAt: pubAt, publishedBy: pubBy, sessionName: session };
  }

  if (!jsonDb.resultsPublication) jsonDb.resultsPublication = {};
  jsonDb.resultsPublication[s] = {
    isPublished: Boolean(isPublished),
    publishedAt: pubAt,
    publishedBy: pubBy,
    sessionName: session
  };
  saveJsonDb();
  return { semester: numS, isPublished: Boolean(isPublished), publishedAt: pubAt, publishedBy: pubBy, sessionName: session };
}

async function getAllSemestersAnalytics() {
  const published = await getPublishedSemesters();
  const students = (await listStudents()).filter(s => s.status === "active");
  const yearMap = { 1: "I Year", 2: "I Year", 3: "II Year", 4: "II Year", 5: "III Year", 6: "III Year", 7: "IV Year", 8: "IV Year" };

  const analytics = {};

  for (let sem = 1; sem <= 8; sem++) {
    const sStr = String(sem);
    const pub = published[sStr] || { isPublished: false };
    const targetYear = yearMap[sem];
    const semStudents = students.filter(s => s.year === targetYear || !s.year);
    const evalList = [];

    for (const student of students) {
      const records = await getCourseRecords(student.id, sem);
      if (records.length > 0) {
        const valid = records.filter(r => r.grade && r.grade !== "—");
        if (valid.length > 0) {
          const totalCredits = valid.reduce((acc, r) => acc + Number(r.course?.credits || 0), 0);
          const weightedSum = valid.reduce((acc, r) => acc + (Number(r.gradePoint || 0) * Number(r.course?.credits || 0)), 0);
          const sgpa = totalCredits ? Number((weightedSum / totalCredits).toFixed(2)) : 0;
          const hasRA = records.some(r => r.grade === "RA");
          const isComplete = records.every(r => r.grade && r.grade !== "—");
          evalList.push({
            studentId: student.id,
            fullName: student.fullName,
            loginId: student.loginId,
            sgpa,
            hasRA,
            isComplete
          });
        }
      }
    }

    const totalEvaluated = evalList.length;
    const passedCount = evalList.filter(e => !e.hasRA && e.isComplete).length;
    const raCount = evalList.filter(e => e.hasRA).length;
    const pendingCount = evalList.filter(e => !e.isComplete && !e.hasRA).length;
    const passPercentage = totalEvaluated > 0 ? Number(((passedCount / totalEvaluated) * 100).toFixed(1)) : 0;
    const avgSgpa = totalEvaluated > 0 ? Number((evalList.reduce((acc, e) => acc + e.sgpa, 0) / totalEvaluated).toFixed(2)) : 0;
    const maxSgpa = totalEvaluated > 0 ? Math.max(...evalList.map(e => e.sgpa)) : 0;

    analytics[sStr] = {
      semester: sem,
      year: targetYear,
      isPublished: Boolean(pub.isPublished),
      publishedAt: pub.publishedAt,
      publishedBy: pub.publishedBy,
      sessionName: pub.sessionName || "Regular End Semester Examinations",
      totalEligible: semStudents.length,
      totalEvaluated,
      passedCount,
      raCount,
      pendingCount,
      passPercentage,
      avgSgpa,
      maxSgpa,
      valuationStatus: totalEvaluated === 0 ? "NOT_STARTED" : (pendingCount > 0 ? "IN_PROGRESS" : "READY_TO_PUBLISH")
    };
  }

  return analytics;
}

async function getSemesterBroadsheet(semester) {
  const sem = Number(semester);
  const courses = await getCourses(sem);
  const students = (await listStudents()).filter(s => s.status === "active");
  const published = await isSemesterPublished(sem);
  const pubStatus = (await getPublishedSemesters())[String(sem)] || {};

  const rows = [];
  for (const student of students) {
    const records = await getCourseRecords(student.id, sem);
    if (records.length > 0) {
      const semResult = await getSemesterResult(student.id, sem);
      rows.push({
        student: {
          id: student.id,
          fullName: student.fullName,
          loginId: student.loginId,
          department: student.department,
          year: student.year,
          section: student.section || "A"
        },
        records: records.map(r => ({
          courseId: r.course?.id,
          code: r.course?.code,
          name: r.course?.name,
          credits: r.course?.credits,
          internalMark: r.internalMark,
          externalMark: r.externalMark,
          totalMark: r.totalMark,
          grade: r.grade,
          gradePoint: r.gradePoint
        })),
        sgpa: semResult ? semResult.sgpa : 0,
        cgpa: semResult ? semResult.cgpa : 0,
        resultStatus: semResult ? semResult.resultStatus : "INCOMPLETE",
        earnedCredits: semResult ? semResult.earnedCredits : 0,
        totalCredits: semResult ? semResult.totalCredits : 0
      });
    }
  }

  return {
    semester: sem,
    isPublished: published,
    publishedAt: pubStatus.publishedAt,
    publishedBy: pubStatus.publishedBy,
    sessionName: pubStatus.sessionName || "Regular End Semester Examinations",
    courses,
    rows
  };
}

async function getSemesterResult(studentId, semester) {
  const sId = Number(studentId);
  const sem = Number(semester);
  const student = await findUserById(sId);
  if (!student) return null;

  const isPublished = await isSemesterPublished(sem);
  const allPub = await getPublishedSemesters();
  const pubStatus = allPub[String(sem)] || {};

  // Retrieve records for this semester
  let records = await getCourseRecords(sId, sem);

  // If no enrolled records exist for this semester, load course templates
  if (!records.length) {
    const semCourses = await getCourses(sem, student.department);
    records = semCourses.map(c => ({
      id: null,
      semester: sem,
      attendance: 0,
      internalMark: 0,
      externalMark: 0,
      totalMark: 0,
      percentage: 0,
      grade: "—",
      gradePoint: 0,
      course: c
    }));
  }

  const validRecords = records.filter(r => r.grade && r.grade !== "—");
  const totalCredits = validRecords.reduce((s, r) => s + Number(r.course.credits || 0), 0);
  const earnedCredits = validRecords.filter(r => r.grade !== "RA")
    .reduce((s, r) => s + Number(r.course.credits || 0), 0);

  const weightedSum = validRecords.reduce((s, r) => s + (Number(r.gradePoint || 0) * Number(r.course.credits || 0)), 0);
  const sgpa = totalCredits ? Number((weightedSum / totalCredits).toFixed(2)) : 0;

  // Cumulative CGPA calculation
  const allRecords = await getCourseRecords(sId);
  const allValid = allRecords.filter(r => r.semester <= sem && r.grade && r.grade !== "—");
  const totalCgpaCredits = allValid.reduce((s, r) => s + Number(r.course.credits || 0), 0);
  const totalCgpaWeighted = allValid.reduce((s, r) => s + (Number(r.gradePoint || 0) * Number(r.course.credits || 0)), 0);
  const cgpa = totalCgpaCredits ? Number((totalCgpaWeighted / totalCgpaCredits).toFixed(2)) : sgpa;

  const hasRA = records.some(r => r.grade === "RA");
  const hasPending = records.some(r => r.grade === "—");
  let resultStatus = "PASS";
  if (hasPending) resultStatus = "INCOMPLETE";
  else if (hasRA) resultStatus = "RA";

  let classification = "First Class with Distinction";
  if (hasRA || cgpa < 6.5) classification = "Second Class";
  else if (cgpa < 8.5) classification = "First Class";

  const yearMap = { 1: "I Year", 2: "I Year", 3: "II Year", 4: "II Year", 5: "III Year", 6: "III Year", 7: "IV Year", 8: "IV Year" };

  return {
    isPublished,
    publishedAt: pubStatus.publishedAt || null,
    publishedBy: pubStatus.publishedBy || null,
    semester: sem,
    year: yearMap[sem] || student.year,
    student,
    courses: records,
    sgpa,
    cgpa,
    totalCredits,
    earnedCredits,
    resultStatus,
    classification,
    serialNo: `AJV/COE/${new Date().getFullYear()}/SEM${sem}/${String(student.id).padStart(4, "0")}`,
    issueDate: new Date().toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" }),
    institution: {
      name: "AJV COLLEGE OF ENGINEERING",
      tagline: "An Autonomous Institution • Affiliated to Anna University, Chennai",
      accreditation: "Approved by AICTE, New Delhi • Accredited by NAAC with 'A++' Grade • NBA Accredited",
      office: "OFFICE OF THE CONTROLLER OF EXAMINATIONS",
      sealCode: "AJV-COE-OFFICIAL-SEAL",
      regulations: "Regulations 2021 (Choice Based Credit System)"
    }
  };
}

async function recalculateAcademic(studentId) {
  const sId = Number(studentId);
  const records = await getCourseRecords(sId);

  const totalMax = records.length * 100;
  const totalObtained = records.reduce((sum, x) => sum + Number(x.totalMark || 0), 0);
  const overallPercentage = totalMax ? Number(((totalObtained / totalMax) * 100).toFixed(2)) : 0;
  const totalCredits = records.reduce((sum, x) => sum + Number(x.course.credits || 0), 0);
  const weightedPoints = records.reduce((sum, x) => sum + Number(x.gradePoint || 0) * Number(x.course.credits || 0), 0);
  const cgpa = totalCredits ? Number((weightedPoints / totalCredits).toFixed(2)) : 0;
  const attendance = records.length ? Number((records.reduce((s, x) => s + Number(x.attendance || 0), 0) / records.length).toFixed(2)) : 0;

  await updateUser(sId, { cgpa, overallPercentage, attendance });

  return { overallPercentage, cgpa, attendance, totalObtained, totalMax, totalCredits };
}

async function getStaffDashboardStats() {
  if (dbMode === "postgres") {
    const studentRes = await pool.query("SELECT * FROM users WHERE role = 'student' ORDER BY id DESC");
    const staffRes = await pool.query("SELECT COUNT(*) FROM users WHERE role = 'staff'");
    const courseRes = await pool.query("SELECT COUNT(*) FROM courses");
    const deptRes = await pool.query("SELECT COUNT(DISTINCT department) FROM users WHERE role = 'student'");
    const pendingRes = await pool.query("SELECT COUNT(*) FROM users WHERE role = 'student' AND status = 'pending'");

    const students = studentRes.rows.map(formatPgUser);
    return {
      counts: {
        students: students.length,
        staff: parseInt(staffRes.rows[0].count),
        courses: parseInt(courseRes.rows[0].count),
        departments: deptRes.rows.length,
        pending: parseInt(pendingRes.rows[0].count)
      },
      recent: students.slice(0, 8)
    };
  }

  const students = jsonDb.users.filter(u => u.role === "student");
  const staff = jsonDb.users.filter(u => u.role === "staff");
  const courses = jsonDb.courses || [];
  const depts = new Set(students.map(s => s.department).filter(Boolean));
  const pending = students.filter(s => s.status === "pending");

  return {
    counts: {
      students: students.length,
      staff: staff.length,
      courses: courses.length,
      departments: depts.size,
      pending: pending.length
    },
    recent: [...students].reverse().slice(0, 8).map(u => ({ ...u }))
  };
}

async function getAnnouncements() {
  if (dbMode === "postgres") {
    const res = await pool.query("SELECT * FROM announcements ORDER BY created_at DESC LIMIT 20");
    return res.rows.map(r => ({
      id: r.id,
      title: r.title,
      body: r.body,
      createdAt: r.created_at
    }));
  }

  return (jsonDb.announcements || []).slice().reverse();
}

async function createAnnouncement(title, body) {
  const cleanTitle = String(title || "").trim();
  const cleanBody = String(body || "").trim();

  if (dbMode === "postgres") {
    const res = await pool.query(
      "INSERT INTO announcements (title, body) VALUES ($1, $2) RETURNING *",
      [cleanTitle, cleanBody]
    );
    const row = res.rows[0];
    return { id: row.id, title: row.title, body: row.body, createdAt: row.created_at };
  }

  if (!jsonDb.announcements) jsonDb.announcements = [];
  const maxId = jsonDb.announcements.reduce((m, x) => Math.max(m, x.id || 0), 0);
  const ann = {
    id: maxId + 1,
    title: cleanTitle,
    body: cleanBody,
    createdAt: new Date().toISOString()
  };
  jsonDb.announcements.push(ann);
  saveJsonDb();
  return { ...ann };
}

async function deleteAnnouncement(id) {
  const numId = Number(id);
  if (dbMode === "postgres") {
    const res = await pool.query("DELETE FROM announcements WHERE id = $1 RETURNING id", [numId]);
    return res.rowCount > 0;
  }

  if (!jsonDb.announcements) return false;
  const initLen = jsonDb.announcements.length;
  jsonDb.announcements = jsonDb.announcements.filter(a => a.id !== numId);
  saveJsonDb();
  return jsonDb.announcements.length < initLen;
}

module.exports = {
  initDb,
  getHealth,
  findUserByLoginId,
  findUserById,
  findUserByEmail,
  createStudentUser,
  approveStudent,
  createFacultyUser,
  listFaculty,
  deleteFaculty,
  deleteStudent,
  updateUser,
  listStudents,
  listPendingStudents,
  getCourses,
  getCourseRecords,
  upsertEnrollment,
  recalculateAcademic,
  getStaffDashboardStats,
  getAnnouncements,
  createAnnouncement,
  deleteAnnouncement,
  gradeFor,
  getPublishedSemesters,
  isSemesterPublished,
  setSemesterPublishStatus,
  getSemesterResult,
  getAllSemestersAnalytics,
  getSemesterBroadsheet,
  getDbMode: () => dbMode
};

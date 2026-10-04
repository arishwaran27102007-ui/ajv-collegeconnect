require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const path = require("path");
const db = require("./db");
const Razorpay = require("razorpay");
const crypto = require("crypto");

let razorpay = null;
if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
  razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
  });
}

const app = express();
const PORT = Number(process.env.PORT || 5000);
const JWT_SECRET = process.env.JWT_SECRET || "ajv-collegeconnect-local-secret";
const FRONTEND = path.join(__dirname, "..", "frontend");

app.set("trust proxy", true);
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// Basic Security Headers (Helmet-like)
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline' https://checkout.razorpay.com; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' https://api.razorpay.com https://lumberjack.razorpay.com; frame-src https://api.razorpay.com;");
  next();
});

// Basic Request Logging (Morgan-like)
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`);
  });
  next();
});

app.use(express.static(FRONTEND, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith(".html") || filePath.endsWith(".js") || filePath.endsWith("sw.js")) {
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
    }
  }
}));

const departments = [
  "Information Technology",
  "Computer Science and Engineering",
  "Electronics and Communication Engineering",
  "Electrical and Electronics Engineering",
  "Mechanical Engineering",
  "Artificial Intelligence and Data Science"
];
const years = ["I Year", "II Year", "III Year", "IV Year"];

function clean(v) { return String(v ?? "").trim(); }

function getClientIp(req) {
  const forwarded = (req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  const remote = req.socket ? (req.socket.remoteAddress || "") : "";
  const raw = forwarded || req.ip || remote;
  return raw.replace(/^::ffff:/, "").trim();
}

// IP / Host Authorization for Admin Console
// ONLY accessible from the college WiFi network (10.43.120.x)
// Any other WiFi or mobile data connection is BLOCKED
const os = require('os');
const { execSync } = require('child_process');

function isAuthorizedAdminIP(req) {
  // Removed IP restriction to allow admin access from any network
  // (e.g. Render). Access is still secured by admin credentials.
  return true;
}

function publicUser(u) {
  if (!u) return null;
  const { passwordHash, ...safe } = u;
  return {
    id: safe.id,
    loginId: safe.loginId,
    role: safe.role,
    fullName: safe.fullName,
    email: safe.email,
    phone: safe.phone,
    registerNo: safe.registerNo,
    department: safe.department,
    year: safe.year,
    section: safe.section,
    status: safe.status,
    parentName: safe.parentName,
    dob: safe.dob,
    gender: safe.gender,
    address: safe.address,
    cgpa: Number(safe.cgpa || 0),
    overallPercentage: Number(safe.overallPercentage || 0),
    attendance: Number(safe.attendance || 0),
    mustChangePassword: Boolean(safe.mustChangePassword)
  };
}

function tokenFor(u) {
  return jwt.sign({ id: u.id, role: u.role, loginId: u.loginId }, JWT_SECRET, { expiresIn: "8h" });
}

function auth(req, res, next) {
  const h = req.headers.authorization || "";
  if (!h.startsWith("Bearer ")) return res.status(401).json({ message: "Authentication required." });
  try {
    req.user = jwt.verify(h.slice(7), JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ message: "Session expired. Please login again." });
  }
}

function role(...roles) {
  return (req, res, next) => roles.includes(req.user.role)
    ? next()
    : res.status(403).json({ message: "Access denied for this account." });
}

// -------------------------------------------------------------
// Health & Configuration
// -------------------------------------------------------------

app.get("/api/health", async (_req, res) => {
  try {
    const health = await db.getHealth();
    res.json(health);
  } catch (e) {
    res.status(500).json({ ok: false, backend: "online", database: "error", error: e.message });
  }
});

app.get("/api/config", (req, res) => {
  res.json({
    college: "AJV College of Engineering",
    departments,
    years,
    isAdminAllowed: isAuthorizedAdminIP(req),
    clientIp: getClientIp(req),
    razorpayKeyId: process.env.RAZORPAY_KEY_ID || null
  });
});

// Simple in-memory rate limiting for login (max 10 attempts per 15 minutes per IP)
const loginAttempts = new Map();
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 10;

function checkLoginRateLimit(req, res) {
  const ip = getClientIp(req);
  const now = Date.now();
  const record = loginAttempts.get(ip);

  if (record) {
    // Clean expired entries
    if (now - record.windowStart > LOGIN_WINDOW_MS) {
      loginAttempts.set(ip, { count: 1, windowStart: now });
      return true;
    }
    if (record.count >= MAX_LOGIN_ATTEMPTS) {
      const retryAfterSec = Math.ceil((record.windowStart + LOGIN_WINDOW_MS - now) / 1000);
      res.status(429).json({ message: `Too many login attempts. Please wait ${Math.ceil(retryAfterSec / 60)} minute(s) before trying again.` });
      return false;
    }
    record.count++;
  } else {
    loginAttempts.set(ip, { count: 1, windowStart: now });
  }
  return true;
}

// Periodically clean stale entries (every 30 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of loginAttempts) {
    if (now - record.windowStart > LOGIN_WINDOW_MS) loginAttempts.delete(ip);
  }
}, 30 * 60 * 1000);

app.post("/api/auth/login", async (req, res) => {
  if (!checkLoginRateLimit(req, res)) return;
  const loginId = clean(req.body.loginId);
  const password = String(req.body.password || "");
  const requestedRole = clean(req.body.role).toLowerCase();

  if (!loginId || !password || !requestedRole) {
    return res.status(400).json({ message: "Login ID, password and account type are required." });
  }

  // Admin IP Protection
  if (requestedRole === "admin" && !isAuthorizedAdminIP(req)) {
    return res.status(403).json({
      message: `Admin login is strictly restricted to the authorized host (${process.env.ADMIN_IP || "10.43.120.56"}).`
    });
  }

  try {
    const user = await db.findUserByLoginId(loginId, requestedRole);
    if (!user) {
      return res.status(401).json({ message: "Invalid Login ID or password." });
    }
    if (user.status === "pending") {
      return res.status(403).json({
        message: "Your registration is pending faculty approval. Official email and credentials will be issued upon acceptance."
      });
    }
    if (user.status === "rejected") {
      return res.status(403).json({ message: "Your registration was rejected by faculty." });
    }
    // Fallback password only works if user has NOT yet changed from temporary default
    const isStudentPassFallback = user.role === "student" && user.mustChangePassword && (password === "ajv@123");
    if (!user.passwordHash || (!bcrypt.compareSync(password, user.passwordHash) && !isStudentPassFallback)) {
      return res.status(401).json({ message: "Invalid Login ID or password." });
    }

    res.json({ token: tokenFor(user), user: publicUser(user) });
  } catch (error) {
    console.error("[Auth] Login error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.put("/api/auth/change-password", auth, async (req, res) => {
  const currentPassword = String(req.body.currentPassword || "");
  const newPassword = String(req.body.newPassword || "");

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: "Current and new password are required." });
  }

  const passRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{8,}$/;
  if (!passRegex.test(newPassword)) {
    return res.status(400).json({ message: "Password must be at least 8 characters long, contain an uppercase letter, a lowercase letter, a number, and a special character." });
  }

  try {
    const user = await db.findUserById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found." });

    if (!user.passwordHash || !bcrypt.compareSync(currentPassword, user.passwordHash)) {
      return res.status(400).json({ message: "Current password is incorrect." });
    }

    const newHash = bcrypt.hashSync(newPassword, 10);
    const updated = await db.updateUser(user.id, { passwordHash: newHash, mustChangePassword: false });

    res.json({ message: "Password updated successfully.", user: publicUser(updated) });
  } catch (e) {
    console.error("[Auth] Change password error:", e);
    res.status(500).json({ message: "Server error" });
  }
});

// -------------------------------------------------------------
// Student Registration (No email & password input required)
// -------------------------------------------------------------

app.post("/api/students/register", async (req, res) => {
  const fullName = clean(req.body.fullName);
  const phone = clean(req.body.phone);
  const parentName = clean(req.body.parentName);
  const dob = clean(req.body.dob);
  const gender = clean(req.body.gender);
  const department = clean(req.body.department);
  const year = clean(req.body.year);
  const section = clean(req.body.section);
  const address = clean(req.body.address);

  if (![fullName, phone, parentName, dob, gender, department, year, section, address].every(Boolean)) {
    return res.status(400).json({ message: "Please fill every mandatory field." });
  }
  if (!departments.includes(department)) return res.status(400).json({ message: "Please select a valid department." });
  if (!years.includes(year)) return res.status(400).json({ message: "Please select a valid year." });
  if (!/^\d{10}$/.test(phone.replace(/\D/g, ""))) return res.status(400).json({ message: "Enter a valid 10-digit phone number." });

  try {
    const student = await db.createStudentUser({
      fullName,
      phone: phone.replace(/\D/g, ""),
      parentName,
      dob,
      gender,
      department,
      year,
      section,
      address
    });

    res.status(201).json({
      message: "Registration submitted successfully. Awaiting faculty approval.",
      loginId: student.loginId,
      registerNo: student.registerNo,
      studentName: student.fullName
    });
  } catch (error) {
    console.error("[Student Registration Error]:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// -------------------------------------------------------------
// Profile Management
// -------------------------------------------------------------

app.get("/api/me", auth, async (req, res) => {
  try {
    const user = await db.findUserById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found." });
    res.json(publicUser(user));
  } catch (e) {
    res.status(500).json({ message: "Server error" });
  }
});

app.put("/api/profile", auth, async (req, res) => {
  const fullName = clean(req.body.fullName);
  const email = clean(req.body.email).toLowerCase();
  const phone = clean(req.body.phone);

  if (!fullName) return res.status(400).json({ message: "Name is required." });

  try {
    if (email) {
      const existing = await db.findUserByEmail(email);
      if (existing && existing.id !== req.user.id) {
        return res.status(409).json({ message: "Email is already in use." });
      }
    }

    const updated = await db.updateUser(req.user.id, { fullName, email: email || null, phone });
    if (!updated) return res.status(404).json({ message: "User not found." });

    res.json({ message: "Profile updated successfully.", user: publicUser(updated) });
  } catch (e) {
    res.status(500).json({ message: "Server error" });
  }
});

// -------------------------------------------------------------
// Student Dashboard
// -------------------------------------------------------------

app.get("/api/student/dashboard", auth, role("student"), async (req, res) => {
  try {
    const user = await db.findUserById(req.user.id);
    if (!user) return res.status(404).json({ message: "Student not found." });

    const academic = await db.recalculateAcademic(user.id);
    const courses = await db.getCourseRecords(user.id);
    const announcements = await db.getAnnouncements();

    // Check if user is still on temporary password ajv@123
    const isTempPassword = user.passwordHash && bcrypt.compareSync("ajv@123", user.passwordHash);

    res.json({
      profile: publicUser(user),
      academic,
      courses,
      announcements: announcements.slice(0, 6),
      isTempPassword
    });
  } catch (e) {
    console.error("[Student Dashboard Error]:", e);
    res.status(500).json({ message: "Server error" });
  }
});

// -------------------------------------------------------------
// Staff Dashboard & Student Operations
// -------------------------------------------------------------

app.get("/api/staff/dashboard", auth, role("staff", "admin"), async (_req, res) => {
  try {
    const stats = await db.getStaffDashboardStats();
    res.json(stats);
  } catch (e) {
    console.error("[Staff Dashboard Error]:", e);
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/api/staff/pending-students", auth, role("staff", "admin"), async (_req, res) => {
  try {
    const pending = await db.listPendingStudents();
    res.json(pending.map(publicUser));
  } catch (e) {
    res.status(500).json({ message: "Server error" });
  }
});

// Faculty approval generates official email <name><last4digits>@ajv.edu and temporary password ajv@123
app.put("/api/staff/students/:id/status", auth, role("staff", "admin"), async (req, res) => {
  const { status } = req.body;
  if (!["active", "rejected"].includes(status)) return res.status(400).json({ message: "Invalid status" });

  try {
    if (status === "active") {
      const approval = await db.approveStudent(req.params.id);
      return res.json({
        message: `Student registration approved successfully. Official email: ${approval.generatedEmail} | Initial Password: ${approval.temporaryPassword}`,
        user: publicUser(approval.user),
        generatedEmail: approval.generatedEmail,
        temporaryPassword: approval.temporaryPassword
      });
    }

    const updated = await db.updateUser(req.params.id, { status: "rejected" });
    if (!updated || updated.role !== "student") return res.status(404).json({ message: "Student not found." });
    res.json({ message: "Student registration rejected.", user: publicUser(updated) });
  } catch (e) {
    console.error("[Approve Error]:", e);
    res.status(500).json({ message: e.message || "Server error" });
  }
});

// Bulk student approval
app.post("/api/staff/students/bulk-approve", auth, role("staff", "admin"), async (req, res) => {
  const ids = Array.isArray(req.body.studentIds) ? req.body.studentIds : [];
  if (!ids.length) return res.status(400).json({ message: "No students selected for approval." });

  try {
    const results = [];
    for (const sid of ids) {
      try {
        const approval = await db.approveStudent(sid);
        results.push({
          id: sid,
          loginId: approval.user.loginId,
          registerNo: approval.user.registerNo,
          fullName: approval.user.fullName,
          department: approval.user.department,
          year: approval.user.year,
          section: approval.user.section,
          generatedEmail: approval.generatedEmail,
          temporaryPassword: approval.temporaryPassword
        });
      } catch (err) {
        console.warn(`[Bulk Approve] Skip student ${sid}:`, err.message);
      }
    }
    res.json({
      message: `Successfully approved ${results.length} student(s).`,
      approved: results
    });
  } catch (e) {
    console.error("[Bulk Approve Error]:", e);
    res.status(500).json({ message: "Bulk approval failed" });
  }
});

app.get("/api/staff/students", auth, role("staff", "admin"), async (_req, res) => {
  try {
    const students = await db.listStudents();
    res.json(students.map(publicUser));
  } catch (e) {
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/api/staff/students/:id", auth, role("staff", "admin"), async (req, res) => {
  try {
    const student = await db.findUserById(req.params.id);
    if (!student || student.role !== "student") return res.status(404).json({ message: "Student not found." });

    const academic = await db.recalculateAcademic(student.id);
    const courses = await db.getCourseRecords(student.id);

    res.json({ student: publicUser(student), academic, courses });
  } catch (e) {
    console.error("[Staff Student View Error]:", e);
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/api/courses", auth, async (req, res) => {
  try {
    const semester = req.query.semester ? Number(req.query.semester) : null;
    const department = req.query.department || null;
    const courses = await db.getCourses(semester, department);
    res.json(courses);
  } catch (e) {
    res.status(500).json({ message: "Server error" });
  }
});

// -------------------------------------------------------------
// Official Result Publishing (Admin Only) & Semester Marksheets
// -------------------------------------------------------------

// Get overall publication status of all 8 semesters
app.get("/api/results/status", auth, async (_req, res) => {
  try {
    const publishedSemesters = await db.getPublishedSemesters();
    res.json({ publishedSemesters });
  } catch (e) {
    res.status(500).json({ message: "Server error" });
  }
});

// Admin-only: Publish or Unpublish semester results
// Comprehensive Examination Analytics for all 8 Semesters (Admin Only)
app.get("/api/admin/results/analytics", auth, role("admin"), async (req, res) => {
  try {
    const analytics = await db.getAllSemestersAnalytics();
    res.json({ analytics });
  } catch (e) {
    console.error("[Results Analytics Error]:", e);
    res.status(500).json({ message: "Failed to generate examination analytics." });
  }
});

// Tabulated Mark Register (TMR) / Broadsheet for Examination Board (Admin & Staff)
app.get("/api/admin/results/broadsheet/:semester", auth, role("admin", "staff"), async (req, res) => {
  const semester = Number(req.params.semester);
  if (!semester || semester < 1 || semester > 8) {
    return res.status(400).json({ message: "Valid semester (1 to 8) is required." });
  }

  try {
    const broadsheet = await db.getSemesterBroadsheet(semester);
    res.json(broadsheet);
  } catch (e) {
    console.error("[Broadsheet Error]:", e);
    res.status(500).json({ message: "Failed to load examination broadsheet." });
  }
});

// Publish / Unpublish Single Semester (Admin Only)
app.post("/api/admin/results/publish", auth, role("admin"), async (req, res) => {
  const semester = Number(req.body.semester);
  const isPublished = Boolean(req.body.isPublished);
  const sessionName = req.body.sessionName ? String(req.body.sessionName).trim() : null;
  const broadcastAnnouncement = req.body.broadcastAnnouncement !== false;
  const customNotice = req.body.customNotice ? String(req.body.customNotice).trim() : null;
  const department = req.body.department || "ALL";
  const year = req.body.year || "ALL";

  if (!semester || semester < 1 || semester > 8) {
    return res.status(400).json({ message: "Valid semester (1 to 8) is required." });
  }

  try {
    const adminUser = await db.findUserById(req.user.id);
    const publisherName = adminUser ? adminUser.fullName : "AJV Controller of Examinations";
    const status = await db.setSemesterPublishStatus(semester, isPublished, department, year, publisherName, sessionName);

    // Optional campus bulletin broadcast
    if (isPublished && broadcastAnnouncement) {
      const defaultNotice = `The Controller of Examinations has officially published the Semester ${semester} results (${sessionName || 'Regular Session'}). Students and faculty can now view statements of grades and download official marksheets with the institutional seal.`;
      await db.createAnnouncement(
        `Official Result Published: Semester ${semester}`,
        customNotice || defaultNotice
      ).catch(() => {});
    }

    res.json({
      message: isPublished
        ? `Semester ${semester} results published successfully! Marksheets with institutional seal are now active.`
        : `Semester ${semester} results unpublished.`,
      status
    });
  } catch (e) {
    console.error("[Publish Results Error]:", e);
    res.status(500).json({ message: "Failed to update publication status." });
  }
});

// Bulk Publish / Unpublish by Academic Year (Admin Only)
app.post("/api/admin/results/publish-year", auth, role("admin"), async (req, res) => {
  const year = req.body.year; // e.g. "I Year", "II Year", "III Year", "IV Year"
  const isPublished = Boolean(req.body.isPublished);
  const department = req.body.department || "ALL";
  const yearMap = {
    "I Year": [1, 2],
    "II Year": [3, 4],
    "III Year": [5, 6],
    "IV Year": [7, 8]
  };

  const sems = yearMap[year];
  if (!sems) {
    return res.status(400).json({ message: "Invalid academic year specified." });
  }

  try {
    const adminUser = await db.findUserById(req.user.id);
    const publisherName = adminUser ? adminUser.fullName : "AJV Controller of Examinations";

    for (const sem of sems) {
      await db.setSemesterPublishStatus(sem, isPublished, department, year, publisherName);
    }

    if (isPublished) {
      await db.createAnnouncement(
        `Official Results Published: ${year} (Semesters ${sems.join(" & ")})`,
        `The Controller of Examinations has officially released the ${year} semester examination results. All students can now inspect semester marks and print sealed official marksheets.`
      ).catch(() => {});
    }

    res.json({
      message: `${year} results (Semesters ${sems.join(" & ")}) ${isPublished ? 'published' : 'unpublished'} successfully!`
    });
  } catch (e) {
    console.error("[Publish Year Error]:", e);
    res.status(500).json({ message: "Failed to update year publication status." });
  }
});

// View Semester Result & Marksheet (Accessible by Student, Faculty, and Admin)
app.get("/api/results/semester/:semester", auth, async (req, res) => {
  const semester = Number(req.params.semester);
  if (!semester || semester < 1 || semester > 8) {
    return res.status(400).json({ message: "Valid semester (1 to 8) is required." });
  }

  let studentId = req.user.id;
  if (req.user.role === "staff" || req.user.role === "admin") {
    studentId = req.query.studentId ? Number(req.query.studentId) : req.user.id;
  }

  try {
    const student = await db.findUserById(studentId);
    if (!student || student.role !== "student") {
      return res.status(404).json({ message: "Student record not found." });
    }

    // Restriction 1: Student can only view results of their currently studying year or below
    const yearMaxSem = {
      "I Year": 2,
      "II Year": 4,
      "III Year": 6,
      "IV Year": 8
    };
    const maxSem = yearMaxSem[student.year] || 2;
    if (req.user.role === "student" && semester > maxSem) {
      return res.json({
        isPublished: false,
        isEligible: false,
        semester,
        studentName: student.fullName,
        registerNo: student.registerNo,
        studentYear: student.year,
        maxEligibleSemester: maxSem,
        message: `Semester ${semester} belongs to a higher academic year. As a ${student.year} student, your enrolled curriculum covers Semesters 1 to ${maxSem}. Results for Semester ${semester} are restricted to students studying in that academic year.`
      });
    }

    const isPublished = await db.isSemesterPublished(semester);

    // If student is requesting and semester is not published by admin, deny display
    if (req.user.role === "student" && !isPublished) {
      return res.json({
        isPublished: false,
        isEligible: true,
        semester,
        studentName: student.fullName,
        registerNo: student.registerNo,
        message: `Semester ${semester} result has not been published yet by the Controller of Examinations. Please check back after official announcement.`
      });
    }

    const result = await db.getSemesterResult(studentId, semester);
    if (!result) return res.status(404).json({ message: "Result data unavailable." });

    result.isEligible = true;
    res.json(result);
  } catch (e) {
    console.error("[Semester Result Error]:", e);
    res.status(500).json({ message: "Failed to retrieve semester result." });
  }
});

// -------------------------------------------------------------
// College Fee Payment & Official Receipts Endpoints
// -------------------------------------------------------------

// Get all fees & dues summary for a student
app.get("/api/student/fees", auth, async (req, res) => {
  let targetId = req.user.id;
  if ((req.user.role === "staff" || req.user.role === "admin") && req.query.studentId) {
    targetId = Number(req.query.studentId);
  }

  try {
    const feeData = await db.getStudentFees(targetId);
    if (!feeData) return res.status(404).json({ message: "Student fee profile not found." });
    res.json(feeData);
  } catch (err) {
    console.error("[Fees Fetch Error]:", err);
    res.status(500).json({ message: "Failed to load fee information." });
  }
});
// Razorpay Create Order Endpoint
app.post("/api/create-order", auth, async (req, res) => {
  try {
    const { amount, receipt } = req.body;
    if (!amount || amount < 100) return res.status(400).json({ message: "Invalid amount." });
    if (!razorpay) return res.status(500).json({ message: "Razorpay is not configured on the server." });

    const order = await razorpay.orders.create({
      amount: amount,
      currency: "INR",
      receipt: receipt || "receipt_" + Date.now()
    });

    res.json({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency
    });
  } catch (err) {
    console.error("[Razorpay Order Error]:", err);
    res.status(500).json({ message: "Failed to create payment order." });
  }
});

// Razorpay Verify Signature Endpoint
app.post("/api/verify-payment", auth, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ message: "Missing payment verification fields." });
    }

    const secret = process.env.RAZORPAY_KEY_SECRET;
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto.createHmac("sha256", secret).update(body.toString()).digest("hex");

    if (expectedSignature === razorpay_signature) {
      res.json({ success: true, message: "Payment verified successfully" });
    } else {
      res.status(400).json({ message: "Invalid signature. Payment verification failed." });
    }
  } catch (err) {
    console.error("[Razorpay Verification Error]:", err);
    res.status(500).json({ message: "Payment verification error." });
  }
});

// Pay single fee item (UPI, NetBanking, Card)
app.post("/api/student/fees/:id/pay", auth, async (req, res) => {
  let targetId = req.user.id;
  if ((req.user.role === "staff" || req.user.role === "admin") && req.body.studentId) {
    targetId = Number(req.body.studentId);
  }

  const feeId = Number(req.params.id);
  try {
    const paymentResult = await db.payStudentFee(targetId, feeId, req.body);
    res.json(paymentResult);
  } catch (err) {
    console.error("[Fee Payment Error]:", err);
    res.status(400).json({ message: err.message || "Payment transaction failed." });
  }
});

// Pay all outstanding dues in one consolidated transaction
app.post("/api/student/fees/pay-all", auth, async (req, res) => {
  let targetId = req.user.id;
  if ((req.user.role === "staff" || req.user.role === "admin") && req.body.studentId) {
    targetId = Number(req.body.studentId);
  }

  try {
    const batchResult = await db.payAllStudentFees(targetId, req.body);
    res.json(batchResult);
  } catch (err) {
    console.error("[Consolidated Fee Payment Error]:", err);
    res.status(400).json({ message: err.message || "Consolidated payment failed." });
  }
});

// Official Fee Payment Receipt with Institution Seal
app.get("/api/fees/receipt/:feeId", auth, async (req, res) => {
  try {
    const receipt = await db.getFeeReceipt(req.params.feeId);
    if (!receipt) return res.status(404).json({ message: "Official receipt not found or fee unpaid." });

    // Ensure student only accesses their own receipt unless staff/admin
    if (req.user.role === "student" && receipt.student.loginId !== req.user.loginId) {
      return res.status(403).json({ message: "Unauthorized receipt access." });
    }

    res.json(receipt);
  } catch (err) {
    console.error("[Fee Receipt Error]:", err);
    res.status(500).json({ message: "Failed to generate receipt." });
  }
});

// Admin & Staff Fee Summary
app.get("/api/admin/fees/summary", auth, role("admin", "staff"), async (req, res) => {
  try {
    const summary = await db.getAllFeesSummary();
    res.json(summary);
  } catch (err) {
    console.error("[Fee Summary Error]:", err);
    res.status(500).json({ message: "Failed to compile fee collections." });
  }
});

// Mark entry / update (Faculty and Admin)
app.put("/api/staff/students/:id/marks", auth, role("staff", "admin"), async (req, res) => {
  const studentId = Number(req.params.id);
  const courseId = Number(req.body.courseId);
  const attendance = Number(req.body.attendance);
  const internalMark = Number(req.body.internalMark);
  const externalMark = Number(req.body.externalMark);
  const semester = req.body.semester ? Number(req.body.semester) : null;

  if (![attendance, internalMark, externalMark].every(Number.isFinite)) {
    return res.status(400).json({ message: "Enter valid numeric marks." });
  }
  if (attendance < 0 || attendance > 100) return res.status(400).json({ message: "Attendance must be between 0 and 100." });
  if (internalMark < 0 || internalMark > 40) return res.status(400).json({ message: "Internal mark must be between 0 and 40." });
  if (externalMark < 0 || externalMark > 60) return res.status(400).json({ message: "External mark must be between 0 and 60." });

  try {
    const student = await db.findUserById(studentId);
    if (!student || student.role !== "student") return res.status(404).json({ message: "Student not found." });

    const recordId = await db.upsertEnrollment(studentId, courseId, { attendance, internalMark, externalMark, semester });
    const academic = await db.recalculateAcademic(studentId);

    res.json({
      message: "Marks saved successfully. Grades, SGPA and CGPA calculated.",
      record: { id: recordId },
      academic
    });
  } catch (error) {
    console.error("[Mark Entry Error]:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.post("/api/staff/students/:id/reset-password", auth, role("admin"), async (req, res) => {
  // Admin reset always sets back to the default temp password "ajv@123"
  const tempPassword = "ajv@123";

  try {
    const hash = bcrypt.hashSync(tempPassword, 10);
    const updated = await db.updateUser(req.params.id, { passwordHash: hash, mustChangePassword: true });
    if (!updated || updated.role !== "student") return res.status(404).json({ message: "Student not found." });

    res.json({ message: `Student password reset to temporary default. They must change it on next login.` });
  } catch (e) {
    res.status(500).json({ message: "Server error" });
  }
});

// -------------------------------------------------------------
// Admin Dedicated Console (Faculty Management & System Protection)
// -------------------------------------------------------------

app.get("/api/admin/faculty", auth, role("admin"), async (_req, res) => {
  try {
    const faculty = await db.listFaculty();
    res.json(faculty.map(publicUser));
  } catch (e) {
    res.status(500).json({ message: "Server error" });
  }
});

// Admin issues new Faculty ID
app.post("/api/admin/faculty", auth, role("admin"), async (req, res) => {
  const fullName = clean(req.body.fullName);
  const email = clean(req.body.email).toLowerCase();
  const phone = clean(req.body.phone);
  const department = clean(req.body.department);
  const section = clean(req.body.section);
  const password = String(req.body.password || "Faculty@123");

  if (!fullName || !email || !department) {
    return res.status(400).json({ message: "Full Name, Email, and Department are required." });
  }

  try {
    const existing = await db.findUserByEmail(email);
    if (existing) return res.status(409).json({ message: "Email is already assigned to an account." });

    const newFaculty = await db.createFacultyUser({
      fullName,
      email,
      phone,
      department,
      section,
      password
    });

    res.status(201).json({
      message: `Faculty ID ${newFaculty.loginId} issued successfully. Initial password: ${password}`,
      faculty: publicUser(newFaculty),
      initialPassword: password
    });
  } catch (e) {
    console.error("[Issue Faculty Error]:", e);
    res.status(500).json({ message: "Server error" });
  }
});

app.delete("/api/admin/faculty/:id", auth, role("admin"), async (req, res) => {
  try {
    const ok = await db.deleteFaculty(req.params.id);
    if (!ok) return res.status(404).json({ message: "Faculty member not found." });
    res.json({ message: "Faculty account deleted successfully." });
  } catch (e) {
    res.status(500).json({ message: "Server error" });
  }
});

app.delete("/api/admin/students/:id", auth, role("admin"), async (req, res) => {
  try {
    const ok = await db.deleteStudent(req.params.id);
    if (!ok) return res.status(404).json({ message: "Student account not found." });
    res.json({ message: "Student account and records deleted." });
  } catch (e) {
    res.status(500).json({ message: "Server error" });
  }
});

// -------------------------------------------------------------
// Announcements
// -------------------------------------------------------------

app.get("/api/announcements", async (_req, res) => {
  try {
    const items = await db.getAnnouncements();
    res.json(items);
  } catch (e) {
    res.status(500).json({ message: "Server error" });
  }
});

app.post("/api/announcements", auth, role("staff", "admin"), async (req, res) => {
  const title = clean(req.body.title);
  const body = clean(req.body.body);

  if (!title || !body) return res.status(400).json({ message: "Title and notice body are required." });

  try {
    const created = await db.createAnnouncement(title, body);
    res.status(201).json({ message: "Announcement published successfully.", announcement: created });
  } catch (e) {
    res.status(500).json({ message: "Server error" });
  }
});

app.delete("/api/announcements/:id", auth, role("staff", "admin"), async (req, res) => {
  try {
    const ok = await db.deleteAnnouncement(req.params.id);
    if (!ok) return res.status(404).json({ message: "Announcement not found." });
    res.json({ message: "Announcement deleted successfully." });
  } catch (e) {
    res.status(500).json({ message: "Server error" });
  }
});

// -------------------------------------------------------------
// Grievances & Service Desk
// -------------------------------------------------------------

app.get("/api/grievances", auth, async (req, res) => {
  try {
    const filter = {};
    if (req.user.role === "student") {
      filter.studentId = req.user.id;
    } else if (req.query.studentId) {
      filter.studentId = req.query.studentId;
    }
    if (req.query.status) filter.status = req.query.status;

    const list = await db.getGrievances(filter);
    res.json(list);
  } catch (e) {
    res.status(500).json({ message: e.message || "Failed to load grievances" });
  }
});

app.post("/api/grievances", auth, async (req, res) => {
  const category = clean(req.body.category) || "General";
  const priority = clean(req.body.priority) || "Normal";
  const subject = clean(req.body.subject);
  const description = clean(req.body.description);

  if (!subject || !description) {
    return res.status(400).json({ message: "Subject and detailed description are required." });
  }

  try {
    const student = await db.findUserById(req.user.id);
    const created = await db.createGrievance({
      studentId: req.user.id,
      studentName: student ? student.fullName : req.user.loginId,
      registerNo: student ? student.registerNo : req.user.loginId,
      department: student ? student.department : "General",
      year: student ? student.year : "N/A",
      category,
      priority,
      subject,
      description
    });
    res.status(201).json({ message: "Ticket filed successfully. Tracking ID: " + created.ticketNo, grievance: created });
  } catch (e) {
    res.status(500).json({ message: e.message || "Failed to submit grievance" });
  }
});

app.put("/api/grievances/:id", auth, role("staff", "admin"), async (req, res) => {
  const status = clean(req.body.status);
  const responseNote = req.body.responseNote !== undefined ? clean(req.body.responseNote) : undefined;

  try {
    const updated = await db.updateGrievance(req.params.id, {
      status,
      responseNote,
      respondedBy: `${req.user.loginId} (${req.user.role.toUpperCase()})`
    });
    res.json({ message: "Grievance ticket updated successfully.", grievance: updated });
  } catch (e) {
    res.status(500).json({ message: e.message || "Failed to update grievance ticket" });
  }
});

// -------------------------------------------------------------
// Daily Subject Attendance Tracking
// -------------------------------------------------------------

app.post("/api/staff/attendance/session", auth, role("staff", "admin"), async (req, res) => {
  const { date, department, year, semester, courseCode, courseName, records } = req.body;
  if (!courseCode || !records || !Array.isArray(records)) {
    return res.status(400).json({ message: "Course code and student records are required." });
  }

  try {
    const session = await db.saveAttendanceSession({
      date: date || new Date().toISOString().split("T")[0],
      department,
      year,
      semester: Number(semester || 1),
      courseCode,
      courseName,
      facultyId: req.user.id,
      facultyName: req.user.loginId,
      records
    });
    res.status(201).json({ message: "Class attendance recorded and student percentages updated.", session });
  } catch (e) {
    res.status(500).json({ message: e.message || "Failed to save attendance session" });
  }
});

app.get("/api/student/attendance/subjects", auth, async (req, res) => {
  try {
    let studentId = req.user.id;
    if (req.user.role !== "student" && req.query.studentId) {
      studentId = Number(req.query.studentId);
    }
    const student = await db.findUserById(studentId);
    if (!student) return res.status(404).json({ message: "Student not found" });

    let targetSem = Number(req.query.semester);
    if (!targetSem || targetSem < 1 || targetSem > 8) {
      if (student.year === "I Year") targetSem = 2;
      else if (student.year === "II Year") targetSem = 4;
      else if (student.year === "III Year") targetSem = 6;
      else targetSem = 8;
    }

    const subjects = await db.getStudentSubjectAttendance(studentId, targetSem);
    res.json({
      student: {
        id: student.id,
        fullName: student.fullName,
        loginId: student.loginId,
        department: student.department,
        year: student.year,
        overallAttendance: student.attendance
      },
      semester: targetSem,
      subjects
    });
  } catch (e) {
    res.status(500).json({ message: e.message || "Failed to load subject attendance" });
  }
});

// -------------------------------------------------------------
// Exam Hall Ticket & Clearance
// -------------------------------------------------------------

app.get("/api/student/hall-ticket", auth, async (req, res) => {
  try {
    let studentId = req.user.id;
    if (req.user.role !== "student" && req.query.studentId) {
      studentId = Number(req.query.studentId);
    }
    const targetSem = req.query.semester ? Number(req.query.semester) : null;
    const data = await db.getHallTicket(studentId, targetSem);
    res.json(data);
  } catch (e) {
    res.status(500).json({ message: e.message || "Failed to generate hall ticket" });
  }
});

// -------------------------------------------------------------
// Data Export Endpoints (CSV / Excel)
// -------------------------------------------------------------

function csvEscape(val) {
  if (val === null || val === undefined) return '""';
  return `"${String(val).replace(/"/g, '""')}"`;
}

app.get("/api/admin/export/students", auth, role("admin", "staff"), async (_req, res) => {
  try {
    const students = await db.listStudents();
    const headers = ["ID", "Login ID", "Register No", "Full Name", "Email", "Phone", "Department", "Year", "Section", "CGPA", "Attendance %", "Status", "Parent Name", "DOB"];
    const rows = students.map(s => [
      s.id,
      s.loginId,
      s.registerNo || s.loginId,
      s.fullName,
      s.email,
      s.phone,
      s.department,
      s.year,
      s.section,
      s.cgpa,
      s.attendance,
      s.status,
      s.parentName,
      s.dob
    ].map(csvEscape).join(","));

    const csvContent = "\uFEFF" + [headers.map(csvEscape).join(","), ...rows].join("\r\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="AJV_Student_Master_Register.csv"');
    res.send(csvContent);
  } catch (e) {
    res.status(500).json({ message: "Export failed: " + e.message });
  }
});

app.get("/api/admin/export/broadsheet/:semester", auth, role("admin", "staff"), async (req, res) => {
  try {
    const sem = Number(req.params.semester || 1);
    const broadsheet = await db.getSemesterBroadsheet(sem);
    const headers = ["Register No", "Student Name", "Department", "Year", ...broadsheet.courses.map(c => `${c.code} (${c.name})`), "Total Marks", "Percentage", "GPA", "Result Status"];

    const rows = broadsheet.students.map(s => {
      const courseCols = broadsheet.courses.map(c => {
        const mark = s.marks[c.code];
        return mark ? `${mark.totalMark} [${mark.grade}]` : "-";
      });
      return [
        s.student.registerNo || s.student.loginId,
        s.student.fullName,
        s.student.department,
        s.student.year,
        ...courseCols,
        s.totalMarks,
        s.overallPercentage + "%",
        s.gpa,
        s.result
      ].map(csvEscape).join(",");
    });

    const csvContent = "\uFEFF" + [headers.map(csvEscape).join(","), ...rows].join("\r\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="AJV_Semester_${sem}_TMR_Broadsheet.csv"`);
    res.send(csvContent);
  } catch (e) {
    res.status(500).json({ message: "Broadsheet export failed: " + e.message });
  }
});

app.get("/api/admin/export/fees", auth, role("admin", "staff"), async (_req, res) => {
  try {
    const summary = await db.getAllFeesSummary();
    const headers = ["Student ID", "Login ID", "Student Name", "Department", "Year", "Total Assessed (INR)", "Total Paid (INR)", "Outstanding Due (INR)", "Clearance Status", "Pending Fees Count"];

    const rows = summary.studentsFees.map(item => [
      item.student.id,
      item.student.loginId,
      item.student.fullName,
      item.student.department,
      item.student.year,
      item.summary.totalAssessed,
      item.summary.totalPaid,
      item.summary.totalDue,
      item.summary.totalDue === 0 ? "FULLY CLEARED" : "PENDING DUE",
      item.summary.pendingCount
    ].map(csvEscape).join(","));

    const csvContent = "\uFEFF" + [headers.map(csvEscape).join(","), ...rows].join("\r\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="AJV_Fee_Collections_Register.csv"');
    res.send(csvContent);
  } catch (e) {
    res.status(500).json({ message: "Fee register export failed: " + e.message });
  }
});

// -------------------------------------------------------------
// Static Frontend Fallback
// -------------------------------------------------------------

app.use("/api", (_req, res) => res.status(404).json({ message: "API endpoint not found." }));
app.get("*", (_req, res) => res.sendFile(path.join(FRONTEND, "index.html")));

db.initDb().then(() => {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`AJV College of Engineering portal running at http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error("Fatal startup error:", err);
});

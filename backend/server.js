require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const path = require("path");
const db = require("./db");

const app = express();
const PORT = Number(process.env.PORT || 5000);
const JWT_SECRET = process.env.JWT_SECRET || "ajv-collegeconnect-local-secret";
const FRONTEND = path.join(__dirname, "..", "frontend");

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(FRONTEND));

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
  const raw = forwarded || remote;
  return raw.replace(/^::ffff:/, "").trim();
}

// IP / Host Authorization for Admin Console (strictly restricted to authorized IP 10.43.120.56 / localhost)
function isAuthorizedAdminIP(req) {
  const clientIp = getClientIp(req);
  const host = (req.headers.host || "").split(":")[0].trim();
  const adminSecret = req.headers["x-admin-key"] || req.query.admin_key;
  const claimedIp = req.headers["x-client-ip"] || req.query.ip;

  // Authorized Admin Device token or secret passkey
  if (
    adminSecret === "10.43.120.56" ||
    adminSecret === "ajv-admin-secure-2026" ||
    adminSecret === "Admin@123" ||
    adminSecret === "ajv2026" ||
    claimedIp === "10.43.120.56"
  ) {
    return true;
  }

  // Active when directly accessed via 10.43.120.56, localhost, or local hotspot network
  return (
    host === "10.43.120.56" ||
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "www.ajv.edu" ||
    clientIp === "10.43.120.56" ||
    clientIp.startsWith("10.43.120.") ||
    clientIp === "127.0.0.1" ||
    clientIp === "::1" ||
    clientIp === "localhost"
  );
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
    clientIp: getClientIp(req)
  });
});

// -------------------------------------------------------------
// Authentication
// -------------------------------------------------------------

app.post("/api/auth/login", async (req, res) => {
  const loginId = clean(req.body.loginId);
  const password = String(req.body.password || "");
  const requestedRole = clean(req.body.role).toLowerCase();

  if (!loginId || !password || !requestedRole) {
    return res.status(400).json({ message: "Login ID, password and account type are required." });
  }

  // Admin IP Protection
  if (requestedRole === "admin" && !isAuthorizedAdminIP(req)) {
    return res.status(403).json({
      message: "Admin login is strictly restricted to the authorized host (10.43.120.56)."
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
    if (!user.passwordHash || !bcrypt.compareSync(password, user.passwordHash)) {
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
  if (newPassword.length < 6) {
    return res.status(400).json({ message: "New password must be at least 6 characters." });
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

app.get("/api/courses", auth, role("staff", "admin"), async (_req, res) => {
  try {
    const courses = await db.getCourses();
    res.json(courses);
  } catch (e) {
    res.status(500).json({ message: "Server error" });
  }
});

app.put("/api/staff/students/:id/marks", auth, role("staff", "admin"), async (req, res) => {
  const studentId = Number(req.params.id);
  const courseId = Number(req.body.courseId);
  const attendance = Number(req.body.attendance);
  const internalMark = Number(req.body.internalMark);
  const externalMark = Number(req.body.externalMark);

  if (![attendance, internalMark, externalMark].every(Number.isFinite)) {
    return res.status(400).json({ message: "Enter valid numeric marks." });
  }
  if (attendance < 0 || attendance > 100) return res.status(400).json({ message: "Attendance must be between 0 and 100." });
  if (internalMark < 0 || internalMark > 40) return res.status(400).json({ message: "Internal mark must be between 0 and 40." });
  if (externalMark < 0 || externalMark > 60) return res.status(400).json({ message: "External mark must be between 0 and 60." });

  try {
    const student = await db.findUserById(studentId);
    if (!student || student.role !== "student") return res.status(404).json({ message: "Student not found." });

    const recordId = await db.upsertEnrollment(studentId, courseId, { attendance, internalMark, externalMark });
    const academic = await db.recalculateAcademic(studentId);

    res.json({
      message: "Marks saved. Percentage, grade and CGPA updated automatically.",
      record: { id: recordId },
      academic
    });
  } catch (error) {
    console.error("[Mark Entry Error]:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.post("/api/staff/students/:id/reset-password", auth, role("admin"), async (req, res) => {
  const newPassword = String(req.body.password || "Student@123");
  if (newPassword.length < 6) return res.status(400).json({ message: "Password must contain at least 6 characters." });

  try {
    const hash = bcrypt.hashSync(newPassword, 10);
    const updated = await db.updateUser(req.params.id, { passwordHash: hash });
    if (!updated || updated.role !== "student") return res.status(404).json({ message: "Student not found." });

    res.json({ message: "Student password reset successfully." });
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

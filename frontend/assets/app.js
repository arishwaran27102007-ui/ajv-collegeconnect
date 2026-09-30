const app = document.getElementById("app");
const nav = document.getElementById("nav");
const toastEl = document.getElementById("toast");
const modalDialog = document.getElementById("modalDialog");

const state = {
  token: localStorage.getItem("ajv_token"),
  user: JSON.parse(localStorage.getItem("ajv_user") || "null"),
  role: "student",
  config: { isAdminAllowed: false, departments: [], years: [] },
  staffStudents: [],
  facultyList: [],
  courses: []
};

const esc = s => String(s ?? "").replace(/[&<>"']/g, m => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "\"": "&quot;",
  "'": "&#039;"
}[m]));

function toast(msg, ok = true) {
  toastEl.textContent = msg;
  toastEl.className = ok ? "show good" : "show bad";
  setTimeout(() => { toastEl.className = ""; }, 4000);
}

async function api(url, opt = {}) {
  opt.headers = { ...(opt.headers || {}) };
  if (opt.body && typeof opt.body !== "string") opt.body = JSON.stringify(opt.body);
  if (opt.body) opt.headers["Content-Type"] = "application/json";
  if (state.token) opt.headers.Authorization = "Bearer " + state.token;
  const adminKey = sessionStorage.getItem("ajv_admin_key");
  if (adminKey) opt.headers["x-admin-key"] = adminKey;

  const r = await fetch(url, opt);
  const d = await r.json().catch(() => ({}));
  if (r.status === 401) {
    logout(false);
    throw Error(d.message || "Session expired. Please login again.");
  }
  if (!r.ok) throw Error(d.message || "Request failed");
  return d;
}

function setAuth(d) {
  state.token = d.token;
  state.user = d.user;
  localStorage.setItem("ajv_token", d.token);
  localStorage.setItem("ajv_user", JSON.stringify(d.user));
  layoutNav();
}

function logout(show = true) {
  state.token = null;
  state.user = null;
  localStorage.removeItem("ajv_token");
  localStorage.removeItem("ajv_user");
  layoutNav();
  showPage("home");
  if (show) toast("Logged out successfully");
}

function layoutNav() {
  if (!state.user) {
    nav.innerHTML = `
      <button onclick="showPage('home')">Home</button>
      <button onclick="showPage('login')">Login</button>
      <button class="nav-register" onclick="showPage('register')">Register</button>
    `;
    return;
  }

  if (state.user.role === "admin") {
    nav.innerHTML = `
      <button onclick="showPage('dashboard')">Dashboard</button>
      <button onclick="loadFaculty()">Faculty</button>
      <button onclick="loadStudents()">Students</button>
      <button onclick="showPage('profile')">Profile</button>
      <button onclick="logout()">Logout</button>
    `;
  } else if (state.user.role === "staff") {
    nav.innerHTML = `
      <button onclick="showPage('dashboard')">Dashboard</button>
      <button onclick="loadStudents()">Students</button>
      <button onclick="showPage('profile')">Profile</button>
      <button onclick="logout()">Logout</button>
    `;
  } else {
    nav.innerHTML = `
      <button onclick="showPage('dashboard')">Dashboard</button>
      <button onclick="showPage('profile')">Profile</button>
      <button onclick="logout()">Logout</button>
    `;
  }
}

function gradeClass(grade) {
  if (!grade) return "grade-B";
  const clean = grade.trim();
  if (clean === "A+") return "grade-Ap";
  if (clean === "B+") return "grade-Bp";
  return `grade-${clean}`;
}

function renderProgressRing(pct, strokeColor, centerText) {
  const radius = 22;
  const circ = 2 * Math.PI * radius;
  const validPct = Math.min(Math.max(Number(pct) || 0, 0), 100);
  const offset = circ - (validPct / 100) * circ;

  return `
    <div class="ring-container">
      <svg viewBox="0 0 56 56">
        <circle class="ring-bg" cx="28" cy="28" r="${radius}"></circle>
        <circle class="ring-val" cx="28" cy="28" r="${radius}" stroke="${strokeColor}" style="stroke-dasharray:${circ};stroke-dashoffset:${offset};"></circle>
      </svg>
      <div class="ring-center">${centerText || validPct + "%"}</div>
    </div>
  `;
}

// -------------------------------------------------------------
// Home Page
// -------------------------------------------------------------

function home() {
  app.innerHTML = `
    <section class="hero">
      <div class="hero-copy">
        <div class="eyebrow">AJV COLLEGE OF ENGINEERING</div>
        <h1>One campus.<br><em>One connected</em> experience.</h1>
        <p>A secure academic portal for student onboarding, attendance monitoring, faculty marks evaluation, and credit-weighted CGPA calculation.</p>
        <div class="actions">
          <button class="btn" onclick="showPage('login')">Open College Portal →</button>
          <button class="btn gold" onclick="showPage('register')">Student Registration</button>
        </div>
        <div class="trust">
          <span>✓ Auto Email &amp; ID Issuance</span>
          <span>✓ Faculty Verification</span>
          <span>✓ Live CGPA Engine</span>
          <span>✓ Official Marksheets</span>
        </div>
      </div>
      <div class="hero-card">
        <div class="hero-visual">
          <img src="/assets/college-logo.png" alt="AJV Logo">
          <h2>AJV CollegeConnect</h2>
          <p>Autonomous Institution • NAAC 'A+' Accredited</p>
          <div class="hero-badges">
            <span>Student Portal</span>
            <span>Faculty Console</span>
            <span>Admin Protection</span>
          </div>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="eyebrow">CORE COLLEGE WORKFLOW</div>
      <h2>Simple for students. Protected by administration.</h2>
      <p class="muted">Connected workflow from application submission to official mark sheets.</p>
      <div class="grid">
        <div class="card">
          <div class="icon">🎓</div>
          <h3>Student Onboarding</h3>
          <p class="muted">Students fill identity details. Faculty verifies application and issues official college email and initial login credentials.</p>
        </div>
        <div class="card">
          <div class="icon">👨‍🏫</div>
          <h3>Faculty Mark Entry</h3>
          <p class="muted">Authorized faculty record attendance and internal/external marks with automated grade and CGPA recalculation.</p>
        </div>
        <div class="card">
          <div class="icon">🛡️</div>
          <h3>Admin Protected Console</h3>
          <p class="muted">Admin issues Faculty IDs and oversees both student and staff records with dedicated workstation protection.</p>
        </div>
      </div>
    </section>

    <section class="workflow">
      <div>
        <div class="eyebrow">ACADEMIC FLOW</div>
        <h2>Register → Faculty Approval → Credentials → Results</h2>
        <p class="muted">Zero manual calculation. Instant grade determination and downloadable official semester mark statements.</p>
      </div>
      <div class="flow">
        <span>ONBOARD</span><b>→</b>
        <span>FACULTY APPROVAL</span><b>→</b>
        <span>EMAIL ISSUANCE</span><b>→</b>
        <span>MARKS</span><b>→</b>
        <span>OFFICIAL CERTIFICATE</span>
      </div>
    </section>
  `;
}

// -------------------------------------------------------------
// Authentication & Registration
// -------------------------------------------------------------

async function loadConfig() {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const keyFromUrl = urlParams.get("key") || urlParams.get("admin_key");
    if (keyFromUrl) {
      sessionStorage.setItem("ajv_admin_key", keyFromUrl);
    }
    const storedKey = sessionStorage.getItem("ajv_admin_key");
    const query = storedKey ? `?admin_key=${encodeURIComponent(storedKey)}` : "";
    const cfg = await api(`/api/config${query}`);
    state.config = cfg || {};
  } catch (e) {
    state.config = { isAdminAllowed: false };
  }
}

async function login() {
  await loadConfig();
  if (state.role === "admin" && !state.config.isAdminAllowed) {
    state.role = "student";
  }
  renderLogin();
}

function renderLogin() {
  const isAdminAllowed = state.config.isAdminAllowed;

  app.innerHTML = `
    <div class="login-wrap">
      <div class="login">
        <div class="login-head">
          <img src="/assets/college-logo.png" alt="AJV Logo">
          <div class="eyebrow" style="margin-top:12px;">SECURE LOGIN</div>
          <h1>Welcome back</h1>
          <p class="muted">Sign in to AJV CollegeConnect</p>
        </div>

        <div class="tabs" style="grid-template-columns: ${isAdminAllowed ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)'};">
          <button id="studentTab" class="${state.role === 'student' ? 'active' : ''}" onclick="setLoginRole('student')">Student</button>
          <button id="staffTab" class="${state.role === 'staff' ? 'active' : ''}" onclick="setLoginRole('staff')">Faculty</button>
          ${isAdminAllowed ? `<button id="adminTab" class="${state.role === 'admin' ? 'active' : ''}" onclick="setLoginRole('admin')">Admin</button>` : ''}
        </div>

        <form onsubmit="doLogin(event)">
          <label>Login ID / Official Email</label>
          <input id="loginId" placeholder="${state.role === 'student' ? 'e.g. AJVSTU001 or name0001@ajv.edu' : (state.role === 'staff' ? 'e.g. FAC001' : 'e.g. ADMIN001')}" required>

          <label>Password</label>
          <input id="password" type="password" placeholder="Enter your password" required>

          <label class="show-pass-label">
            <input type="checkbox" onchange="document.getElementById('password').type = this.checked ? 'text' : 'password'">
            <span>Show Password</span>
          </label>

          <div class="notice">
            <b>Demo Credentials:</b><br>
            ${state.role === 'student' ? 'Student ID: <code>AJVSTU001</code> / Password: <code>Student@123</code> (or temporary <code>ajv@123</code>)' : (state.role === 'staff' ? 'Faculty ID: <code>FAC001</code> / Password: <code>Faculty@123</code>' : 'Admin ID: <code>ADMIN001</code> / Password: <code>Admin@123</code>')}
          </div>

          <button class="btn full">Secure Sign In →</button>
        </form>
      </div>
    </div>
  `;
}

function setLoginRole(r) {
  state.role = r;
  renderLogin();
}

async function doLogin(e) {
  e.preventDefault();
  try {
    const d = await api("/api/auth/login", {
      method: "POST",
      body: {
        loginId: loginId.value,
        password: password.value,
        role: state.role
      }
    });
    setAuth(d);
    toast("Welcome, " + d.user.fullName);
    showPage("dashboard");
    if (d.user.role === "student" && d.user.mustChangePassword) {
      setTimeout(showFirstLoginPasswordModal, 300);
    }
  } catch (x) {
    toast(x.message, false);
  }
}

async function register() {
  await loadConfig();
  const depts = state.config.departments && state.config.departments.length ? state.config.departments : [
    "Information Technology",
    "Computer Science and Engineering",
    "Electronics and Communication Engineering",
    "Electrical and Electronics Engineering",
    "Mechanical Engineering",
    "Artificial Intelligence and Data Science"
  ];
  const yrs = state.config.years && state.config.years.length ? state.config.years : ["I Year", "II Year", "III Year", "IV Year"];

  app.innerHTML = `
    <div class="register-wrap">
      <div class="register-card">
        <div class="register-head">
          <img src="/assets/college-logo.png" alt="AJV Logo">
          <div>
            <div class="eyebrow">STUDENT ONBOARDING</div>
            <h1>Create your academic identity</h1>
            <p class="muted">Fill your details below. Your official college email (<code>name&lt;digits&gt;@ajv.edu</code>) and temporary login password will be issued upon faculty approval.</p>
          </div>
        </div>

        <form onsubmit="doRegister(event)" class="form-grid">
          <label>Full Name *<input id="rName" placeholder="As per official school certificates" required></label>
          <label>Date of Birth *<input id="rDob" type="date" required></label>

          <label>Gender *
            <select id="rGender" required>
              <option value="">Select Gender</option>
              <option>Female</option>
              <option>Male</option>
              <option>Other</option>
            </select>
          </label>

          <label>Parent / Guardian Name *<input id="rParent" placeholder="Parent or guardian full name" required></label>
          <label>Phone Contact *<input id="rPhone" inputmode="numeric" pattern="[0-9]{10}" maxlength="10" placeholder="10-digit mobile number" required></label>

          <label>Department *
            <select id="rDept" required>
              ${depts.map(x => `<option>${esc(x)}</option>`).join("")}
            </select>
          </label>

          <label>Year of Study *
            <select id="rYear" required>
              ${yrs.map(x => `<option>${esc(x)}</option>`).join("")}
            </select>
          </label>

          <label>Section *
            <select id="rSection" required>
              <option>A</option>
              <option>B</option>
              <option>C</option>
            </select>
          </label>

          <label class="span2">Permanent Residential Address *
            <textarea id="rAddress" rows="3" placeholder="Door No, Street, City, State, PIN" required></textarea>
          </label>

          <div class="span2 form-actions">
            <button type="button" class="btn secondary" onclick="showPage('login')">Back to Login</button>
            <button class="btn gold">Submit Registration Application →</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

async function doRegister(e) {
  e.preventDefault();
  try {
    const d = await api("/api/students/register", {
      method: "POST",
      body: {
        fullName: rName.value,
        dob: rDob.value,
        gender: rGender.value,
        parentName: rParent.value,
        phone: rPhone.value,
        department: rDept.value,
        year: rYear.value,
        section: rSection.value,
        address: rAddress.value
      }
    });

    app.innerHTML = `
      <div class="login-wrap">
        <div class="login" style="text-align:center;">
          <div style="font-size:46px;margin-bottom:12px;">⏳</div>
          <div class="eyebrow">REGISTRATION SUBMITTED</div>
          <h1 style="color:var(--navy);margin:6px 0;">Pending Faculty Approval</h1>
          <p class="muted" style="margin-top:6px;">Your registration application has been submitted to your department faculty.</p>

          <div class="notice" style="text-align:left;margin:20px 0;">
            <b>Assigned Application ID:</b> <code style="font-size:16px;">${esc(d.loginId)}</code><br><br>
            <b>What happens next:</b><br>
            1. Your department faculty will verify your admission details.<br>
            2. Upon approval, you will receive your official email: <code>${esc(rName.value.toLowerCase().replace(/[^a-z0-9]/g, ''))}${d.loginId.replace(/\\D/g, '').padStart(4, '0')}@ajv.edu</code>.<br>
            3. Your temporary password will be <code>ajv@123</code>, which you can change after logging in.
          </div>

          <button class="btn full" onclick="showPage('login')">Return to Sign In</button>
        </div>
      </div>
    `;
    toast("Registration submitted successfully");
  } catch (x) {
    toast(x.message, false);
  }
}

// -------------------------------------------------------------
// Student Dashboard
// -------------------------------------------------------------

async function studentDashboard() {
  try {
    const d = await api("/api/student/dashboard");
    const isAttendanceLow = Number(d.academic.attendance) < 75;

    app.innerHTML = `
      <div class="dashboard">
        <div class="dash-head">
          <div>
            <div class="eyebrow">STUDENT PORTAL</div>
            <h1>Welcome, ${esc(d.profile.fullName)} 👋</h1>
            <p class="muted">${esc(d.profile.loginId)} • ${esc(d.profile.email || "Pending Email")} • ${esc(d.profile.department)} • ${esc(d.profile.year)} Sec ${esc(d.profile.section || "A")}</p>
          </div>
          <div style="display:flex;gap:10px;align-items:center;">
            <button class="btn gold" onclick="openMarksheetModal(${JSON.stringify(d.profile).replace(/"/g, '&quot;')}, ${JSON.stringify(d.academic).replace(/"/g, '&quot;')}, ${JSON.stringify(d.courses).replace(/"/g, '&quot;')})">📄 Download Marksheet</button>
            <span class="status">● Enrolled Student</span>
          </div>
        </div>

        ${d.isTempPassword ? `
          <div class="card callout" style="border-left: 6px solid #d97706; background: #fffbeb; margin-top: 10px;">
            <div>
              <div class="eyebrow" style="color:#d97706;">SECURITY REMINDER</div>
              <h3 style="color:#92400e;margin:4px 0;">You are using the default temporary password (<code>ajv@123</code>)</h3>
              <p style="color:#92400e;opacity:0.85;margin:0;font-size:13px;">Please change your password in the Profile section to secure your academic account.</p>
            </div>
            <button class="btn gold" onclick="showPage('profile')">Change Password →</button>
          </div>
        ` : ''}

        ${isAttendanceLow ? `
          <div class="alert-shortage">
            <div>
              <b>⚠️ Attendance Shortage Warning (${Number(d.academic.attendance).toFixed(1)}%)</b>
              <p>Your current attendance is below the mandatory 75% university eligibility requirement. Please meet your faculty advisor.</p>
            </div>
            <span class="pill grade-RA">Detention Risk</span>
          </div>
        ` : ''}

        <div class="stats" style="margin-top:20px;">
          <div class="stat stat-with-ring">
            <div>
              <span class="label">CGPA (10.0 Scale)</span>
              <b>${Number(d.academic.cgpa).toFixed(2)}</b>
              <small>Credit-weighted average</small>
            </div>
            ${renderProgressRing((Number(d.academic.cgpa) / 10) * 100, "#1769aa", Number(d.academic.cgpa).toFixed(1))}
          </div>

          <div class="stat stat-with-ring">
            <div>
              <span class="label">Overall Percentage</span>
              <b>${Number(d.academic.overallPercentage).toFixed(2)}%</b>
              <small>Total marks percentage</small>
            </div>
            ${renderProgressRing(d.academic.overallPercentage, "#13845a", Math.round(d.academic.overallPercentage) + "%")}
          </div>

          <div class="stat stat-with-ring">
            <div>
              <span class="label">Average Attendance</span>
              <b style="color:${isAttendanceLow ? '#e11d48' : 'var(--navy)'};">${Number(d.academic.attendance).toFixed(1)}%</b>
              <small>${isAttendanceLow ? 'Below threshold (<75%)' : 'Eligible for examinations'}</small>
            </div>
            ${renderProgressRing(d.academic.attendance, isAttendanceLow ? '#e11d48' : '#0891b2', Math.round(d.academic.attendance) + "%")}
          </div>

          <div class="stat">
            <span class="label">Enrolled Courses</span>
            <b>${d.courses.length}</b>
            <small>Active semester records</small>
          </div>
        </div>

        <div class="profile-strip">
          <div><span>Register ID</span><b>${esc(d.profile.loginId)}</b></div>
          <div><span>Official Email</span><b>${esc(d.profile.email || "—")}</b></div>
          <div><span>Contact Mobile</span><b>${esc(d.profile.phone)}</b></div>
          <div><span>Parent / Guardian</span><b>${esc(d.profile.parentName || "—")}</b></div>
        </div>

        <div class="table-wrap">
          <div class="table-title">
            <div>
              <strong>Semester Marks &amp; Academic Performance</strong>
              <span>Verified and recorded by course faculty</span>
            </div>
            <button class="btn secondary mini" onclick="openMarksheetModal(${JSON.stringify(d.profile).replace(/"/g, '&quot;')}, ${JSON.stringify(d.academic).replace(/"/g, '&quot;')}, ${JSON.stringify(d.courses).replace(/"/g, '&quot;')})">🖨️ Print Mark Statement</button>
          </div>
          <table>
            <thead>
              <tr>
                <th>Course</th>
                <th>Credits</th>
                <th>Attendance</th>
                <th>Internal / 40</th>
                <th>External / 60</th>
                <th>Total / 100</th>
                <th>Grade</th>
                <th>Grade Point</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              ${d.courses.length ? d.courses.map(x => `
                <tr>
                  <td><b>${esc(x.course.code)}</b><br><small class="muted">${esc(x.course.name)}</small></td>
                  <td>${x.course.credits}</td>
                  <td>
                    ${x.attendance}%
                    ${x.attendance < 75 ? `<span class="badge-shortage">Low</span>` : ''}
                  </td>
                  <td>${x.internalMark}</td>
                  <td>${x.externalMark}</td>
                  <td><b>${x.totalMark}</b></td>
                  <td><span class="pill ${gradeClass(x.grade)}">${esc(x.grade)}</span></td>
                  <td><b>${x.gradePoint}</b></td>
                  <td><b>${x.grade === 'RA' ? '<span style="color:#dc2626;">RA</span>' : '<span style="color:#059669;">PASS</span>'}</b></td>
                </tr>
              `).join("") : `<tr><td colspan="9" style="text-align:center;padding:24px;color:var(--muted);">No course marks recorded yet. Faculty mark entry is in progress.</td></tr>`}
            </tbody>
          </table>
        </div>

        <div class="two-col">
          <div class="card">
            <h3>Student Identity &amp; Profile</h3>
            <div class="detail-grid">
              <span>Full Name<b>${esc(d.profile.fullName)}</b></span>
              <span>Official Email<b>${esc(d.profile.email || "—")}</b></span>
              <span>Date of Birth<b>${esc(d.profile.dob || "—")}</b></span>
              <span>Gender<b>${esc(d.profile.gender || "—")}</b></span>
              <span>Department<b>${esc(d.profile.department)}</b></span>
              <span>Year &amp; Section<b>${esc(d.profile.year)} / Section ${esc(d.profile.section || "A")}</b></span>
              <span>Address<b>${esc(d.profile.address || "—")}</b></span>
            </div>
          </div>

          <div class="card">
            <h3>Campus Bulletins &amp; Notices</h3>
            ${d.announcements && d.announcements.length ? d.announcements.map(a => `
              <div class="announcement-card">
                <div class="meta">NOTICE • ${a.createdAt ? new Date(a.createdAt).toLocaleDateString() : 'RECENT'}</div>
                <b>${esc(a.title)}</b>
                <p>${esc(a.body)}</p>
              </div>
            `).join("") : `<p class="muted">No bulletins posted at this time.</p>`}
          </div>
        </div>
      </div>
    `;
  } catch (x) {
    toast(x.message, false);
  }
}

// -------------------------------------------------------------
// Official Marksheet Certificate Modal
// -------------------------------------------------------------

function openMarksheetModal(student, academic, courses) {
  const totalCredits = courses.reduce((acc, c) => acc + Number(c.course.credits || 0), 0);
  const hasRA = courses.some(c => c.grade === 'RA');
  let classification = "First Class with Distinction";
  if (hasRA || Number(academic.cgpa) < 6.5) classification = "Second Class";
  else if (Number(academic.cgpa) < 8.5) classification = "First Class";

  modalDialog.innerHTML = `
    <div class="modal-header">
      <h2>Official Statement of Marks</h2>
      <button class="btn mini secondary" onclick="modalDialog.close()">✕</button>
    </div>
    <div class="modal-body">
      <div class="certificate">
        <div class="cert-header">
          <img src="/assets/college-logo.png" alt="AJV College Emblem">
          <h2>AJV COLLEGE OF ENGINEERING</h2>
          <p>An Autonomous Institution • Approved by AICTE, New Delhi • Affiliated to Anna University</p>
          <div class="cert-title">SEMESTER GRADE CARD &amp; STATEMENT OF MARKS</div>
        </div>

        <div class="cert-meta">
          <div><span>Student Name:</span> <b>${esc(student.fullName)}</b></div>
          <div><span>Register Number:</span> <b>${esc(student.registerNo || student.loginId)}</b></div>
          <div><span>Official Email:</span> <b>${esc(student.email || "—")}</b></div>
          <div><span>Department:</span> <b>${esc(student.department)}</b></div>
          <div><span>Academic Year:</span> <b>${esc(student.year)} (Section ${esc(student.section || "A")})</b></div>
          <div><span>Issue Date:</span> <b>${new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}</b></div>
        </div>

        <table style="margin-top:16px;">
          <thead>
            <tr>
              <th>Course Code</th>
              <th>Course Title</th>
              <th>Credits</th>
              <th>Internal / 40</th>
              <th>External / 60</th>
              <th>Total / 100</th>
              <th>Letter Grade</th>
              <th>Grade Point</th>
              <th>Result</th>
            </tr>
          </thead>
          <tbody>
            ${courses.length ? courses.map(c => `
              <tr>
                <td><b>${esc(c.course.code)}</b></td>
                <td>${esc(c.course.name)}</td>
                <td>${c.course.credits}</td>
                <td>${c.internalMark}</td>
                <td>${c.externalMark}</td>
                <td><b>${c.totalMark}</b></td>
                <td><span class="pill ${gradeClass(c.grade)}">${esc(c.grade)}</span></td>
                <td>${c.gradePoint}</td>
                <td><b>${c.grade === 'RA' ? 'RA' : 'PASS'}</b></td>
              </tr>
            `).join("") : `<tr><td colspan="9">No marks recorded.</td></tr>`}
          </tbody>
        </table>

        <div class="cert-summary">
          <div class="cert-summary-box">
            <span>Total Credits Earned</span>
            <b>${totalCredits}</b>
          </div>
          <div class="cert-summary-box">
            <span>Cumulative GPA (CGPA)</span>
            <b>${Number(academic.cgpa).toFixed(2)} / 10.0</b>
          </div>
          <div class="cert-summary-box">
            <span>Standing Classification</span>
            <b style="font-size:15px;margin-top:5px;">${classification}</b>
          </div>
        </div>

        <div class="cert-signatures">
          <div class="cert-sign-line">Class Advisor</div>
          <div class="cert-sign-line">Head of Department</div>
          <div class="cert-sign-line">Controller of Examinations</div>
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn secondary" onclick="modalDialog.close()">Close</button>
      <button class="btn gold" onclick="window.print()">🖨️ Print / Save as PDF</button>
    </div>
  `;

  modalDialog.showModal();
}

// -------------------------------------------------------------
// Staff Dashboard & Pending Approval Handling
// -------------------------------------------------------------

async function staffDashboard() {
  try {
    const d = await api("/api/staff/dashboard");
    const announcements = await api("/api/announcements").catch(() => []);

    app.innerHTML = `
      <div class="dashboard">
        <div class="dash-head">
          <div>
            <div class="eyebrow">FACULTY CONSOLE</div>
            <h1>Academic Control Center</h1>
            <p class="muted">Review student applications, enter marks, and publish bulletins.</p>
          </div>
          <div style="display:flex;gap:10px;">
            <button class="btn secondary" onclick="openAnnouncementModal()">📢 Post Bulletin</button>
            <button class="btn" onclick="loadStudents()">Student Directory →</button>
          </div>
        </div>

        <div class="stats">
          <div class="stat">
            <span class="label">Pending Applications</span>
            <b style="color:${d.counts.pending > 0 ? '#d97706' : 'var(--navy)'}">${d.counts.pending}</b>
            <small>${d.counts.pending > 0 ? 'Requires faculty review' : 'All accounts approved'}</small>
          </div>
          <div class="stat">
            <span class="label">Approved Students</span>
            <b>${d.counts.students}</b>
            <small>Active student records</small>
          </div>
          <div class="stat">
            <span class="label">Courses Offered</span>
            <b>${d.counts.courses}</b>
            <small>Active curriculum</small>
          </div>
          <div class="stat">
            <span class="label">Departments</span>
            <b>${d.counts.departments}</b>
            <small>Academic branches</small>
          </div>
        </div>

        ${d.counts.pending > 0 ? `
          <div class="card callout" style="border-left: 6px solid #d97706; background: #fffbeb;">
            <div>
              <div class="eyebrow" style="color:#d97706;">ACTION REQUIRED</div>
              <h3 style="color:#92400e;margin:4px 0;">${d.counts.pending} Student(s) Awaiting Approval</h3>
              <p style="color:#92400e;opacity:0.85;margin:0;font-size:13px;">Review applications. Approving will automatically issue their official college email and temporary password (<code>ajv@123</code>).</p>
            </div>
            <button class="btn gold" onclick="loadPendingStudents()">Review Applications →</button>
          </div>
        ` : ''}

        <div class="table-wrap">
          <div class="table-title">
            <div>
              <strong>Recent Registered Students</strong>
              <span>Latest admissions and performance indicators</span>
            </div>
            <button class="btn secondary mini" onclick="loadStudents()">View Full Directory (${d.counts.students})</button>
          </div>
          ${studentTable(d.recent)}
        </div>

        <div class="card" style="margin-top:20px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
            <h3>Active Campus Bulletins (${announcements.length})</h3>
            <button class="btn mini secondary" onclick="openAnnouncementModal()">+ New Bulletin</button>
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(300px, 1fr));gap:12px;">
            ${announcements.map(a => `
              <div class="announcement-card" style="position:relative;">
                <button onclick="deleteAnnouncement(${a.id})" style="position:absolute;top:10px;right:10px;border:none;background:none;color:#ef4444;cursor:pointer;font-size:14px;" title="Delete Bulletin">✕</button>
                <div class="meta">${a.createdAt ? new Date(a.createdAt).toLocaleDateString() : 'NOTICE'}</div>
                <b>${esc(a.title)}</b>
                <p>${esc(a.body)}</p>
              </div>
            `).join("")}
          </div>
        </div>
      </div>
    `;
  } catch (x) {
    toast(x.message, false);
  }
}

// -------------------------------------------------------------
// Admin Dedicated Console (Full Control & Faculty Management)
// -------------------------------------------------------------

async function adminDashboard() {
  try {
    const stats = await api("/api/staff/dashboard");
    const faculty = await api("/api/admin/faculty");
    state.facultyList = faculty;

    app.innerHTML = `
      <div class="dashboard">
        <div class="dash-head">
          <div>
            <div class="eyebrow" style="color:var(--red);">🛡️ PROTECTED ADMIN CONSOLE</div>
            <h1>Administrator Control Center</h1>
            <p class="muted">Authorized Workstation (${window.location.hostname}). Full protection and credential governance.</p>
          </div>
          <div style="display:flex;gap:10px;">
            <button class="btn gold" onclick="openIssueFacultyModal()">+ Issue Faculty ID</button>
            <button class="btn secondary" onclick="openAnnouncementModal()">📢 Post Bulletin</button>
          </div>
        </div>

        <div class="stats">
          <div class="stat">
            <span class="label">Total Faculty</span>
            <b style="color:var(--blue);">${faculty.length}</b>
            <small>Admin-issued faculty IDs</small>
          </div>
          <div class="stat">
            <span class="label">Registered Students</span>
            <b>${stats.counts.students}</b>
            <small>Active student records</small>
          </div>
          <div class="stat">
            <span class="label">Pending Applications</span>
            <b style="color:${stats.counts.pending > 0 ? '#d97706' : 'var(--navy)'};">${stats.counts.pending}</b>
            <small>Awaiting verification</small>
          </div>
          <div class="stat">
            <span class="label">Total Courses</span>
            <b>${stats.counts.courses}</b>
            <small>Academic syllabus</small>
          </div>
        </div>

        <!-- Faculty Management Section -->
        <div class="table-wrap" style="margin-top:24px;">
          <div class="table-title">
            <div>
              <strong>Faculty Roster &amp; Access Governance (${faculty.length})</strong>
              <span>Faculty IDs are issued and managed strictly by Admin</span>
            </div>
            <div style="display:flex;gap:8px;">
              <button class="btn secondary mini" onclick="loadFaculty()">Open Faculty Directory</button>
              <button class="btn gold mini" onclick="openIssueFacultyModal()">+ Issue New Faculty ID</button>
            </div>
          </div>
          ${facultyTable(faculty.slice(0, 5))}
        </div>

        <!-- Student Protection Section -->
        <div class="table-wrap" style="margin-top:24px;">
          <div class="table-title">
            <div>
              <strong>Student Records &amp; Academic Protection</strong>
              <span>Admin oversight of registered student accounts</span>
            </div>
            <button class="btn secondary mini" onclick="loadStudents()">Open Student Directory</button>
          </div>
          ${studentTable(stats.recent, true)}
        </div>
      </div>
    `;
  } catch (x) {
    toast(x.message, false);
  }
}

// Dedicated Faculty Directory Page
async function loadFaculty() {
  try {
    const faculty = await api("/api/admin/faculty");
    state.facultyList = faculty;

    app.innerHTML = `
      <div class="dashboard">
        <div class="dash-head">
          <div>
            <div class="eyebrow">FACULTY GOVERNANCE</div>
            <h1>Faculty Directory</h1>
            <p class="muted">${faculty.length} faculty account(s) issued and authorized by Admin</p>
          </div>
          <div style="display:flex;gap:10px;">
            <button class="btn gold" onclick="openIssueFacultyModal()">+ Issue Faculty ID</button>
            <button class="btn secondary" onclick="exportFacultyCsv()">📥 Export CSV</button>
            <button class="btn secondary" onclick="showPage('dashboard')">← Return to Dashboard</button>
          </div>
        </div>

        <div class="table-wrap">
          <div class="table-title">
            <div>
              <strong>All Faculty Members</strong>
              <span>Search across faculty name, ID, email, or department</span>
            </div>
            <input id="facultySearch" oninput="filterFaculty()" placeholder="Filter faculty..." style="max-width:300px;">
          </div>
          <div id="facultyTableContainer">
            ${facultyTable(faculty)}
          </div>
        </div>
      </div>
    `;
  } catch (x) {
    toast(x.message, false);
  }
}

function facultyTable(rows) {
  return `
    <table>
      <thead>
        <tr>
          <th>Faculty ID</th>
          <th>Faculty Name</th>
          <th>Official Email</th>
          <th>Department</th>
          <th>Contact</th>
          <th>Status</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${rows.length ? rows.map(f => `
          <tr>
            <td><b>${esc(f.loginId)}</b></td>
            <td>${esc(f.fullName)}</td>
            <td>${esc(f.email)}</td>
            <td>${esc(f.department)}</td>
            <td>${esc(f.phone || "—")}</td>
            <td><span class="pill grade-Ap">Active</span></td>
            <td>
              <button class="btn mini danger" onclick="adminDeleteFaculty(${f.id}, '${esc(f.fullName)}')">Revoke Access</button>
            </td>
          </tr>
        `).join("") : `<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--muted);">No faculty accounts found. Click "+ Issue Faculty ID" to add.</td></tr>`}
      </tbody>
    </table>
  `;
}

function filterFaculty() {
  const q = document.getElementById("facultySearch").value.toLowerCase();
  const filtered = state.facultyList.filter(f =>
    (f.fullName + " " + f.loginId + " " + f.email + " " + f.department).toLowerCase().includes(q)
  );
  document.getElementById("facultyTableContainer").innerHTML = facultyTable(filtered);
}

function exportFacultyCsv() {
  if (!state.facultyList || !state.facultyList.length) return toast("No faculty accounts to export", false);
  const headers = ["Faculty ID", "Faculty Name", "Official Email", "Department", "Section / Role", "Contact Phone", "Status"];
  const rows = state.facultyList.map(f => [
    `"${f.loginId}"`,
    `"${f.fullName}"`,
    `"${f.email || ''}"`,
    `"${f.department || ''}"`,
    `"${f.section || 'Faculty'}"`,
    `"${f.phone || ''}"`,
    `"Active"`
  ]);

  const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
  const link = document.createElement("a");
  link.setAttribute("href", encodeURI(csvContent));
  link.setAttribute("download", `AJV_Faculty_Directory_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  toast("Faculty directory CSV exported");
}

function openIssueFacultyModal() {
  const depts = state.config.departments && state.config.departments.length ? state.config.departments : [
    "Information Technology",
    "Computer Science and Engineering",
    "Electronics and Communication Engineering",
    "Electrical and Electronics Engineering",
    "Mechanical Engineering",
    "Artificial Intelligence and Data Science"
  ];

  modalDialog.innerHTML = `
    <div class="modal-header">
      <h2>Issue New Faculty ID</h2>
      <button class="btn mini secondary" onclick="modalDialog.close()">✕</button>
    </div>
    <form onsubmit="doIssueFaculty(event)">
      <div class="modal-body">
        <label>Faculty Full Name *</label>
        <input id="fName" placeholder="e.g. Dr. Ramesh Kumar" required>

        <label>Official Email Address *</label>
        <input id="fEmail" type="email" placeholder="e.g. ramesh@ajv.edu" required>

        <label>Contact Phone</label>
        <input id="fPhone" placeholder="Mobile number">

        <label>Department *</label>
        <select id="fDept" required>
          ${depts.map(d => `<option>${esc(d)}</option>`).join("")}
        </select>

        <label>Section / Designation</label>
        <input id="fSection" placeholder="e.g. Associate Professor / Faculty">

        <label>Initial Password</label>
        <input id="fPass" value="Faculty@123" placeholder="Default: Faculty@123">

        <div class="notice">
          The next Faculty ID (e.g. <code>FAC003</code>) will be generated automatically.
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn secondary" onclick="modalDialog.close()">Cancel</button>
        <button type="submit" class="btn gold">Issue Faculty Credentials →</button>
      </div>
    </form>
  `;
  modalDialog.showModal();
}

async function doIssueFaculty(e) {
  e.preventDefault();
  try {
    const d = await api("/api/admin/faculty", {
      method: "POST",
      body: {
        fullName: document.getElementById("fName").value,
        email: document.getElementById("fEmail").value,
        phone: document.getElementById("fPhone").value,
        department: document.getElementById("fDept").value,
        section: document.getElementById("fSection").value,
        password: document.getElementById("fPass").value
      }
    });
    modalDialog.close();
    toast(`Faculty ${d.faculty.loginId} issued! Initial Password: ${d.initialPassword}`);
    loadFaculty();
  } catch (x) {
    toast(x.message, false);
  }
}

async function adminDeleteFaculty(id, name) {
  if (!confirm(`Are you sure you want to revoke access and delete faculty "${name}"?`)) return;
  try {
    await api(`/api/admin/faculty/${id}`, { method: "DELETE" });
    toast("Faculty account deleted");
    loadFaculty();
  } catch (x) {
    toast(x.message, false);
  }
}

async function adminDeleteStudent(id, name) {
  if (!confirm(`Are you sure you want to delete student "${name}" and all their academic records?`)) return;
  try {
    await api(`/api/admin/students/${id}`, { method: "DELETE" });
    toast("Student account and records removed");
    loadStudents();
  } catch (x) {
    toast(x.message, false);
  }
}

// -------------------------------------------------------------
// Pending Students Review & Credential Issuance
// -------------------------------------------------------------

async function loadPendingStudents() {
  try {
    const rows = await api("/api/staff/pending-students");
    state.pendingStudents = rows;
    state.selectedPending = new Set();

    app.innerHTML = `
      <div class="dashboard">
        <div class="dash-head">
          <div>
            <div class="eyebrow">APPLICATIONS VERIFICATION</div>
            <h1>Pending Registrations</h1>
            <p class="muted">${rows.length} applicant(s) waiting for faculty approval</p>
          </div>
          <button class="btn secondary" onclick="showPage('dashboard')">← Return to Dashboard</button>
        </div>

        ${rows.length ? `
          <div class="bulk-bar" id="bulkBar">
            <div>
              <strong id="bulkSelectedText">0 applicant(s) selected</strong>
              <span style="font-size:12px;color:var(--muted);margin-left:8px;">Check multiple applications to approve in batch</span>
            </div>
            <button id="bulkApproveBtn" class="btn" style="background:#059669;color:#fff;" disabled onclick="doBulkApprove()">✅ Approve Selected (<span id="bulkCount">0</span>)</button>
          </div>
        ` : ''}

        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th style="width:36px;text-align:center;"><input type="checkbox" id="selectAllPending" onchange="toggleSelectAllPending(this.checked)"></th>
                <th>Application ID</th>
                <th>Applicant Name</th>
                <th>Department</th>
                <th>Year &amp; Section</th>
                <th>Phone</th>
                <th>Proposed Email</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${rows.length ? rows.map(s => {
                const cleanName = s.fullName.toLowerCase().replace(/[^a-z0-9]/g, '');
                const numDigits = s.loginId.replace(/\D/g, '');
                const proposedEmail = `${cleanName}${numDigits.padStart(4, '0')}@ajv.edu`;
                return `
                  <tr>
                    <td style="text-align:center;">
                      <input type="checkbox" class="pending-chk" value="${s.id}" onchange="toggleSelectPending(${s.id}, this.checked)">
                    </td>
                    <td><b>${esc(s.loginId)}</b></td>
                    <td>${esc(s.fullName)}</td>
                    <td>${esc(s.department)}</td>
                    <td>${esc(s.year)} / Sec ${esc(s.section || "A")}</td>
                    <td>${esc(s.phone)}</td>
                    <td><code style="color:var(--blue);">${esc(proposedEmail)}</code></td>
                    <td>
                      <button class="btn mini" style="background:#059669;color:#fff;" onclick="updateStudentStatus(${s.id}, 'active', '${esc(s.fullName)}')">Accept &amp; Issue Email</button>
                      <button class="btn mini danger" onclick="updateStudentStatus(${s.id}, 'rejected', '${esc(s.fullName)}')">Reject</button>
                    </td>
                  </tr>
                `;
              }).join("") : `<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--muted);">No pending registrations at this time.</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    `;
  } catch (x) {
    toast(x.message, false);
  }
}

function toggleSelectPending(id, checked) {
  if (checked) state.selectedPending.add(id);
  else state.selectedPending.delete(id);
  updateBulkBar();
}

function toggleSelectAllPending(checked) {
  const chks = document.querySelectorAll(".pending-chk");
  chks.forEach(c => {
    c.checked = checked;
    const id = Number(c.value);
    if (checked) state.selectedPending.add(id);
    else state.selectedPending.delete(id);
  });
  updateBulkBar();
}

function updateBulkBar() {
  const count = state.selectedPending.size;
  const countSpan = document.getElementById("bulkCount");
  const textSpan = document.getElementById("bulkSelectedText");
  const btn = document.getElementById("bulkApproveBtn");
  const allChk = document.getElementById("selectAllPending");

  if (countSpan) countSpan.textContent = count;
  if (textSpan) textSpan.textContent = `${count} applicant(s) selected`;
  if (btn) btn.disabled = count === 0;
  if (allChk && state.pendingStudents) {
    allChk.checked = count > 0 && count === state.pendingStudents.length;
  }
}

async function doBulkApprove() {
  const ids = Array.from(state.selectedPending);
  if (!ids.length) return;
  if (!confirm(`Are you sure you want to approve ${ids.length} student applicant(s) in batch?\n\nOfficial college emails and initial temporary passwords (ajv@123) will be generated for all.`)) return;

  try {
    const res = await api("/api/staff/students/bulk-approve", {
      method: "POST",
      body: { studentIds: ids }
    });

    const approved = res.approved || [];
    modalDialog.innerHTML = `
      <div class="modal-header">
        <h2>Batch Approval Complete (${approved.length})</h2>
        <button class="btn mini secondary" onclick="modalDialog.close(); loadPendingStudents();">✕</button>
      </div>
      <div class="modal-body" style="padding:24px;">
        <p style="color:var(--green);font-weight:bold;margin-top:0;">🎉 ${esc(res.message)}</p>
        <p class="muted" style="font-size:13px;">Official emails and temporary credentials (<code>ajv@123</code>) have been assigned. Students can log in immediately.</p>
        <div class="table-wrap" style="max-height:280px;overflow-y:auto;margin:16px 0;">
          <table>
            <thead>
              <tr>
                <th>Register ID</th>
                <th>Student Name</th>
                <th>Generated Email</th>
                <th>Initial Password</th>
              </tr>
            </thead>
            <tbody>
              ${approved.map(a => `
                <tr>
                  <td><b>${esc(a.loginId)}</b></td>
                  <td>${esc(a.fullName)}</td>
                  <td><code style="color:var(--blue);">${esc(a.generatedEmail)}</code></td>
                  <td><code style="color:var(--green);">${esc(a.temporaryPassword)}</code></td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </div>
      <div class="modal-footer" style="justify-content:space-between;">
        <button class="btn gold" onclick="exportBatchCredentialsCsv(${JSON.stringify(approved).replace(/"/g, '&quot;')})">📥 Export Credentials CSV</button>
        <button class="btn secondary" onclick="modalDialog.close(); loadPendingStudents();">Done</button>
      </div>
    `;
    modalDialog.showModal();
  } catch (err) {
    toast(err.message, false);
  }
}

function exportBatchCredentialsCsv(list) {
  if (!list || !list.length) return toast("No records to export", false);
  const headers = ["Register ID", "Student Name", "Official Email", "Department", "Initial Password", "Portal URL"];
  const rows = list.map(s => [
    `"${s.loginId || s.registerNo}"`,
    `"${s.fullName}"`,
    `"${s.generatedEmail}"`,
    `"${s.department || ''}"`,
    `"${s.temporaryPassword || 'ajv@123'}"`,
    `"${window.location.origin}"`
  ]);

  const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
  const link = document.createElement("a");
  link.setAttribute("href", encodeURI(csvContent));
  link.setAttribute("download", `AJV_Approved_Credentials_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  toast("Batch credentials CSV exported");
}

async function updateStudentStatus(id, status, name) {
  if (status === "active") {
    if (!confirm(`Accept and approve registration for "${name}"?\n\nThis will issue their official college email and temporary password (ajv@123).`)) return;
  } else {
    if (!confirm(`Reject registration for "${name}"?`)) return;
  }

  try {
    const res = await api(`/api/staff/students/${id}/status`, { method: "PUT", body: { status } });
    if (status === "active") {
      const studentSlipData = {
        fullName: name,
        loginId: res.user.loginId,
        registerNo: res.user.loginId,
        department: res.user.department,
        year: res.user.year,
        section: res.user.section,
        phone: res.user.phone,
        generatedEmail: res.generatedEmail,
        temporaryPassword: res.temporaryPassword
      };

      modalDialog.innerHTML = `
        <div class="modal-header">
          <h2>Registration Approved</h2>
          <button class="btn mini secondary" onclick="modalDialog.close(); loadPendingStudents();">✕</button>
        </div>
        <div class="modal-body" style="text-align:center;padding:30px;">
          <div style="font-size:48px;">🎉</div>
          <h2 style="color:var(--navy);margin:10px 0 4px;">Credentials Issued Successfully!</h2>
          <p class="muted">The student can now log in using the assigned official email or login ID.</p>
          <div class="notice" style="text-align:left;margin:20px auto;max-width:440px;">
            <b>Student Name:</b> ${esc(name)}<br>
            <b>Official Email:</b> <code style="font-size:15px;color:var(--navy);">${esc(res.generatedEmail)}</code><br>
            <b>Register / Login ID:</b> <code>${esc(res.user.loginId)}</code><br>
            <b>Temporary Password:</b> <code style="font-size:15px;color:var(--green);">${esc(res.temporaryPassword)}</code>
          </div>
          <div style="display:flex;gap:10px;justify-content:center;margin-top:16px;">
            <button class="btn secondary" onclick="printAdmissionSlip(${JSON.stringify(studentSlipData).replace(/"/g, '&quot;')})">🖨️ Print Admission Slip</button>
            <button class="btn gold" onclick="modalDialog.close(); loadPendingStudents();">Understood, Done →</button>
          </div>
        </div>
      `;
      modalDialog.showModal();
    } else {
      toast("Registration rejected");
      loadPendingStudents();
    }
  } catch (x) {
    toast(x.message, false);
  }
}

function printAdmissionSlip(data) {
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    return toast("Please allow popups to print admission slip", false);
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Admission Slip - ${data.fullName}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; margin: 30px; color: #081b2f; }
        .header { text-align: center; border-bottom: 2px solid #081b2f; padding-bottom: 16px; margin-bottom: 20px; }
        .logo { width: 68px; height: 68px; margin-bottom: 6px; }
        h1 { margin: 0; font-size: 20px; text-transform: uppercase; color: #081b2f; letter-spacing: 0.5px; }
        .sub { font-size: 12px; color: #64748b; margin-top: 3px; }
        .title { text-align: center; font-size: 15px; font-weight: bold; background: #f1f5f9; padding: 10px; margin: 18px 0; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.8px; color: #0f172a; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px; }
        .item { padding: 8px 12px; background: #fafafa; border: 1px solid #e2e8f0; border-radius: 4px; }
        .item small { display: block; font-size: 11px; text-transform: uppercase; color: #64748b; margin-bottom: 3px; }
        .item strong { font-size: 14px; color: #0f172a; }
        .credentials-box { background: #f0fdf4; border: 2px dashed #16a34a; padding: 16px; border-radius: 6px; margin: 20px 0; }
        .credentials-box h3 { margin: 0 0 10px; color: #15803d; font-size: 14px; }
        .cred-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #dcfce7; }
        .cred-row:last-child { border-bottom: none; }
        .cred-label { font-size: 13px; color: #166534; font-weight: 500; }
        .cred-val { font-family: monospace; font-size: 14px; font-weight: bold; color: #0f172a; }
        .instructions { font-size: 12px; color: #64748b; margin-top: 18px; line-height: 1.5; border-top: 1px solid #e2e8f0; padding-top: 12px; }
        .footer { margin-top: 50px; display: flex; justify-content: space-between; padding-top: 20px; }
        .sig { text-align: center; width: 180px; }
        .sig-line { border-top: 1px solid #94a3b8; margin-top: 36px; padding-top: 6px; font-size: 12px; color: #475569; }
        @media print {
          body { margin: 15px; }
          .print-btn-bar { display: none !important; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <img src="/assets/college-logo.png" class="logo" alt="Logo">
        <h1>AJV College of Engineering</h1>
        <div class="sub">Autonomous Institution • Approved by AICTE • Affiliated to Anna University</div>
        <div class="sub">CollegeConnect Academic Automation System</div>
      </div>

      <div class="title">Official Student Admission &amp; Portal Credential Slip</div>

      <div class="grid">
        <div class="item"><small>Candidate Name</small><strong>${data.fullName}</strong></div>
        <div class="item"><small>Register Number</small><strong>${data.loginId || data.registerNo}</strong></div>
        <div class="item"><small>Department</small><strong>${data.department || "Engineering"}</strong></div>
        <div class="item"><small>Academic Year / Section</small><strong>${data.year || "I Year"} - Section ${data.section || "A"}</strong></div>
        <div class="item"><small>Contact Mobile</small><strong>${data.phone || "—"}</strong></div>
        <div class="item"><small>Admission Status</small><strong style="color:#16a34a;">Verified &amp; Approved</strong></div>
      </div>

      <div class="credentials-box">
        <h3>🔐 Secure CollegeConnect Portal Credentials</h3>
        <div class="cred-row">
          <span class="cred-label">Portal Login URL:</span>
          <span class="cred-val">${window.location.origin}</span>
        </div>
        <div class="cred-row">
          <span class="cred-label">Official College Email:</span>
          <span class="cred-val">${data.generatedEmail || data.email}</span>
        </div>
        <div class="cred-row">
          <span class="cred-label">Register / Login ID:</span>
          <span class="cred-val">${data.loginId || data.registerNo}</span>
        </div>
        <div class="cred-row">
          <span class="cred-label">Temporary Initial Password:</span>
          <span class="cred-val">${data.temporaryPassword || "ajv@123"}</span>
        </div>
      </div>

      <div class="instructions">
        <b>Important Instructions for the Student:</b>
        <ol style="margin: 6px 0 0; padding-left: 20px;">
          <li>Visit the portal link on mobile or desktop and choose <b>Student</b> login.</li>
          <li>Enter your Official College Email or Register ID and temporary password.</li>
          <li>You will be prompted immediately to set a secure personal password upon your first sign in.</li>
          <li>Keep your login credentials strictly confidential.</li>
        </ol>
      </div>

      <div class="footer">
        <div class="sig">
          <div class="sig-line">Faculty Advisor / Staff</div>
        </div>
        <div class="sig">
          <div class="sig-line">Dean (Academics) / Principal</div>
        </div>
      </div>

      <div class="print-btn-bar" style="text-align:center;margin-top:24px;">
        <button onclick="window.print()" style="padding:10px 24px;font-size:14px;background:#081b2f;color:#fff;border:none;border-radius:4px;cursor:pointer;">🖨️ Print Slip</button>
      </div>
      <script>
        window.onload = function() {
          setTimeout(() => { window.print(); }, 400);
        };
      </script>
    </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}


// -------------------------------------------------------------
// Student Directory
// -------------------------------------------------------------

function studentTable(rows, isAdminView = false) {
  return `
    <table>
      <thead>
        <tr>
          <th>Register ID</th>
          <th>Student Name</th>
          <th>Official Email</th>
          <th>Department</th>
          <th>Year &amp; Sec</th>
          <th>Overall %</th>
          <th>CGPA</th>
          <th>Attendance</th>
          <th>Status</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(s => `
          <tr>
            <td><b>${esc(s.loginId)}</b></td>
            <td>${esc(s.fullName)}</td>
            <td>${s.email ? `<small>${esc(s.email)}</small>` : '<span class="muted">Pending</span>'}</td>
            <td>${esc(s.department)}</td>
            <td>${esc(s.year)} / ${esc(s.section || "A")}</td>
            <td><b>${Number(s.overallPercentage || 0).toFixed(2)}%</b></td>
            <td><b>${Number(s.cgpa || 0).toFixed(2)}</b></td>
            <td>
              ${Number(s.attendance || 0).toFixed(1)}%
              ${s.attendance < 75 && s.attendance > 0 ? `<span class="badge-shortage">Low</span>` : ''}
            </td>
            <td><span class="pill ${s.status === 'active' ? 'grade-Ap' : 'grade-RA'}">${esc(s.status)}</span></td>
            <td>
              <button class="btn secondary mini" onclick="viewStudent(${s.id})">Academic Record →</button>
              ${isAdminView ? `<button class="btn mini danger" onclick="adminDeleteStudent(${s.id}, '${esc(s.fullName)}')">Delete</button>` : ''}
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

async function loadStudents() {
  try {
    const rows = await api("/api/staff/students");
    state.staffStudents = rows;
    const isAdmin = state.user && state.user.role === "admin";

    app.innerHTML = `
      <div class="dashboard">
        <div class="dash-head">
          <div>
            <div class="eyebrow">ACADEMIC ROSTER</div>
            <h1>Student Directory</h1>
            <p class="muted">${rows.length} student account(s) registered in the portal</p>
          </div>
          <div style="display:flex;gap:10px;">
            <button class="btn secondary" onclick="exportStudentsCsv()">📥 Export CSV</button>
            <button class="btn secondary" onclick="showPage('dashboard')">← Dashboard</button>
          </div>
        </div>
        <div class="table-wrap">
          <div class="table-title">
            <div>
              <strong>All Students</strong>
              <span>Search across name, student ID, email, or department</span>
            </div>
            <input id="studentSearch" oninput="filterStudents()" placeholder="Filter by name, ID, email..." style="max-width:300px;">
          </div>
          <div id="studentTableContainer">
            ${studentTable(rows, isAdmin)}
          </div>
        </div>
      </div>
    `;
  } catch (x) {
    toast(x.message, false);
  }
}

function filterStudents() {
  const q = document.getElementById("studentSearch").value.toLowerCase();
  const filtered = state.staffStudents.filter(s =>
    (s.fullName + " " + s.loginId + " " + (s.email || "") + " " + s.department).toLowerCase().includes(q)
  );
  const isAdmin = state.user && state.user.role === "admin";
  document.getElementById("studentTableContainer").innerHTML = studentTable(filtered, isAdmin);
}

function exportStudentsCsv() {
  if (!state.staffStudents.length) return toast("No students to export", false);
  const headers = ["Register ID", "Full Name", "Official Email", "Department", "Year", "Section", "Attendance %", "Overall %", "CGPA", "Status"];
  const rows = state.staffStudents.map(s => [
    `"${s.loginId}"`,
    `"${s.fullName}"`,
    `"${s.email || ''}"`,
    `"${s.department}"`,
    `"${s.year}"`,
    `"${s.section || 'A'}"`,
    s.attendance || 0,
    s.overallPercentage || 0,
    s.cgpa || 0,
    `"${s.status}"`
  ]);

  const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
  const link = document.createElement("a");
  link.setAttribute("href", encodeURI(csvContent));
  link.setAttribute("download", `AJV_Student_Directory_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  toast("CSV exported successfully");
}

async function viewStudent(id) {
  try {
    const d = await api(`/api/staff/students/${id}`);
    const courses = await api("/api/courses");
    state.courses = courses;

    app.innerHTML = `
      <div class="dashboard">
        <div class="dash-head">
          <div>
            <div class="eyebrow">ACADEMIC EVALUATION</div>
            <h1>${esc(d.student.fullName)}</h1>
            <p class="muted">${esc(d.student.loginId)} • ${esc(d.student.email || "Pending Email")} • ${esc(d.student.department)}</p>
          </div>
          <div style="display:flex;gap:10px;">
            <button class="btn gold" onclick="openMarksheetModal(${JSON.stringify(d.student).replace(/"/g, '&quot;')}, ${JSON.stringify(d.academic).replace(/"/g, '&quot;')}, ${JSON.stringify(d.courses).replace(/"/g, '&quot;')})">📄 Generate Marksheet</button>
            <button class="btn secondary" onclick="loadStudents()">← Student Directory</button>
          </div>
        </div>

        <div class="stats">
          <div class="stat">
            <span class="label">Credit-Weighted CGPA</span>
            <b>${Number(d.academic.cgpa).toFixed(2)}</b>
            <small>Out of 10.0 scale</small>
          </div>
          <div class="stat">
            <span class="label">Overall Percentage</span>
            <b>${Number(d.academic.overallPercentage).toFixed(2)}%</b>
            <small>Across all subjects</small>
          </div>
          <div class="stat">
            <span class="label">Average Attendance</span>
            <b style="color:${d.academic.attendance < 75 ? '#dc2626' : 'var(--navy)'};">${Number(d.academic.attendance).toFixed(1)}%</b>
            <small>${d.academic.attendance < 75 ? 'Shortage (< 75%)' : 'Eligible'}</small>
          </div>
          <div class="stat">
            <span class="label">Recorded Courses</span>
            <b>${d.courses.length}</b>
            <small>Evaluations</small>
          </div>
        </div>

        <div class="two-col" style="margin-top:20px;">
          <div class="card">
            <h3>Record / Update Course Assessment</h3>
            <form onsubmit="saveMarks(event, ${id})">
              <label>Select Course Module</label>
              <select id="mCourse">
                ${courses.map(c => `<option value="${c.id}">${esc(c.code)} — ${esc(c.name)} (${c.credits} Credits)</option>`).join("")}
              </select>

              <div class="mark-grid" style="margin-top:12px;">
                <div>
                  <label>Attendance %</label>
                  <input id="mAtt" type="number" min="0" max="100" step="0.1" value="90" required>
                </div>
                <div>
                  <label>Internal / 40</label>
                  <input id="mInt" type="number" min="0" max="40" step="0.5" value="32" required>
                </div>
                <div>
                  <label>External / 60</label>
                  <input id="mExt" type="number" min="0" max="60" step="0.5" value="50" required>
                </div>
              </div>

              <div class="calc-preview">
                <span>Calculated Result Preview:</span>
                <b id="markPreview">82.0 / 100 • A+ • 9 Grade Points</b>
              </div>

              <button class="btn full gold">Save Assessment &amp; Recalculate CGPA →</button>
            </form>
          </div>

          <div class="card">
            <h3>Student Identity Record</h3>
            <div class="detail-grid">
              <span>Full Name<b>${esc(d.student.fullName)}</b></span>
              <span>Official Email<b>${esc(d.student.email || "Pending Approval")}</b></span>
              <span>Date of Birth<b>${esc(d.student.dob || "—")}</b></span>
              <span>Gender<b>${esc(d.student.gender || "—")}</b></span>
              <span>Parent / Guardian<b>${esc(d.student.parentName || "—")}</b></span>
              <span>Phone Contact<b>${esc(d.student.phone || "—")}</b></span>
            </div>

            <div style="margin-top:20px;padding-top:16px;border-top:1px solid var(--line);">
              <label style="margin-top:0;">Administrative Reset</label>
              <button class="btn secondary mini" onclick="adminResetPassword(${d.student.id})">Reset Password to "Student@123"</button>
            </div>
          </div>
        </div>

        <div class="table-wrap">
          <div class="table-title">
            <div>
              <strong>Recorded Semester Courses (${d.courses.length})</strong>
              <span>Evaluation records currently saved for this student</span>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Course</th>
                <th>Credits</th>
                <th>Attendance</th>
                <th>Internal / 40</th>
                <th>External / 60</th>
                <th>Total / 100</th>
                <th>Grade</th>
                <th>Point</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${d.courses.length ? d.courses.map(c => `
                <tr>
                  <td><b>${esc(c.course.code)}</b><br><small class="muted">${esc(c.course.name)}</small></td>
                  <td>${c.course.credits}</td>
                  <td>
                    ${c.attendance}%
                    ${c.attendance < 75 ? `<span class="badge-shortage">Low</span>` : ''}
                  </td>
                  <td>${c.internalMark}</td>
                  <td>${c.externalMark}</td>
                  <td><b>${c.totalMark}</b></td>
                  <td><span class="pill ${gradeClass(c.grade)}">${esc(c.grade)}</span></td>
                  <td>${c.gradePoint}</td>
                  <td><b>${c.grade === 'RA' ? '<span style="color:#dc2626;">RA</span>' : '<span style="color:#059669;">PASS</span>'}</b></td>
                </tr>
              `).join("") : `<tr><td colspan="9" style="text-align:center;padding:24px;color:var(--muted);">No course assessments recorded yet.</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    `;

    setupPreviewListeners();
  } catch (x) {
    toast(x.message, false);
  }
}

function gradePreview(total) {
  if (total >= 90) return ["O", 10];
  if (total >= 80) return ["A+", 9];
  if (total >= 70) return ["A", 8];
  if (total >= 60) return ["B+", 7];
  if (total >= 50) return ["B", 6];
  if (total >= 40) return ["C", 5];
  return ["RA", 0];
}

function setupPreviewListeners() {
  const a = document.getElementById("mInt");
  const b = document.getElementById("mExt");
  const p = document.getElementById("markPreview");
  if (!a || !b || !p) return;

  const update = () => {
    const total = Number(a.value || 0) + Number(b.value || 0);
    const g = gradePreview(total);
    p.textContent = `${total.toFixed(1)} / 100 • Grade ${g[0]} • ${g[1]} Grade Points`;
  };

  a.oninput = b.oninput = update;
  update();
}

async function saveMarks(e, id) {
  e.preventDefault();
  try {
    const d = await api(`/api/staff/students/${id}/marks`, {
      method: "PUT",
      body: {
        courseId: Number(mCourse.value),
        attendance: Number(mAtt.value),
        internalMark: Number(mInt.value),
        externalMark: Number(mExt.value)
      }
    });
    toast(`Assessment saved! New CGPA: ${d.academic.cgpa.toFixed(2)} (${d.academic.overallPercentage.toFixed(2)}%)`);
    viewStudent(id);
  } catch (x) {
    toast(x.message, false);
  }
}

async function adminResetPassword(id) {
  if (!confirm("Reset this student's password to default (Student@123)?")) return;
  try {
    const d = await api(`/api/staff/students/${id}/reset-password`, {
      method: "POST",
      body: { password: "Student@123" }
    });
    toast(d.message);
  } catch (x) {
    toast(x.message, false);
  }
}

// -------------------------------------------------------------
// Announcements
// -------------------------------------------------------------

function openAnnouncementModal() {
  modalDialog.innerHTML = `
    <div class="modal-header">
      <h2>Publish Campus Bulletin</h2>
      <button class="btn mini secondary" onclick="modalDialog.close()">✕</button>
    </div>
    <form onsubmit="doPublishAnnouncement(event)">
      <div class="modal-body">
        <label>Bulletin Title *</label>
        <input id="annTitle" placeholder="e.g. End Semester Examination Schedule" required>
        <label>Notice Content *</label>
        <textarea id="annBody" rows="4" placeholder="Enter notification details for students and staff..." required></textarea>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn secondary" onclick="modalDialog.close()">Cancel</button>
        <button type="submit" class="btn gold">Publish Notice →</button>
      </div>
    </form>
  `;
  modalDialog.showModal();
}

async function doPublishAnnouncement(e) {
  e.preventDefault();
  try {
    await api("/api/announcements", {
      method: "POST",
      body: {
        title: document.getElementById("annTitle").value,
        body: document.getElementById("annBody").value
      }
    });
    modalDialog.close();
    toast("Bulletin published successfully");
    if (state.user.role === "admin") adminDashboard();
    else staffDashboard();
  } catch (x) {
    toast(x.message, false);
  }
}

async function deleteAnnouncement(id) {
  if (!confirm("Are you sure you want to delete this bulletin?")) return;
  try {
    await api(`/api/announcements/${id}`, { method: "DELETE" });
    toast("Bulletin removed");
    if (state.user.role === "admin") adminDashboard();
    else staffDashboard();
  } catch (x) {
    toast(x.message, false);
  }
}

// -------------------------------------------------------------
// Profile & Password Management
// -------------------------------------------------------------

async function profile() {
  try {
    const u = await api("/api/me");
    app.innerHTML = `
      <div class="dashboard">
        <div class="dash-head">
          <div>
            <div class="eyebrow">USER PROFILE</div>
            <h1>Account Settings</h1>
            <p class="muted">Manage your personal contact details and update your password.</p>
          </div>
          <button class="btn secondary" onclick="showPage('dashboard')">← Dashboard</button>
        </div>

        <div class="two-col" style="max-width:960px;margin:0 auto;">
          <div class="card">
            <h3>Personal Information</h3>
            <form onsubmit="saveProfile(event)">
              <label>Full Name *</label>
              <input id="pName" value="${esc(u.fullName)}" required>

              <label>Official Email Address</label>
              <input id="pEmail" type="email" value="${esc(u.email || "")}" ${u.role === 'student' ? 'disabled style="background:#f1f5f9;cursor:not-allowed;"' : ''}>

              <label>Phone Contact</label>
              <input id="pPhone" value="${esc(u.phone || "")}">

              <label>Account Login ID</label>
              <input value="${esc(u.loginId)}" disabled style="background:#f1f5f9;cursor:not-allowed;">

              <label>Role</label>
              <input value="${esc(u.role).toUpperCase()}" disabled style="background:#f1f5f9;cursor:not-allowed;">

              <button class="btn full">Save Contact Details</button>
            </form>
          </div>

          <div class="card">
            <h3>Change Password</h3>
            <form onsubmit="changePassword(event)">
              <label>Current Password *</label>
              <input id="oldPass" type="password" placeholder="Enter current password" required>

              <label>New Password *</label>
              <input id="newPass" type="password" minlength="6" placeholder="Minimum 6 characters" required>

              <label>Confirm New Password *</label>
              <input id="confirmPass" type="password" minlength="6" placeholder="Re-enter new password" required>

              <div class="notice">
                Ensure your new password contains at least 6 characters. You can use this new password for future logins.
              </div>

              <button class="btn gold full">Update Password →</button>
            </form>
          </div>
        </div>
      </div>
    `;
  } catch (x) {
    toast(x.message, false);
  }
}

async function saveProfile(e) {
  e.preventDefault();
  try {
    const d = await api("/api/profile", {
      method: "PUT",
      body: {
        fullName: pName.value,
        email: pEmail.value,
        phone: pPhone.value
      }
    });
    toast("Profile updated successfully");
    if (d.user) state.user = { ...state.user, ...d.user };
  } catch (x) {
    toast(x.message, false);
  }
}

async function changePassword(e) {
  e.preventDefault();
  const oldP = document.getElementById("oldPass").value;
  const newP = document.getElementById("newPass").value;
  const confP = document.getElementById("confirmPass").value;

  if (newP !== confP) return toast("New passwords do not match", false);

  try {
    const d = await api("/api/auth/change-password", {
      method: "PUT",
      body: { currentPassword: oldP, newPassword: newP }
    });
    toast(d.message);
    document.getElementById("oldPass").value = "";
    document.getElementById("newPass").value = "";
    document.getElementById("confirmPass").value = "";
  } catch (x) {
    toast(x.message, false);
  }
}

function showFirstLoginPasswordModal() {
  modalDialog.innerHTML = `
    <div class="modal-header" style="background:#fffbeb;border-bottom:1px solid #fef3c7;">
      <div>
        <div class="eyebrow" style="color:#d97706;">SECURITY MANDATE</div>
        <h2 style="color:#92400e;margin:2px 0 0;">First-Time Login: Set New Password</h2>
      </div>
    </div>
    <form onsubmit="doFirstPasswordChange(event)">
      <div class="modal-body" style="padding:24px;">
        <div class="notice" style="background:#fffbeb;border-left:4px solid #d97706;color:#92400e;margin-bottom:18px;">
          Welcome, <b>${esc(state.user.fullName)}</b>!<br>
          For your account security, you are required to change your temporary admission password (<code>ajv@123</code>) to a personal password before continuing.
        </div>
        
        <label>Current Temporary Password *</label>
        <input id="firstCurrentPass" type="password" value="ajv@123" required>

        <label>New Password (min 6 characters) *</label>
        <input id="firstNewPass" type="password" placeholder="Create your new personal password" required minlength="6">

        <label>Confirm New Password *</label>
        <input id="firstConfirmPass" type="password" placeholder="Retype your new personal password" required minlength="6">

        <label class="show-pass-label" style="margin-top:10px;">
          <input type="checkbox" onchange="toggleFirstPassVisibility(this.checked)">
          <span>Show Passwords</span>
        </label>
      </div>
      <div class="modal-footer">
        <button type="submit" class="btn gold full">Update Password &amp; Enter Dashboard →</button>
      </div>
    </form>
  `;
  modalDialog.showModal();
}

function toggleFirstPassVisibility(checked) {
  const type = checked ? "text" : "password";
  const c = document.getElementById("firstCurrentPass");
  const n = document.getElementById("firstNewPass");
  const r = document.getElementById("firstConfirmPass");
  if (c) c.type = type;
  if (n) n.type = type;
  if (r) r.type = type;
}

async function doFirstPasswordChange(e) {
  e.preventDefault();
  const currentPassword = document.getElementById("firstCurrentPass").value;
  const newPassword = document.getElementById("firstNewPass").value;
  const confirmPassword = document.getElementById("firstConfirmPass").value;

  if (newPassword !== confirmPassword) {
    return toast("New passwords do not match", false);
  }
  if (newPassword === "ajv@123") {
    return toast("Please choose a password different from the temporary default (ajv@123)", false);
  }

  try {
    const res = await api("/api/auth/change-password", {
      method: "PUT",
      body: { currentPassword, newPassword }
    });
    if (res.user) {
      state.user = res.user;
      localStorage.setItem("ajv_user", JSON.stringify(res.user));
    } else {
      state.user.mustChangePassword = false;
      localStorage.setItem("ajv_user", JSON.stringify(state.user));
    }
    modalDialog.close();
    toast("Password set successfully! Welcome to your dashboard.", true);
    showPage("dashboard");
  } catch (err) {
    toast(err.message, false);
  }
}

// -------------------------------------------------------------
// Router
// -------------------------------------------------------------

function showPage(p) {
  layoutNav();
  if (p === "home") home();
  else if (p === "login") login();
  else if (p === "register") register();
  else if (p === "profile") profile();
  else if (p === "dashboard") {
    if (!state.user) login();
    else if (state.user.role === "admin") adminDashboard();
    else if (state.user.role === "staff") staffDashboard();
    else {
      studentDashboard();
      if (state.user && state.user.mustChangePassword) {
        setTimeout(showFirstLoginPasswordModal, 250);
      }
    }
  }
}

layoutNav();
loadConfig().then(() => {
  showPage(state.user ? "dashboard" : "home");
});


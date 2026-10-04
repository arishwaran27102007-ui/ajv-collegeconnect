const app = document.getElementById("app");
const nav = document.getElementById("nav");
const toastEl = document.getElementById("toast");
const modalDialog = document.getElementById("modalDialog");
const themeToggleBtn = document.getElementById("themeToggleBtn");

function checkSemPub(pubMap, sem, dept = 'ALL', year = 'ALL') {
  if (!pubMap) return false;
  // Check legacy key format (just semester number)
  if (pubMap[String(sem)]?.isPublished) return true;
  // Check new composite key formats
  const k1 = `${sem}_ALL_ALL`;
  const k2 = `${sem}_${dept}_ALL`;
  const k3 = `${sem}_ALL_${year}`;
  const k4 = `${sem}_${dept}_${year}`;
  return !!(pubMap[k1]?.isPublished || pubMap[k2]?.isPublished || pubMap[k3]?.isPublished || pubMap[k4]?.isPublished);
}

// Theme Initialization
const currentTheme = localStorage.getItem("ajv_theme") || "light";
document.documentElement.setAttribute("data-theme", currentTheme);
if (themeToggleBtn) {
  themeToggleBtn.textContent = currentTheme === "dark" ? "☀️" : "🌙";
  themeToggleBtn.addEventListener("click", () => {
    let theme = document.documentElement.getAttribute("data-theme");
    let newTheme = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", newTheme);
    localStorage.setItem("ajv_theme", newTheme);
    themeToggleBtn.textContent = newTheme === "dark" ? "☀️" : "🌙";
  });
}

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
  const adminKey = sessionStorage.getItem("ajv_admin_key") || localStorage.getItem("ajv_admin_key");
  if (adminKey) opt.headers["x-admin-key"] = adminKey;
  const adminDevice = localStorage.getItem("ajv_admin_device");
  if (adminDevice) opt.headers["x-client-ip"] = adminDevice;

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
      <button onclick="openPublishResultsCenter()" style="color:var(--gold);font-weight:700;">📢 Results Center</button>
      <button onclick="showPage('fees')">💳 Fee Ledger</button>
      <button onclick="openGrievancesPortal()">💬 Helpdesk</button>
      <button onclick="loadFaculty()">Faculty</button>
      <button onclick="loadStudents()">Students</button>
      <button onclick="showPage('profile')">Profile</button>
      <button onclick="logout()">Logout</button>
    `;
  } else if (state.user.role === "staff") {
    nav.innerHTML = `
      <button onclick="showPage('dashboard')">Dashboard</button>
      <button onclick="openFacultyAttendanceMarker()" style="color:#0891b2;font-weight:700;">📋 Attendance Marker</button>
      <button onclick="openFacultyResultsView()" style="color:var(--gold);font-weight:700;">🎓 Marksheets</button>
      <button onclick="showPage('fees')">💳 Student Fees</button>
      <button onclick="openGrievancesPortal()">💬 Helpdesk</button>
      <button onclick="openAnnouncementModal()">📢 Post Bulletin</button>
      <button onclick="loadStudents()">Students</button>
      <button onclick="showPage('profile')">Profile</button>
      <button onclick="logout()">Logout</button>
    `;
  } else {
    nav.innerHTML = `
      <button onclick="showPage('dashboard')">Dashboard</button>
      <button onclick="showPage('results')" style="color:var(--gold);font-weight:700;">🎓 Marksheets</button>
      <button onclick="openOfficialHallTicket()" style="color:#2563eb;font-weight:700;">🎫 Hall Ticket</button>
      <button onclick="openDigitalStudentIdCard()" style="font-weight:700;">🪪 Smart ID</button>
      <button onclick="openStudentAttendanceBreakdown()">📋 Attendance</button>
      <button onclick="showPage('fees')" style="color:#10b981;font-weight:700;">💳 Fee Payment</button>
      <button onclick="openGrievancesPortal()">💬 Helpdesk</button>
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
    const cfg = await api(`/api/config`);
    state.config = cfg || {};
  } catch (e) {
    state.config = { isAdminAllowed: false };
  }

  if (state.role === "admin" && (!state.config || !state.config.isAdminAllowed)) {
    state.role = "student";
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
  const urlParams = new URLSearchParams(window.location.search);
  const isHiddenAdminUrl = urlParams.get('admin') === 'show';
  const isAdminAllowed = Boolean(state.config && state.config.isAdminAllowed === true && isHiddenAdminUrl);

  if (state.role === "admin" && !isAdminAllowed) {
    state.role = "student";
  }

  app.innerHTML = `
    <div class="login-wrap">
      <div class="login">
        <div class="login-head">
          <img src="/assets/college-logo.png" alt="AJV Logo" title="AJV Logo">
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

          ${state.role === 'admin' ? `
          <label>Secret Passkey</label>
          <input id="adminPasskey" type="password" placeholder="Enter Admin Passkey" required>
          ` : ''}

          <label class="show-pass-label">
            <input type="checkbox" onchange="document.getElementById('password').type = this.checked ? 'text' : 'password'; if(document.getElementById('adminPasskey')) document.getElementById('adminPasskey').type = this.checked ? 'text' : 'password';">
            <span>Show Password(s)</span>
          </label>

          <div class="notice" style="text-align:center;">
            <div style="font-size:12px;color:var(--muted);margin-top:4px;">Please login with your official credentials to proceed.</div>
          </div>

          <button class="btn full">Secure Sign In →</button>
        </form>
      </div>
    </div>
  `;
}



function setLoginRole(r) {
  const urlParams = new URLSearchParams(window.location.search);
  const isHiddenAdminUrl = urlParams.get('admin') === 'show';
  
  if (r === "admin" && (!state.config || !state.config.isAdminAllowed || !isHiddenAdminUrl)) {
    toast("Admin access is restricted to authorized network and URL.", false);
    return;
  }
  state.role = r;
  renderLogin();
}

async function doLogin(e) {
  e.preventDefault();
  const urlParams = new URLSearchParams(window.location.search);
  const isHiddenAdminUrl = urlParams.get('admin') === 'show';

  if (state.role === "admin" && (!state.config || !state.config.isAdminAllowed || !isHiddenAdminUrl)) {
    toast("Admin access is restricted to authorized network and URL.", false);
    return;
  }
  try {
    const d = await api("/api/auth/login", {
      method: "POST",
      body: {
        loginId: loginId.value,
        password: password.value,
        role: state.role,
        adminPasskey: document.getElementById("adminPasskey") ? document.getElementById("adminPasskey").value : undefined
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

// -------------------------------------------------------------
// Official Institution Seal & Marksheet Generator
// -------------------------------------------------------------

function renderInstitutionSealSvg() {
  return `
    <div class="institution-seal-badge" title="Official Seal of the Controller of Examinations, AJV College of Engineering">
      <svg class="seal-svg" viewBox="0 0 200 200" width="124" height="124" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="sealGoldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#d4af37" />
            <stop offset="35%" stop-color="#fff3a8" />
            <stop offset="70%" stop-color="#b8860b" />
            <stop offset="100%" stop-color="#7a5400" />
          </linearGradient>
          <linearGradient id="sealNavyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#0b2447" />
            <stop offset="100%" stop-color="#041226" />
          </linearGradient>
          <path id="sealPathTop" d="M 32,100 A 68,68 0 1,1 168,100" fill="none" />
          <path id="sealPathBottom" d="M 168,100 A 68,68 0 0,1 32,100" fill="none" />
        </defs>

        <circle cx="100" cy="100" r="95" fill="none" stroke="url(#sealGoldGrad)" stroke-width="3" stroke-dasharray="3,3" />
        <circle cx="100" cy="100" r="90" fill="url(#sealNavyGrad)" stroke="url(#sealGoldGrad)" stroke-width="3.5" />
        <circle cx="100" cy="100" r="67" fill="none" stroke="url(#sealGoldGrad)" stroke-width="1.5" />

        <text font-size="8" font-weight="900" fill="url(#sealGoldGrad)" letter-spacing="1.5" text-anchor="middle">
          <textPath href="#sealPathTop" startOffset="50%">AJV COLLEGE OF ENGINEERING</textPath>
        </text>

        <text font-size="7" font-weight="800" fill="url(#sealGoldGrad)" letter-spacing="1" text-anchor="middle">
          <textPath href="#sealPathBottom" startOffset="50%">* EXAM CONTROLLER • AUTONOMOUS *</textPath>
        </text>

        <circle cx="100" cy="100" r="48" fill="#081b2f" stroke="url(#sealGoldGrad)" stroke-width="2" />
        <circle cx="100" cy="100" r="45" fill="none" stroke="#d4af37" stroke-dasharray="2,2" />

        <text x="100" y="80" text-anchor="middle" font-size="11" fill="#ffd700">★ ★ ★</text>
        <text x="100" y="95" text-anchor="middle" font-size="11" font-weight="900" fill="#ffffff" letter-spacing="1">OFFICIAL</text>
        <text x="100" y="109" text-anchor="middle" font-size="11" font-weight="900" fill="#ffd700" letter-spacing="1">SEAL</text>
        <text x="100" y="122" text-anchor="middle" font-size="7" font-weight="700" fill="#93c5fd">ESTD 2008</text>
        <text x="100" y="132" text-anchor="middle" font-size="6" fill="#f1d98f">TAMIL NADU</text>
      </svg>
      <div class="seal-ribbons">
        <div class="ribbon-left"></div>
        <div class="ribbon-right"></div>
      </div>
    </div>
  `;
}

// Open Official Marksheet Modal with verified results and institution seal
async function openOfficialMarksheet(semester = 1, studentId = null) {
  try {
    const sId = studentId || (state.user && state.user.id);
    const sem = Number(semester || 1);
    const data = await api(`/api/results/semester/${sem}${sId ? '?studentId=' + sId : ''}`);

    if (data.isPublished === false && state.user && state.user.role === "student") {
      modalDialog.innerHTML = `
        <div class="modal-header">
          <h2>Results Withheld / Under Valuation</h2>
          <button class="btn mini secondary" onclick="modalDialog.close()">×</button>
        </div>
        <div class="modal-body" style="padding:24px; text-align:center;">
          <div style="font-size:48px; margin-bottom:16px;">⏳</div>
          <h3 style="color:var(--navy); margin-bottom:12px;">Semester ${sem} results have not been officially published yet.</h3>
          <p class="muted">The Office of the Controller of Examinations is currently processing the results for this semester. Official academic marksheets will be available here once they are officially declared and published.</p>
        </div>
        <div class="modal-footer">
          <button class="btn secondary" onclick="modalDialog.close()">Close</button>
        </div>
      `;
      modalDialog.showModal();
      return;
    }

    renderMarksheetModal(data);
  } catch (e) {
    toast(e.message, false);
  }
}

// Backward-compatible wrapper for marksheet modal
function openMarksheetModal(student, academic, courses, semester = 1) {
  if (student && student.student && student.courses) {
    renderMarksheetModal(student);
    return;
  }
  openOfficialMarksheet(semester || 1, student ? student.id : null);
}

function renderMarksheetModal(data) {
  const isDraft = data.isPublished === false;
  const courses = data.courses || [];
  const sem = data.semester || 1;
  const student = data.student || {};
  const totalCredits = data.totalCredits || courses.reduce((s, c) => s + Number(c.course?.credits || 0), 0);
  const earnedCredits = data.earnedCredits || courses.filter(c => c.grade !== 'RA' && c.grade !== '—').reduce((s, c) => s + Number(c.course?.credits || 0), 0);
  const sgpa = Number(data.sgpa || 0).toFixed(2);
  const cgpa = Number(data.cgpa || 0).toFixed(2);
  const classification = data.classification || "First Class";

  modalDialog.innerHTML = `
    <div class="modal-header">
      <div>
        <h2 style="margin:0;">Official Statement of Grades</h2>
        <small class="muted">Semester ${sem} • Serial: ${esc(data.serialNo || 'AJV-OFFICIAL')}</small>
      </div>
      <button class="btn mini secondary" onclick="modalDialog.close()">✕</button>
    </div>
    <div class="modal-body">
      <div class="certificate">
        ${isDraft ? `
          <div style="background:#fef2f2;border:1px solid #fecaca;color:#991b1b;padding:8px 14px;border-radius:6px;margin-bottom:14px;text-align:center;font-weight:700;font-size:12px;">
            ⚠️ PROVISIONAL EVALUATION COPY • RESULT NOT OFFICIALLY PUBLISHED YET
          </div>
        ` : ''}

        <div class="cert-header">
          <img src="/assets/college-logo.png" alt="AJV College Logo">
          <h2>AJV COLLEGE OF ENGINEERING</h2>
          <p>An Autonomous Institution • Affiliated to Anna University, Chennai • Approved by AICTE, New Delhi</p>
          <p>Accredited by NAAC with 'A++' Grade • NBA Accredited • ISO 9001:2015 Certified</p>
          <div style="font-size:11px;font-weight:800;color:var(--blue);letter-spacing:1px;margin-top:4px;">OFFICE OF THE CONTROLLER OF EXAMINATIONS</div>
          <div class="cert-title">SEMESTER GRADE REPORT &amp; STATEMENT OF MARKS</div>
          <div style="font-size:12px;font-weight:700;color:#475569;margin-top:2px;">
            SEMESTER ${sem} (${esc(data.year || student.year || 'I Year').toUpperCase()}) — END SEMESTER EXAMINATIONS
          </div>
        </div>

        <div class="cert-meta">
          <div><span>Name of the Candidate:</span> <b>${esc(student.fullName || '').toUpperCase()}</b></div>
          <div><span>Register Number:</span> <b>${esc(student.registerNo || student.loginId)}</b></div>
          <div><span>Degree &amp; Branch:</span> <b>B.Tech — ${esc(student.department)}</b></div>
          <div><span>Regulations &amp; Pattern:</span> <b>Regulations 2021 (CBCS)</b></div>
          <div><span>Academic Year:</span> <b>${esc(data.year || student.year)} (Section ${esc(student.section || "A")})</b></div>
          <div><span>Date of Issue:</span> <b>${esc(data.issueDate || new Date().toLocaleDateString('en-US'))}</b></div>
        </div>

        <table style="margin-top:16px;">
          <thead>
            <tr>
              <th style="width:40px;text-align:center;">S.No</th>
              <th>Course Code</th>
              <th>Course Title</th>
              <th style="text-align:center;">Credits</th>
              <th style="text-align:center;">Internal / 40</th>
              <th style="text-align:center;">External / 60</th>
              <th style="text-align:center;">Total / 100</th>
              <th style="text-align:center;">Letter Grade</th>
              <th style="text-align:center;">Grade Point</th>
              <th style="text-align:center;">Result</th>
            </tr>
          </thead>
          <tbody>
            ${courses.length ? courses.map((c, idx) => `
              <tr>
                <td style="text-align:center;">${idx + 1}</td>
                <td><b>${esc(c.course?.code || '')}</b></td>
                <td>${esc(c.course?.name || '')}</td>
                <td style="text-align:center;">${c.course?.credits || 0}</td>
                <td style="text-align:center;">${c.internalMark}</td>
                <td style="text-align:center;">${c.externalMark}</td>
                <td style="text-align:center;"><b>${c.totalMark}</b></td>
                <td style="text-align:center;"><span class="pill ${gradeClass(c.grade)}">${esc(c.grade)}</span></td>
                <td style="text-align:center;"><b>${c.gradePoint}</b></td>
                <td style="text-align:center;"><b>${c.grade === 'RA' ? '<span style="color:#dc2626;">RA</span>' : (c.grade === '—' ? '—' : '<span style="color:#059669;">PASS</span>')}</b></td>
              </tr>
            `).join("") : `<tr><td colspan="10" style="text-align:center;padding:24px;color:var(--muted);">No course marks recorded for this semester yet.</td></tr>`}
          </tbody>
        </table>

        <div class="cert-summary">
          <div class="cert-summary-box">
            <span>Credits (Reg / Earned)</span>
            <b>${totalCredits} / ${earnedCredits}</b>
          </div>
          <div class="cert-summary-box">
            <span>Semester GPA (SGPA)</span>
            <b style="color:var(--blue);">${sgpa} / 10.0</b>
          </div>
          <div class="cert-summary-box">
            <span>Cumulative GPA (CGPA)</span>
            <b style="color:var(--gold);">${cgpa} / 10.0</b>
          </div>
          <div class="cert-summary-box">
            <span>Standing &amp; Result</span>
            <b style="font-size:13px;color:${data.resultStatus === 'PASS' ? '#059669' : '#dc2626'};">${data.resultStatus || 'PASS'} • ${classification}</b>
          </div>
        </div>

        <div class="cert-bottom-row">
          <div class="cert-verify-block">
            <div class="cert-barcode">${esc(data.serialNo || 'AJV-VERIFIED-TRANSCRIPT')}</div>
            <div><b>Security Hash:</b> SHA256-AJV-${student.id}-${sem}-VERIFIED</div>
            <div style="margin-top:2px;">Official electronic transcript certified by AJV Examination Cell.</div>
          </div>

          <!-- Official Institution Seal with Ribbons -->
          ${renderInstitutionSealSvg()}

          <div class="cert-signatures">
            <div class="cert-sign-line">Class Advisor</div>
            <div class="cert-sign-line">Head of Department</div>
            <div class="cert-sign-line">
              <div style="font-size:9px;color:#94a3b8;margin-bottom:2px;">Digitally Certified</div>
              Controller of Examinations
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn secondary" onclick="modalDialog.close()">Close</button>
      <button class="btn gold" onclick="window.print()">🖨️ Print Marksheet / Save PDF</button>
    </div>
  `;

  modalDialog.showModal();
}

async function studentDashboard(initialSem = 1) {
  try {
    const d = await api("/api/student/dashboard");
    const pubStatus = await api("/api/results/status").catch(() => ({ publishedSemesters: {} }));
    const pubMap = pubStatus.publishedSemesters || {};
    const feeData = await api("/api/student/fees").catch(() => null);
    const feeSummary = feeData?.summary || null;
    const feeDueAmount = feeSummary ? (feeSummary.totalDue || 0) : 0;
    const isAttendanceLow = Number(d.academic.attendance) < 75;

    // Restriction 1: Student only gets published results for their studying year or below
    const yearMaxSemMap = { "I Year": 2, "II Year": 4, "III Year": 6, "IV Year": 8 };
    const studentMaxSem = yearMaxSemMap[d.profile.year] || 2;
    state.studentSelectedSem = Math.min(state.studentSelectedSem || initialSem || 1, studentMaxSem);

    app.innerHTML = `
      <div class="dashboard">
        <div class="dash-head">
          <div>
            <div class="eyebrow">STUDENT PORTAL</div>
            <h1>Welcome, ${esc(d.profile.fullName)} 👋</h1>
            <p class="muted">${esc(d.profile.loginId)} • ${esc(d.profile.email || "Pending Email")} • ${esc(d.profile.department)} • ${esc(d.profile.year)} Sec ${esc(d.profile.section || "A")}</p>
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

        <!-- Dedicated Student Fee Payment & Clearance Status Card -->
        ${feeSummary ? `
          <div class="card callout" style="border-left: 6px solid ${feeDueAmount > 0 ? '#f59e0b' : '#10b981'}; background: ${feeDueAmount > 0 ? '#fffbeb' : '#ecfdf5'}; margin-top: 14px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
            <div>
              <div class="eyebrow" style="color:${feeDueAmount > 0 ? '#d97706' : '#059669'};">COLLEGE FEE STATUS &amp; ONLINE PAYMENT</div>
              <h3 style="color:${feeDueAmount > 0 ? '#92400e' : '#065f46'}; margin:2px 0;">
                ${feeDueAmount > 0 ? `⚠️ Outstanding Institutional Dues: ₹${feeDueAmount.toLocaleString('en-IN')}` : '✓ All Semester College Fees Fully Paid 🎉'}
              </h3>
              <p style="color:${feeDueAmount > 0 ? '#92400e' : '#047857'}; opacity:0.9; margin:0; font-size:13px;">
                ${feeDueAmount > 0 
                  ? `${feeSummary.pendingCount} pending fee item(s) due across Tuition, Exam, Hostel, Caution Deposit, &amp; Placement. Pay online to download official stamped receipts.`
                  : 'Your academic clearance is complete. Official stamped institutional cash receipts with university seal are available.'}
              </p>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              ${feeDueAmount > 0 ? `
                <button class="btn gold" onclick="openPayAllModal(${feeDueAmount}, ${feeSummary.pendingCount})">⚡ Settle All Dues (₹${feeDueAmount.toLocaleString('en-IN')})</button>
                <button class="btn secondary" onclick="showPage('fees')">View Breakdown &amp; Pay Items →</button>
              ` : `
                <button class="btn secondary" onclick="showPage('fees')">📜 View Stamped Receipts →</button>
              `}
            </div>
          </div>
        ` : ''}

        <div class="stats" style="margin-top:20px;">
          <div class="stat stat-with-ring">
            <div>
              <span class="label">CGPA (10.0 Scale)</span>
              <b>${Number(d.academic.cgpa).toFixed(2)}</b>
              <small>Cumulative Grade Point</small>
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
            <span class="label">Studying Year</span>
            <b style="font-size:18px;color:var(--navy);">${esc(d.profile.year)}</b>
            <small>Semesters 1 to ${studentMaxSem}</small>
          </div>
        </div>

        <div class="profile-strip">
          <div><span>Register ID</span><b>${esc(d.profile.loginId)}</b></div>
          <div><span>Official Email</span><b>${esc(d.profile.email || "—")}</b></div>
          <div><span>Contact Mobile</span><b>${esc(d.profile.phone)}</b></div>
          <div><span>Parent / Guardian</span><b>${esc(d.profile.parentName || "—")}</b></div>
        </div>



        <div class="two-col" style="margin-top:24px;">
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

async function openStudentResults(initialSem = 1) {
  try {
    const d = await api("/api/student/dashboard");
    const pubStatus = await api("/api/results/status").catch(() => ({ publishedSemesters: {} }));
    const pubMap = pubStatus.publishedSemesters || {};

    window.currentDept = d.profile.department;
    window.currentYear = d.profile.year;

    const yearMaxSemMap = { "I Year": 2, "II Year": 4, "III Year": 6, "IV Year": 8 };
    const studentMaxSem = yearMaxSemMap[d.profile.year] || 2;
    state.studentSelectedSem = Math.min(state.studentSelectedSem || initialSem || 1, studentMaxSem);

    app.innerHTML = `
      <div class="dashboard">
        <div class="dash-head">
          <div>
            <div class="eyebrow">ACADEMIC RESULTS &amp; MARKSHEETS</div>
            <h1>Curriculum Grade Statements</h1>
            <p class="muted">Official semester results published by the Administration.</p>
          </div>
        </div>

        <div class="card" style="margin-top:24px;">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:12px;">
            <div>
              <h2 style="margin:4px 0;">Studying: ${esc(d.profile.year)}</h2>
              <p class="muted" style="margin:0;font-size:13px;">Results are released strictly according to your enrolled academic year progression.</p>
            </div>
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
              <span class="badge" style="background:#e0f2fe;color:#0369a1;font-weight:700;">🎓 Enrolled: ${esc(d.profile.year)}</span>
              <span class="badge" style="background:#ecfdf5;color:#059669;font-weight:700;">● Admin Published</span>
              <span class="badge" style="background:#f1f5f9;color:#64748b;font-weight:700;">● In Valuation</span>
            </div>
          </div>

          <!-- 4 Year Groups containing 8 Semesters -->
          <div class="year-sem-container">
            <!-- I YEAR -->
            <div class="year-group ${studentMaxSem < 2 ? 'year-inactive' : ''}">
              <div class="year-label">I YEAR ${d.profile.year === 'I Year' ? '★' : ''}</div>
              <div class="sem-btns">
                <button class="sem-btn ${state.studentSelectedSem === 1 ? 'active' : ''}" onclick="selectStudentSem(1)">
                  <span>Semester 1</span>
                  ${checkSemPub(pubMap, 1, window.currentDept, window.currentYear) ? '<span class="tag-pub">Published ✓</span>' : '<span class="tag-unpub">In Valuation</span>'}
                </button>
                <button class="sem-btn ${state.studentSelectedSem === 2 ? 'active' : ''}" onclick="selectStudentSem(2)">
                  <span>Semester 2</span>
                  ${checkSemPub(pubMap, 2, window.currentDept, window.currentYear) ? '<span class="tag-pub">Published ✓</span>' : '<span class="tag-unpub">In Valuation</span>'}
                </button>
              </div>
            </div>

            <!-- II YEAR -->
            <div class="year-group ${studentMaxSem < 4 ? 'year-inactive' : ''}">
              <div class="year-label">II YEAR ${d.profile.year === 'II Year' ? '★' : ''}</div>
              <div class="sem-btns">
                ${studentMaxSem >= 4 ? `
                  <button class="sem-btn ${state.studentSelectedSem === 3 ? 'active' : ''}" onclick="selectStudentSem(3)">
                    <span>Semester 3</span>
                    ${checkSemPub(pubMap, 3, window.currentDept, window.currentYear) ? '<span class="tag-pub">Published ✓</span>' : '<span class="tag-unpub">In Valuation</span>'}
                  </button>
                  <button class="sem-btn ${state.studentSelectedSem === 4 ? 'active' : ''}" onclick="selectStudentSem(4)">
                    <span>Semester 4</span>
                    ${checkSemPub(pubMap, 4, window.currentDept, window.currentYear) ? '<span class="tag-pub">Published ✓</span>' : '<span class="tag-unpub">In Valuation</span>'}
                  </button>
                ` : `
                  <button class="sem-btn locked" onclick="notifyHigherYearLocked(3, '${esc(d.profile.year)}', ${studentMaxSem})">
                    <span>Semester 3</span>
                    <span class="tag-locked">🔒 Higher Year</span>
                  </button>
                  <button class="sem-btn locked" onclick="notifyHigherYearLocked(4, '${esc(d.profile.year)}', ${studentMaxSem})">
                    <span>Semester 4</span>
                    <span class="tag-locked">🔒 Higher Year</span>
                  </button>
                `}
              </div>
            </div>

            <!-- III YEAR -->
            <div class="year-group ${studentMaxSem < 6 ? 'year-inactive' : ''}">
              <div class="year-label">III YEAR ${d.profile.year === 'III Year' ? '★' : ''}</div>
              <div class="sem-btns">
                ${studentMaxSem >= 6 ? `
                  <button class="sem-btn ${state.studentSelectedSem === 5 ? 'active' : ''}" onclick="selectStudentSem(5)">
                    <span>Semester 5</span>
                    ${checkSemPub(pubMap, 5, window.currentDept, window.currentYear) ? '<span class="tag-pub">Published ✓</span>' : '<span class="tag-unpub">In Valuation</span>'}
                  </button>
                  <button class="sem-btn ${state.studentSelectedSem === 6 ? 'active' : ''}" onclick="selectStudentSem(6)">
                    <span>Semester 6</span>
                    ${checkSemPub(pubMap, 6, window.currentDept, window.currentYear) ? '<span class="tag-pub">Published ✓</span>' : '<span class="tag-unpub">In Valuation</span>'}
                  </button>
                ` : `
                  <button class="sem-btn locked" onclick="notifyHigherYearLocked(5, '${esc(d.profile.year)}', ${studentMaxSem})">
                    <span>Semester 5</span>
                    <span class="tag-locked">🔒 Higher Year</span>
                  </button>
                  <button class="sem-btn locked" onclick="notifyHigherYearLocked(6, '${esc(d.profile.year)}', ${studentMaxSem})">
                    <span>Semester 6</span>
                    <span class="tag-locked">🔒 Higher Year</span>
                  </button>
                `}
              </div>
            </div>

            <!-- IV YEAR -->
            <div class="year-group ${studentMaxSem < 8 ? 'year-inactive' : ''}">
              <div class="year-label">IV YEAR ${d.profile.year === 'IV Year' ? '★' : ''}</div>
              <div class="sem-btns">
                ${studentMaxSem >= 8 ? `
                  <button class="sem-btn ${state.studentSelectedSem === 7 ? 'active' : ''}" onclick="selectStudentSem(7)">
                    <span>Semester 7</span>
                    ${checkSemPub(pubMap, 7, window.currentDept, window.currentYear) ? '<span class="tag-pub">Published ✓</span>' : '<span class="tag-unpub">In Valuation</span>'}
                  </button>
                  <button class="sem-btn ${state.studentSelectedSem === 8 ? 'active' : ''}" onclick="selectStudentSem(8)">
                    <span>Semester 8</span>
                    ${checkSemPub(pubMap, 8, window.currentDept, window.currentYear) ? '<span class="tag-pub">Published ✓</span>' : '<span class="tag-unpub">In Valuation</span>'}
                  </button>
                ` : `
                  <button class="sem-btn locked" onclick="notifyHigherYearLocked(7, '${esc(d.profile.year)}', ${studentMaxSem})">
                    <span>Semester 7</span>
                    <span class="tag-locked">🔒 Higher Year</span>
                  </button>
                  <button class="sem-btn locked" onclick="notifyHigherYearLocked(8, '${esc(d.profile.year)}', ${studentMaxSem})">
                    <span>Semester 8</span>
                    <span class="tag-locked">🔒 Higher Year</span>
                  </button>
                `}
              </div>
            </div>
          </div>

          <div id="studentSemDetail" style="margin-top:20px;">
            <!-- Rendered by loadStudentSemResult(state.studentSelectedSem) -->
          </div>
        </div>
      </div>
    `;

    loadStudentSemResult(state.studentSelectedSem);
  } catch (x) {
    toast(x.message, false);
  }
}

function notifyHigherYearLocked(sem, year, maxSem) {
  toast(`Semester ${sem} is restricted. As a ${year} student, your enrolled results cover Semesters 1 to ${maxSem}.`, false);
  loadStudentSemResult(sem);
}

async function selectStudentSem(sem) {
  state.studentSelectedSem = sem;
  document.querySelectorAll(".sem-btn").forEach((b) => {
    const isThisSem = b.textContent.includes(`Semester ${sem}`);
    b.classList.toggle("active", isThisSem);
  });
  loadStudentSemResult(sem);
}

async function loadStudentSemResult(sem) {
  const container = document.getElementById("studentSemDetail");
  if (!container) return;

  container.innerHTML = `<div style="text-align:center;padding:24px;color:var(--muted);">Loading Semester ${sem} records...</div>`;
  try {
    const data = await api(`/api/results/semester/${sem}`);

    // If higher-year restriction applies to this student
    if (data.isEligible === false) {
      container.innerHTML = `
        <div style="background:#f8fafc;border:2px dashed #cbd5e1;border-radius:12px;padding:36px 24px;text-align:center;">
          <div style="font-size:42px;margin-bottom:8px;">🔒</div>
          <h3 style="color:var(--navy);margin:4px 0;">Semester ${sem} Results Not Applicable to ${esc(data.studentYear || 'Your Academic Year')}</h3>
          <p class="muted" style="max-width:550px;margin:8px auto 16px;font-size:14px;">
            ${esc(data.message || 'Results are restricted to students studying in that academic year. Your enrolled progression corresponds to ' + data.studentYear + ' (Semesters 1 to ' + data.maxEligibleSemester + ').')}
          </p>
          <span class="badge" style="background:#f1f5f9;color:#475569;font-weight:700;padding:6px 14px;border-radius:999px;">
            Enrolled Progression: Semesters 1 to ${data.maxEligibleSemester || 2}
          </span>
        </div>
      `;
      return;
    }

    if (data.isPublished === false) {
      container.innerHTML = `
        <div style="background:#f8fafc;border:2px dashed #cbd5e1;border-radius:12px;padding:36px 24px;text-align:center;">
          <div style="font-size:42px;margin-bottom:8px;">⏳</div>
          <h3 style="color:var(--navy);margin:4px 0;">Semester ${sem} Results Pending Official Publication</h3>
          <p class="muted" style="max-width:550px;margin:8px auto 16px;font-size:14px;">
            Semester ${sem} assessments are currently undergoing valuation and verification. 
            Once officially published by the Controller of Examinations / Admin, your statement of marks and verified institutional marksheet will appear here automatically.
          </p>
          <span class="badge" style="background:#fef3c7;color:#b45309;font-weight:700;padding:6px 14px;border-radius:999px;">
            🔒 Status: Unpublished by Administration
          </span>
        </div>
      `;
      return;
    }

    const courses = data.courses || [];
    container.innerHTML = `
      <div class="result-success-alert">
        <div>
          <b class="title">✓ Official Results Published: Semester ${sem} (${esc(data.year)})</b>
          <div class="sub">Certified by ${esc(data.publishedBy || 'AJV Controller of Examinations')} • SGPA: <b>${data.sgpa} / 10.0</b> • Result: <b>${data.resultStatus}</b></div>
        </div>
        <button class="btn gold" onclick="openOfficialMarksheet(${sem})">🎓 View Official Marksheet (With Seal) →</button>
      </div>

      <div class="table-wrap" style="box-shadow:none;border:1px solid var(--line);">
        <table>
          <thead>
            <tr>
              <th style="width:40px;text-align:center;">#</th>
              <th>Course Code &amp; Title</th>
              <th style="text-align:center;">Credits</th>
              <th style="text-align:center;">Attendance</th>
              <th style="text-align:center;">Internal / 40</th>
              <th style="text-align:center;">External / 60</th>
              <th style="text-align:center;">Total / 100</th>
              <th style="text-align:center;">Letter Grade</th>
              <th style="text-align:center;">Grade Point</th>
              <th style="text-align:center;">Result</th>
            </tr>
          </thead>
          <tbody>
            ${courses.length ? courses.map((x, i) => `
              <tr>
                <td style="text-align:center;">${i + 1}</td>
                <td><b>${esc(x.course?.code || '')}</b><br><small class="muted">${esc(x.course?.name || '')}</small></td>
                <td style="text-align:center;">${x.course?.credits || 0}</td>
                <td style="text-align:center;">${x.attendance}%</td>
                <td style="text-align:center;">${x.internalMark}</td>
                <td style="text-align:center;">${x.externalMark}</td>
                <td style="text-align:center;"><b>${x.totalMark}</b></td>
                <td style="text-align:center;"><span class="pill ${gradeClass(x.grade)}">${esc(x.grade)}</span></td>
                <td style="text-align:center;"><b>${x.gradePoint}</b></td>
                <td style="text-align:center;"><b>${x.grade === 'RA' ? '<span style="color:#dc2626;">RA</span>' : (x.grade === '—' ? '—' : '<span style="color:#059669;">PASS</span>')}</b></td>
              </tr>
            `).join("") : `<tr><td colspan="10" style="text-align:center;padding:24px;color:var(--muted);">No course marks recorded for this semester yet.</td></tr>`}
          </tbody>
        </table>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div style="color:#dc2626;padding:16px;">Failed to load semester result: ${esc(err.message)}</div>`;
  }
}

function openStudentResultsView(sem = 1) {
  openStudentResults(sem);
}

// -------------------------------------------------------------
// Faculty & Staff Results & Marksheet View
// -------------------------------------------------------------

async function openFacultyResultsView(initialSem = 1, initialStudentId = null) {
  try {
    const students = await api("/api/staff/students");
    state.staffStudents = students;
    const pubStatus = await api("/api/results/status").catch(() => ({ publishedSemesters: {} }));
    const pubMap = pubStatus.publishedSemesters || {};

    state.facultySelectedSem = Number(state.facultySelectedSem || initialSem || 1);
    state.facultySelectedStudent = Number(state.facultySelectedStudent || initialStudentId || (students[0] ? students[0].id : null));

    app.innerHTML = `
      <div class="dashboard">
        <div class="dash-head">
          <div>
            <div class="eyebrow">ACADEMIC RESULTS &amp; MARKSHEETS</div>
            <h1>Semester Grade Reports &amp; Marksheets</h1>
            <p class="muted">Faculty Console: Inspect student performance across 4 Years / 8 Semesters and generate official verified marksheets with institution seal.</p>
          </div>
          <div style="display:flex;gap:10px;">
            <button class="btn secondary" onclick="showPage('dashboard')">← Dashboard</button>
          </div>
        </div>

        <!-- Student & Semester Selection Bar -->
        <div class="card" style="margin-bottom:20px;">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:16px;">
            <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;flex:1;">
              <div>
                <label style="margin:0 0 4px;font-size:11px;font-weight:700;">SELECT STUDENT</label>
                <select id="facultyStudentSelect" onchange="changeFacultyStudent(this.value)" style="padding:8px 12px;border:1px solid var(--line);border-radius:6px;min-width:240px;font-weight:600;background:var(--bg);">
                  ${students.map(s => `<option value="${s.id}" ${s.id === state.facultySelectedStudent ? 'selected' : ''}>${esc(s.loginId)} — ${esc(s.fullName)} (${esc(s.department)})</option>`).join("")}
                </select>
              </div>

              <div>
                <label style="margin:0 0 4px;font-size:11px;font-weight:700;">ACADEMIC SEMESTER</label>
                <select id="facultySemSelect" onchange="changeFacultySem(this.value)" style="padding:8px 12px;border:1px solid var(--line);border-radius:6px;min-width:180px;font-weight:600;background:var(--bg);">
                  <option value="1" ${state.facultySelectedSem === 1 ? 'selected' : ''}>Semester 1 (I Year)</option>
                  <option value="2" ${state.facultySelectedSem === 2 ? 'selected' : ''}>Semester 2 (I Year)</option>
                  <option value="3" ${state.facultySelectedSem === 3 ? 'selected' : ''}>Semester 3 (II Year)</option>
                  <option value="4" ${state.facultySelectedSem === 4 ? 'selected' : ''}>Semester 4 (II Year)</option>
                  <option value="5" ${state.facultySelectedSem === 5 ? 'selected' : ''}>Semester 5 (III Year)</option>
                  <option value="6" ${state.facultySelectedSem === 6 ? 'selected' : ''}>Semester 6 (III Year)</option>
                  <option value="7" ${state.facultySelectedSem === 7 ? 'selected' : ''}>Semester 7 (IV Year)</option>
                  <option value="8" ${state.facultySelectedSem === 8 ? 'selected' : ''}>Semester 8 (IV Year)</option>
                </select>
              </div>
            </div>

            <button class="btn gold" onclick="openOfficialMarksheet(state.facultySelectedSem, state.facultySelectedStudent)">
              🎓 View Official Marksheet (With Seal) →
            </button>
          </div>
        </div>

        <!-- 4 Years & 8 Semesters Quick Tabs -->
        <div class="card" style="margin-bottom:24px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
            <b>Select Semester to View:</b>
            <div style="font-size:12px;">
              ${checkSemPub(pubMap, state.facultySelectedSem, window.currentDept, window.currentYear)
                ? '<span style="color:#059669;font-weight:700;">● Admin Published to Students</span>'
                : '<span style="color:#d97706;font-weight:700;">🔒 Unpublished / In Valuation</span>'}
            </div>
          </div>
          <div class="year-sem-container">
            <div class="year-group">
              <div class="year-label">I YEAR</div>
              <div class="sem-btns">
                <button class="sem-btn ${state.facultySelectedSem === 1 ? 'active' : ''}" onclick="changeFacultySem(1)">
                  <span>Semester 1</span>
                  ${checkSemPub(pubMap, 1, window.currentDept, window.currentYear) ? '<span class="tag-pub">Published</span>' : '<span class="tag-unpub">Draft</span>'}
                </button>
                <button class="sem-btn ${state.facultySelectedSem === 2 ? 'active' : ''}" onclick="changeFacultySem(2)">
                  <span>Semester 2</span>
                  ${checkSemPub(pubMap, 2, window.currentDept, window.currentYear) ? '<span class="tag-pub">Published</span>' : '<span class="tag-unpub">Draft</span>'}
                </button>
              </div>
            </div>
            <div class="year-group">
              <div class="year-label">II YEAR</div>
              <div class="sem-btns">
                <button class="sem-btn ${state.facultySelectedSem === 3 ? 'active' : ''}" onclick="changeFacultySem(3)">
                  <span>Semester 3</span>
                  ${checkSemPub(pubMap, 3, window.currentDept, window.currentYear) ? '<span class="tag-pub">Published</span>' : '<span class="tag-unpub">Draft</span>'}
                </button>
                <button class="sem-btn ${state.facultySelectedSem === 4 ? 'active' : ''}" onclick="changeFacultySem(4)">
                  <span>Semester 4</span>
                  ${checkSemPub(pubMap, 4, window.currentDept, window.currentYear) ? '<span class="tag-pub">Published</span>' : '<span class="tag-unpub">Draft</span>'}
                </button>
              </div>
            </div>
            <div class="year-group">
              <div class="year-label">III YEAR</div>
              <div class="sem-btns">
                <button class="sem-btn ${state.facultySelectedSem === 5 ? 'active' : ''}" onclick="changeFacultySem(5)">
                  <span>Semester 5</span>
                  ${checkSemPub(pubMap, 5, window.currentDept, window.currentYear) ? '<span class="tag-pub">Published</span>' : '<span class="tag-unpub">Draft</span>'}
                </button>
                <button class="sem-btn ${state.facultySelectedSem === 6 ? 'active' : ''}" onclick="changeFacultySem(6)">
                  <span>Semester 6</span>
                  ${checkSemPub(pubMap, 6, window.currentDept, window.currentYear) ? '<span class="tag-pub">Published</span>' : '<span class="tag-unpub">Draft</span>'}
                </button>
              </div>
            </div>
            <div class="year-group">
              <div class="year-label">IV YEAR</div>
              <div class="sem-btns">
                <button class="sem-btn ${state.facultySelectedSem === 7 ? 'active' : ''}" onclick="changeFacultySem(7)">
                  <span>Semester 7</span>
                  ${checkSemPub(pubMap, 7, window.currentDept, window.currentYear) ? '<span class="tag-pub">Published</span>' : '<span class="tag-unpub">Draft</span>'}
                </button>
                <button class="sem-btn ${state.facultySelectedSem === 8 ? 'active' : ''}" onclick="changeFacultySem(8)">
                  <span>Semester 8</span>
                  ${checkSemPub(pubMap, 8, window.currentDept, window.currentYear) ? '<span class="tag-pub">Published</span>' : '<span class="tag-unpub">Draft</span>'}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div id="facultyResultDetail">
          <!-- Populated by loadFacultyResultDetail -->
        </div>
      </div>
    `;

    loadFacultyResultDetail();
  } catch (err) {
    toast(err.message, false);
  }
}

function changeFacultyStudent(id) {
  state.facultySelectedStudent = Number(id);
  loadFacultyResultDetail();
}

function changeFacultySem(sem) {
  state.facultySelectedSem = Number(sem);
  const semSelect = document.getElementById("facultySemSelect");
  if (semSelect) semSelect.value = String(sem);
  document.querySelectorAll(".sem-btn").forEach((b, idx) => {
    b.classList.toggle("active", idx + 1 === state.facultySelectedSem);
  });
  loadFacultyResultDetail();
}

async function loadFacultyResultDetail() {
  const container = document.getElementById("facultyResultDetail");
  if (!container) return;
  if (!state.facultySelectedStudent) {
    container.innerHTML = `<p class="muted" style="padding:20px;text-align:center;">Please select a student above.</p>`;
    return;
  }

  container.innerHTML = `<div style="text-align:center;padding:24px;color:var(--muted);">Loading semester ${state.facultySelectedSem} assessment...</div>`;
  try {
    const data = await api(`/api/results/semester/${state.facultySelectedSem}?studentId=${state.facultySelectedStudent}`);
    const courses = data.courses || [];
    const isPub = data.isPublished;

    container.innerHTML = `
      <div style="background:${isPub ? '#f0fdf4' : '#fffbeb'};border:1px solid ${isPub ? '#86efac' : '#fde68a'};border-radius:8px;padding:14px 18px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
        <div>
          <b style="color:${isPub ? '#15803d' : '#b45309'};font-size:15px;">
            ${isPub ? '✓ Semester ' + state.facultySelectedSem + ' Results: Officially Published' : '🔒 Semester ' + state.facultySelectedSem + ' Results: Unpublished (Faculty Review Copy)'}
          </b>
          <div style="color:${isPub ? '#166534' : '#92400e'};font-size:12px;margin-top:2px;">
            Candidate: <b>${esc(data.student?.fullName)} (${esc(data.student?.loginId)})</b> • SGPA: <b>${data.sgpa} / 10.0</b> • Result: <b>${data.resultStatus}</b> • Credits Earned: <b>${data.earnedCredits} / ${data.totalCredits}</b>
          </div>
        </div>
        <button class="btn gold" onclick="openOfficialMarksheet(${state.facultySelectedSem}, ${state.facultySelectedStudent})">
          🖨️ Open Sealed Marksheet Statement →
        </button>
      </div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th style="width:40px;text-align:center;">#</th>
              <th>Course Code &amp; Title</th>
              <th style="text-align:center;">Credits</th>
              <th style="text-align:center;">Attendance</th>
              <th style="text-align:center;">Internal / 40</th>
              <th style="text-align:center;">External / 60</th>
              <th style="text-align:center;">Total / 100</th>
              <th style="text-align:center;">Letter Grade</th>
              <th style="text-align:center;">Grade Point</th>
              <th style="text-align:center;">Result</th>
            </tr>
          </thead>
          <tbody>
            ${courses.length ? courses.map((x, i) => `
              <tr>
                <td style="text-align:center;">${i + 1}</td>
                <td><b>${esc(x.course?.code || '')}</b><br><small class="muted">${esc(x.course?.name || '')}</small></td>
                <td style="text-align:center;">${x.course?.credits || 0}</td>
                <td style="text-align:center;">${x.attendance}%</td>
                <td style="text-align:center;">${x.internalMark}</td>
                <td style="text-align:center;">${x.externalMark}</td>
                <td style="text-align:center;"><b>${x.totalMark}</b></td>
                <td style="text-align:center;"><span class="pill ${gradeClass(x.grade)}">${esc(x.grade)}</span></td>
                <td style="text-align:center;"><b>${x.gradePoint}</b></td>
                <td style="text-align:center;"><b>${x.grade === 'RA' ? '<span style="color:#dc2626;">RA</span>' : (x.grade === '—' ? '—' : '<span style="color:#059669;">PASS</span>')}</b></td>
              </tr>
            `).join("") : `<tr><td colspan="10" style="text-align:center;padding:24px;color:var(--muted);">No course marks recorded for Semester ${state.facultySelectedSem} yet.</td></tr>`}
          </tbody>
        </table>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div style="color:#dc2626;padding:16px;">Failed to load result: ${esc(err.message)}</div>`;
  }
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
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button class="btn secondary" onclick="exportDataCsv('/api/admin/export/students', 'AJV_Student_Master_Register.csv')">📥 Export Master CSV</button>
            <button class="btn secondary" onclick="openIssueFacultyModal()">+ Issue Faculty ID</button>
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

      </div>
    `;
  } catch (x) {
    toast(x.message, false);
  }
}

// -------------------------------------------------------------
// Admin Result Publication Center (Strictly Admin Controlled)
// -------------------------------------------------------------

async function openPublishResultsCenter() {
  if (!state.user || state.user.role !== "admin") {
    toast("Unauthorized: Results publication is restricted to Administrator only", false);
    return showPage("dashboard");
  }

  try {
    const [statusData, analyticsData, students] = await Promise.all([
      api("/api/results/status"),
      api("/api/admin/results/analytics").catch(() => ({ analytics: {} })),
      api("/api/staff/students")
    ]);

    const pubMap = statusData.publishedSemesters || {};
    const analytics = analyticsData.analytics || {};
    state.staffStudents = students;
    state.adminResultsAnalytics = analytics;

    const years = [
      { year: "I Year", sems: [1, 2], desc: "Foundation & Applied Science Core" },
      { year: "II Year", sems: [3, 4], desc: "Department Core & Data Structures" },
      { year: "III Year", sems: [5, 6], desc: "Advanced System Engineering & Networks" },
      { year: "IV Year", sems: [7, 8], desc: "Electives, Cloud Systems & Final Capstone" }
    ];

    app.innerHTML = `
      <div class="dashboard">
        <div class="dash-head">
          <div>
            <div class="eyebrow" style="color:var(--red);">🛡️ CONTROLLER OF EXAMINATIONS • EXECUTIVE CONSOLE</div>
            <h1>Academic Results Publication &amp; Governance Center</h1>
            <p class="muted">Authorize, audit, and broadcast semester examination results across all 4 Academic Years &amp; 8 Semesters. Inspect batch pass percentages, valuation readiness, and official sealed marksheets.</p>
          </div>
          <div style="display:flex;gap:10px;flex-wrap:wrap;">
            <button class="btn gold" onclick="exportDataCsv('/api/admin/export/broadsheet/' + (state.selectedPublishSemester || 1), 'AJV_Semester_' + (state.selectedPublishSemester || 1) + '_TMR_Broadsheet.csv')">📥 Export Broadsheet CSV</button>
            <button class="btn secondary" onclick="showPage('dashboard')">← Admin Dashboard</button>
          </div>
        </div>

        <!-- Bulk Academic Year Release Strip -->
        <div class="bulk-year-strip">
          <div style="display:flex;align-items:center;gap:8px;">
            <b style="font-size:13px;color:var(--navy);">⚡ Quick Batch Operations:</b>
            <span class="muted" style="font-size:12px;">Publish or withhold entire academic years in one click:</span>
          </div>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:10px;">
            <select id="bulkPubDept" style="padding:8px 12px;border:1px solid var(--line);border-radius:6px;font-size:12px;background:var(--input-bg);color:var(--ink);min-width:200px;">
              <option value="ALL">Overall (All Departments)</option>
              ${state.config.departments.map(d => `<option value="${d}">${esc(d)}</option>`).join('')}
            </select>
            <button class="btn mini secondary" onclick="adminBulkPublishYear('I Year', true, document.getElementById('bulkPubDept').value)">Publish I Year (Sem 1 &amp; 2)</button>
            <button class="btn mini secondary" onclick="adminBulkPublishYear('II Year', true, document.getElementById('bulkPubDept').value)">Publish II Year (Sem 3 &amp; 4)</button>
            <button class="btn mini secondary" onclick="adminBulkPublishYear('III Year', true, document.getElementById('bulkPubDept').value)">Publish III Year (Sem 5 &amp; 6)</button>
            <button class="btn mini secondary" onclick="adminBulkPublishYear('IV Year', true, document.getElementById('bulkPubDept').value)">Publish IV Year (Sem 7 &amp; 8)</button>
          </div>
        </div>

        <!-- Executive Instant Marksheet & Broadsheet Inspection Toolbar -->
        <div class="card" style="background:#f8fafc;border:1px solid #cbd5e1;margin-bottom:24px;">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:14px;">
            <div>
              <b style="color:var(--navy);font-size:15px;">🎓 Instant Candidate Marksheet &amp; Batch Audit Tool</b>
              <p class="muted" style="margin:2px 0 0;font-size:12px;">Inspect any student's marksheet with the institutional seal or open the Tabulated Mark Register (TMR) Broadsheet for any semester.</p>
            </div>
            <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
              <select id="adminPreviewStudent" style="padding:8px 12px;border:1px solid var(--line);border-radius:6px;min-width:220px;font-size:13px;background:#fff;">
                ${students.map(s => `<option value="${s.id}">${esc(s.loginId)} — ${esc(s.fullName)} (${esc(s.year)})</option>`).join("")}
              </select>
              <select id="adminPreviewSemSelect" style="padding:8px 12px;border:1px solid var(--line);border-radius:6px;font-size:13px;background:#fff;">
                <option value="1">Semester 1 (I Year)</option>
                <option value="2">Semester 2 (I Year)</option>
                <option value="3">Semester 3 (II Year)</option>
                <option value="4">Semester 4 (II Year)</option>
                <option value="5">Semester 5 (III Year)</option>
                <option value="6">Semester 6 (III Year)</option>
                <option value="7">Semester 7 (IV Year)</option>
                <option value="8">Semester 8 (IV Year)</option>
              </select>
              <button class="btn gold" onclick="openOfficialMarksheet(document.getElementById('adminPreviewSemSelect').value, document.getElementById('adminPreviewStudent').value)">
                🎓 View Sealed Marksheet
              </button>
              <button class="btn secondary" onclick="openSemesterBroadsheet(document.getElementById('adminPreviewSemSelect').value)">
                📑 Broadsheet (TMR)
              </button>
            </div>
          </div>
        </div>

        <!-- 4 Years & 8 Semesters Executive Publishing & Analytics Grid -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(320px, 1fr));gap:20px;">
          ${years.map(y => `
            <div class="card" style="border-top:4px solid var(--navy);display:flex;flex-direction:column;justify-content:space-between;">
              <div>
                <div style="display:flex;justify-content:space-between;align-items:center;">
                  <span class="eyebrow" style="color:var(--blue);">${y.year.toUpperCase()}</span>
                  <span style="font-size:11px;font-weight:700;color:var(--muted);">${y.sems.length} Semesters</span>
                </div>
                <h3 style="margin:6px 0 2px;">${y.year} Academic Assessment</h3>
                <p class="muted" style="font-size:12px;margin:0 0 16px;">${y.desc}</p>
                
                <div style="display:flex;flex-direction:column;gap:14px;">
                  ${y.sems.map(sem => {
                    const pubMapKeys = Object.keys(pubMap).filter(k => k.startsWith(String(sem) + "_"));
                    const legacyPub = pubMap[String(sem)] && pubMap[String(sem)].isPublished;
                    const isPub = legacyPub || pubMapKeys.some(k => pubMap[k].isPublished);
                    const pub = isPub ? (legacyPub ? pubMap[String(sem)] : pubMap[pubMapKeys.find(k => pubMap[k].isPublished)]) : { isPublished: false };
                    
                    const semAnalytics = analytics[String(sem)] || {
                      totalEvaluated: 0,
                      passedCount: 0,
                      raCount: 0,
                      pendingCount: 0,
                      passPercentage: 0,
                      avgSgpa: 0,
                      valuationStatus: 'NOT_STARTED'
                    };
                    const passPct = Number(semAnalytics.passPercentage || 0);
                    const barClass = passPct >= 85 ? '' : (passPct >= 65 ? 'warning' : 'danger');

                    let readinessHtml = '';
                    if (semAnalytics.valuationStatus === 'READY_TO_PUBLISH') {
                      readinessHtml = `<span class="readiness-badge readiness-ready">✓ 100% Valuated</span>`;
                    } else if (semAnalytics.valuationStatus === 'IN_PROGRESS') {
                      readinessHtml = `<span class="readiness-badge readiness-progress">⏳ Valuation In Progress</span>`;
                    } else {
                      readinessHtml = `<span class="readiness-badge readiness-notstarted">Awaiting Mark Entry</span>`;
                    }

                    return `
                      <div class="admin-pub-card ${isPub ? 'is-published' : 'is-unpublished'}">
                        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;">
                          <div>
                            <b style="font-size:15px;color:var(--navy);">Semester ${sem}</b>
                            <div style="font-size:11px;color:${isPub ? '#15803d' : '#64748b'};margin-top:1px;">
                              ${isPub ? `✓ Released by ${esc(pub.publishedBy || 'COE')}` : '🔒 Withheld / Unpublished'}
                            </div>
                          </div>
                          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;">
                            <span class="pill ${isPub ? 'grade-Ap' : 'grade-B'}" style="font-size:10px;padding:2px 8px;">
                              ${isPub ? 'PUBLISHED' : 'DRAFT'}
                            </span>
                            ${readinessHtml}
                          </div>
                        </div>

                        <!-- Real-Time Examination Analytics & Pass Metrics -->
                        <div class="sem-analytics-bar">
                          <div class="sem-metrics-strip">
                            <span>Evaluated: <b>${semAnalytics.totalEvaluated}</b> students</span>
                            <span>Pass Rate: <b>${passPct}%</b></span>
                          </div>
                          <div class="pass-bar-track">
                            <div class="pass-bar-fill ${barClass}" style="width: ${passPct}%;"></div>
                          </div>
                          <div style="display:flex;justify-content:space-between;font-size:10px;color:#64748b;margin-top:5px;">
                            <span>${semAnalytics.passedCount} PASS • ${semAnalytics.raCount} RA</span>
                            <span>Batch Avg: <b>${semAnalytics.avgSgpa} SGPA</b></span>
                          </div>
                        </div>

                        <!-- Action Toolbar -->
                        <div style="display:flex;gap:6px;align-items:center;margin-top:12px;">
                          <button class="btn gold mini" style="flex:1;" onclick="openPublishModal(${sem}, true)">
                            🚀 Publish Results
                          </button>
                          <button class="btn secondary mini" style="flex:1;" onclick="openPublishModal(${sem}, false)">
                            🔒 Unpublish
                          </button>
                          <button class="btn secondary mini" title="Tabulated Mark Register (TMR) Broadsheet" onclick="openSemesterBroadsheet(${sem})">
                            📑 TMR
                          </button>
                          <button class="btn secondary mini" title="Inspect marksheet with institutional seal" onclick="previewSemFirstStudent(${sem})">
                            🎓 Preview
                          </button>
                        </div>
                      </div>
                    `;
                  }).join("")}
                </div>
              </div>

              <div style="margin-top:16px;padding-top:12px;border-top:1px solid var(--line);font-size:11px;color:var(--muted);display:flex;justify-content:space-between;">
                <span>Regulations 2021 (Autonomous)</span>
                <span>Choice Based Credit System</span>
              </div>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  } catch (err) {
    toast(err.message, false);
  }
}

// -------------------------------------------------------------
// Executive Publishing Dialog with Session & Auto-Broadcast
// -------------------------------------------------------------

function openPublishModal(sem, willPublish) {
  const analytics = (state.adminResultsAnalytics && state.adminResultsAnalytics[String(sem)]) || {};
  const currentSession = analytics.sessionName || "April / May 2026 End Semester Examinations";
  const passRate = analytics.passPercentage || 0;
  const evalCount = analytics.totalEvaluated || 0;

  modalDialog.innerHTML = `
    <div class="modal-header">
      <div>
        <h2 style="margin:0;">${willPublish ? '🚀 Official Semester Results Publication' : '🔒 Withhold / Unpublish Results'}</h2>
        <small class="muted">Semester ${sem} Assessment Governance</small>
      </div>
      <button class="btn mini secondary" onclick="modalDialog.close()">✕</button>
    </div>
    <form onsubmit="executePublish(event, ${sem}, ${willPublish})">
      <div class="modal-body">
        ${willPublish ? `
          <div style="background:var(--alert-success-bg);border:1px solid var(--alert-success-border);border-radius:8px;padding:12px 14px;margin-bottom:14px;">
            <b style="color:var(--alert-success-text);font-size:14px;">Pre-Publication Valuation Audit Summary:</b>
            <div style="display:flex;gap:16px;margin-top:6px;font-size:12px;color:var(--alert-success-text);">
              <span>Total Evaluated: <b>${evalCount} Candidates</b></span>
              <span>Pass Rate: <b>${passRate}%</b></span>
              <span>Batch Average SGPA: <b>${analytics.avgSgpa || '—'}</b></span>
            </div>
          </div>

          <label style="margin-top:12px;">Target Scope (Department)</label>
          <select id="pubScope" style="width:100%; padding:10px; border-radius:8px; border:1px solid var(--line); background:var(--input-bg); color:var(--ink); margin-top:4px; margin-bottom:12px;">
            <option value="ALL">Overall (All Departments)</option>
            ${state.config.departments.map(d => `<option value="${d}">${esc(d)}</option>`).join('')}
          </select>

          <label>Examination Session Title *</label>
          <input id="pubSessionName" value="${esc(currentSession)}" placeholder="e.g. April / May 2026 End Semester Autonomous Examinations" required>

          <label style="margin-top:12px;">Authorized Official Designation</label>
          <input id="pubDesignation" value="AJV Controller of Examinations" placeholder="Signatory Designation" required>

          <label class="show-pass-label" style="margin-top:14px;">
            <input id="pubBroadcastCheck" type="checkbox" checked onchange="document.getElementById('noticeWrap').style.display = this.checked ? 'block' : 'none'">
            <span><b>Broadcast official announcement to campus portal bulletin</b></span>
          </label>

          <div id="noticeWrap" style="margin-top:10px;">
            <label>Official Notification Circular Text</label>
            <textarea id="pubNoticeText" rows="3">The Controller of Examinations has officially released the Semester ${sem} examination results. Students and faculty can now view semester statements of grades and download verified marksheets with the official institutional seal.</textarea>
          </div>
        ` : `
          <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:14px;margin-bottom:14px;color:#991b1b;">
            <b>⚠️ Confirmation Required: Withhold Semester ${sem} Results</b>
            <p style="margin:6px 0 0;font-size:13px;line-height:1.5;">
              Unpublishing Semester ${sem} will immediately lock student access to statements of grades and marksheet downloads. 
              Students will see an official "Under Valuation" notice until the administration re-releases the results.
            </p>
          </div>
        `}
      </div>
      <div class="modal-footer">
        <button type="button" class="btn secondary" onclick="modalDialog.close()">Cancel</button>
        <button type="submit" class="btn ${willPublish ? 'gold' : 'danger'}">
          ${willPublish ? '🚀 Confirm Official Publication →' : '🔒 Withhold Results Now'}
        </button>
      </div>
    </form>
  `;

  modalDialog.showModal();
}

async function executePublish(e, sem, willPublish) {
  e.preventDefault();
  const sessionName = document.getElementById("pubSessionName") ? document.getElementById("pubSessionName").value : null;
  const publishedBy = document.getElementById("pubDesignation") ? document.getElementById("pubDesignation").value : null;
  const broadcastAnnouncement = document.getElementById("pubBroadcastCheck") ? document.getElementById("pubBroadcastCheck").checked : false;
  const customNotice = document.getElementById("pubNoticeText") ? document.getElementById("pubNoticeText").value : null;
  const department = document.getElementById("pubScope") ? document.getElementById("pubScope").value : "ALL";

  try {
    const res = await api("/api/admin/results/publish", {
      method: "POST",
      body: {
        semester: sem,
        isPublished: willPublish,
        sessionName,
        publishedBy,
        broadcastAnnouncement,
        customNotice,
        department
      }
    });

    modalDialog.close();
    toast(res.message || `Semester ${sem} results ${willPublish ? 'published' : 'unpublished'} successfully!`, true);
    openPublishResultsCenter();
  } catch (err) {
    toast(err.message, false);
  }
}

// -------------------------------------------------------------
// Bulk Publish by Academic Year
// -------------------------------------------------------------

async function adminBulkPublishYear(year, willPublish, department = "ALL") {
  const confirmMsg = `Are you sure you want to ${willPublish ? 'PUBLISH' : 'UNPUBLISH'} all semester examination results for ${year} (${department === "ALL" ? "All Departments" : department})?\n\nThis will apply to both semesters of ${year} and generate official campus bulletins.`;
  if (!confirm(confirmMsg)) return;

  try {
    const res = await api("/api/admin/results/publish-year", {
      method: "POST",
      body: { year, isPublished: willPublish, department }
    });
    toast(res.message, true);
    openPublishResultsCenter();
  } catch (err) {
    toast(err.message, false);
  }
}

// -------------------------------------------------------------
// Tabulated Mark Register (TMR) / Broadsheet Viewer
// -------------------------------------------------------------

async function openSemesterBroadsheet(sem) {
  try {
    const data = await api(`/api/admin/results/broadsheet/${sem}`);
    const courses = data.courses || [];
    const rows = data.rows || [];
    state.activeBroadsheetData = data;

    const totalStudents = rows.length;
    const passedStudents = rows.filter(r => r.resultStatus === "PASS").length;
    const passPercentage = totalStudents > 0 ? ((passedStudents / totalStudents) * 100).toFixed(1) : 0;
    const avgSgpa = totalStudents > 0 ? (rows.reduce((s, r) => s + Number(r.sgpa || 0), 0) / totalStudents).toFixed(2) : 0;

    modalDialog.innerHTML = `
      <div class="modal-header">
        <div>
          <h2 style="margin:0;">Tabulated Mark Register (TMR) — Semester ${sem}</h2>
          <small class="muted">AJV College of Engineering • Office of the Controller of Examinations • ${esc(data.sessionName)}</small>
        </div>
        <div style="display:flex;gap:8px;">
          <button class="btn mini gold" onclick="window.print()">🖨️ Print Broadsheet</button>
          <button class="btn mini secondary" onclick="exportBroadsheetCsv(${sem})">📥 Export CSV</button>
          <button class="btn mini secondary" onclick="modalDialog.close()">✕</button>
        </div>
      </div>
      <div class="modal-body" style="padding:16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;background:#f8fafc;border:1px solid #cbd5e1;padding:10px 14px;border-radius:8px;margin-bottom:14px;flex-wrap:wrap;gap:10px;">
          <div>
            <b>Session:</b> ${esc(data.sessionName)} • <b>Status:</b> ${data.isPublished ? '<span style="color:#059669;font-weight:700;">● Officially Published</span>' : '<span style="color:#d97706;font-weight:700;">🔒 Withheld / Valuation Draft</span>'}
          </div>
          <div style="display:flex;gap:16px;font-size:12px;">
            <span>Candidates: <b>${totalStudents}</b></span>
            <span>Passed: <b style="color:#059669;">${passedStudents}</b></span>
            <span>Pass Rate: <b style="color:var(--navy);">${passPercentage}%</b></span>
            <span>Batch SGPA: <b>${avgSgpa} / 10.0</b></span>
          </div>
        </div>

        <div class="broadsheet-table-wrap">
          <table class="broadsheet-table">
            <thead>
              <tr>
                <th style="width:35px;text-align:center;">#</th>
                <th>Register No</th>
                <th>Candidate Name</th>
                <th>Dept &amp; Sec</th>
                ${courses.map(c => `
                  <th style="text-align:center;" title="${esc(c.name)} (${c.credits} Credits)">
                    ${esc(c.code)}<br>
                    <small style="opacity:0.8;font-weight:normal;">${c.credits}C</small>
                  </th>
                `).join("")}
                <th style="text-align:center;">SGPA</th>
                <th style="text-align:center;">CGPA</th>
                <th style="text-align:center;">Result</th>
                <th style="text-align:center;">Action</th>
              </tr>
            </thead>
            <tbody>
              ${rows.length ? rows.map((r, i) => `
                <tr>
                  <td style="text-align:center;">${i + 1}</td>
                  <td><b>${esc(r.student.loginId)}</b></td>
                  <td>${esc(r.student.fullName)}</td>
                  <td>${esc(r.student.department)} (${esc(r.student.section)})</td>
                  ${courses.map(c => {
                    const rec = r.records.find(rc => rc.courseId === c.id || rc.code === c.code);
                    if (!rec || !rec.grade || rec.grade === "—") return `<td style="text-align:center;color:#94a3b8;">—</td>`;
                    return `
                      <td style="text-align:center;">
                        <b>${rec.totalMark}</b><br>
                        <span class="pill ${gradeClass(rec.grade)}" style="font-size:9px;padding:1px 4px;">${esc(rec.grade)}</span>
                      </td>
                    `;
                  }).join("")}
                  <td style="text-align:center;font-weight:700;color:var(--blue);">${r.sgpa}</td>
                  <td style="text-align:center;font-weight:700;color:var(--gold);">${r.cgpa}</td>
                  <td style="text-align:center;">
                    <span class="pill ${r.resultStatus === 'PASS' ? 'grade-Ap' : 'grade-RA'}">${esc(r.resultStatus)}</span>
                  </td>
                  <td style="text-align:center;">
                    <button class="btn mini secondary" onclick="openOfficialMarksheet(${sem}, ${r.student.id})">🎓 Marksheet</button>
                  </td>
                </tr>
              `).join("") : `<tr><td colspan="${courses.length + 8}" style="text-align:center;padding:24px;color:var(--muted);">No candidates recorded for Semester ${sem} yet.</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn secondary" onclick="modalDialog.close()">Close Broadsheet</button>
        <button class="btn gold" onclick="window.print()">🖨️ Print Tabulated Mark Register</button>
      </div>
    `;

    modalDialog.showModal();
  } catch (err) {
    toast(err.message, false);
  }
}

function exportBroadsheetCsv(sem) {
  const data = state.activeBroadsheetData;
  if (!data || !data.rows || !data.rows.length) return toast("No broadsheet data to export", false);

  const courses = data.courses || [];
  const headers = ["Register No", "Candidate Name", "Department", "Section", ...courses.map(c => `${c.code}_Total`), ...courses.map(c => `${c.code}_Grade`), "SGPA", "CGPA", "Result"];
  const csvRows = data.rows.map(r => {
    const marksCols = courses.map(c => {
      const rec = r.records.find(rc => rc.courseId === c.id || rc.code === c.code);
      return rec ? rec.totalMark : "";
    });
    const gradeCols = courses.map(c => {
      const rec = r.records.find(rc => rc.courseId === c.id || rc.code === c.code);
      return rec ? rec.grade : "";
    });
    return [
      `"${r.student.loginId}"`,
      `"${r.student.fullName}"`,
      `"${r.student.department}"`,
      `"${r.student.section}"`,
      ...marksCols,
      ...gradeCols,
      r.sgpa,
      r.cgpa,
      `"${r.resultStatus}"`
    ];
  });

  const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...csvRows.map(e => e.join(","))].join("\n");
  const link = document.createElement("a");
  link.setAttribute("href", encodeURI(csvContent));
  link.setAttribute("download", `AJV_COE_TMR_Broadsheet_Sem${sem}_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  toast("Tabulated Mark Register (TMR) exported to CSV");
}

function previewSemFirstStudent(sem) {
  if (!state.staffStudents || !state.staffStudents.length) {
    return toast("No student records available to preview", false);
  }
  openOfficialMarksheet(sem, state.staffStudents[0].id);
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
            <td style="white-space:nowrap;">
              <button class="btn secondary mini" onclick="viewStudent(${s.id})">Record →</button>
              <button class="btn secondary mini" onclick="openDigitalStudentIdCard(${s.id})" title="Print PVC Smart ID Card">🪪 ID</button>
              <button class="btn secondary mini" onclick="openOfficialHallTicket(null, ${s.id})" title="Exam Hall Ticket & Clearance">🎫 Hall Ticket</button>
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
            <p class="muted">${esc(d.student.loginId)} • ${esc(d.student.email || "Pending Email")} • ${esc(d.student.department)} • ${esc(d.student.year)} Sec ${esc(d.student.section || "A")}</p>
          </div>
          <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
            <select id="viewStudentSemChoice" style="padding:8px 12px;border:1px solid var(--line);border-radius:6px;font-weight:600;background:var(--bg);">
              <option value="1">Semester 1 (I Year)</option>
              <option value="2">Semester 2 (I Year)</option>
              <option value="3">Semester 3 (II Year)</option>
              <option value="4">Semester 4 (II Year)</option>
              <option value="5">Semester 5 (III Year)</option>
              <option value="6">Semester 6 (III Year)</option>
              <option value="7">Semester 7 (IV Year)</option>
              <option value="8">Semester 8 (IV Year)</option>
            </select>
            <button class="btn gold" onclick="openOfficialMarksheet(document.getElementById('viewStudentSemChoice').value, ${id})">🎓 View Marksheet (With Seal)</button>
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
              <label>Filter Curriculum by Semester</label>
              <select id="mSemFilter" onchange="filterCoursesBySem(this.value)">
                <option value="all">All Semesters (1 to 8)</option>
                <option value="1">Semester 1 (I Year)</option>
                <option value="2">Semester 2 (I Year)</option>
                <option value="3">Semester 3 (II Year)</option>
                <option value="4">Semester 4 (II Year)</option>
                <option value="5">Semester 5 (III Year)</option>
                <option value="6">Semester 6 (III Year)</option>
                <option value="7">Semester 7 (IV Year)</option>
                <option value="8">Semester 8 (IV Year)</option>
              </select>

              <label style="margin-top:10px;">Select Course Module</label>
              <select id="mCourse">
                ${courses.map(c => `<option value="${c.id}">[Sem ${c.semester || 1}] ${esc(c.code)} — ${esc(c.name)} (${c.credits} Credits)</option>`).join("")}
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
              <button class="btn secondary mini" onclick="adminResetPassword(${d.student.id})">Reset Password to Temporary Default</button>
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

function filterCoursesBySem(semVal) {
  const select = document.getElementById("mCourse");
  if (!select) return;
  const filtered = (!semVal || semVal === "all")
    ? (state.courses || [])
    : (state.courses || []).filter(c => String(c.semester) === String(semVal));
  select.innerHTML = filtered.map(c => 
    `<option value="${c.id}">[Sem ${c.semester || 1}] ${esc(c.code)} — ${esc(c.name)} (${c.credits} Credits)</option>`
  ).join("");
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
  if (!confirm("Reset this student's password to temporary default (ajv@123)?\n\nThey will be forced to change it on their next login.")) return;
  try {
    const d = await api(`/api/staff/students/${id}/reset-password`, {
      method: "POST",
      body: {}
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
              <input id="newPass" type="password" minlength="8" placeholder="Minimum 8 characters" required oninput="renderPasswordStrength('newPass', 'meter-profile')">
              <div id="meter-profile"></div>

              <label>Confirm New Password *</label>
              <input id="confirmPass" type="password" minlength="8" placeholder="Re-enter new password" required>

              <div class="notice">
                Ensure your new password contains at least 8 characters. You can use this new password for future logins.
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
  const strength = checkPasswordStrength(newP);
  if (strength.score < 5) return toast(`Password is too weak (${strength.label}). You must include uppercase, lowercase, numbers, and special characters.`, false);

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

        <label>New Password (min 8 characters) *</label>
        <input id="firstNewPass" type="password" placeholder="Create your new personal password" required minlength="8" oninput="renderPasswordStrength('firstNewPass', 'meter-first')">
        <div id="meter-first"></div>

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
  const strength = checkPasswordStrength(newPassword);
  if (strength.score < 5) {
    return toast(`Password is too weak (${strength.label}). You must include uppercase, lowercase, numbers, and special characters.`, false);
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
// College Fee Payment Portal & Institutional Receipts
// -------------------------------------------------------------

let cachedStudentFeesData = null;
let currentFeeFilter = { category: "all", status: "all" };

async function openStudentFeesView() {
  try {
    const data = await api("/api/student/fees");
    cachedStudentFeesData = data;
    renderStudentFeesView();
  } catch (err) {
    toast(err.message, false);
  }
}

function filterStudentFees(category, status) {
  if (category !== undefined) currentFeeFilter.category = category;
  if (status !== undefined) currentFeeFilter.status = status;
  renderStudentFeesView();
}

function renderStudentFeesView() {
  if (!cachedStudentFeesData) return;
  const { student, summary, fees } = cachedStudentFeesData;
  const totalAssessedAmt = summary.totalAssessed || summary.totalFee || fees.reduce((s, x) => s + Number(x.amount || 0), 0);

  const filteredFees = fees.filter(f => {
    if (currentFeeFilter.category !== "all" && f.category !== currentFeeFilter.category) return false;
    if (currentFeeFilter.status !== "all" && f.status.toLowerCase() !== currentFeeFilter.status.toLowerCase()) return false;
    return true;
  });

  const categories = [
    { id: "all", label: "All Fees", icon: "📑" },
    { id: "tuition", label: "Tuition & Academics", icon: "🎓" },
    { id: "exam", label: "Examination Fees", icon: "📝" },
    { id: "hostel", label: "Hostel & Dining", icon: "🏢" },
    { id: "transport", label: "Campus Transport", icon: "🚌" },
    { id: "deposit", label: "Caution Deposits", icon: "🛡️" },
    { id: "placement", label: "Placement & Training", icon: "🚀" }
  ];

  app.innerHTML = `
    <div class="dashboard">
      <div class="dash-head">
        <div>
          <div class="eyebrow">FEE PAYMENT PORTAL</div>
          <h1>College Fee Management 💳</h1>
          <p class="muted">${esc(student.fullName)} (${esc(student.loginId)}) • ${esc(student.department)} • ${esc(student.year)}</p>
        </div>
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
          <button class="btn secondary" onclick="showPage('dashboard')">← Back to Dashboard</button>
          ${summary.totalDue > 0 ? `
            <button class="btn gold" onclick="openPayAllModal(${summary.totalDue}, ${summary.pendingCount})">⚡ Pay All Dues (₹${summary.totalDue.toLocaleString('en-IN')})</button>
          ` : ''}
        </div>
      </div>

      <!-- Summary Metrics -->
      <div class="stats" style="margin-top:20px;">
        <div class="stat">
          <span class="label">Total Assessed</span>
          <b style="font-size:22px;color:var(--navy);">₹${totalAssessedAmt.toLocaleString('en-IN')}</b>
          <small>Academic Year Total (${fees.length} items)</small>
        </div>
        <div class="stat">
          <span class="label">Total Paid to Date</span>
          <b style="font-size:22px;color:#059669;">₹${summary.totalPaid.toLocaleString('en-IN')}</b>
          <small>${fees.filter(f => f.status === 'PAID').length} items completed</small>
        </div>
        <div class="stat">
          <span class="label">Outstanding Balance</span>
          <b style="font-size:22px;color:${summary.totalDue > 0 ? '#d97706' : '#059669'};">₹${summary.totalDue.toLocaleString('en-IN')}</b>
          <small>${summary.totalDue === 0 ? '✓ All dues cleared' : `${summary.pendingCount} pending payment(s)`}</small>
        </div>
        <div class="stat">
          <span class="label">Payment Status</span>
          <b style="font-size:18px;color:${summary.totalDue === 0 ? '#059669' : '#d97706'};">${summary.totalDue === 0 ? 'No Dues Pending' : 'Action Required'}</b>
          <small>Verified by Finance Section</small>
        </div>
      </div>

      ${summary.totalDue > 0 ? `
        <div class="card callout" style="border-left: 6px solid #f59e0b; background: #fffbeb; margin-top: 16px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
          <div>
            <div class="eyebrow" style="color:#d97706;">PAYMENT NOTICE</div>
            <h3 style="color:#92400e;margin:2px 0;">Outstanding Institutional Dues: ₹${summary.totalDue.toLocaleString('en-IN')}</h3>
            <p style="color:#92400e;opacity:0.9;margin:0;font-size:13px;">Please clear overdue amounts before the deadline to avoid late clearance charges or exam hall ticket holds.</p>
          </div>
          <button class="btn gold" onclick="openPayAllModal(${summary.totalDue}, ${summary.pendingCount})">⚡ Settle All Dues (₹${summary.totalDue.toLocaleString('en-IN')})</button>
        </div>
      ` : `
        <div class="card callout" style="border-left: 6px solid #10b981; background: #ecfdf5; margin-top: 16px;">
          <div class="eyebrow" style="color:#059669;">CLEARANCE VERIFIED</div>
          <h3 style="color:#065f46;margin:2px 0;">All College Fees Fully Paid 🎉</h3>
          <p style="color:#047857;margin:0;font-size:13px;">Your official clearance is active. You can download and print official institutional stamped receipts for each fee item below.</p>
        </div>
      `}

      <!-- Category Filter Pills -->
      <div style="display:flex;gap:8px;overflow-x:auto;padding-bottom:6px;margin-top:24px;border-bottom:1px solid #e2e8f0;">
        ${categories.map(c => `
          <button class="btn mini ${currentFeeFilter.category === c.id ? 'primary' : 'secondary'}" 
                  style="${currentFeeFilter.category === c.id ? 'background:var(--navy);color:#fff;' : ''}" 
                  onclick="filterStudentFees('${c.id}', undefined)">
            ${c.icon} ${c.label}
          </button>
        `).join("")}
      </div>

      <!-- Status Filter Toggle -->
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:16px;flex-wrap:wrap;gap:10px;">
        <div style="display:flex;gap:6px;">
          <button class="btn mini ${currentFeeFilter.status === 'all' ? 'gold' : 'secondary'}" onclick="filterStudentFees(undefined, 'all')">Show All (${fees.length})</button>
          <button class="btn mini ${currentFeeFilter.status === 'due' ? 'gold' : 'secondary'}" onclick="filterStudentFees(undefined, 'due')">Pending / Due (${fees.filter(f => f.status === 'DUE').length})</button>
          <button class="btn mini ${currentFeeFilter.status === 'paid' ? 'gold' : 'secondary'}" onclick="filterStudentFees(undefined, 'paid')">Paid &amp; Receipted (${fees.filter(f => f.status === 'PAID').length})</button>
        </div>
        <span class="muted" style="font-size:12px;">Displaying ${filteredFees.length} fee record(s)</span>
      </div>

      <!-- Fees Cards Grid -->
      <div class="fee-card-grid">
        ${filteredFees.length === 0 ? `
          <div class="card" style="grid-column: 1 / -1; text-align:center; padding: 40px;">
            <div style="font-size:40px;margin-bottom:8px;">🔍</div>
            <h3>No fee items match the selected filter</h3>
            <p class="muted">Try selecting "Show All" or choosing a different fee category.</p>
            <button class="btn secondary" onclick="filterStudentFees('all', 'all')">Reset Filters</button>
          </div>
        ` : filteredFees.map(fee => `
          <div class="fee-item-card ${fee.status === 'PAID' ? 'is-paid' : 'is-due'}">
            <div>
              <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">
                <span class="fee-badge ${fee.status === 'PAID' ? 'paid' : 'due'}">
                  ${fee.status === 'PAID' ? '✓ Paid' : '⏳ Due'}
                </span>
                <span class="badge" style="background:#f1f5f9;color:#475569;font-size:11px;">Sem ${fee.semester} • ${fee.academicYear}</span>
              </div>
              <h3 style="margin:4px 0 6px;font-size:16px;color:var(--navy);">${esc(fee.title)}</h3>
              <p class="muted" style="font-size:12px;margin:0 0 12px;min-height:32px;">${esc(fee.description)}</p>

              <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:8px 12px;margin-bottom:12px;font-size:12px;">
                ${fee.breakdown.map(b => `
                  <div style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px dashed #e2e8f0;">
                    <span style="color:#64748b;">${esc(b.item)}</span>
                    <b>₹${b.amount.toLocaleString('en-IN')}</b>
                  </div>
                `).join("")}
                <div style="display:flex;justify-content:space-between;padding:6px 0 2px;font-weight:700;color:var(--navy);font-size:13px;">
                  <span>Total Amount</span>
                  <span>₹${fee.amount.toLocaleString('en-IN')}</span>
                </div>
              </div>

              ${fee.status === 'PAID' ? `
                <div style="font-size:11px;color:#059669;margin-bottom:12px;">
                  ✓ Paid on ${new Date(fee.paidAt).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })}<br>
                  <span style="color:#64748b;">Ref: <code>${esc(fee.transactionId)}</code> • Mode: ${esc(fee.paymentMode || 'ONLINE')}</span>
                </div>
              ` : `
                <div style="font-size:11px;color:#d97706;margin-bottom:12px;">
                  ⚠️ Due Date: <b>${new Date(fee.dueDate).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })}</b>
                </div>
              `}
            </div>

            <div>
              ${fee.status === 'PAID' ? `
                <button class="btn gold full" onclick="openOfficialFeeReceipt('${fee.id}')">📜 View Official Stamped Receipt</button>
              ` : `
                <button class="btn full" style="background:linear-gradient(135deg,#d97706,#b45309);color:#fff;" onclick="openPaymentGatewayModal('${fee.id}', '${esc(fee.title)}', ${fee.amount})">
                  💳 Pay Now (₹${fee.amount.toLocaleString('en-IN')}) →
                </button>
              `}
            </div>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

let currentPaymentMethod = "upi";

function selectPaymentMethod(m) {
  currentPaymentMethod = m;
  document.querySelectorAll(".payment-tab-btn").forEach(b => b.classList.remove("active"));
  const btn = document.getElementById("tab-" + m);
  if (btn) btn.classList.add("active");

  const views = ["upi", "card", "netbanking"];
  views.forEach(v => {
    const el = document.getElementById("pay-view-" + v);
    if (el) el.style.display = v === m ? "block" : "none";
  });
}

function openPaymentGatewayModal(feeId, feeTitle, amount) {
  currentPaymentMethod = "upi";
  modalDialog.innerHTML = `
    <div class="modal-header">
      <div>
        <div class="eyebrow" style="color:var(--gold);">AJV SECURE PAYMENT GATEWAY</div>
        <h3 style="margin:2px 0;">Settle Fee Payment</h3>
      </div>
      <button class="btn mini secondary" onclick="modalDialog.close()">✕</button>
    </div>

    <form onsubmit="executeFeePayment(event, '${feeId}')">
      <div class="modal-body" style="padding-top:10px;">
        <div style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:8px;padding:12px 16px;display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
          <div>
            <div style="font-size:12px;color:#64748b;">Paying for:</div>
            <b style="font-size:14px;color:var(--navy);">${esc(feeTitle)}</b>
          </div>
          <div style="text-align:right;">
            <div style="font-size:12px;color:#64748b;">Payable Amount:</div>
            <b style="font-size:20px;color:#059669;">₹${amount.toLocaleString('en-IN')}</b>
          </div>
        </div>

        <div class="payment-tabs">
          <button type="button" id="tab-upi" class="payment-tab-btn active" onclick="selectPaymentMethod('upi')">📱 UPI / QR Code</button>
          <button type="button" id="tab-card" class="payment-tab-btn" onclick="selectPaymentMethod('card')">💳 Debit / Credit Card</button>
          <button type="button" id="tab-netbanking" class="payment-tab-btn" onclick="selectPaymentMethod('netbanking')">🏦 Net Banking</button>
        </div>

        <!-- UPI Tab Content -->
        <div id="pay-view-upi">
          <div class="upi-qr-box">
            <div style="margin-bottom:8px;font-size:12px;color:#475569;">Scan QR with any UPI App to Pay</div>
            <div style="display:inline-block;background:#fff;padding:10px;border-radius:8px;box-shadow:0 2px 6px rgba(0,0,0,0.1);">
              <svg width="140" height="140" viewBox="0 0 140 140">
                <rect width="140" height="140" fill="#ffffff"/>
                <!-- Outer borders -->
                <rect x="10" y="10" width="40" height="40" fill="none" stroke="#0f172a" stroke-width="6"/>
                <rect x="20" y="20" width="20" height="20" fill="#0f172a"/>
                <rect x="90" y="10" width="40" height="40" fill="none" stroke="#0f172a" stroke-width="6"/>
                <rect x="100" y="20" width="20" height="20" fill="#0f172a"/>
                <rect x="10" y="90" width="40" height="40" fill="none" stroke="#0f172a" stroke-width="6"/>
                <rect x="20" y="100" width="20" height="20" fill="#0f172a"/>
                <!-- QR Dots representation -->
                <circle cx="70" cy="20" r="4" fill="#0f172a"/>
                <circle cx="70" cy="40" r="4" fill="#0f172a"/>
                <circle cx="60" cy="70" r="5" fill="#0f172a"/>
                <circle cx="80" cy="70" r="5" fill="#0f172a"/>
                <circle cx="70" cy="90" r="4" fill="#0f172a"/>
                <circle cx="100" cy="70" r="4" fill="#0f172a"/>
                <circle cx="120" cy="90" r="5" fill="#0f172a"/>
                <circle cx="90" cy="110" r="4" fill="#0f172a"/>
                <circle cx="110" cy="110" r="5" fill="#0f172a"/>
                <circle cx="120" cy="120" r="4" fill="#0f172a"/>
                <!-- Center Emblem -->
                <rect x="58" y="58" width="24" height="24" rx="4" fill="#d97706"/>
                <text x="70" y="74" fill="#fff" font-size="12" font-weight="bold" text-anchor="middle">AJV</text>
              </svg>
            </div>
            <div style="font-size:12px;color:#0f172a;font-weight:700;margin-top:8px;">UPI ID: <code>ajvcollege.fees@upi</code></div>
            <div class="upi-apps">
              <span class="upi-app-pill">GPay</span>
              <span class="upi-app-pill">PhonePe</span>
              <span class="upi-app-pill">Paytm</span>
              <span class="upi-app-pill">BHIM</span>
            </div>
          </div>
          <label style="font-size:12px;font-weight:600;margin-bottom:4px;display:block;">Or enter your VPA / UPI ID</label>
          <input type="text" id="upiVpaInput" placeholder="e.g. yourname@okhdfcbank" value="student@okhdfcbank">
        </div>

        <!-- Card Tab Content -->
        <div id="pay-view-card" style="display:none;">
          <label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px;">Card Number</label>
          <input type="text" id="cardNumInput" placeholder="4532 •••• •••• 8892" value="4532 9801 2234 8892" maxlength="19">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:8px;">
            <div>
              <label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px;">Expiry Date</label>
              <input type="text" id="cardExpInput" placeholder="MM/YY" value="08/28" maxlength="5">
            </div>
            <div>
              <label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px;">CVV</label>
              <input type="password" id="cardCvvInput" placeholder="•••" value="782" maxlength="4">
            </div>
          </div>
          <label style="font-size:12px;font-weight:600;display:block;margin-top:8px;margin-bottom:4px;">Cardholder Name</label>
          <input type="text" id="cardHolderInput" placeholder="Name as printed on card" value="${esc(state.user ? state.user.fullName : 'STUDENT HOLDER')}">
        </div>

        <!-- Net Banking Tab Content -->
        <div id="pay-view-netbanking" style="display:none;">
          <label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px;">Select Your Bank</label>
          <select id="bankSelectInput" style="width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:6px;margin-bottom:12px;">
            <option value="State Bank of India">State Bank of India (SBI)</option>
            <option value="HDFC Bank">HDFC Bank</option>
            <option value="ICICI Bank">ICICI Bank</option>
            <option value="Canara Bank">Canara Bank</option>
            <option value="Indian Bank">Indian Bank</option>
            <option value="Axis Bank">Axis Bank</option>
            <option value="Punjab National Bank">Punjab National Bank</option>
            <option value="Bank of Baroda">Bank of Baroda</option>
          </select>
          <p class="muted" style="font-size:11px;">You will be redirected to the college's secure multi-bank gateway server to authenticate.</p>
        </div>

        <div style="display:flex;align-items:center;gap:6px;justify-content:center;margin-top:14px;font-size:11px;color:#64748b;">
          <span>🔒 256-Bit SSL Encrypted Banking Channel</span>
          <span>•</span>
          <span>Instant Institutional Clearance</span>
        </div>
      </div>

      <div class="modal-footer">
        <button type="button" class="btn secondary" onclick="modalDialog.close()">Cancel</button>
        <button type="submit" class="btn gold">Confirm &amp; Authorize ₹${amount.toLocaleString('en-IN')} →</button>
      </div>
    </form>
  `;
  modalDialog.showModal();
}

async function executeFeePayment(e, feeId) {
  e.preventDefault();
  let details = "";
  if (currentPaymentMethod === "upi") {
    const vpa = document.getElementById("upiVpaInput")?.value || "student@upi";
    details = "UPI ID: " + vpa;
  } else if (currentPaymentMethod === "card") {
    const last4 = (document.getElementById("cardNumInput")?.value || "8892").slice(-4);
    details = "Card ending in " + last4;
  } else {
    const bank = document.getElementById("bankSelectInput")?.value || "State Bank of India";
    details = "NetBanking: " + bank;
  }

  // Get amount from UI
  const amountStr = document.querySelector(".modal-body b[style*='color:#059669']").textContent.replace(/[^0-9]/g, '');
  const amountInPaise = parseInt(amountStr) * 100 || 100000;

  try {
    // 1. Create Order
    const orderRes = await api("/api/create-order", {
      method: "POST",
      body: { amount: amountInPaise, receipt: "fee_" + feeId }
    });

    var options = {
      "key": state.config.razorpayKeyId || "rzp_test_TjB5rQ3Gr0vfAv",
      "amount": orderRes.amount,
      "currency": orderRes.currency,
      "name": "AJV College of Engg",
      "description": "Fee Settlement",
      "image": "/assets/college-logo.png",
      "order_id": orderRes.order_id,
      "handler": async function (response) {
        try {
          // 2. Verify Payment
          await api("/api/verify-payment", {
            method: "POST",
            body: {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature
            }
          });

          // 3. Complete internal fee logic
          const res = await api(`/api/student/fees/${feeId}/pay`, {
            method: "POST",
            body: {
              paymentMode: currentPaymentMethod.toUpperCase(),
              details: details + " (RZP Txn: " + response.razorpay_payment_id + ")"
            }
          });

          toast("Fee Payment Successful! Transaction: " + res.transactionId, true);
          modalDialog.close();

          await openStudentFeesView();
          setTimeout(() => { openOfficialFeeReceipt(feeId); }, 200);
        } catch (err) {
          toast(err.message || "Payment Verification Failed", false);
        }
      },
      "prefill": {
          "name": state.user ? state.user.fullName : "AJV Student",
          "email": state.user ? state.user.loginId.toLowerCase() + "@ajv.edu" : "student@ajv.edu",
          "contact": "9999999999"
      },
      "theme": { "color": "#081b2f" }
    };

    if (typeof Razorpay === "undefined") {
      return toast("Payment Gateway failed to load. Check internet connection.", false);
    }
    var rzp = new Razorpay(options);
    rzp.on('payment.failed', function (response){
        toast("Payment Failed: " + response.error.description, false);
    });
    rzp.open();
  } catch (err) {
    toast(err.message || "Failed to initialize payment gateway", false);
  }
}

function openPayAllModal(totalDue, pendingCount) {
  currentPaymentMethod = "upi";
  modalDialog.innerHTML = `
    <div class="modal-header">
      <div>
        <div class="eyebrow" style="color:var(--gold);">BULK SETTLEMENT</div>
        <h3 style="margin:2px 0;">Pay All Outstanding College Fees</h3>
      </div>
      <button class="btn mini secondary" onclick="modalDialog.close()">✕</button>
    </div>

    <form onsubmit="executePayAll(event)">
      <div class="modal-body" style="padding-top:10px;">
        <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:12px 16px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:center;">
          <div>
            <div style="font-size:12px;color:#92400e;">Clearing Items:</div>
            <b style="font-size:15px;color:#b45309;">${pendingCount} Fee Category Items</b>
          </div>
          <div style="text-align:right;">
            <div style="font-size:12px;color:#92400e;">Total Payable:</div>
            <b style="font-size:20px;color:#b45309;">₹${totalDue.toLocaleString('en-IN')}</b>
          </div>
        </div>

        <div class="payment-tabs">
          <button type="button" id="tab-upi" class="payment-tab-btn active" onclick="selectPaymentMethod('upi')">📱 UPI / QR Code</button>
          <button type="button" id="tab-card" class="payment-tab-btn" onclick="selectPaymentMethod('card')">💳 Debit / Credit Card</button>
          <button type="button" id="tab-netbanking" class="payment-tab-btn" onclick="selectPaymentMethod('netbanking')">🏦 Net Banking</button>
        </div>

        <!-- UPI Tab Content -->
        <div id="pay-view-upi">
          <div class="upi-qr-box">
            <div style="margin-bottom:8px;font-size:12px;color:#475569;">Scan QR with any UPI App to Pay</div>
            <div style="display:inline-block;background:#fff;padding:10px;border-radius:8px;box-shadow:0 2px 6px rgba(0,0,0,0.1);">
              <svg width="140" height="140" viewBox="0 0 140 140">
                <rect width="140" height="140" fill="#ffffff"/>
                <!-- Outer borders -->
                <rect x="10" y="10" width="40" height="40" fill="none" stroke="#0f172a" stroke-width="6"/>
                <rect x="20" y="20" width="20" height="20" fill="#0f172a"/>
                <rect x="90" y="10" width="40" height="40" fill="none" stroke="#0f172a" stroke-width="6"/>
                <rect x="100" y="20" width="20" height="20" fill="#0f172a"/>
                <rect x="10" y="90" width="40" height="40" fill="none" stroke="#0f172a" stroke-width="6"/>
                <rect x="20" y="100" width="20" height="20" fill="#0f172a"/>
                <!-- QR Dots representation -->
                <circle cx="70" cy="20" r="4" fill="#0f172a"/>
                <circle cx="70" cy="40" r="4" fill="#0f172a"/>
                <circle cx="60" cy="70" r="5" fill="#0f172a"/>
                <circle cx="80" cy="70" r="5" fill="#0f172a"/>
                <circle cx="70" cy="90" r="4" fill="#0f172a"/>
                <circle cx="100" cy="70" r="4" fill="#0f172a"/>
                <circle cx="120" cy="90" r="5" fill="#0f172a"/>
                <circle cx="90" cy="110" r="4" fill="#0f172a"/>
                <circle cx="110" cy="110" r="5" fill="#0f172a"/>
                <circle cx="120" cy="120" r="4" fill="#0f172a"/>
                <!-- Center Emblem -->
                <rect x="58" y="58" width="24" height="24" rx="4" fill="#d97706"/>
                <text x="70" y="74" fill="#fff" font-size="12" font-weight="bold" text-anchor="middle">AJV</text>
              </svg>
            </div>
            <div style="font-size:12px;color:#0f172a;font-weight:700;margin-top:8px;">UPI ID: <code>ajvcollege.fees@upi</code></div>
            <div class="upi-apps">
              <span class="upi-app-pill">GPay</span>
              <span class="upi-app-pill">PhonePe</span>
              <span class="upi-app-pill">Paytm</span>
              <span class="upi-app-pill">BHIM</span>
            </div>
          </div>
          <label style="font-size:12px;font-weight:600;margin-bottom:4px;display:block;">Or enter your VPA / UPI ID</label>
          <input type="text" id="upiVpaInput" placeholder="e.g. yourname@okhdfcbank" value="student@okhdfcbank">
        </div>

        <!-- Card Tab Content -->
        <div id="pay-view-card" style="display:none;">
          <label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px;">Card Number</label>
          <input type="text" id="cardNumInput" placeholder="4532 •••• •••• 8892" value="4532 9801 2234 8892" maxlength="19">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:8px;">
            <div>
              <label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px;">Expiry Date</label>
              <input type="text" id="cardExpInput" placeholder="MM/YY" value="08/28" maxlength="5">
            </div>
            <div>
              <label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px;">CVV</label>
              <input type="password" id="cardCvvInput" placeholder="•••" value="782" maxlength="4">
            </div>
          </div>
          <label style="font-size:12px;font-weight:600;display:block;margin-top:8px;margin-bottom:4px;">Cardholder Name</label>
          <input type="text" id="cardHolderInput" placeholder="Name as printed on card" value="${esc(state.user ? state.user.fullName : 'STUDENT HOLDER')}">
        </div>

        <!-- Net Banking Tab Content -->
        <div id="pay-view-netbanking" style="display:none;">
          <label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px;">Select Your Bank</label>
          <select id="bankSelectInput" style="width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:6px;margin-bottom:12px;">
            <option value="State Bank of India">State Bank of India (SBI)</option>
            <option value="HDFC Bank">HDFC Bank</option>
            <option value="ICICI Bank">ICICI Bank</option>
            <option value="Canara Bank">Canara Bank</option>
            <option value="Indian Bank">Indian Bank</option>
            <option value="Axis Bank">Axis Bank</option>
            <option value="Punjab National Bank">Punjab National Bank</option>
            <option value="Bank of Baroda">Bank of Baroda</option>
          </select>
          <p class="muted" style="font-size:11px;">You will be redirected to the college's secure multi-bank gateway server to authenticate.</p>
        </div>

        <p class="muted" style="font-size:12px;margin-top:14px;text-align:center;">
          🔒 Upon successful authorization, all individual fee receipts with official college stamps will be generated instantly.
        </p>
      </div>

      <div class="modal-footer">
        <button type="button" class="btn secondary" onclick="modalDialog.close()">Cancel</button>
        <button type="submit" class="btn gold">Pay ₹${totalDue.toLocaleString('en-IN')} Now →</button>
      </div>
    </form>
  `;
  modalDialog.showModal();
}

async function executePayAll(e) {
  e.preventDefault();
  let details = "";
  if (currentPaymentMethod === "upi") {
    const vpa = document.getElementById("upiVpaInput")?.value || "student@upi";
    details = "UPI ID: " + vpa;
  } else if (currentPaymentMethod === "card") {
    const last4 = (document.getElementById("cardNumInput")?.value || "8892").slice(-4);
    details = "Card ending in " + last4;
  } else {
    const bank = document.getElementById("bankSelectInput")?.value || "State Bank of India";
    details = "NetBanking: " + bank;
  }

  // Get amount from UI
  const amountStr = document.querySelector(".modal-body b[style*='font-size:20px']").textContent.replace(/[^0-9]/g, '');
  const amountInPaise = parseInt(amountStr) * 100 || 100000;

  try {
    // 1. Create Order
    const orderRes = await api("/api/create-order", {
      method: "POST",
      body: { amount: amountInPaise, receipt: "bulk_" + Date.now() }
    });

    var options = {
      "key": "rzp_test_TjB5rQ3Gr0vfAv",
      "amount": orderRes.amount,
      "currency": orderRes.currency,
      "name": "AJV College of Engg",
      "description": "Bulk Fee Settlement",
      "image": "/assets/college-logo.png",
      "order_id": orderRes.order_id,
      "handler": async function (response) {
        try {
          // 2. Verify Payment
          await api("/api/verify-payment", {
            method: "POST",
            body: {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature
            }
          });

          // 3. Complete internal fee logic
          const res = await api("/api/student/fees/pay-all", {
            method: "POST",
            body: {
              paymentMode: currentPaymentMethod.toUpperCase(),
              details: "Batch Settlement - " + details + " (RZP: " + response.razorpay_payment_id + ")"
            }
          });

          const count = res.paidCount || res.count || 'all';
          const total = res.totalPaidAmount || res.totalPaid || '';
          toast(`Successfully settled ${count} fee items ${total ? `(₹${total.toLocaleString('en-IN')})` : ''}!`, true);
          modalDialog.close();
          await openStudentFeesView();
        } catch (err) {
          toast(err.message || "Payment Verification Failed", false);
        }
      },
      "prefill": {
          "name": state.user ? state.user.fullName : "AJV Student",
          "email": state.user ? state.user.loginId.toLowerCase() + "@ajv.edu" : "student@ajv.edu",
          "contact": "9999999999"
      },
      "theme": { "color": "#081b2f" }
    };

    if (typeof Razorpay === "undefined") {
      return toast("Payment Gateway failed to load. Check internet connection.", false);
    }
    var rzp = new Razorpay(options);
    rzp.on('payment.failed', function (response){
        toast("Bulk Payment Failed: " + response.error.description, false);
    });
    rzp.open();
  } catch (err) {
    toast(err.message || "Failed to initialize payment gateway", false);
  }
}

async function openOfficialFeeReceipt(feeId) {
  try {
    const data = await api(`/api/fees/receipt/${feeId}`);
    const receipt = data.receipt || data;

    modalDialog.innerHTML = `
      <div class="modal-header no-print">
        <div>
          <div class="eyebrow" style="color:var(--gold);">OFFICIAL INSTITUTIONAL RECORD</div>
          <h3 style="margin:2px 0;">Stamped Fee Receipt</h3>
        </div>
        <div style="display:flex;gap:8px;">
          <button class="btn gold" onclick="window.print()">🖨️ Print Receipt</button>
          <button class="btn mini secondary" onclick="modalDialog.close()">✕</button>
        </div>
      </div>

      <div class="modal-body" style="padding:16px;">
        <div class="fee-receipt">
          <div class="fee-receipt-head">
            <img src="/assets/logo.svg" alt="AJV Emblem" onerror="this.src='https://via.placeholder.com/60?text=AJV'">
            <h2>AJV COLLEGE OF ENGINEERING &amp; TECHNOLOGY</h2>
            <p>Approved by AICTE, New Delhi • Affiliated to Anna University, Chennai • NAAC 'A+' Grade</p>
            <p style="font-size:10px;color:#94a3b8;margin-top:2px;">Kavaraipettai, G.S.T Road, Chennai - 601 206, Tamil Nadu, India</p>
            <div style="margin-top:10px;display:inline-block;padding:3px 14px;background:#f8fafc;border:1px solid var(--navy);border-radius:999px;font-weight:700;font-size:12px;color:var(--navy);letter-spacing:1px;">
              OFFICIAL CASH &amp; ONLINE FEE RECEIPT
            </div>
          </div>

          <div class="receipt-meta-grid">
            <div>
              <span>RECEIPT NUMBER</span>
              <b>${esc(receipt.receiptNo)}</b>
            </div>
            <div>
              <span>DATE &amp; TIME</span>
              <b>${new Date(receipt.paidAt).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })}</b>
            </div>
            <div>
              <span>TRANSACTION REFERENCE ID</span>
              <b style="font-family:monospace;">${esc(receipt.transactionId)}</b>
            </div>
            <div>
              <span>PAYMENT MODE &amp; CHANNEL</span>
              <b>${esc(receipt.paymentMode)} (${esc(receipt.paymentDetails || 'Instant Settlement')})</b>
            </div>
            <div>
              <span>STUDENT NAME</span>
              <b>${esc(receipt.studentName)}</b>
            </div>
            <div>
              <span>ROLL / REGISTRATION NUMBER</span>
              <b style="font-family:monospace;">${esc(receipt.loginId)}</b>
            </div>
            <div>
              <span>DEPARTMENT / BRANCH</span>
              <b>${esc(receipt.department)}</b>
            </div>
            <div>
              <span>ACADEMIC YEAR &amp; SEMESTER</span>
              <b>${esc(receipt.year)} • Semester ${receipt.semester} (${receipt.academicYear})</b>
            </div>
          </div>

          <table class="table" style="margin-bottom:12px;border:1px solid #e2e8f0;">
            <thead>
              <tr style="background:#f1f5f9;color:var(--navy);">
                <th style="width:40px;text-align:center;">S.No</th>
                <th>Fee Head / Particulars Description</th>
                <th style="width:140px;text-align:right;">Amount (INR)</th>
              </tr>
            </thead>
            <tbody>
              ${receipt.breakdown.map((b, idx) => `
                <tr>
                  <td style="text-align:center;color:#64748b;">${idx + 1}</td>
                  <td><b>${esc(b.item)}</b></td>
                  <td style="text-align:right;font-weight:600;">₹${b.amount.toLocaleString('en-IN')}</td>
                </tr>
              `).join("")}
              <tr style="background:#f8fafc;font-size:14px;border-top:2px solid var(--navy);">
                <td colspan="2" style="text-align:right;font-weight:700;color:var(--navy);">TOTAL AMOUNT PAID:</td>
                <td style="text-align:right;font-weight:800;color:#059669;font-size:15px;">₹${receipt.amount.toLocaleString('en-IN')}</td>
              </tr>
            </tbody>
          </table>

          <div style="background:#f8fafc;border-left:4px solid var(--navy);padding:8px 12px;font-size:12px;margin-bottom:20px;">
            <span style="color:#64748b;font-weight:600;">AMOUNT IN WORDS:</span><br>
            <b style="color:var(--navy);font-style:italic;">Rupees ${esc(receipt.amountInWords)} Only</b>
          </div>

          <div class="receipt-seal-bottom">
            <div style="font-size:11px;color:#64748b;max-width:200px;">
              <b>Verification Note:</b><br>
              Computer-generated official receipt stamped by Finance Office. No external receipt required.<br>
              <code style="font-size:10px;display:block;margin-top:4px;">SEAL-VERIFY: ${esc(receipt.institutionSealCode)}</code>
            </div>

            <!-- Authentic Circular Institutional Seal Badge -->
            <div style="text-align:center;">
              <svg width="90" height="90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="46" fill="none" stroke="#b91c1c" stroke-width="2.5" stroke-dasharray="3,2"/>
                <circle cx="50" cy="50" r="41" fill="none" stroke="#b91c1c" stroke-width="1.5"/>
                <path id="receiptSealPath" fill="none" d="M 50,50 m -35,0 a 35,35 0 1,1 70,0 a 35,35 0 1,1 -70,0"/>
                <text font-size="7.5" font-weight="bold" fill="#b91c1c" letter-spacing="1.2">
                  <textPath href="#receiptSealPath" startOffset="50%" text-anchor="middle">
                    AJV COLLEGE OF ENGG &amp; TECH • CHENNAI
                  </textPath>
                </text>
                <circle cx="50" cy="50" r="24" fill="#fef2f2" stroke="#b91c1c" stroke-width="1"/>
                <text x="50" y="44" font-size="6" font-weight="900" fill="#b91c1c" text-anchor="middle">OFFICIAL</text>
                <text x="50" y="52" font-size="6.5" font-weight="900" fill="#b91c1c" text-anchor="middle">SEAL</text>
                <text x="50" y="60" font-size="5" font-weight="bold" fill="#991b1b" text-anchor="middle">ACCOUNTS</text>
              </svg>
              <div style="font-size:10px;font-weight:700;color:#b91c1c;margin-top:2px;">OFFICIALLY STAMPED</div>
            </div>

            <div class="receipt-sig-line">
              <b>Accounts Officer / Dean Finance</b><br>
              AJV College of Engg &amp; Tech
            </div>
          </div>
        </div>
      </div>

      <div class="modal-footer no-print">
        <button type="button" class="btn secondary" onclick="modalDialog.close()">Close</button>
        <button type="button" class="btn gold" onclick="window.print()">🖨️ Print Official Receipt</button>
      </div>
    `;

    modalDialog.showModal();
  } catch (err) {
    toast(err.message, false);
  }
}

let cachedAdminFeesSummary = null;
let adminFeeDeptFilter = "all";
let adminFeeYearFilter = "all";
let adminFeeStatusFilter = "all";
let adminFeeSearchQuery = "";

async function openAdminFeesOverview() {
  try {
    const data = await api("/api/admin/fees/summary");
    cachedAdminFeesSummary = data;
    renderAdminFeesOverview();
  } catch (err) {
    toast(err.message, false);
  }
}

function renderAdminFeesOverview() {
  if (!cachedAdminFeesSummary) return;
  const { metrics, studentsFees } = cachedAdminFeesSummary;

  const filteredStudents = studentsFees.filter(item => {
    if (adminFeeDeptFilter !== "all" && item.student.department !== adminFeeDeptFilter) return false;
    if (adminFeeYearFilter !== "all" && item.student.year !== adminFeeYearFilter) return false;
    if (adminFeeStatusFilter === "due" && item.summary.totalDue === 0) return false;
    if (adminFeeStatusFilter === "cleared" && item.summary.totalDue > 0) return false;
    if (adminFeeSearchQuery) {
      const q = adminFeeSearchQuery.toLowerCase();
      const match = item.student.fullName.toLowerCase().includes(q) || item.student.loginId.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  const completionRate = metrics.totalAssessed > 0 ? ((metrics.totalCollected / metrics.totalAssessed) * 100).toFixed(1) : "0";

  app.innerHTML = `
    <div class="dashboard">
      <div class="dash-head">
        <div>
          <div class="eyebrow">INSTITUTION FINANCE &amp; ACCOUNTS</div>
          <h1>College Fee Collections Overview 💳</h1>
          <p class="muted">Monitoring all fee categories: Tuition, Exams, Hostel, Transport, Caution Deposits, &amp; Placement.</p>
        </div>
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
          <button class="btn gold" onclick="exportDataCsv('/api/admin/export/fees', 'AJV_Fee_Collections_Register.csv')">📥 Export Fee Register CSV</button>
          <button class="btn secondary" onclick="showPage('dashboard')">← Dashboard</button>
          <button class="btn secondary" onclick="openAdminFeesOverview()">🔄 Refresh</button>
        </div>
      </div>

      <!-- Financial Metrics -->
      <div class="stats" style="margin-top:20px;">
        <div class="stat">
          <span class="label">Total Assessed Fees</span>
          <b style="font-size:22px;color:var(--navy);">₹${metrics.totalAssessed.toLocaleString('en-IN')}</b>
          <small>Across ${metrics.totalStudents} enrolled students</small>
        </div>
        <div class="stat">
          <span class="label">Total Collections Realized</span>
          <b style="font-size:22px;color:#059669;">₹${metrics.totalCollected.toLocaleString('en-IN')}</b>
          <small>Settled in college treasury</small>
        </div>
        <div class="stat">
          <span class="label">Total Outstanding Dues</span>
          <b style="font-size:22px;color:#d97706;">₹${metrics.totalOutstanding.toLocaleString('en-IN')}</b>
          <small>Pending student clearance</small>
        </div>
        <div class="stat">
          <span class="label">Collection Recovery Rate</span>
          <b style="font-size:22px;color:var(--blue);">${completionRate}%</b>
          <small>Overall compliance</small>
        </div>
      </div>

      <!-- Student Filter & Search Bar -->
      <div class="card" style="margin-top:20px;">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:14px;">
          <div>
            <h3 style="margin:0;">Student Fee Ledgers (${filteredStudents.length} Students)</h3>
            <p class="muted" style="margin:2px 0 0;font-size:12px;">Inspect fee structure, pending dues, or stamped receipts for each student.</p>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
            <input type="text" placeholder="Search name or ID..." value="${esc(adminFeeSearchQuery)}" 
                   oninput="adminFeeSearchQuery=this.value;renderAdminFeesOverview()" style="width:180px;padding:6px 10px;font-size:12px;">
            <select onchange="adminFeeDeptFilter=this.value;renderAdminFeesOverview()" style="padding:6px 10px;font-size:12px;">
              <option value="all" ${adminFeeDeptFilter === 'all' ? 'selected' : ''}>All Departments</option>
              <option value="CSE" ${adminFeeDeptFilter === 'CSE' ? 'selected' : ''}>CSE</option>
              <option value="ECE" ${adminFeeDeptFilter === 'ECE' ? 'selected' : ''}>ECE</option>
              <option value="MECH" ${adminFeeDeptFilter === 'MECH' ? 'selected' : ''}>MECH</option>
              <option value="CIVIL" ${adminFeeDeptFilter === 'CIVIL' ? 'selected' : ''}>CIVIL</option>
            </select>
            <select onchange="adminFeeYearFilter=this.value;renderAdminFeesOverview()" style="padding:6px 10px;font-size:12px;">
              <option value="all" ${adminFeeYearFilter === 'all' ? 'selected' : ''}>All Years</option>
              <option value="I Year" ${adminFeeYearFilter === 'I Year' ? 'selected' : ''}>I Year</option>
              <option value="II Year" ${adminFeeYearFilter === 'II Year' ? 'selected' : ''}>II Year</option>
              <option value="III Year" ${adminFeeYearFilter === 'III Year' ? 'selected' : ''}>III Year</option>
              <option value="IV Year" ${adminFeeYearFilter === 'IV Year' ? 'selected' : ''}>IV Year</option>
            </select>
            <select onchange="adminFeeStatusFilter=this.value;renderAdminFeesOverview()" style="padding:6px 10px;font-size:12px;">
              <option value="all" ${adminFeeStatusFilter === 'all' ? 'selected' : ''}>All Status</option>
              <option value="due" ${adminFeeStatusFilter === 'due' ? 'selected' : ''}>With Pending Dues</option>
              <option value="cleared" ${adminFeeStatusFilter === 'cleared' ? 'selected' : ''}>Fully Cleared</option>
            </select>
          </div>
        </div>

        <div style="overflow-x:auto;">
          <table class="table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Dept / Year</th>
                <th>Total Assessed</th>
                <th>Paid to Date</th>
                <th>Outstanding</th>
                <th>Status</th>
                <th style="text-align:right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${filteredStudents.length === 0 ? `
                <tr><td colspan="7" style="text-align:center;padding:24px;color:#64748b;">No student records found matching the filter.</td></tr>
              ` : filteredStudents.map(item => `
                <tr>
                  <td>
                    <b>${esc(item.student.fullName)}</b><br>
                    <code style="font-size:11px;">${esc(item.student.loginId)}</code>
                  </td>
                  <td>${esc(item.student.department)} • ${esc(item.student.year)}</td>
                  <td>₹${item.summary.totalAssessed.toLocaleString('en-IN')}</td>
                  <td style="color:#059669;font-weight:600;">₹${item.summary.totalPaid.toLocaleString('en-IN')}</td>
                  <td style="color:${item.summary.totalDue > 0 ? '#d97706' : '#059669'};font-weight:700;">
                    ₹${item.summary.totalDue.toLocaleString('en-IN')}
                  </td>
                  <td>
                    ${item.summary.totalDue === 0 ? `
                      <span class="fee-badge paid">✓ Fully Cleared</span>
                    ` : `
                      <span class="fee-badge due">⏳ ${item.summary.pendingCount} Pending</span>
                    `}
                  </td>
                  <td style="text-align:right;">
                    <button class="btn mini secondary" onclick="viewStudentFeeBreakdown('${item.student.id}')">View Breakdown</button>
                  </td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

async function viewStudentFeeBreakdown(studentId) {
  let item = cachedAdminFeesSummary?.studentsFees?.find(s => 
    String(s.student.id) === String(studentId) || 
    String(s.student.loginId).toLowerCase() === String(studentId).toLowerCase()
  );

  if (!item || !item.fees) {
    try {
      const data = await api(`/api/student/fees?studentId=${encodeURIComponent(studentId)}`);
      if (data && data.fees) {
        item = {
          student: data.student,
          summary: data.summary,
          fees: data.fees
        };
      }
    } catch (e) {
      console.error("Failed to load student fee ledger:", e);
    }
  }

  if (!item) {
    return toast("Fee details could not be found for student #" + studentId, false);
  }

  const sTotalAssessed = item.summary.totalAssessed || item.summary.totalFee || item.fees.reduce((s, x) => s + Number(x.amount || 0), 0);
  const sTotalPaid = item.summary.totalPaid || 0;
  const sTotalDue = item.summary.totalDue || 0;

  modalDialog.innerHTML = `
    <div class="modal-header">
      <div>
        <div class="eyebrow" style="color:var(--gold);">OFFICIAL STUDENT FEE LEDGER</div>
        <h3 style="margin:2px 0;">${esc(item.student.fullName)} (${esc(item.student.loginId)})</h3>
        <p class="muted" style="margin:2px 0 0;font-size:12px;">${esc(item.student.department)} • ${esc(item.student.year)} • Enrolled Student</p>
      </div>
      <button class="btn mini secondary" onclick="modalDialog.close()">✕</button>
    </div>

    <div class="modal-body" style="padding:16px;">
      <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:10px;background:#f8fafc;padding:12px 16px;border-radius:8px;border:1px solid #e2e8f0;margin-bottom:16px;font-size:13px;">
        <div><b>Assessed Total:</b> <span style="color:var(--navy);font-weight:700;">₹${sTotalAssessed.toLocaleString('en-IN')}</span></div>
        <div><b>Paid to Date:</b> <span style="color:#059669;font-weight:700;">₹${sTotalPaid.toLocaleString('en-IN')}</span></div>
        <div><b>Outstanding Due:</b> <span style="color:${sTotalDue > 0 ? '#d97706' : '#059669'};font-weight:700;">₹${sTotalDue.toLocaleString('en-IN')}</span></div>
        <div><b>Clearance:</b> <span class="fee-badge ${sTotalDue === 0 ? 'paid' : 'due'}">${sTotalDue === 0 ? '✓ No Dues' : `⏳ ${item.summary.pendingCount || 0} Pending`}</span></div>
      </div>

      <div style="overflow-x:auto;">
        <table class="table">
          <thead>
            <tr>
              <th>Fee Category &amp; Particulars</th>
              <th>Sem</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Payment Info / Due Date</th>
              <th style="text-align:right;">Receipt / Action</th>
            </tr>
          </thead>
          <tbody>
            ${item.fees.map(f => `
              <tr>
                <td>
                  <b>${esc(f.title)}</b><br>
                  <span class="muted" style="font-size:11px;">${esc(f.category || 'Academic Fee')}</span>
                  ${f.breakdown && f.breakdown.length > 0 ? `
                    <div style="font-size:11px;color:#64748b;margin-top:2px;">
                      ${f.breakdown.map(b => `${esc(b.item)}: ₹${Number(b.amount).toLocaleString('en-IN')}`).join(' • ')}
                    </div>
                  ` : ''}
                </td>
                <td>Sem ${f.semester}</td>
                <td><b>₹${Number(f.amount).toLocaleString('en-IN')}</b></td>
                <td>
                  <span class="fee-badge ${f.status === 'PAID' ? 'paid' : 'due'}">
                    ${f.status === 'PAID' ? '✓ Paid' : '⏳ Due'}
                  </span>
                </td>
                <td>
                  ${f.status === 'PAID' ? `
                    <code style="font-size:11px;color:#059669;">${esc(f.transactionId || 'PAID')}</code><br>
                    <span class="muted" style="font-size:10px;">${f.paidAt ? new Date(f.paidAt).toLocaleDateString('en-IN') : 'Completed'}</span>
                  ` : `
                    <span style="font-size:11px;color:#d97706;font-weight:600;">Due: ${new Date(f.dueDate).toLocaleDateString('en-IN')}</span>
                  `}
                </td>
                <td style="text-align:right;">
                  ${f.status === 'PAID' ? `
                    <button class="btn mini gold" onclick="openOfficialFeeReceipt('${f.id}')">📜 Stamped Receipt</button>
                  ` : `
                    <button class="btn mini primary" style="background:#059669;color:#fff;" onclick="adminCollectStudentFee('${item.student.id}', '${f.id}', '${esc(f.title)}', ${f.amount})">
                      💵 Collect / Mark Paid
                    </button>
                  `}
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </div>

    <div class="modal-footer">
      <button type="button" class="btn secondary" onclick="modalDialog.close()">Close</button>
    </div>
  `;
  modalDialog.showModal();
}

async function adminCollectStudentFee(studentId, feeId, feeTitle, amount) {
  if (!confirm(`Confirm recording offline Cash / DD payment for:\n\nFee: ${feeTitle}\nAmount: ₹${amount.toLocaleString('en-IN')}\n\nThis will mark the fee as PAID and generate an official institutional stamped receipt.`)) {
    return;
  }

  try {
    const res = await api(`/api/student/fees/${feeId}/pay`, {
      method: "POST",
      body: {
        studentId: Number(studentId),
        paymentMode: "CASH (OFFICE COLLECTION)",
        details: "Direct Treasury Cash Receipt"
      }
    });

    toast(`Payment of ₹${amount.toLocaleString('en-IN')} recorded successfully! Ref: ${res.transactionId}`, true);
    await openAdminFeesOverview();
    setTimeout(() => {
      viewStudentFeeBreakdown(studentId);
    }, 200);
  } catch (err) {
    toast(err.message, false);
  }
}

// -------------------------------------------------------------
// 1-Click CSV/Excel Data Exporter
// -------------------------------------------------------------

async function exportDataCsv(endpointUrl, filename) {
  try {
    toast(`Preparing ${filename}...`, true);
    const headers = {};
    if (state.token) headers.Authorization = "Bearer " + state.token;
    const res = await fetch(endpointUrl, { headers });
    if (!res.ok) throw Error("Failed to export data");
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    toast(`✓ Downloaded ${filename}`, true);
  } catch (err) {
    toast(err.message, false);
  }
}

// -------------------------------------------------------------
// Digital Student Smart ID Card (Printable PVC Format)
// -------------------------------------------------------------

async function openDigitalStudentIdCard(targetStudentId = null) {
  let s = state.user;
  if (targetStudentId && state.user.role !== "student") {
    try {
      s = await api(`/api/staff/students/${targetStudentId}`);
    } catch (_) {}
  }
  if (!s) return toast("Student record not found", false);

  const regNo = s.registerNo || s.loginId;
  const dept = s.department || "Information Technology";
  const year = s.year || "I Year";
  const yearBatchMap = {
    "I Year": { batch: "2025 - 2029", valid: "MAY 2029" },
    "II Year": { batch: "2024 - 2028", valid: "MAY 2028" },
    "III Year": { batch: "2023 - 2027", valid: "MAY 2027" },
    "IV Year": { batch: "2022 - 2026", valid: "MAY 2026" }
  };
  const batchInfo = yearBatchMap[year] || { batch: "2024 - 2028", valid: "MAY 2028" };
  const initials = s.fullName.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

  modalDialog.innerHTML = `
    <div class="modal-header no-print">
      <div>
        <div class="eyebrow" style="color:var(--gold);">OFFICIAL DIGITAL CREDENTIAL</div>
        <h3 style="margin:2px 0;">Student Smart PVC ID Card</h3>
        <p class="muted" style="margin:0;font-size:12px;">ISO/IEC 7810 ID-1 standard format • RFID &amp; Barcode Enabled</p>
      </div>
      <div style="display:flex;gap:8px;">
        <button class="btn mini gold" onclick="window.print()">🖨️ Print PVC Card</button>
        <button class="btn mini secondary" onclick="modalDialog.close()">✕</button>
      </div>
    </div>

    <div class="modal-body" style="padding:16px;">
      <div class="idcard-preview-wrap">
        <!-- FRONT SIDE -->
        <div class="idcard">
          <div class="idcard-front-header">
            <img src="/assets/college-logo.png" alt="AJV">
            <h3>AJV COLLEGE OF ENGINEERING</h3>
            <span>AUTONOMOUS • ANNA UNIVERSITY AFFILIATED</span>
          </div>
          <div class="idcard-body">
            <div class="idcard-chip-row">
              <div class="idcard-emv-chip"></div>
              <div class="idcard-hologram">✨ SECURE RFID</div>
            </div>

            <div class="idcard-photo-box">
              <span>${initials}</span>
            </div>

            <h4 class="idcard-name">${esc(s.fullName)}</h4>
            <div class="idcard-regno">${esc(regNo)}</div>

            <div class="idcard-details-grid">
              <div><span>Course:</span> <b>B.Tech / B.E.</b></div>
              <div><span>Department:</span> <b>${esc(dept)}</b></div>
              <div><span>Class &amp; Sec:</span> <b>${esc(year)} • Sec ${esc(s.section || 'A')}</b></div>
              <div><span>Batch:</span> <b>${batchInfo.batch}</b></div>
              <div><span>Valid Upto:</span> <b>${batchInfo.valid}</b></div>
            </div>

            <div class="idcard-barcode">||| | |||| | ||| |||| | |||</div>
            <div style="font-size:9px;color:#64748b;font-family:monospace;margin-top:2px;">*${esc(regNo)}*</div>

            <div class="idcard-footer-sigs">
              <div>Authorized Signatory</div>
              <div style="font-weight:700;color:var(--navy);">Dr. A. Joseph, Principal</div>
            </div>
          </div>
        </div>

        <!-- BACK SIDE -->
        <div class="idcard idcard-back">
          <div class="idcard-back-header">
            EMERGENCY &amp; INSTITUTIONAL INFORMATION
          </div>
          <div class="idcard-back-body">
            <div style="margin-bottom:8px;">
              <span style="color:#64748b;font-size:10px;display:block;">PARENT / GUARDIAN:</span>
              <b style="color:var(--navy);font-size:12px;">${esc(s.parentName || 'R. Kumar')}</b>
            </div>

            <div style="margin-bottom:8px;">
              <span style="color:#64748b;font-size:10px;display:block;">EMERGENCY CONTACT:</span>
              <b style="color:var(--navy);font-size:12px;">${esc(s.phone || '+91 90000 00003')}</b>
            </div>

            <div style="margin-bottom:8px;">
              <span style="color:#64748b;font-size:10px;display:block;">BLOOD GROUP &amp; DOB:</span>
              <b style="color:#dc2626;font-size:12px;">B+ POSITIVE • ${s.dob || '2007-04-15'}</b>
            </div>

            <div style="margin-bottom:8px;">
              <span style="color:#64748b;font-size:10px;display:block;">PERMANENT RESIDENCE:</span>
              <span style="font-size:11px;color:#334155;">${esc(s.address || 'Coimbatore, Tamil Nadu, India')}</span>
            </div>

            <div class="idcard-back-qr">
              <svg width="80" height="80" viewBox="0 0 100 100" style="background:#fff;padding:4px;border:1px solid #cbd5e1;border-radius:4px;">
                <rect x="0" y="0" width="100" height="100" fill="white"/>
                <rect x="10" y="10" width="25" height="25" fill="#081b2f"/>
                <rect x="15" y="15" width="15" height="15" fill="white"/>
                <rect x="18" y="18" width="9" height="9" fill="#081b2f"/>
                <rect x="65" y="10" width="25" height="25" fill="#081b2f"/>
                <rect x="70" y="15" width="15" height="15" fill="white"/>
                <rect x="73" y="18" width="9" height="9" fill="#081b2f"/>
                <rect x="10" y="65" width="25" height="25" fill="#081b2f"/>
                <rect x="15" y="70" width="15" height="15" fill="white"/>
                <rect x="18" y="73" width="9" height="9" fill="#081b2f"/>
                <circle cx="50" cy="50" r="12" fill="#c99a3b"/>
                <rect x="42" y="15" width="10" height="10" fill="#081b2f"/>
                <rect x="42" y="75" width="10" height="10" fill="#081b2f"/>
                <rect x="75" y="45" width="10" height="10" fill="#081b2f"/>
              </svg>
              <div style="font-size:9px;color:#64748b;margin-top:2px;">Scan to Verify Student Status</div>
            </div>

            <div style="font-size:9px;color:#64748b;line-height:1.3;margin-top:auto;border-top:1px dashed #cbd5e1;padding-top:6px;text-align:center;">
              If found, return to Registrar, AJV College of Engineering, Campus Road, Coimbatore.<br>
              Helpline: +91 422 268 0001 • portal: ajv.edu
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="modal-footer no-print">
      <button type="button" class="btn gold" onclick="window.print()">🖨️ Print PVC Smart ID</button>
      <button type="button" class="btn secondary" onclick="modalDialog.close()">Close</button>
    </div>
  `;
  modalDialog.showModal();
}

// -------------------------------------------------------------
// Official Exam Hall Ticket / Admit Card
// -------------------------------------------------------------

async function openOfficialHallTicket(semester = null, targetStudentId = null) {
  try {
    const q = [];
    if (semester) q.push(`semester=${semester}`);
    if (targetStudentId) q.push(`studentId=${targetStudentId}`);
    const query = q.length > 0 ? `?${q.join("&")}` : "";

    const data = await api(`/api/student/hall-ticket${query}`);
    const st = data.student;
    const ht = data.hallTicketDetails;
    const isEligible = data.isEligible;
    const reasons = data.eligibilityReasons;

    modalDialog.innerHTML = `
      <div class="modal-header no-print">
        <div>
          <div class="eyebrow" style="color:var(--gold);">CONTROLLER OF EXAMINATIONS</div>
          <h3 style="margin:2px 0;">Official Examination Hall Ticket / Admit Card</h3>
          <p class="muted" style="margin:0;font-size:12px;">Semester ${ht.semester} • Academic Year ${ht.academicYear}</p>
        </div>
        <div style="display:flex;gap:8px;">
          ${isEligible ? `<button class="btn mini gold" onclick="window.print()">🖨️ Print Admit Card</button>` : ''}
          <button class="btn mini secondary" onclick="modalDialog.close()">✕</button>
        </div>
      </div>

      <div class="modal-body" style="padding:16px;">
        ${!isEligible ? `
          <div class="hallticket-blocked-box">
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
              <span style="font-size:28px;">🚫</span>
              <div>
                <h3 style="color:#b91c1c;margin:0;">ADMIT CARD WITHHELD / BLOCKED</h3>
                <p style="color:#991b1b;margin:2px 0 0;font-size:13px;">This candidate has not cleared institutional eligibility prerequisites for semester examinations.</p>
              </div>
            </div>

            <div style="background:#fff;border-radius:6px;border:1px solid #fca5a5;padding:12px;font-size:13px;">
              <div style="margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;">
                <div>
                  <b>1. Minimum Attendance Requirement:</b>
                  <div style="font-size:12px;color:#475569;">${reasons.attendance.message}</div>
                </div>
                <span class="pill ${reasons.attendance.cleared ? 'grade-Ap' : 'grade-RA'}">
                  ${reasons.attendance.cleared ? '✓ Cleared' : 'Deficit Shortage'}
                </span>
              </div>

              <div style="display:flex;justify-content:space-between;align-items:center;border-top:1px dashed #fecaca;padding-top:8px;">
                <div>
                  <b>2. College Treasury Fee Clearance:</b>
                  <div style="font-size:12px;color:#475569;">${reasons.fees.message}</div>
                </div>
                <span class="pill ${reasons.fees.cleared ? 'grade-Ap' : 'grade-RA'}">
                  ${reasons.fees.cleared ? '✓ Cleared' : 'Dues Pending'}
                </span>
              </div>
            </div>

            <div style="margin-top:14px;display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
              ${!reasons.fees.cleared ? `
                <button class="btn gold" onclick="modalDialog.close();showPage('fees');">💳 Pay Outstanding Dues Now →</button>
              ` : ''}
              <button class="btn secondary" onclick="modalDialog.close();openGrievancesPortal();">💬 File Condonation Appeal / Inquiry</button>
            </div>
          </div>
        ` : `
          <div class="hallticket-doc">
            <div class="hallticket-head">
              <img src="/assets/college-logo.png" alt="AJV" style="width:64px;height:64px;border-radius:50%;border:2px solid var(--gold);">
              <div class="hallticket-title">
                <h2>AJV COLLEGE OF ENGINEERING</h2>
                <div style="font-size:11px;color:#475569;">Autonomous Institution • Affiliated to Anna University • Accredited NAAC 'A+'</div>
                <h4>END SEMESTER DEGREE EXAMINATIONS - HALL TICKET</h4>
                <div style="font-size:11px;font-weight:700;color:var(--navy);">${ht.academicYear} • B.Tech / B.E. Degree</div>
              </div>
            </div>

            <div class="hallticket-grid">
              <div>
                <table class="hallticket-bio-table">
                  <tr><td class="lbl">Register Number:</td><td><b>${esc(st.registerNo)}</b></td></tr>
                  <tr><td class="lbl">Candidate Name:</td><td><b>${esc(st.fullName)}</b></td></tr>
                  <tr><td class="lbl">Degree &amp; Branch:</td><td><b>B.Tech - ${esc(st.department)}</b></td></tr>
                  <tr><td class="lbl">Year / Semester:</td><td><b>${esc(st.year)} / Semester ${ht.semester}</b></td></tr>
                  <tr><td class="lbl">Examination Center:</td><td><b>${ht.examCenter}</b></td></tr>
                  <tr><td class="lbl">Allocated Hall &amp; Seat:</td><td><b style="color:var(--blue);">${ht.hallNumber} • ${ht.seatNumber}</b></td></tr>
                  <tr><td class="lbl">Attendance Rate:</td><td><b style="color:#059669;">${reasons.attendance.current}% (Eligible)</b></td></tr>
                  <tr><td class="lbl">Dues Clearance:</td><td><b style="color:#059669;">✓ Fully Cleared (No Dues)</b></td></tr>
                </table>
              </div>

              <div class="hallticket-photo-box">
                <div style="width:84px;height:90px;background:#1e3a5f;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:24px;border-radius:4px;border:1px solid #cbd5e1;margin-bottom:6px;">
                  ${st.fullName.slice(0, 2).toUpperCase()}
                </div>
                <div style="font-size:10px;font-weight:700;color:var(--navy);">${esc(st.loginId)}</div>
                <div style="font-size:9px;color:#64748b;margin-top:2px;">Candidate Signature</div>
                <div style="border-top:1px solid #475569;width:80px;margin-top:18px;"></div>
              </div>
            </div>

            <div style="margin:16px 0;">
              <div class="eyebrow" style="margin-bottom:6px;">COURSE TIMETABLE &amp; HALL LOG</div>
              <table class="table" style="font-size:12px;">
                <thead>
                  <tr>
                    <th>Course Code</th>
                    <th>Course Title</th>
                    <th>Date of Exam</th>
                    <th>Session</th>
                    <th style="text-align:center;">Invigilator Sign</th>
                  </tr>
                </thead>
                <tbody>
                  ${ht.timetable.map(t => `
                    <tr>
                      <td><b>${esc(t.courseCode)}</b></td>
                      <td>${esc(t.courseName)}</td>
                      <td><b>${t.date}</b></td>
                      <td><span class="pill grade-B">${t.session}</span></td>
                      <td style="text-align:center;color:#cbd5e1;">[ &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; ]</td>
                    </tr>
                  `).join("")}
                </tbody>
              </table>
            </div>

            <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:24px;padding-top:16px;border-top:1px solid #cbd5e1;">
              <div>
                <div style="font-size:10px;color:#64748b;">Verification Hash: <code>${ht.verificationCode}</code></div>
                <div style="font-size:10px;color:#64748b;">Issued on: ${ht.issueDate} • Digital Hall Scanner Enabled</div>
              </div>
              <div style="text-align:center;">
                <div style="display:inline-block;border:2px solid var(--gold);color:var(--gold);padding:3px 8px;border-radius:4px;font-size:10px;font-weight:900;margin-bottom:4px;">
                  ★ AJV COE OFFICIAL SEAL ★
                </div>
                <div style="font-size:11px;font-weight:700;color:var(--navy);border-top:1px solid #475569;width:160px;padding-top:2px;margin-top:4px;">
                  Controller of Examinations
                </div>
              </div>
            </div>

            <div style="margin-top:16px;padding:8px 12px;background:#f8fafc;border-radius:6px;font-size:10px;color:#64748b;line-height:1.4;">
              <b>Instructions to Candidate:</b> 1. Hall ticket along with Student ID card must be presented for all examinations. 2. Possession of mobile phones, smartwatches, or programmable calculators inside the examination hall is strictly prohibited. 3. Candidates must report at least 15 minutes prior to session start.
            </div>
          </div>
        `}
      </div>

      <div class="modal-footer no-print">
        ${isEligible ? `<button type="button" class="btn gold" onclick="window.print()">🖨️ Print Official Hall Ticket</button>` : ''}
        <button type="button" class="btn secondary" onclick="modalDialog.close()">Close</button>
      </div>
    `;
    modalDialog.showModal();
  } catch (err) {
    toast(err.message, false);
  }
}

// -------------------------------------------------------------
// Daily Subject Attendance Marker (Faculty)
// -------------------------------------------------------------

async function openFacultyAttendanceMarker() {
  try {
    const studentsData = await api("/api/staff/students");
    const activeStudents = (studentsData || []).filter(s => s.status === "active");

    const courses = [
      { code: "PH3151", name: "Engineering Physics", semester: 1, dept: "Information Technology", year: "I Year" },
      { code: "MA3151", name: "Matrices and Calculus", semester: 1, dept: "Information Technology", year: "I Year" },
      { code: "GE3151", name: "Python Programming", semester: 1, dept: "Information Technology", year: "I Year" },
      { code: "CS3351", name: "Digital Principles & Computer Org", semester: 3, dept: "Information Technology", year: "II Year" },
      { code: "CS3301", name: "Data Structures", semester: 3, dept: "Information Technology", year: "II Year" },
      { code: "CS3591", name: "Computer Networks", semester: 5, dept: "Information Technology", year: "III Year" },
      { code: "IT3701", name: "Cryptography & Cyber Security", semester: 7, dept: "Information Technology", year: "IV Year" }
    ];

    state.attendanceRoster = activeStudents.map(s => ({
      studentId: s.id,
      fullName: s.fullName,
      loginId: s.loginId,
      registerNo: s.registerNo || s.loginId,
      department: s.department,
      year: s.year,
      status: "P"
    }));

    modalDialog.innerHTML = `
      <div class="modal-header">
        <div>
          <div class="eyebrow" style="color:var(--cyan);">CLASSROOM OPERATIONS</div>
          <h3 style="margin:2px 0;">📋 Daily Subject Attendance Marker</h3>
          <p class="muted" style="margin:0;font-size:12px;">Record class attendance session and update university records in real time</p>
        </div>
        <button class="btn mini secondary" onclick="modalDialog.close()">✕</button>
      </div>

      <div class="modal-body" style="padding:16px;">
        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(180px, 1fr));gap:12px;background:#f8fafc;padding:12px 16px;border-radius:8px;border:1px solid #e2e8f0;margin-bottom:16px;">
          <div>
            <label style="font-size:11px;font-weight:700;color:#64748b;display:block;margin-bottom:4px;">Academic Year &amp; Dept</label>
            <select id="attDeptYear" class="input" style="width:100%;font-size:12px;" onchange="filterAttendanceRoster()">
              <option value="All">All Registered Classes</option>
              <option value="I Year" selected>I Year • IT</option>
              <option value="II Year">II Year • IT</option>
              <option value="III Year">III Year • IT</option>
              <option value="IV Year">IV Year • IT</option>
            </select>
          </div>

          <div>
            <label style="font-size:11px;font-weight:700;color:#64748b;display:block;margin-bottom:4px;">Course / Subject</label>
            <select id="attCourse" class="input" style="width:100%;font-size:12px;">
              ${courses.map(c => `<option value="${c.code}" data-name="${c.name}" data-sem="${c.semester}">${c.code} - ${c.name} (Sem ${c.semester})</option>`).join("")}
            </select>
          </div>

          <div>
            <label style="font-size:11px;font-weight:700;color:#64748b;display:block;margin-bottom:4px;">Session Date</label>
            <input type="date" id="attDate" class="input" value="${new Date().toISOString().split('T')[0]}" style="width:100%;font-size:12px;">
          </div>
        </div>

        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:12px;">
          <div id="attLiveSummary" style="font-size:13px;font-weight:700;color:var(--navy);">
            Total: ${state.attendanceRoster.length} | Present: ${state.attendanceRoster.length} | Absent: 0 (100%)
          </div>
          <div style="display:flex;gap:6px;">
            <button type="button" class="btn mini secondary" onclick="markAllAttendance('P')">⚡ Mark All Present</button>
            <button type="button" class="btn mini secondary" onclick="markAllAttendance('A')">Mark All Absent</button>
          </div>
        </div>

        <div style="overflow-x:auto;max-height:360px;">
          <table class="att-roster-table">
            <thead>
              <tr>
                <th style="width:40px;">#</th>
                <th>Student Name</th>
                <th>Register No</th>
                <th>Year &amp; Dept</th>
                <th style="text-align:right;">Attendance Status</th>
              </tr>
            </thead>
            <tbody id="attRosterBody">
              ${renderAttendanceRosterRows()}
            </tbody>
          </table>
        </div>
      </div>

      <div class="modal-footer" style="display:flex;justify-content:space-between;">
        <button type="button" class="btn secondary" onclick="modalDialog.close()">Cancel</button>
        <button type="button" class="btn primary" style="background:#0891b2;color:#fff;" onclick="submitAttendanceSession()">
          💾 Save &amp; Record Attendance Session
        </button>
      </div>
    `;
    modalDialog.showModal();
    updateAttendanceCounters();
  } catch (err) {
    toast(err.message, false);
  }
}

function renderAttendanceRosterRows() {
  if (!state.attendanceRoster) return "";
  const filterYear = document.getElementById("attDeptYear")?.value || "I Year";

  const list = state.attendanceRoster.filter(s => filterYear === "All" || s.year === filterYear);

  return list.map((s, idx) => `
    <tr>
      <td>${idx + 1}</td>
      <td><b>${esc(s.fullName)}</b></td>
      <td><code>${esc(s.registerNo)}</code></td>
      <td><span class="muted">${esc(s.year)} • ${esc(s.department)}</span></td>
      <td style="text-align:right;">
        <div class="att-btn-group">
          <button type="button" class="att-btn present ${s.status === 'P' ? 'active' : ''}" onclick="toggleStudentAttendance(${s.studentId}, 'P')">P</button>
          <button type="button" class="att-btn absent ${s.status === 'A' ? 'active' : ''}" onclick="toggleStudentAttendance(${s.studentId}, 'A')">A</button>
          <button type="button" class="att-btn od ${s.status === 'OD' ? 'active' : ''}" onclick="toggleStudentAttendance(${s.studentId}, 'OD')">OD</button>
        </div>
      </td>
    </tr>
  `).join("");
}

function toggleStudentAttendance(studentId, status) {
  const item = state.attendanceRoster.find(s => s.studentId === studentId);
  if (item) {
    item.status = status;
    const body = document.getElementById("attRosterBody");
    if (body) body.innerHTML = renderAttendanceRosterRows();
    updateAttendanceCounters();
  }
}

function markAllAttendance(status) {
  const filterYear = document.getElementById("attDeptYear")?.value || "I Year";
  state.attendanceRoster.forEach(s => {
    if (filterYear === "All" || s.year === filterYear) {
      s.status = status;
    }
  });
  const body = document.getElementById("attRosterBody");
  if (body) body.innerHTML = renderAttendanceRosterRows();
  updateAttendanceCounters();
}

function filterAttendanceRoster() {
  const body = document.getElementById("attRosterBody");
  if (body) body.innerHTML = renderAttendanceRosterRows();
  updateAttendanceCounters();
}

function updateAttendanceCounters() {
  const filterYear = document.getElementById("attDeptYear")?.value || "I Year";
  const list = (state.attendanceRoster || []).filter(s => filterYear === "All" || s.year === filterYear);
  const total = list.length;
  const present = list.filter(s => s.status === "P" || s.status === "OD").length;
  const absent = list.filter(s => s.status === "A").length;
  const pct = total > 0 ? ((present / total) * 100).toFixed(1) : "0";

  const el = document.getElementById("attLiveSummary");
  if (el) {
    el.innerHTML = `Total: <b>${total}</b> | Present: <b style="color:#059669;">${present}</b> | Absent: <b style="color:#dc2626;">${absent}</b> (${pct}% Attendance Rate)`;
  }
}

async function submitAttendanceSession() {
  const courseSelect = document.getElementById("attCourse");
  const dateInput = document.getElementById("attDate");
  const yearSelect = document.getElementById("attDeptYear");

  const courseCode = courseSelect.value;
  const courseOpt = courseSelect.selectedOptions[0];
  const courseName = courseOpt ? courseOpt.getAttribute("data-name") : "Subject";
  const semester = courseOpt ? courseOpt.getAttribute("data-sem") : 1;
  const date = dateInput.value || new Date().toISOString().split("T")[0];
  const year = yearSelect.value;

  const records = state.attendanceRoster.map(s => ({
    studentId: s.studentId,
    status: s.status
  }));

  try {
    const res = await api("/api/staff/attendance/session", {
      method: "POST",
      body: {
        date,
        department: "Information Technology",
        year,
        semester,
        courseCode,
        courseName,
        records
      }
    });

    toast(`✓ Class attendance for ${courseCode} (${date}) recorded successfully!`, true);
    modalDialog.close();
  } catch (err) {
    toast(err.message, false);
  }
}

// -------------------------------------------------------------
// Student Subject-wise Attendance Breakdown
// -------------------------------------------------------------

async function openStudentAttendanceBreakdown(studentId = null, semester = null) {
  try {
    const q = [];
    if (studentId) q.push(`studentId=${studentId}`);
    if (semester) q.push(`semester=${semester}`);
    const query = q.length > 0 ? `?${q.join("&")}` : "";

    const data = await api(`/api/student/attendance/subjects${query}`);
    const st = data.student;
    const subjects = data.subjects || [];

    modalDialog.innerHTML = `
      <div class="modal-header">
        <div>
          <div class="eyebrow" style="color:var(--cyan);">ATTENDANCE MONITOR</div>
          <h3 style="margin:2px 0;">Subject-wise Attendance Breakdown</h3>
          <p class="muted" style="margin:0;font-size:12px;">${esc(st.fullName)} (${esc(st.loginId)}) • Overall: <b>${st.overallAttendance}%</b></p>
        </div>
        <button class="btn mini secondary" onclick="modalDialog.close()">✕</button>
      </div>

      <div class="modal-body" style="padding:16px;">
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px 16px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
          <div>
            <div style="font-size:11px;color:#64748b;">OVERALL ACADEMIC ATTENDANCE</div>
            <div style="font-size:20px;font-weight:900;color:${st.overallAttendance >= 75 ? '#059669' : '#dc2626'};">
              ${st.overallAttendance}% ${st.overallAttendance >= 75 ? '✓ (Eligible for Exams)' : '⚠️ (Shortage Detention Risk)'}
            </div>
          </div>
          <button class="btn mini gold" onclick="modalDialog.close();openOfficialHallTicket();">🎫 Check Exam Hall Ticket →</button>
        </div>

        <div style="overflow-x:auto;">
          <table class="table">
            <thead>
              <tr>
                <th>Subject Code &amp; Title</th>
                <th>Sem</th>
                <th>Classes Attended</th>
                <th>Attendance %</th>
                <th>Clearance Status</th>
              </tr>
            </thead>
            <tbody>
              ${subjects.map(s => `
                <tr>
                  <td><b>${esc(s.code)}</b><br><span class="muted" style="font-size:11px;">${esc(s.name)}</span></td>
                  <td>Sem ${s.semester}</td>
                  <td><b>${s.attendedClasses}</b> / ${s.totalClasses} periods</td>
                  <td>
                    <div style="display:flex;align-items:center;gap:8px;">
                      <div style="flex:1;height:8px;background:#e2e8f0;border-radius:4px;overflow:hidden;min-width:70px;">
                        <div style="height:100%;width:${s.percentage}%;background:${s.percentage >= 85 ? '#059669' : (s.percentage >= 75 ? '#f59e0b' : '#dc2626')};"></div>
                      </div>
                      <b style="font-size:12px;color:${s.percentage >= 75 ? '#059669' : '#dc2626'};">${s.percentage}%</b>
                    </div>
                  </td>
                  <td>
                    <span class="pill ${s.percentage >= 85 ? 'grade-Ap' : (s.percentage >= 75 ? 'grade-Bp' : 'grade-RA')}">
                      ${s.status}
                    </span>
                  </td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </div>

      <div class="modal-footer">
        <button type="button" class="btn secondary" onclick="modalDialog.close()">Close</button>
      </div>
    `;
    modalDialog.showModal();
  } catch (err) {
    toast(err.message, false);
  }
}

// -------------------------------------------------------------
// Grievances & Helpdesk Service Desk
// -------------------------------------------------------------

async function openGrievancesPortal() {
  try {
    const list = await api("/api/grievances");
    const isStaffOrAdmin = state.user && (state.user.role === "staff" || state.user.role === "admin");

    modalDialog.innerHTML = `
      <div class="modal-header">
        <div>
          <div class="eyebrow" style="color:var(--gold);">CAMPUS SERVICE DESK</div>
          <h3 style="margin:2px 0;">💬 Student Grievance &amp; Redressal Portal</h3>
          <p class="muted" style="margin:0;font-size:12px;">Track complaints, inquiries, fee clarifications &amp; marksheet revaluation requests</p>
        </div>
        <div style="display:flex;gap:8px;">
          ${!isStaffOrAdmin ? `
            <button class="btn mini gold" onclick="openSubmitGrievanceModal()">+ File New Ticket</button>
          ` : ''}
          <button class="btn mini secondary" onclick="modalDialog.close()">✕</button>
        </div>
      </div>

      <div class="modal-body" style="padding:16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:16px;">
          <div style="font-size:13px;font-weight:700;color:var(--navy);">
            ${list.length} Ticket(s) on Record
          </div>
          ${!isStaffOrAdmin ? `
            <button class="btn mini gold" onclick="openSubmitGrievanceModal()">+ File New Grievance</button>
          ` : `
            <div style="font-size:12px;color:#64748b;">Staff &amp; Administrator Resolution Console</div>
          `}
        </div>

        <div style="max-height:420px;overflow-y:auto;">
          ${list.length === 0 ? `
            <div style="text-align:center;padding:32px;color:#64748b;">
              <div style="font-size:32px;margin-bottom:8px;">📬</div>
              <b>No Grievance Tickets Found</b>
              <p style="font-size:12px;margin:4px 0 0;">All student service requests and queries have been addressed.</p>
            </div>
          ` : list.map(item => `
            <div class="grievance-item">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px;margin-bottom:6px;">
                <div>
                  <span style="font-family:monospace;font-weight:700;color:#c99a3b;font-size:12px;">${item.ticketNo}</span>
                  <span style="font-size:11px;color:#64748b;margin-left:6px;">• ${item.category} • Priority: <b>${item.priority}</b></span>
                  <h4 style="margin:4px 0 2px;color:var(--navy);font-size:14px;">${esc(item.subject)}</h4>
                  <div style="font-size:11px;color:#64748b;">Filed by: <b>${esc(item.studentName)}</b> (${esc(item.registerNo)}) • ${new Date(item.createdAt).toLocaleDateString('en-IN')}</div>
                </div>
                <div style="display:flex;align-items:center;gap:6px;">
                  <span class="status-pill ${item.status.toLowerCase().replace(' ', '-')}">${item.status}</span>
                  ${isStaffOrAdmin ? `
                    <button class="btn mini secondary" onclick="openResolveGrievanceModal('${item.id}', '${esc(item.ticketNo)}', '${esc(item.subject)}', '${item.status}', '${esc(item.responseNote || '')}')">
                      ✍️ Respond
                    </button>
                  ` : ''}
                </div>
              </div>

              <div style="font-size:12px;color:#334155;background:#f8fafc;padding:8px 12px;border-radius:6px;border:1px solid #f1f5f9;margin-top:6px;">
                ${esc(item.description)}
              </div>

              ${item.responseNote ? `
                <div style="margin-top:8px;background:#ecfdf5;border-left:4px solid #10b981;padding:8px 12px;border-radius:0 6px 6px 0;font-size:12px;">
                  <b style="color:#065f46;">Official Resolution / Remarks:</b>
                  <p style="margin:2px 0 0;color:#047857;">${esc(item.responseNote)}</p>
                  <div style="font-size:10px;color:#059669;margin-top:4px;">Resolved by: ${esc(item.respondedBy || 'Academic Committee')}</div>
                </div>
              ` : `
                <div style="font-size:11px;color:#d97706;margin-top:6px;">⏳ Awaiting response from department coordinator.</div>
              `}
            </div>
          `).join("")}
        </div>
      </div>

      <div class="modal-footer">
        <button type="button" class="btn secondary" onclick="modalDialog.close()">Close</button>
      </div>
    `;
    modalDialog.showModal();
  } catch (err) {
    toast(err.message, false);
  }
}

function openSubmitGrievanceModal() {
  modalDialog.innerHTML = `
    <div class="modal-header">
      <div>
        <div class="eyebrow" style="color:var(--gold);">NEW INQUIRY / APPEAL</div>
        <h3 style="margin:2px 0;">Submit Grievance or Service Request</h3>
        <p class="muted" style="margin:0;font-size:12px;">Your ticket will be routed to the respective college administrative authority</p>
      </div>
      <button class="btn mini secondary" onclick="modalDialog.close()">✕</button>
    </div>

    <form onsubmit="submitGrievanceTicket(event)">
      <div class="modal-body" style="padding:16px;">
        <label>Category</label>
        <select id="grvCategory" class="input" style="width:100%;margin-bottom:12px;">
          <option value="Academic / Revaluation">Academic / Exam Marksheet Revaluation</option>
          <option value="Fee / Payment Issue">College Fee / Treasury Payment Query</option>
          <option value="Exam / Hall Ticket">Examination Hall Ticket / Admit Card</option>
          <option value="Hostel & Transport">Hostel, Mess or Bus Transport</option>
          <option value="General Grievance">General Student Service Inquiry</option>
        </select>

        <label>Priority</label>
        <select id="grvPriority" class="input" style="width:100%;margin-bottom:12px;">
          <option value="Normal">Normal</option>
          <option value="High">High</option>
          <option value="Urgent">Urgent</option>
        </select>

        <label>Subject / Summary</label>
        <input id="grvSubject" class="input" placeholder="e.g. Request for evaluation review in CS3301" required style="width:100%;margin-bottom:12px;">

        <label>Detailed Description</label>
        <textarea id="grvDescription" class="input" rows="4" placeholder="Explain your grievance or request clearly with reference details..." required style="width:100%;"></textarea>
      </div>

      <div class="modal-footer" style="display:flex;justify-content:space-between;">
        <button type="button" class="btn secondary" onclick="openGrievancesPortal()">← Back to Tickets</button>
        <button type="submit" class="btn gold">Submit Ticket →</button>
      </div>
    </form>
  `;
  modalDialog.showModal();
}

async function submitGrievanceTicket(e) {
  e.preventDefault();
  const category = document.getElementById("grvCategory").value;
  const priority = document.getElementById("grvPriority").value;
  const subject = document.getElementById("grvSubject").value;
  const description = document.getElementById("grvDescription").value;

  try {
    const res = await api("/api/grievances", {
      method: "POST",
      body: { category, priority, subject, description }
    });
    toast(res.message, true);
    openGrievancesPortal();
  } catch (err) {
    toast(err.message, false);
  }
}

function openResolveGrievanceModal(ticketId, ticketNo, subject, currentStatus, currentNote) {
  modalDialog.innerHTML = `
    <div class="modal-header">
      <div>
        <div class="eyebrow" style="color:var(--gold);">STAFF RESOLUTION CONSOLE</div>
        <h3 style="margin:2px 0;">Respond to ${ticketNo}</h3>
        <p class="muted" style="margin:0;font-size:12px;">${esc(subject)}</p>
      </div>
      <button class="btn mini secondary" onclick="modalDialog.close()">✕</button>
    </div>

    <div class="modal-body" style="padding:16px;">
      <label>Update Status</label>
      <select id="resolveStatus" class="input" style="width:100%;margin-bottom:12px;">
        <option value="Open" ${currentStatus === 'Open' ? 'selected' : ''}>Open</option>
        <option value="In Review" ${currentStatus === 'In Review' ? 'selected' : ''}>In Review</option>
        <option value="Resolved" ${currentStatus === 'Resolved' ? 'selected' : ''}>Resolved</option>
      </select>

      <label>Official Resolution / Response Note</label>
      <textarea id="resolveNote" class="input" rows="4" placeholder="Enter resolution explanation or action taken..." style="width:100%;">${esc(currentNote)}</textarea>
    </div>

    <div class="modal-footer" style="display:flex;justify-content:space-between;">
      <button type="button" class="btn secondary" onclick="openGrievancesPortal()">Cancel</button>
      <button type="button" class="btn gold" onclick="saveGrievanceResolution(${ticketId})">Save Resolution →</button>
    </div>
  `;
  modalDialog.showModal();
}

async function saveGrievanceResolution(ticketId) {
  const status = document.getElementById("resolveStatus").value;
  const responseNote = document.getElementById("resolveNote").value;

  try {
    const res = await api(`/api/grievances/${ticketId}`, {
      method: "PUT",
      body: { status, responseNote }
    });
    toast(res.message, true);
    openGrievancesPortal();
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
  else if (p === "idcard" || p === "smartid") openDigitalStudentIdCard();
  else if (p === "hallticket" || p === "admitcard") openOfficialHallTicket();
  else if (p === "attendance") {
    if (state.user && state.user.role === "staff") openFacultyAttendanceMarker();
    else openStudentAttendanceBreakdown();
  }
  else if (p === "grievances" || p === "helpdesk") openGrievancesPortal();
  else if (p === "fees" || p === "payment") {
    if (!state.user) login();
    else if (state.user.role === "student") openStudentFeesView();
    else openAdminFeesOverview();
  }
  else if (p === "results" || p === "marksheets") {
    if (!state.user) login();
    else if (state.user.role === "admin") openPublishResultsCenter();
    else if (state.user.role === "staff") openFacultyResultsView();
    else openStudentResults();
  }
  else if (p === "publish") {
    if (!state.user) login();
    else if (state.user.role === "admin") openPublishResultsCenter();
    else openFacultyResultsView();
  }
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

// Google-style Password Strength Algorithm
window.checkPasswordStrength = function(pwd) {
  if (!pwd) return { score: 0, label: "", color: "transparent" };
  if (pwd.length < 8) {
      if (pwd.length < 6) return { score: 1, label: "Too Weak", color: "#ef4444" };
      return { score: 2, label: "Weak", color: "#f97316" };
  }
  let score = 2; // base score for length >= 8
  let hasUpperLower = /[A-Z]/.test(pwd) && /[a-z]/.test(pwd);
  let hasNumber = /[0-9]/.test(pwd);
  let hasSpecial = /[^A-Za-z0-9]/.test(pwd);

  if (hasUpperLower) score++;
  if (hasNumber) score++;
  if (hasSpecial) score++;
  
  if (score <= 3) return { score: 3, label: "Fair", color: "#eab308" };
  if (score === 4) return { score: 4, label: "Good", color: "#84cc16" };
  return { score: 5, label: "Strong", color: "#22c55e" };
}

window.renderPasswordStrength = function(inputId, meterId) {
  const el = document.getElementById(inputId);
  const meter = document.getElementById(meterId);
  if (!el || !meter) return;
  const val = el.value;
  const s = checkPasswordStrength(val);
  if (!val) {
    meter.innerHTML = "";
    return;
  }
  const bars = Array.from({length: 5}, (_, i) => `<div style="flex:1;height:4px;border-radius:2px;background:${i < s.score ? s.color : '#e2e8f0'}; transition: background 0.3s;"></div>`).join("");
  meter.innerHTML = `
    <div style="display:flex;gap:4px;margin-top:6px;">${bars}</div>
    <div style="font-size:11px;color:${s.color};margin-top:4px;text-align:right;font-weight:600;">${s.label}</div>
  `;
}

layoutNav();
loadConfig().then(() => {
  showPage(state.user ? "dashboard" : "home");
  
  // IP Monitoring: Check every second for IP changes to enforce STRICT admin security
  setInterval(async () => {
    try {
      const opt = {};
      const adminDevice = localStorage.getItem("ajv_admin_device");
      if (adminDevice) opt.headers = { "x-client-ip": adminDevice };
      
      const res = await fetch('/api/config', opt);
      if (!res.ok) return;
      const d = await res.json();
      
      const wasAdminAllowed = state.config && state.config.isAdminAllowed;
      const isAdminAllowedNow = d.isAdminAllowed;
      
      if (wasAdminAllowed && !isAdminAllowedNow) {
        // IP changed to UNAUTHORIZED!
        state.config.isAdminAllowed = false;
        
        // If logged in as admin, instantly kick them out
        if (state.user && state.user.role === 'admin') {
          logout(false);
          toast("Security Alert: Network IP change detected. Admin access instantly revoked.", false);
        }
        
        // If on login page trying to select Admin
        if (!state.user && state.role === 'admin') {
          state.role = 'student';
          if (document.querySelector('.login-wrap')) {
            renderLogin();
            toast("Admin access locked: Unauthorized IP detected.", false);
          }
        } else if (!state.user && document.querySelector('.login-wrap')) {
          renderLogin(); // Refresh to hide the tab
        }
      } else if (!wasAdminAllowed && isAdminAllowedNow) {
        // IP changed to AUTHORIZED
        state.config.isAdminAllowed = true;
        if (!state.user && document.querySelector('.login-wrap')) {
          renderLogin(); // Refresh to show the tab
        }
      }
    } catch (e) {}
  }, 1000);
});



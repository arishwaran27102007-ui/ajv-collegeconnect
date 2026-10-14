# AJV CollegeConnect — AJV College of Engineering

A modern, full-stack academic portal built with **Node.js, Express, PostgreSQL / Persistent JSON, Vanilla HTML5/CSS3/JS, Docker, and Android**.

> **Note:** Yes, this project is **completely containerised by Docker**. You can run the entire stack seamlessly using Docker Compose.

---

## 🌟 Key Features & Enhancements

- **Dual-Mode Zero-Config Database Architecture**:
  - **Zero-Config Mode**: Automatically runs using persistent local storage (`data/db.json`). No database installation needed.
  - **Production PostgreSQL Mode**: Automatically connects to PostgreSQL if `DATABASE_URL` is set or when started with Docker Compose.
- **Automated Academic Engine**:
  - Credit-weighted CGPA: $\text{CGPA} = \frac{\sum (\text{Grade Point} \times \text{Course Credits})}{\sum \text{Course Credits}}$
  - Auto-calculated Grades: `O` (10), `A+` (9), `A` (8), `B+` (7), `B` (6), `C` (5), `RA` (0 - Re-Appear).
  - Dynamic overall percentage and average attendance tracking.
- **Attendance Shortage Alert System**:
  - Highlights attendance below the 75% threshold with visual alerts and detention warnings for compliance with university norms.
- **Official Semester Marksheet Generation (Print & PDF)**:
  - One-click official statement of marks with AJV College emblem, student details, course-wise scores, standings, and signature lines.
- **Faculty & Administrative Console**:
  - Pending student onboarding verification (Approve/Reject).
  - Campus Bulletin / Announcement publisher and manager.
  - Student directory with live instant search and **CSV export**.
  - Internal assessment and semester marks recording with live preview.
- **Account Security & Self-Service**:
  - Self-service password changing in User Profile.
  - Role-based JWT authentication and bcrypt password hashing.
- **Multi-Platform Access**:
  - Desktop & Mobile Web SPA.
  - Progressive Web App (PWA) with offline shell caching.
  - Native Android app scaffolding (`android/`) ready for Android Studio.
- **Enterprise-Grade Security Features**:
  - **Google-Style Password Strength algorithm** enforced on all endpoints (Uppercase, lowercase, number, special character, 8+ chars).
  - Strict IP-based access control for administrative roles (Admin login only visible on `10.43.120.56`).
  - No default/demo credentials. All user provisioning must be done properly.
- **Payment Gateway Integration**:
  - Integrated **Razorpay Standard Web Checkout** for Fee ledger settlements.
- **Automated Testing Suite**:
  - Uses `jest` for core database engine logic and integrations.

---

## 🔑 Authentication & Provisioning

**Demo accounts have been permanently removed for security.**
- **Students**: Self-register on the portal. Wait for staff/admin approval.
- **Staff**: Admins can issue staff/faculty IDs from the admin console.
- **Admin**: The admin login is explicitly restricted by IP. You must load the site from `10.43.120.56` to see and use the Admin portal.

---

### Pre-requisites
- Create a `.env` file with Razorpay keys (optional, but required for fee payments):
  ```
  RAZORPAY_KEY_ID=rzp_test_xxxxxx
  RAZORPAY_KEY_SECRET=yyyyyyy
  ```

### Run
Open the project folder in terminal:

```bash
npm install
npm start
```

### Testing
To run the automated tests via Jest:
```bash
npm test
```

Open in your browser:
👉 **`http://localhost:5000`**

*The backend automatically runs with `data/db.json` out of the box if no PostgreSQL is installed.*

---

## 🐳 Running with Docker & PostgreSQL

The Docker Compose configuration spins up both the **Node.js app** and a **PostgreSQL 16** database container initialized with `backend/schema.sql`:

```bash
docker compose up --build
```

Access the portal at `http://localhost:5000`. Database data persists in the `pgdata` Docker volume.

---

## 📱 Mobile App (Android & PWA)

### Progressive Web App (PWA)
1. Open `http://localhost:5000` (or your deployed URL) in Chrome on Android.
2. Tap the **Install App** button or select **Add to Home screen**.
3. Launches standalone with the official AJV laurel emblem icon.

### Native Android Project
The `android/` directory contains a Jetpack Compose & Retrofit application:
1. Open the `android` folder in **Android Studio**.
2. Sync Gradle dependencies.
3. Run on an Android Emulator or connected physical device.

---

## 🏛️ Cloud Database & Multi-Decade Permanent Archival (10–50+ Years)

AJV CollegeConnect includes an enterprise-grade **Cloud Database & Multi-Decade Institutional Archive** designed for lifelong storage and instant retrieval of student records across decades:

### 1. Cloud Database Integration
- Supports any managed cloud PostgreSQL instance (**Neon, Supabase, Render, AWS RDS, GCP Cloud SQL, Railway**).
- Automatic SSL negotiation (`ssl: { rejectUnauthorized: false }`) and zero-config automated schema migrations.
- Set `DATABASE_URL` in `.env` or configure live via the **Admin Cloud DB Manager** on the portal.

### 2. Multi-Decade Retrieval (10–12+ Years Ago)
- Dedicated `academic_archives` table indexed on `batch`, `admission_year`, `graduation_year`, `register_no`, and `department`.
- High-efficiency queries retrieve full transcripts, marks, credits, and degree classifications from cohorts **10, 12, or even 20+ years back** in sub-millisecond latency.
- Pre-seeded with historical cohorts from **2012–2016 (14 years ago)** and **2014–2018 (12 years ago)** for instant testing and verification.

### 3. Strict WORM (Write-Once, Read-Many) Anti-Deletion Guarantee
- **"The data stored in cloud database cannot be deleted by anyone"**:
  - Enforced by PostgreSQL triggers (`trg_protect_academic_archives`, `trg_protect_audit_ledger`) that raise a fatal database exception on any `DELETE` or `TRUNCATE` operations.
  - Operational student deactivations automatically transfer the complete academic record to the permanent archive rather than purging data.
  - Every archival action is chained into an append-only **Cryptographic SHA-256 Audit Ledger** providing tamper-evident authenticity proofs.

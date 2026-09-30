# AJV CollegeConnect — AJV College of Engineering

A modern, full-stack academic portal built with **Node.js, Express, PostgreSQL / Persistent JSON, Vanilla HTML5/CSS3/JS, Docker, and Android**.

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

---

## 🔑 Demo Accounts

| Role | Login ID | Password | Access Details |
| :--- | :--- | :--- | :--- |
| **Student** | `AJVSTU001` | `Student@123` | View grades, CGPA, attendance, download official marksheet |
| **Faculty** | `FAC001` | `Faculty@123` | Enter marks, review applicants, publish bulletins |
| **Admin** | `ADMIN001` | `Admin@123` | Full administrative control, reset student passwords |

---

## 🚀 Quick Start (Local Run)

Open the project folder in terminal:

```bash
npm install
npm start
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

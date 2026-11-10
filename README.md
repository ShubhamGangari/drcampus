# Drivion CampusERP SaaS — by Drivion Solutions Private Limited

**Drivion CampusERP SaaS** is a next-generation, high-performance Higher Education Cloud ERP engineered specifically for Indian multi-disciplinary state and private universities (Piloting at **Swami Rama Himalayan University — SRHU, Dehradun**).

Reverse-engineered from the functional blueprints of legacy market leaders like **MasterSoft ERP**, Drivion replaces 2010s-era ASP.NET clunkiness with a world-class, ultra-fast **Next.js 15 + TypeScript** single-page architecture that runs natively on Windows and deploys to the cloud in minutes.

---

## 🏛️ Constituent Schools Hierarchy (Multi-School Architecture)

Unlike standard school software, private universities comprise autonomous constituent institutes. Drivion models:
1. **Himalayan School of Science & Technology (HSST):** B.Tech CSE, AI/ML, BCA
2. **Himalayan Institute of Medical Sciences (HIMS):** MBBS, MD, Nursing, Paramedical
3. **Himalayan School of Management Studies (HSMS):** BBA, MBA
4. **Himalayan School of Biosciences (HSBS):** M.Sc Biotechnology, Microbiology

---

## 🚀 Key Modules (MasterSoft Benchmark)

### 1. Admissions & Merit Pipeline (CAP Engine)
- 5-Stage Funnel: `Applied` ➔ `Docs Verified` ➔ `Merit Listed` ➔ `Seat Frozen (Token Paid)` ➔ `Enrolled`
- State Reservation Quota (40% Uttarakhand Domicile), All-India Management, and NRI Seats
- 12th PCM % / NEET Rank / CAT %ile merit calculations

### 2. Student Information System (SIS 360°)
- Complete student dossier: Enrollment No, Roll No, School, Batch, and Academic CGPA
- Parent contacts, hostel room allocation (AC/Non-AC), and fee ledger balance

### 3. UGC 75% Attendance Engine & WhatsApp Bot
- Lecture-wise & period-wise attendance marking
- **Automated Shortage Detector:** Live computation of students falling below the mandatory UGC 75% threshold
- **WhatsApp Cloud API Bot:** 1-Click templated alert dispatched directly to parents to prevent end-term exam debarment

### 4. Fee Management & Verified Digital Receipts
- Multi-tier fee slabs: Tuition, AC/Non-AC Hostel, Mess, Exam, and Caution Deposit
- Multi-channel payment simulation (UPI, Netbanking, Cards)
- **Official Print-Ready Fee Receipt:** Includes University watermark, GST breakdown, transaction ID, barcode, and Dean's stamp

### 5. Autonomous Examination & SGPA/CGPA Engine
- Continuous Internal Assessment (CIA / 30 marks) + End-Semester Examination (ESE / 70 marks)
- **UGC 10-Point Relative Grading Scale:**
  - `O (90-100)`: 10 GP | `A+ (80-89)`: 9 GP | `A (70-79)`: 8 GP | `B+ (60-69)`: 7 GP | `B (50-59)`: 6 GP | `C (40-49)`: 5 GP | `F (<40)`: 0 GP
- Automated SGPA formula: $\text{SGPA} = \frac{\sum (C_i \times G_i)}{\sum C_i}$
- **Digital Marksheet with Verification QR Code:** Official grade-card layout with QR code verification

### 6. NAAC & NIRF Accreditation Cockpit
- IQAC institutional progress tracker across **Criteria 1 to 7**
- Current Score: **902 / 1000 Points (Projected CGPA 3.61 ➔ Grade A+ Certified)**
- Self Study Report (SSR) quantitative metrics export ready

---

## ⚡ Quick Start (Windows)

### Option 1: 1-Click Batch Launcher
Double-click [`run_saas.bat`](./run_saas.bat) in the project root. It will automatically start the server and open your browser to `http://localhost:3000`.

### Option 2: Terminal Execution
```bash
# Start development server
npm run dev

# Or run optimized production server (744ms boot time)
npm run build
npm run start
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

---

## 🛠️ Tech Stack

- **Framework:** Next.js 14/15 (App Router, Server & Client Components)
- **Language:** TypeScript 5
- **Styling:** Tailwind CSS 3
- **Icons:** Lucide React
- **Architecture:** 100% Windows Native, Cloud-ready for Vercel / AWS / Railway
- **Licensing:** Proprietary — Drivion Solutions Private Limited

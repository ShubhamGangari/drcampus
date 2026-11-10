# CampusERP — System Overview

**CampusERP** is Drivion Solutions' own advanced, multi-tenant university ERP (Next.js + TypeScript + Prisma). It covers the complete college lifecycle — from admissions to alumni — in a single system, plus all the minor day-to-day university functions (notices, events, scholarships, health, library, transport, and more).

> **Modularity rule (AGENTS.md):** one module at a time, spec first → code second → independent reviewer + tester gate before the next module begins.

---

## 1. Technology Stack (fixed)

| Layer | Choice |
|-------|--------|
| Framework | Next.js 14.2.15 (App Router), TypeScript |
| Styling | Tailwind CSS — premium, simple, light theme, full English |
| ORM | Prisma 5.22 (SQLite dev / PostgreSQL production) |
| Auth | bcrypt + JWT HttpOnly cookie (`auth_token`) |
| Tenancy | Multi-tenant via `schoolIdStorage.run(user.schoolId, …)` (AsyncLocalStorage in `src/lib/prisma.ts`) |
| Test runner | Node built-in `node:test` (via `scripts/test.cjs` using tsx); `npm test` |

---

## 2. Architecture

- **Server components** handle data access; each page is gated by role arrays in its sidebar `*Shell.tsx`.
- **Module shell pattern:** `layout.tsx` (wraps `<UniversityProvider>`) + `*Shell.tsx` + role-gated sidebar nav.
- **Pure-function core:** business rules live in `*Core.ts` files (with `ApiError` permission gates), Zod schemas in `*-schemas.ts`, and thin server-client wrappers `<module>.ts`.
- **RBAC** (`src/lib/perms.ts`): permission strings in `area.action` format with a `PERMISSION_CATALOG`. `SUPER_ADMIN` bypasses all checks. Administrators can create custom roles. Every query is tenant-scoped with `schoolId`.
- **Cross-cutting infra:** Org structure (departments/classes/staff/allocations), academic calendar & timetable, audit logs, dashboard KPIs, notifications, command palette.

---

## 3. Modules (full catalog)

### Core modules
| Module | Capabilities |
|--------|--------------|
| Admissions | Admission cycles, applications, seat allocation, quotas |
| Student lifecycle | Students, enrollments, leaves, transfers, graduations |
| Fees | Fee structures, invoices, payments, receipts |
| Examination + Result | Exams, schedules, hall tickets, marks entry, results |
| OBE | CO-PO mapping, course/program outcomes, attainment |
| NAAC / NBA / NIRF | Accreditation & ranking report builders |
| Attendance | Records, leave, reporting |
| Hostel | Rooms, allocations, mess bills, complaints |
| HR / Payroll | Employees, leave, payroll, payslips |
| Alumni | Alumni profiles & network |

### Expansion batches
| Batch | Modules | Highlights |
|-------|---------|-----------|
| **A** — Campus services | Library, Transport, Certificates, Notices/Circulars | Catalogue/circulation/fines, routes/vehicles/passes, degree certificates, notices & circulars |
| **B** — Student welfare | Scholarships, Grievance, Health/Medical, Clubs/Events | Scholarship schemes & review, grievance tracking, health visits/records, clubs & campus events |
| **C** — Academic enrichments | Course registration, Grade cards, Backlog/Revaluation, Question bank | Course catalog & registration, GPA/CGPA grade cards, backlog & revaluation, question bank & duty assignment |
| **D** — Career & alumni | Placement cell, Internships/Jobs, Alumni mentorship | Companies & job posts, internship/job listings, mentorship connections |
| **E** — Parent portal & reports & ID cards & UX polish | Parent portal, Reports center, ID cards, cross-module UX | Read-only parent dashboard + `ParentStudentLink`; export hub (fees/results/attendance/certificates/admissions) with CSV/PDF; student ID cards with QR; shared Loading/Error/Empty states + data-driven command palette |

---

## 4. Multi-tenancy & security

- Every Prisma query is scoped by `schoolId`; central users get `prismaBase` + `isCentralUser`.
- Permissions: `hasPermission`, `resolveEffectivePermissions`, `guardRole`, `PERMISSION_CATALOG`; `SUPER_ADMIN` bypass.
- Server auth: `withAuth` → `getAuthFromRequest` → `verifyToken`; HttpOnly `auth_token` cookie.
- No secrets in code; no fake/placeholder data wired into real flows; no dead buttons.

---

## 5. How to run

```bash
cd drivion-saas
npm install
npx prisma migrate deploy      # apply migrations (SQLite in dev)
npx prisma db seed             # seed roles/schools
npm run dev                    # http://localhost:3000
```

**Verification gates** (all green for the full A→E build):

```bash
npx tsc --noEmit     # type-check  → 0 errors
npx eslint           # lint         → 0 errors / 0 warnings
npm test             # tests        → 491/491 pass
npm run build        # production    → exit 0, 129 routes
```

---

## 6. Build status

| Batch | Spec | Verified |
|-------|------|----------|
| A (campus services) | `docs/specs/library.md`, `transport.md`, `certificates.md`, `notices.md` | tsc/eslint clean, tests green, build exit 0 |
| B (student welfare) | `docs/specs/scholarships.md`, `grievance.md`, `health.md`, `clubs.md` | tsc/eslint clean, tests green, build exit 0 |
| C (academic enrichments) | `docs/specs/registration.md`, `gradecard.md`, `backlog.md`, `questionbank.md` | 403/403 tests, build exit 0 |
| D (career & alumni) | `docs/specs/placement.md`, `internships.md`, `mentorship.md`, `alumni-jobs.md` | 465/465 tests, build exit 0 |
| E (parent portal & reports & ID cards & UX) | `docs/specs/parent-portal.md`, `reports-center.md`, `id-cards.md`, `ux-polish.md` | 491/491 tests, build exit 0, 129 routes |

All five batches are complete and independently verified green. Commit history is small and scoped per module (e.g. `fees: add fee-structure CRUD + tests`).

# Cross-Cutting Infrastructure — Audit Log, Notifications, Global Search, KPI Widgets

Slug: `cross-cutting-infra`
Applies to: drivion-saas (Next.js + Prisma multi-tenant ERP)

> Frozen spec (erp-module-spec format). Frontend, backend, reviewer and tester agents all
> build from this file. Anything not specified here will not be built; anything built that
> deviates from it is a bug.

---

## 1. Goal

The ERP currently lacks four platform-level capabilities that every production system needs:

1. **Audit log** — an immutable, tenant-scoped record of who changed what and when. Required
   for governance, accidental-change recovery, and accreditation/regulatory evidence.
2. **Notifications** — per-user inbox so staff/students get actionable alerts (e.g. a leave
   request pending approval, an exam result published, a zero-balance requested) without
   re-scanning every page.
3. **Global search** — one endpoint + UI to find any record (student, employee, admission
   application, program, course, alumni, academic event, exam) across the tenant from a single
   query box.
4. **KPI dashboard widgets** — a read-only snapshot of the school's health (students, fees
   collected, dues, attendance, upcoming exams, faculty) for the admin/leadership home screen.

Success = all four are real, DB-backed, tenant-scoped, and verifiable by the tester without
any mock or placeholder data. Every read endpoint returns loading/empty/error states; every
calculation is a pure, tested function.

---

## 2. Users & permissions

Base roles (from `src/lib/perms.ts`): FACULTY, FINANCE_OFFICER, EXAM_CONTROLLER, DEAN,
STUDENT, REGISTRAR_ADMIN.

| Capability | Who can access |
|---|---|
| View audit log | Only REGISTRAR_ADMIN (new permission `audit.view`). Fallback only. |
| Read own notifications | Any authenticated user (scoped to `recipientUserId` = current user). No new permission. |
| Mark notifications read | Any authenticated user (own notifications only). |
| Global search | Any authenticated user; result *types* respect existing view permissions (e.g. STUDENT cannot see employee payroll records — search only surfaces entities their role may view). |
| KPI dashboard | New permission `dashboard.kpi`. Granted to REGISTRAR_ADMIN, DEAN, FINANCE_OFFICER (fallback). |

New `Permission` values added to `src/lib/perms.ts`:
- `"audit.view"` → ROLE_FALLBACK[REGISTRAR_ADMIN].
- `"dashboard.kpi"` → ROLE_FALLBACK[REGISTRAR_ADMIN], ROLE_FALLBACK[DEAN], ROLE_FALLBACK[FINANCE_OFFICER].

No position-specific grants are added.

---

## 3. Screens (frontend)

### 3.1 Audit log — Admin only
- **Route**: `/audit` (added to sidebar for REGISTRAR_ADMIN only).
- **What shows**: table columns `Timestamp` | `Actor` (name + role) | `Action` | `Entity` (type + identifier) | `Summary`. Plus a filter bar: entity type dropdown, free-text search over action/summary, and a "load more" pagination button (cursor-based, 25 rows per page).
- **States**: loading = skeleton rows; empty = "No audit events recorded yet."; error = inline banner with retry.

### 3.2 Notifications bell
- **Where**: `Header` component (top-right). Bell icon with an unread count badge.
- **Interaction**: click opens a dropdown panel listing latest 20 notifications (title, body, relative time, unread dot). Unread items highlight; clicking an item marks it read (and optionally navigates to its `link` if present). A "Mark all read" action at panel top.
- **States**: loading = spinner in panel; empty = "No notifications."; error = banner with retry.

### 3.3 Global search
- **Where**: extends the existing `GlobalCommandPalette` (opens with Ctrl/Cmd+K) plus a search input on the home page for admin roles.
- **Behaviour**: as-you-type ≥2 chars hits `GET /api/search?q=`. Results render grouped by type (Students, Staff, Admission Applications, Programs, Courses, Alumni, Academic Events, Exams). Each row shows a human label and an `href` when the route exists; clicking navigates.
- **States**: loading = spinner; empty = "No results for '…'."; error = banner.
- **Permission gating**: API filters each group by the caller's role/position using existing view permissions; the palette simply renders whatever the API returns.

### 3.4 KPI widgets (admin/leadership home)
- **Where**: top of `/` for roles holding `dashboard.kpi` (a `KpiStrip` component above the existing workspace).
- **Cards** (each = value + label + optional subtle delta/subtext):
  1. **Active Students** — count of `Student` with status ACTIVE.
  2. **Pending Admission Applications** — count of `Application` with status ≠ CONFIRMED/REJECTED.
  3. **Fees Collected (this academic year)** — sum of `Payment` where invoice academicYear = current.
  4. **Outstanding Dues** — count of students with `feeDues > 0`.
  5. **Attendance Today** — % present across `AttendanceRecord` for today (pure calc).
  6. **Upcoming Exams** — count of `ExamSchedule` in the next 14 days.
  7. **Faculty** — count of `Employee` (or Users with role FACULTY).
  8. **Avg CO Attainment** — mean `COAttainment.attainment` for the current academic year.
- **States**: loading = skeleton cards; error = banner; each card hides gracefully when the underlying data is empty (shows 0 / "—" where relevant).

---

## 4. API contract (FREEZE)

All endpoints are tenant-scoped via `withAuth` → `withClient(user, …)` (AsyncLocalStorage
`schoolIdStorage`). Errors use the shared `{ error: { code, message } }` shape; auth failure
is `401 UNAUTHORIZED`, permission denial `403 FORBIDDEN`.

### 4.1 Audit log

**`GET /api/audit-logs`**
- Query: `entityType?`, `entityId?`, `actorId?`, `q?` (matches action/summary, case-insensitive), `cursor?` (opaque `id` for pagination), `limit?` (default 25, max 100).
- Success `200`:
  ```json
  {
    "logs": [{ "id": "…", "actorId": "…", "actorName": "…", "actorRole": "…",
                "action": "STUDENT_CREATED", "entityType": "STUDENT", "entityId": "…",
                "summary": "Created student R2025001", "metadata": null, "createdAt": "ISO" }],
    "nextCursor": "…" | null
  }
  ```
- Errors: `403 FORBIDDEN` if caller lacks `audit.view`; `400 INVALID_LIMIT` if limit not in 1..100.
- Permissions: `audit.view`.

### 4.2 Notifications

**`GET /api/notifications`**
- Query: `unreadOnly?` (true/false), `cursor?`, `limit?` (default 20, max 50).
- Success `200`:
  ```json
  { "notifications": [{ "id": "…", "type": "LEAVE_RECEIVED", "title": "…", "body": "…",
                        "link": "/students/leaves" | null, "read": false, "createdAt": "ISO" }],
    "nextCursor": "…" | null }
  ```
- Scoped to caller (recipientUserId = user.id). No special permission.

**`GET /api/notifications/unread-count`**
- Success `200`: `{ "count": 3 }`.

**`POST /api/notifications/[id]/read`**
- Success `200`: `{ "read": true }`.
- Errors: `404 NOT_FOUND` if id not owned by caller (never leaks other users' ids).

**`POST /api/notifications/read-all`**
- Success `200`: `{ "updated": 5 }`.

**`POST /api/notifications/send`** (internal/system, ADMIN only — used by seed + system jobs)
- Body: `{ recipientUserId, type, title, body?, link? }`.
- Success `201`: `{ "id": "…" }`.
- Permissions: `audit.view` (reuse admin-only gate) — or a dedicated admin check; implementer may use `hasPermission(role, position, 'audit.view')`.

### 4.3 Global search

**`GET /api/search?q=…`**
- Query: `q` (min 2 chars).
- Success `200`:
  ```json
  {
    "results": {
      "students":   [{ "id": "…", "label": "R2025001 · Aarav Sharma", "href": "/students/…" }],
      "staff":      [{ "id": "…", "label": "EMP-001 · Dr Mehta", "href": "/hr/employees" }],
      "applications":[{ "id": "…", "label": "APP-000123 · Priya R", "href": "/admissions/applications" }],
      "programs":   [{ "id": "…", "label": "B.Tech CSE", "href": null }],
      "courses":    [{ "id": "…", "label": "CS101 Data Structures", "href": null }],
      "alumni":     [{ "id": "…", "label": "Sara K · 2024", "href": "/alumni/directory" }],
      "events":     [{ "id": "…", "label": "Diwali Holiday", "href": "/academic/calendar" }],
      "exams":      [{ "id": "…", "label": "End-Sem Dec 2026", "href": "/exams/schedules" }]
    }
  }
  ```
- `q < 2` → `400 QUERY_TOO_SHORT`. Empty/no match → all arrays empty.
- Each result array is gated by the caller's view permission for that entity:
  - students/staff: `"org.view"` (or `attendance.view_all`/`results.view`).
  - applications: `"admissions.manage"`.
  - programs/courses/events/exams: `"org.view"`/`"calendar.view"`/`"results.view"`.
  - alumni: `"org.view"`.
- Limit each group to 10 results; search is `contains` over name/code/rollNo/applicationNo/email.

### 4.4 KPI dashboard

**`GET /api/dashboard/kpis`**
- Success `200`:
  ```json
  {
    "activeStudents": 5,
    "pendingApplications": 2,
    "feesCollected": 120000,
    "outstandingDues": 1,
    "attendanceTodayPercent": 92.5,
    "upcomingExams": 3,
    "facultyCount": 4,
    "avgCoAttainment": 3.4
  }
  ```
- Errors: `403 FORBIDDEN` if caller lacks `dashboard.kpi`.
- Business rules (pure, tested): attendance % = present / (present+absent+OD) × 100 rounded to 1 decimal; avg CO attainment = mean of `attainment` for current academic year rounded to 2 decimals; dues = count of students with `feeDues > 0`.

---

## 5. Database changes (new models appended to `prisma/schema.prisma`)

All carry `schoolId` (tenant) and are captured by a new migration `0002_cross_cutting`.

### `AuditLog`
- `id String @id @default(cuid())`
- `schoolId String`
- `actorId String` (User.id)
- `action String` (e.g. `STUDENT_CREATED`, `PAYMENT_RECORDED`, `EXAM_PUBLISHED`)
- `entityType String` (e.g. `STUDENT`, `PAYMENT`, `EXAM`)
- `entityId String`
- `summary String`
- `metadata String?` (JSON string; optional extra context)
- `createdAt DateTime @default(now())`
- `@@index([schoolId, createdAt])`, `@@index([schoolId, entityType, entityId])`, `@@index([schoolId, actorId])`

### `Notification`
- `id String @id @default(cuid())`
- `schoolId String`
- `recipientUserId String`
- `type String` (e.g. `LEAVE_RECEIVED`, `RESULT_PUBLISHED`, `FEE_RECEIPT`)
- `title String`
- `body String?`
- `link String?`
- `read Boolean @default(false)`
- `createdAt DateTime @default(now())`
- `@@index([schoolId, recipientUserId, read])`, `@@index([schoolId, recipientUserId, createdAt])`

(No new relation fields are required on existing models; these tables reference users/entities by id string only, keeping the change additive and low-risk.)

---

## 6. Business rules

1. **Audit immutability**: audit rows are write-only via the API; no update/delete endpoint exists. Only `GET` is exposed.
2. **Audit capture**: the `writeAuditLog` helper is called from these mutation routes (documented set): students `POST` create, `PATCH` update, enroll, graduate, leave/transfer review; fees `POST` payment; exams `POST` publish/unpublish; attendance `POST` mark (batch summary row). Every write records actor (from token), action, entity type/id, and a short human summary.
3. **Notification ownership**: a user may only read/mark their own notifications. `recipientUserId` always equals `user.id`; mismatch → `404`.
4. **Search permission gating**: the search endpoint never leaks entities the role can't view (see §4.3). It is deny-by-default per group.
5. **KPI calculations** are pure functions in a core file, unit-tested (attendance % rounding, mean attainment rounding, dues counting).
6. **Pagination** is cursor-based (`nextCursor` = last row id); `limit` clamped.

---

## 7. Acceptance criteria (tester)

1. `GET /api/audit-logs` as REGISTRAR_ADMIN returns logs; as a FACULTY/STUDENT user returns `403 FORBIDDEN`.
2. Creating a student via `POST /api/students` writes an audit row; the same change appears in `GET /api/audit-logs` (actor = the user who created it).
3. `GET /api/notifications` returns only the caller's rows; requesting another user's notification read returns `404`.
4. `POST /api/notifications/[id]/read` flips `read` to true; `unread-count` decrements accordingly; `read-all` clears all.
5. `GET /api/search?q=raj` returns students whose name/rollNo contains "raj"; a STUDENT caller gets no `staff` results (gating).
6. `GET /api/search?q=x` (1 char) → `400 QUERY_TOO_SHORT`.
7. `GET /api/dashboard/kpis` as DEAN/FINANCE_OFFICER/REGISTRAR_ADMIN returns all eight fields; as STUDENT returns `403 FORBIDDEN`.
8. Attendance % KPI = present/(present+absent+OD)×100 rounded to 1 decimal; avg attainment = mean rounded to 2 decimals (unit tests).
9. All new UI screens show loading, empty, and error states (tested via component/interaction checks).
10. `npm run build`, `npx tsc --noEmit`, and lint all pass; new unit tests for audit/search/KPI/search helpers are green.

// ==============================================================================
// Academic Governance & Organizational Structure module (Deep Core) — typed
// frontend API client. Mirrors the FROZEN contract for the `/api/departments`,
// `/api/classes`, `/api/allocations`, `/api/staff` and `/api/users` endpoints
// (docs/specs/org-structure.md §4). All auth-bearing calls rely on the HttpOnly
// `auth_token` cookie set by the portal login route, so `fetch` here is
// same-origin without manual headers.
//
// Note: `src/lib/org.ts` is the backend's pure-logic unit (server-only), so this
// browser-safe client helper lives in `org-client.ts` to avoid the collision.
//
// FROZEN SHAPES (do not deviate):
//  1. `GET /api/departments?schoolId=`  → `200 { items: DepartmentListItem[] }`
//  2. `POST /api/departments`           → `201 { id, schoolId, name, code, headUserId, createdAt }`
//  3. `GET /api/departments/[id]`       → `200 DepartmentDetail`
//  4. `PATCH /api/departments/[id]`     → `200 { id, schoolId, name, code, headUserId }`
//  5. `DELETE /api/departments/[id]`    → `204` | `409 DEPT_NOT_EMPTY`
//  6. `PUT /api/departments/[id]/head`  → body `{ headUserId }` → `200 { id, headUserId }` | `400 NOT_HOD`
//  7. `PUT /api/users/[id]/department`   → body `{ departmentId, position? }` → `200` | `400 INVALID_POSITION`
//  8. `GET /api/staff?schoolId=&departmentId=&role=&position=` → `200 StaffMember[]`
//  9. `PUT /api/users/[id]/position`     → body `{ position }` → `200` | `400 INVALID_POSITION`
// 10. `PUT /api/programs/[id]/coordinator` → body `{ coordinatorUserId }` → `200 { id, coordinatorUserId }`
// 11. `POST /api/classes`                → `201 { id, programId, batchId, section, coordinatorUserId }`
// 12. `GET /api/classes?schoolId=&programId=&batchId=` → `200 ClassGroup[]`
// 13. `PUT /api/classes/[id]/coordinator` → body `{ coordinatorUserId }` → `200 { id, coordinatorUserId }`
// 14. `DELETE /api/classes/[id]`         → `204` | `409 CLASS_HAS_ALLOCATIONS`
// 15. `POST /api/allocations`            → `201 { id, ... }` | `409 ALLOCATION_EXISTS`
// 16. `GET /api/allocations?departmentId=&classGroupId=&facultyUserId=&schoolId=` → `200 Allocation[]`
// 17. `DELETE /api/allocations/[id]`     → `204`
// ==============================================================================

import type { UserRole } from "@/types";

// ---- Types (shapes the backend returns) --------------------------------------

/** Shape of a department head reference embedded in department payloads. */
export interface DepartmentHead {
  id: string;
  name: string;
}

/** Row shape returned by `GET /api/departments`. */
export interface DepartmentListItem {
  id: string;
  schoolId: string;
  name: string;
  code: string;
  head: DepartmentHead | null;
  memberCount: number;
  staff?: StaffMember[];
}

/** Full shape returned by `GET /api/departments/[id]`. */
export interface DepartmentDetail {
  id: string;
  schoolId: string;
  name: string;
  code: string;
  head: DepartmentHead | null;
  staff: StaffMember[];
}

/** Row shape returned by `GET /api/staff`. */
export interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  position: string | null;
  schoolId: string;
  departmentId: string | null;
  departmentName: string | null;
}

/** Row shape returned by `GET /api/classes`. */
export interface ClassGroup {
  id: string;
  programId: string;
  batchId: string;
  section: string;
  coordinatorUserId: string | null;
  schoolId?: string;
  programName?: string;
  batchName?: string;
  coordinatorName?: string | null;
}

/** Row shape returned by `GET /api/allocations`. */
export interface Allocation {
  id: string;
  courseId: string;
  classGroupId: string;
  facultyUserId: string;
  semester: number;
  academicYear: string;
  departmentId: string | null;
  schoolId?: string;
  courseCode?: string;
  courseTitle?: string;
  facultyName?: string;
  classLabel?: string;
  departmentName?: string | null;
}

// ---- Request bodies ----------------------------------------------------------

/** Body for `POST /api/departments`. `schoolId` required only for Central officers. */
export interface CreateDepartmentInput {
  schoolId?: string;
  name: string;
  code: string;
}

/** Body for `PATCH /api/departments/[id]`. */
export interface UpdateDepartmentInput {
  name?: string;
  code?: string;
}

/** Body for `PUT /api/departments/[id]/head`. Pass null to unassign the HOD. */
export type SetDepartmentHeadInput = { headUserId: string | null };

/** Body for `PUT /api/users/[id]/department`. Position optional on assignment. */
export interface AssignUserDepartmentInput {
  departmentId: string;
  position?: string;
}

/** Body for `PUT /api/users/[id]/position`. */
export interface SetUserPositionInput {
  position: string;
}

/** Body for `POST /api/classes`. */
export interface CreateClassInput {
  schoolId?: string;
  programId: string;
  batchId: string;
  section: string;
}

/** Body for `POST /api/allocations`. */
export interface CreateAllocationInput {
  schoolId?: string;
  courseId: string;
  classGroupId: string;
  facultyUserId: string;
  semester: number;
  academicYear: string;
  departmentId?: string;
}

// ---- Form option constants ---------------------------------------------------

/** Positions allowed by the org module (spec §2). */
export const POSITION_OPTIONS = [
  { value: "HOD", label: "Head of Department (HOD)" },
  { value: "PROGRAM_COORDINATOR", label: "Program Coordinator" },
  { value: "CLASS_COORDINATOR", label: "Class Coordinator" },
  { value: "DEPARTMENT_SECRETARY", label: "Department Secretary" },
  { value: "SUBJECT_TEACHER", label: "Subject Teacher" },
  { value: "EXAM_CELL_CLERK", label: "Exam Cell Clerk" },
  { value: "HOSTEL_ADMIN", label: "Hostel Admin" },
  { value: "ADMISSIONS_OFFICER", label: "Admissions Officer" },
] as const;

/** Semesters offered in the allocation form. */
export const SEMESTER_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8];

// ---- Role helpers (spec §2) --------------------------------------------------

/** Staff roles that can view the Organization module (org.view). */
const ORG_VIEW_ROLES: UserRole[] = [
  "SUPER_ADMIN",
  "REGISTRAR_ADMIN",
  "DEAN",
  "FINANCE_OFFICER",
  "EXAM_CONTROLLER",
  "FACULTY",
];

/** Roles that can manage departments & set heads (org.manage). */
const DEPT_MANAGER_ROLES: UserRole[] = ["SUPER_ADMIN", "REGISTRAR_ADMIN"];

/** Roles that can assign staff to departments/positions (org.assign_staff). */
const STAFF_ASSIGNER_ROLES: UserRole[] = ["SUPER_ADMIN", "REGISTRAR_ADMIN"];

/** Positions that can allocate courses (org.allocate_course). */
const COURSE_ALLOCATOR_POSITIONS = ["HOD", "PROGRAM_COORDINATOR"];

/** Roles that can manage class groups & set coordinators (org.manage_classes). */
const CLASS_MANAGER_ROLES: UserRole[] = ["SUPER_ADMIN", "REGISTRAR_ADMIN"];

/** Can the role open the Organization module at all? */
export function canAccessOrg(role?: UserRole): boolean {
  return !!role && ORG_VIEW_ROLES.includes(role);
}

/** Can the user manage departments / set a department head? (Registrar/Admin or dept secretary) */
export function canManageDepartments(user: { role?: UserRole; position?: string } | null): boolean {
  if (!user?.role) return false;
  if (DEPT_MANAGER_ROLES.includes(user.role)) return true;
  return user.position === "DEPARTMENT_SECRETARY";
}

/** Can the user assign staff to a department / change their position? (Registrar/Admin) */
export function canAssignStaff(role?: UserRole): boolean {
  return !!role && STAFF_ASSIGNER_ROLES.includes(role);
}

/** Can the user create/delete course–faculty allocations? (HOD/Program Coordinator/Registrar) */
export function canAllocateCourses(user: { role?: UserRole; position?: string } | null): boolean {
  if (!user?.role) return false;
  if (user.role === "REGISTRAR_ADMIN") return true;
  return !!user.position && COURSE_ALLOCATOR_POSITIONS.includes(user.position);
}

/** Can the user create class groups / set class coordinators? (Registrar/Admin or HOD) */
export function canManageClasses(user: { role?: UserRole; position?: string } | null): boolean {
  if (!user?.role) return false;
  if (CLASS_MANAGER_ROLES.includes(user.role)) return true;
  return user.position === "HOD";
}

/** Human label for a position key (fallback to raw key). */
export function positionLabel(position: string | null | undefined): string {
  if (!position) return "—";
  const found = POSITION_OPTIONS.find((p) => p.value === position);
  return found ? found.label : position;
}

/** Human label for a base role. */
export function roleLabel(role: UserRole | string): string {
  switch (role) {
    case "REGISTRAR_ADMIN":
      return "Registrar Admin";
    case "DEAN":
      return "Dean";
    case "FINANCE_OFFICER":
      return "Finance Officer";
    case "EXAM_CONTROLLER":
      return "Exam Controller";
    case "FACULTY":
      return "Faculty";
    case "STUDENT":
      return "Student";
    default:
      return role;
  }
}

// ---- Error contract ----------------------------------------------------------

export interface ApiErrorBody {
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
}

export class OrgApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;
  constructor(status: number, message: string, code?: string, details?: unknown) {
    super(message);
    this.name = "OrgApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function parseError(res: Response): Promise<OrgApiError> {
  let message = `Request failed with status ${res.status}`;
  let code: string | undefined;
  let details: unknown;
  try {
    const body = (await res.json()) as ApiErrorBody;
    if (body?.error?.message) message = body.error.message;
    code = body?.error?.code;
    details = body?.error?.details;
  } catch {
    /* non-JSON error body */
  }
  return new OrgApiError(res.status, message, code, details);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    throw await parseError(res);
  }
  if (res.status === 204) {
    return undefined as T;
  }
  return (await res.json()) as T;
}

// ---- Departments --------------------------------------------------------------

/** `GET /api/departments?schoolId=` → departments list. */
export function fetchDepartments(filters: { schoolId?: string } = {}): Promise<{ items: DepartmentListItem[] }> {
  const p = new URLSearchParams();
  if (filters.schoolId) p.set("schoolId", filters.schoolId);
  const qs = p.toString();
  return request(`/api/departments${qs ? `?${qs}` : ""}`);
}

/** `GET /api/departments/[id]` → department detail with staff + head. */
export function fetchDepartment(id: string): Promise<DepartmentDetail> {
  return request(`/api/departments/${encodeURIComponent(id)}`);
}

/** `POST /api/departments` → 201 created department (409 on duplicate code). */
export function createDepartment(input: CreateDepartmentInput): Promise<DepartmentListItem> {
  return request("/api/departments", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** `PATCH /api/departments/[id]` → updated department. */
export function updateDepartment(id: string, input: UpdateDepartmentInput): Promise<DepartmentListItem> {
  return request(`/api/departments/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

/** `DELETE /api/departments/[id]` → 204 (409 DEPT_NOT_EMPTY). */
export function deleteDepartment(id: string): Promise<void> {
  return request(`/api/departments/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

/** `PUT /api/departments/[id]/head` → assign or clear the HOD (400 NOT_HOD). */
export function setDepartmentHead(
  id: string,
  input: SetDepartmentHeadInput
): Promise<{ id: string; headUserId: string | null }> {
  return request(`/api/departments/${encodeURIComponent(id)}/head`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

// ---- Staff assignment --------------------------------------------------------

/** `PUT /api/users/[id]/department` → assign a user to a department (with optional position). */
export function assignUserDepartment(
  userId: string,
  input: AssignUserDepartmentInput
): Promise<{ id: string }> {
  return request(`/api/users/${encodeURIComponent(userId)}/department`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

/** `PUT /api/users/[id]/position` → set a user's position (400 INVALID_POSITION). */
export function setUserPosition(userId: string, input: SetUserPositionInput): Promise<{ id: string }> {
  return request(`/api/users/${encodeURIComponent(userId)}/position`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

/** `GET /api/staff` → staff directory, optionally filtered. */
export function fetchStaff(
  filters: { schoolId?: string; departmentId?: string; role?: string; position?: string } = {}
): Promise<StaffMember[]> {
  const p = new URLSearchParams();
  if (filters.schoolId) p.set("schoolId", filters.schoolId);
  if (filters.departmentId) p.set("departmentId", filters.departmentId);
  if (filters.role) p.set("role", filters.role);
  if (filters.position) p.set("position", filters.position);
  const qs = p.toString();
  return request(`/api/staff${qs ? `?${qs}` : ""}`);
}

/** `PUT /api/programs/[id]/coordinator` → assign a program coordinator. */
export function setProgramCoordinator(
  programId: string,
  coordinatorUserId: string
): Promise<{ id: string; coordinatorUserId: string }> {
  return request(`/api/programs/${encodeURIComponent(programId)}/coordinator`, {
    method: "PUT",
    body: JSON.stringify({ coordinatorUserId }),
  });
}

// ---- Class groups ------------------------------------------------------------

/** `GET /api/classes` → class groups with program/batch/coordinator names. */
export function fetchClasses(
  filters: { schoolId?: string; programId?: string; batchId?: string } = {}
): Promise<ClassGroup[]> {
  const p = new URLSearchParams();
  if (filters.schoolId) p.set("schoolId", filters.schoolId);
  if (filters.programId) p.set("programId", filters.programId);
  if (filters.batchId) p.set("batchId", filters.batchId);
  const qs = p.toString();
  return request(`/api/classes${qs ? `?${qs}` : ""}`);
}

/** `POST /api/classes` → create a class group (unique program+batch+section). */
export function createClass(input: CreateClassInput): Promise<ClassGroup> {
  return request("/api/classes", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** `PUT /api/classes/[id]/coordinator` → assign a class coordinator. */
export function setClassCoordinator(
  id: string,
  coordinatorUserId: string
): Promise<{ id: string; coordinatorUserId: string }> {
  return request(`/api/classes/${encodeURIComponent(id)}/coordinator`, {
    method: "PUT",
    body: JSON.stringify({ coordinatorUserId }),
  });
}

/** `DELETE /api/classes/[id]` → 204 (409 CLASS_HAS_ALLOCATIONS). */
export function deleteClass(id: string): Promise<void> {
  return request(`/api/classes/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

// ---- Course–faculty allocations ----------------------------------------------

/** `GET /api/allocations` → allocations, optionally filtered. */
export function fetchAllocations(
  filters: {
    schoolId?: string;
    departmentId?: string;
    classGroupId?: string;
    facultyUserId?: string;
  } = {}
): Promise<Allocation[]> {
  const p = new URLSearchParams();
  if (filters.schoolId) p.set("schoolId", filters.schoolId);
  if (filters.departmentId) p.set("departmentId", filters.departmentId);
  if (filters.classGroupId) p.set("classGroupId", filters.classGroupId);
  if (filters.facultyUserId) p.set("facultyUserId", filters.facultyUserId);
  const qs = p.toString();
  return request(`/api/allocations${qs ? `?${qs}` : ""}`);
}

/** `POST /api/allocations` → 201 created allocation (409 ALLOCATION_EXISTS on duplicate). */
export function createAllocation(input: CreateAllocationInput): Promise<Allocation> {
  return request("/api/allocations", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** `DELETE /api/allocations/[id]` → 204. */
export function deleteAllocation(id: string): Promise<void> {
  return request(`/api/allocations/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

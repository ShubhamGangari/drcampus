// ==============================================================================
// Central RBAC permission matrix (Module-phase: RBAC expansion).
// Ground truth for "who can do what" across the whole ERP. Frontend and backend
// both consult this so gating is consistent. Mirrors docs/specs/rbac-expansion.md.
//
// Base roles drive tenant scoping; `position` is a finer sub-role. Unknown
// positions fall back to the base-role default; denied by default otherwise.
// ==============================================================================

export type UserRole =
  | "FACULTY"
  | "FINANCE_OFFICER"
  | "EXAM_CONTROLLER"
  | "DEAN"
  | "STUDENT"
  | "REGISTRAR_ADMIN"
  | "SUPER_ADMIN"
  | "PARENT";

export type Position =
  | "SUBJECT_TEACHER"
  | "CLASS_COORDINATOR"
  | "HOD"
  | "EXAM_CELL_CLERK"
  | "HOSTEL_ADMIN"
  | "ADMISSIONS_OFFICER"
  | "PROGRAM_COORDINATOR"
  | "DEPARTMENT_SECRETARY";

export type Permission =
  | "attendance.mark"
  | "attendance.view_all"
  | "marks.enter_draft"
  | "marks.approve"
  | "marks.publish"
  | "results.view"
  | "obe.edit"
  | "obe.view_reports"
  | "hostel.manage"
  | "fees.view"
  | "fees.manage"
  | "admissions.manage"
  | "payroll.manage"
  | "payroll.approve"
  | "report.view"
  | "org.manage"
  | "org.view"
  | "org.assign_staff"
  | "org.allocate_course"
  | "org.manage_classes"
  | "calendar.view"
  | "calendar.manage"
  | "timetable.view"
  | "timetable.manage"
  | "audit.view"
  | "dashboard.kpi"
  | "library.manage"
  | "library.view"
  | "transport.manage"
  | "transport.view"
  | "certificates.manage"
  | "certificates.view"
  | "notices.manage"
  | "notices.view"
  | "grievance.manage"
  | "grievance.view"
  | "scholarships.manage"
  | "scholarships.view"
  | "health.manage"
  | "health.view"
  | "clubs.manage"
  | "clubs.view"
  | "registration.manage"
  | "registration.view"
  | "gradecard.manage"
  | "gradecard.view"
  | "backlog.manage"
  | "backlog.view"
  | "questionbank.manage"
  | "questionbank.view"
  | "placement.manage"
  | "placement.view"
  | "placement.apply"
  | "internship.manage"
  | "internship.view"
  | "internship.apply"
  | "alumniJobs.manage"
  | "alumniJobs.view"
  | "alumniJobs.post"
  | "mentorship.manage"
  | "mentorship.view"
  | "mentorship.join"
  | "parent.view"
  | "parent.manage"
  | "reports.view"
  | "reports.manage"
  | "idcards.view"
  | "idcards.manage"
  | "dean.dashboard"
  | "faculty.presence_manage"
  | "faculty.presence_view"
  | "messages.send";

// -----------------------------------------------------------------------------
// Grouped permission catalog (single source of truth for the Admin Console UI
// and server-side validation of custom-role permissions).
// -----------------------------------------------------------------------------

export interface CatalogPermission {
  key: Permission;
  label: string;
}

export interface CatalogArea {
  name: string;
  permissions: CatalogPermission[];
}

export const PERMISSION_CATALOG: CatalogArea[] = [
  {
    name: "Attendance",
    permissions: [
      { key: "attendance.mark", label: "Mark attendance" },
      { key: "attendance.view_all", label: "View all attendance" },
    ],
  },
  {
    name: "Marks",
    permissions: [
      { key: "marks.enter_draft", label: "Enter draft marks" },
      { key: "marks.approve", label: "Approve marks" },
      { key: "marks.publish", label: "Publish marks" },
    ],
  },
  {
    name: "Results",
    permissions: [{ key: "results.view", label: "View results" }],
  },
  {
    name: "OBE",
    permissions: [
      { key: "obe.edit", label: "Edit OBE mappings" },
      { key: "obe.view_reports", label: "View OBE reports" },
    ],
  },
  {
    name: "Hostel",
    permissions: [{ key: "hostel.manage", label: "Manage hostel" }],
  },
  {
    name: "Fees",
    permissions: [
      { key: "fees.view", label: "View fee records (invoices/payments)" },
      { key: "fees.manage", label: "Manage fee structures, dues & payments" },
    ],
  },
  {
    name: "Admissions",
    permissions: [{ key: "admissions.manage", label: "Manage admissions" }],
  },
  {
    name: "Payroll",
    permissions: [
      { key: "payroll.manage", label: "Manage payroll" },
      { key: "payroll.approve", label: "Approve payroll" },
    ],
  },
  {
    name: "Reports",
    permissions: [{ key: "report.view", label: "View reports" }],
  },
  {
    name: "Org",
    permissions: [
      { key: "org.manage", label: "Manage organization" },
      { key: "org.view", label: "View organization" },
      { key: "org.assign_staff", label: "Assign staff" },
      { key: "org.allocate_course", label: "Allocate courses" },
      { key: "org.manage_classes", label: "Manage classes" },
    ],
  },
  {
    name: "Calendar",
    permissions: [
      { key: "calendar.view", label: "View calendar" },
      { key: "calendar.manage", label: "Manage calendar" },
    ],
  },
  {
    name: "Timetable",
    permissions: [
      { key: "timetable.view", label: "View timetable" },
      { key: "timetable.manage", label: "Manage timetable" },
    ],
  },
  {
    name: "Audit",
    permissions: [{ key: "audit.view", label: "View audit logs" }],
  },
  {
    name: "Dashboard",
    permissions: [{ key: "dashboard.kpi", label: "View KPI dashboard" }],
  },
  {
    name: "Library",
    permissions: [
      { key: "library.manage", label: "Manage library" },
      { key: "library.view", label: "View library" },
    ],
  },
  {
    name: "Transport",
    permissions: [
      { key: "transport.manage", label: "Manage transport" },
      { key: "transport.view", label: "View transport" },
    ],
  },
  {
    name: "Certificates",
    permissions: [
      { key: "certificates.manage", label: "Manage certificates" },
      { key: "certificates.view", label: "View certificates" },
    ],
  },
  {
    name: "Notices",
    permissions: [
      { key: "notices.manage", label: "Manage notices" },
      { key: "notices.view", label: "View notices" },
    ],
  },
  {
    name: "Grievance",
    permissions: [
      { key: "grievance.manage", label: "Manage grievance" },
      { key: "grievance.view", label: "View grievance" },
    ],
  },
  {
    name: "Scholarships",
    permissions: [
      { key: "scholarships.manage", label: "Manage scholarships" },
      { key: "scholarships.view", label: "View scholarships" },
    ],
  },
  {
    name: "Health",
    permissions: [
      { key: "health.manage", label: "Manage health" },
      { key: "health.view", label: "View health" },
    ],
  },
  {
    name: "Clubs",
    permissions: [
      { key: "clubs.manage", label: "Manage clubs" },
      { key: "clubs.view", label: "View clubs" },
    ],
  },
  {
    name: "Course & Semester Registration",
    permissions: [
      { key: "registration.manage", label: "Manage course registration" },
      { key: "registration.view", label: "View course registration" },
    ],
  },
  {
    name: "Grade Cards & Transcripts",
    permissions: [
      { key: "gradecard.manage", label: "Manage grade cards" },
      { key: "gradecard.view", label: "View grade cards" },
    ],
  },
  {
    name: "Backlog & Revaluation",
    permissions: [
      { key: "backlog.manage", label: "Manage backlog & revaluation" },
      { key: "backlog.view", label: "View backlog & revaluation" },
    ],
  },
  {
    name: "Question Bank & Exam Duty",
    permissions: [
      { key: "questionbank.manage", label: "Manage question bank & duty" },
      { key: "questionbank.view", label: "View question bank & duty" },
    ],
  },
  {
    name: "Placement",
    permissions: [
      { key: "placement.manage", label: "Manage placement cell" },
      { key: "placement.view", label: "View placement outcomes" },
      { key: "placement.apply", label: "Apply to placement posts" },
    ],
  },
  {
    name: "Internships",
    permissions: [
      { key: "internship.manage", label: "Manage internships" },
      { key: "internship.view", label: "View internship records" },
      { key: "internship.apply", label: "Apply to internships" },
    ],
  },
  {
    name: "Alumni Jobs Board",
    permissions: [
      { key: "alumniJobs.manage", label: "Moderate alumni jobs" },
      { key: "alumniJobs.view", label: "View alumni jobs board" },
      { key: "alumniJobs.post", label: "Post alumni jobs" },
    ],
  },
  {
    name: "Mentorship",
    permissions: [
      { key: "mentorship.manage", label: "Manage mentorship" },
      { key: "mentorship.view", label: "View mentorship data" },
      { key: "mentorship.join", label: "Join mentorship program" },
    ],
  },
  {
    name: "Parent Portal",
    permissions: [
      { key: "parent.view", label: "View linked student data" },
      { key: "parent.manage", label: "Manage parent links" },
    ],
  },
  {
    name: "Reports Center",
    permissions: [
      { key: "reports.view", label: "View & export reports" },
      { key: "reports.manage", label: "Manage saved reports" },
    ],
  },
  {
    name: "ID Cards",
    permissions: [
      { key: "idcards.view", label: "View ID cards" },
      { key: "idcards.manage", label: "Generate & revoke ID cards" },
    ],
  },
  {
    name: "Governance",
    permissions: [
      { key: "dean.dashboard", label: "View dean oversight dashboard" },
      { key: "faculty.presence_manage", label: "Mark faculty daily presence" },
      { key: "faculty.presence_view", label: "View faculty presence" },
      { key: "messages.send", label: "Message faculty/staff" },
    ],
  },
];

/** Flat set of every valid catalog permission string (for server-side validation). */
export const ALL_PERMISSIONS: ReadonlySet<string> = new Set(
  PERMISSION_CATALOG.flatMap((area) => area.permissions.map((p) => p.key))
);

export function isPermission(value: string): value is Permission {
  return ALL_PERMISSIONS.has(value);
}

/**
 * Deserialize a stored JSON array of permission strings into a valid catalog
 * subset (SQLite has no primitive-list columns, so `Role.permissionsJson` holds
 * the array as a JSON string).
 */
export function parseRolePermissions(json: string | null | undefined): Permission[] {
  if (!json) return [];
  try {
    const parsed: unknown = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.filter(isPermission) : [];
  } catch {
    return [];
  }
}

/** Serialize a catalog permission array to the JSON string stored on `Role.permissionsJson`. */
export function serializeRolePermissions(permissions: Permission[]): string {
  return JSON.stringify(permissions.filter(isPermission));
}

/** Default position for each base role (used when User.position is null/unknown). */
export const DEFAULT_POSITION: Record<UserRole, string> = {
  FACULTY: "SUBJECT_TEACHER",
  FINANCE_OFFICER: "FINANCE_OFFICER",
  EXAM_CONTROLLER: "EXAM_CELL_CLERK",
  DEAN: "HOD",
  STUDENT: "STUDENT",
  REGISTRAR_ADMIN: "REGISTRAR_ADMIN",
  SUPER_ADMIN: "SUPER_ADMIN",
  PARENT: "PARENT",
};

/**
 * Legal positions per base role. Used to validate position assignments: a user
 * may only be given a position that is legal for their base role. `null` is
 * always allowed (clears the position / falls back to the role default).
 */
export const LEGAL_POSITIONS: Record<UserRole, Position[]> = {
  FACULTY: ["SUBJECT_TEACHER", "CLASS_COORDINATOR", "PROGRAM_COORDINATOR"],
  DEAN: ["HOD"],
  EXAM_CONTROLLER: ["EXAM_CELL_CLERK"],
  REGISTRAR_ADMIN: ["DEPARTMENT_SECRETARY", "HOSTEL_ADMIN", "ADMISSIONS_OFFICER"],
  FINANCE_OFFICER: [],
  STUDENT: [],
  SUPER_ADMIN: [],
  PARENT: [],
};

// Base-role fallback grants (roles that can do a thing regardless of position).
const ROLE_FALLBACK: Record<UserRole, Permission[]> = {
  FACULTY: ["attendance.mark", "attendance.view_all", "marks.enter_draft", "obe.edit", "org.view", "calendar.view", "timetable.view", "faculty.presence_manage", "faculty.presence_view"],
  FINANCE_OFFICER: ["fees.view", "fees.manage", "payroll.approve", "report.view", "org.view", "calendar.view", "timetable.view", "dashboard.kpi"],
  EXAM_CONTROLLER: ["marks.approve", "marks.publish", "results.view", "report.view", "org.view", "calendar.view", "timetable.view"],
  DEAN: ["attendance.view_all", "results.view", "obe.view_reports", "report.view", "org.view", "calendar.view", "timetable.view", "dashboard.kpi", "dean.dashboard", "faculty.presence_manage", "faculty.presence_view", "messages.send"],
  STUDENT: ["fees.view", "calendar.view", "timetable.view"],
  REGISTRAR_ADMIN: [
    "attendance.view_all",
    "results.view",
    "obe.view_reports",
    "hostel.manage",
    "admissions.manage",
    "payroll.manage",
    "report.view",
    "org.view",
    "org.manage",
    "org.assign_staff",
    "org.manage_classes",
    "org.allocate_course",
    "calendar.view",
    "calendar.manage",
    "timetable.view",
    "timetable.manage",
    "audit.view",
    "dashboard.kpi",
    "library.manage",
    "library.view",
    "transport.manage",
    "transport.view",
    "certificates.manage",
    "certificates.view",
    "notices.manage",
    "notices.view",
    "grievance.manage",
    "grievance.view",
    "scholarships.manage",
    "scholarships.view",
    "health.manage",
    "health.view",
    "clubs.manage",
    "clubs.view",
    "registration.manage",
    "registration.view",
    "gradecard.manage",
    "gradecard.view",
    "backlog.manage",
    "backlog.view",
    "questionbank.manage",
    "questionbank.view",
    "placement.manage",
    "placement.view",
    "internship.manage",
    "internship.view",
    "alumniJobs.manage",
    "alumniJobs.view",
    "mentorship.manage",
    "mentorship.view",
    "dean.dashboard",
    "faculty.presence_manage",
    "faculty.presence_view",
    "messages.send",
  ],
  SUPER_ADMIN: [],
  PARENT: ["parent.view"],
};

/** Extra grants per fine-grained position (on top of base fallback). */
const POSITION_GRANTS: Partial<Record<Position, Permission[]>> = {
  SUBJECT_TEACHER: ["marks.enter_draft"],
  CLASS_COORDINATOR: ["marks.approve", "attendance.view_all", "timetable.manage"],
  HOD: ["attendance.view_all", "results.view", "obe.edit", "obe.view_reports", "org.manage_classes", "org.allocate_course", "calendar.manage", "timetable.manage"],
  EXAM_CELL_CLERK: [],
  HOSTEL_ADMIN: ["hostel.manage"],
  ADMISSIONS_OFFICER: ["admissions.manage"],
  PROGRAM_COORDINATOR: ["org.allocate_course", "calendar.manage", "timetable.manage"],
  DEPARTMENT_SECRETARY: ["org.manage", "calendar.manage"],
};

export interface EffectivePermissionUser {
  role?: string | null;
  position?: string | null;
  customRoleId?: string | null;
  /** Resolved permissions of the assigned custom role (fetched by caller). */
  customRolePermissions?: string[] | null;
}

/**
 * Resolve a user's effective permissions.
 *
 * Resolution order (spec §2):
 *   1. SUPER_ADMIN → all catalog permissions (bypass).
 *   2. customRoleId set → exactly that custom role's permissions (replace).
 *   3. Else → static matrix: ROLE_FALLBACK[role] ∪ POSITION_GRANTS[position].
 */
export function resolveEffectivePermissions(user: EffectivePermissionUser = {}): Permission[] {
  if (user.role === "SUPER_ADMIN") {
    return Array.from(ALL_PERMISSIONS, (p) => p as Permission);
  }

  if (user.customRoleId && user.customRolePermissions) {
    return user.customRolePermissions.filter(isPermission);
  }

  const grants: Permission[] = [];
  const role = user.role as UserRole | undefined;
  if (role && role in DEFAULT_POSITION) {
    const r = role as UserRole;
    ROLE_FALLBACK[r].forEach((p) => grants.push(p));
    const rawPosition = user.position ?? null;
    const position: Position =
      rawPosition && rawPosition in POSITION_GRANTS
        ? (rawPosition as Position)
        : (DEFAULT_POSITION[r] as Position);
    (POSITION_GRANTS[position] ?? []).forEach((p) => grants.push(p));
  }
  return grants;
}

/** Does an effective-permission array contain the given catalog permission? */
export function hasEffectivePermission(effective: Permission[], permission?: Permission | null): boolean {
  if (!permission) return false;
  return effective.includes(permission);
}

/**
 * Permission check. Role base fallback OR position grant decides.
 * SUPER_ADMIN bypasses everything. Unknown role → deny. Unknown position → base default.
 */
export function hasPermission(
  role?: string | null,
  position?: string | null,
  permission?: Permission | null
): boolean {
  if (!permission) return false;
  if (role === "SUPER_ADMIN") return true;
  return hasEffectivePermission(resolveEffectivePermissions({ role, position }), permission);
}

/** Convenience: does this user (with optional position) hold any of the permissions? */
export function hasAnyPermission(
  role?: string | null,
  position?: string | null,
  permissions: Permission[] = []
): boolean {
  return permissions.some((perm) => hasPermission(role, position, perm));
}

/**
 * Inline-guard replacement: allows SUPER_ADMIN unconditionally, otherwise only the
 * listed built-in roles. Usage: `guardRole(user.role, "REGISTRAR_ADMIN")`.
 */
export function guardRole(
  role?: string | null,
  ...allowed: UserRole[]
): boolean {
  if (role === "SUPER_ADMIN") return true;
  return !!role && allowed.includes(role as UserRole);
}

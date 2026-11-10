import { Permission } from "./perms";

// ==============================================================================
// UX command index — data-driven navigation for the global command palette.
//
// This is a PURE module: it holds no DB/API references and reads no globals.
// `buildCommandIndex(features)` returns a stable, sorted group/item list that the
// UI + tests can consume. Every item carries the catalog permissions it requires
// (empty array = available to all authenticated users).
// ==============================================================================

export interface UxCommandItem {
    label: string;
    href: string;
    description?: string;
    /** Required catalog permissions. Empty array = public to authenticated users. */
    permissions: Permission[];
}

export interface UxCommandGroup {
    key: string;
    label: string;
    items: UxCommandItem[];
}

export type UxFeature = UxCommandGroup;

/**
 * Canonical feature set covering every module built in Batches A–D plus the
 * original core modules. This is the single source of truth for the command
 * palette, the optional `GET /api/ux/command-index` endpoint, and the unit
 * tests.
 */
export const COMMAND_FEATURES: UxFeature[] = [
    {
        key: "admissions",
        label: "Admissions",
        items: [
            { label: "Apply", href: "/admissions/apply", permissions: ["admissions.manage"] },
            { label: "Admission Cycles", href: "/admissions/cycles", permissions: ["admissions.manage"] },
            { label: "Merit List", href: "/admissions/merit-list", permissions: ["admissions.manage"] },
            { label: "Seat Allocation", href: "/admissions/seat-allocation", permissions: ["admissions.manage"] },
        ],
    },
    {
        key: "students",
        label: "Students",
        items: [
            { label: "Student Directory", href: "/students", permissions: [] },
            { label: "Enrollments", href: "/students/enrollments", permissions: [] },
            { label: "Graduations", href: "/students/graduations", permissions: [] },
            { label: "Leaves", href: "/students/leaves", permissions: [] },
            { label: "Transfers", href: "/students/transfers", permissions: [] },
        ],
    },
    {
        key: "academic",
        label: "Academic",
        items: [
            { label: "Academic Calendar", href: "/academic/calendar", permissions: ["calendar.view"] },
            { label: "Timetable", href: "/academic/timetable", permissions: ["timetable.view"] },
        ],
    },
    {
        key: "organization",
        label: "Organization",
        items: [
            { label: "Departments", href: "/org/departments", permissions: ["org.view"] },
            { label: "Classes", href: "/org/classes", permissions: ["org.view"] },
            { label: "Staff", href: "/org/staff", permissions: ["org.view"] },
            { label: "Allocations", href: "/org/allocations", permissions: ["org.manage"] },
        ],
    },
    {
        key: "fees",
        label: "Fees & Payments",
        items: [
            { label: "Fee Structures", href: "/fees/structures", permissions: ["fees.manage"] },
            { label: "Invoices", href: "/fees/invoices", permissions: ["fees.view"] },
            { label: "Payments", href: "/fees/payments", permissions: ["fees.view"] },
            { label: "Dues", href: "/fees/dues", permissions: ["fees.manage"] },
        ],
    },
    {
        key: "exams",
        label: "Examinations",
        items: [
            { label: "Exams", href: "/exams/exams", permissions: [] },
            { label: "Schedules", href: "/exams/schedules", permissions: [] },
            { label: "Hall Tickets", href: "/exams/hall-tickets", permissions: [] },
            { label: "Marks Entry", href: "/exams/marks-entry", permissions: ["marks.enter_draft"] },
            { label: "Results", href: "/exams/results", permissions: ["results.view"] },
        ],
    },
    {
        key: "obe",
        label: "OBE",
        items: [
            { label: "Course Outcomes", href: "/obe/course-outcomes", permissions: ["obe.edit"] },
            { label: "Mappings", href: "/obe/mappings", permissions: ["obe.edit"] },
            { label: "Attainment", href: "/obe/attainment", permissions: ["obe.view_reports"] },
            { label: "Reports", href: "/obe/reports", permissions: ["obe.view_reports"] },
        ],
    },
    {
        key: "attendance",
        label: "Attendance",
        items: [
            { label: "Attendance Report", href: "/attendance/report", permissions: ["attendance.view_all"] },
        ],
    },
    {
        key: "hostel",
        label: "Hostel",
        items: [
            { label: "Rooms", href: "/hostel/rooms", permissions: ["hostel.manage"] },
            { label: "Allocations", href: "/hostel/allocations", permissions: ["hostel.manage"] },
            { label: "Mess", href: "/hostel/mess", permissions: ["hostel.manage"] },
            { label: "Complaints", href: "/hostel/complaints", permissions: ["hostel.manage"] },
        ],
    },
    {
        key: "hr",
        label: "HR & Payroll",
        items: [
            { label: "Employees", href: "/hr/employees", permissions: [] },
            { label: "Leave", href: "/hr/leave", permissions: [] },
            { label: "Payroll", href: "/hr/payroll", permissions: ["payroll.manage"] },
            { label: "Payslip", href: "/hr/payslip", permissions: [] },
        ],
    },
    {
        key: "alumni",
        label: "Alumni",
        items: [
            { label: "Profile", href: "/alumni/profile", permissions: [] },
            { label: "Events", href: "/alumni/events", permissions: [] },
            { label: "Donations", href: "/alumni/donations", permissions: [] },
        ],
    },
    {
        key: "library",
        label: "Library",
        items: [
            { label: "Catalogue", href: "/library/catalogue", permissions: ["library.view"] },
            { label: "Circulation", href: "/library/circulation", permissions: ["library.view"] },
            { label: "Memberships", href: "/library/memberships", permissions: ["library.manage"] },
            { label: "Fines", href: "/library/fines", permissions: ["library.manage"] },
        ],
    },
    {
        key: "transport",
        label: "Transport",
        items: [
            { label: "Routes", href: "/transport/routes", permissions: ["transport.view"] },
            { label: "Vehicles", href: "/transport/vehicles", permissions: ["transport.view"] },
            { label: "Passes", href: "/transport/passes", permissions: ["transport.view"] },
        ],
    },
    {
        key: "certificates",
        label: "Certificates",
        items: [
            { label: "Portal", href: "/certificates", permissions: ["certificates.view"] },
            { label: "Admin", href: "/certificates/admin", permissions: ["certificates.manage"] },
            { label: "Verify", href: "/certificates/verify", permissions: [] },
        ],
    },
    {
        key: "notices",
        label: "Notices",
        items: [
            { label: "Notices", href: "/notices", permissions: ["notices.view"] },
            { label: "Manage Notices", href: "/notices/admin", permissions: ["notices.manage"] },
        ],
    },
    {
        key: "scholarships",
        label: "Scholarships",
        items: [
            { label: "Schemes", href: "/scholarships/schemes", permissions: ["scholarships.view"] },
            { label: "My Applications", href: "/scholarships/my", permissions: ["scholarships.view"] },
            { label: "Review", href: "/scholarships/review", permissions: ["scholarships.manage"] },
        ],
    },
    {
        key: "grievance",
        label: "Grievance",
        items: [
            { label: "Grievance", href: "/grievance", permissions: ["grievance.view"] },
            { label: "My Grievance", href: "/grievance/my", permissions: ["grievance.view"] },
            { label: "Admin", href: "/grievance/admin", permissions: ["grievance.manage"] },
        ],
    },
    {
        key: "health",
        label: "Health Center",
        items: [
            { label: "Clinic", href: "/health", permissions: ["health.view"] },
            { label: "My Visits", href: "/health/my", permissions: ["health.view"] },
            { label: "Records", href: "/health/records", permissions: ["health.view"] },
            { label: "Visits", href: "/health/visits", permissions: ["health.manage"] },
        ],
    },
    {
        key: "clubs",
        label: "Clubs & Events",
        items: [
            { label: "Clubs", href: "/clubs", permissions: ["clubs.view"] },
            { label: "Events", href: "/clubs/events", permissions: ["clubs.view"] },
            { label: "My Clubs", href: "/clubs/my", permissions: ["clubs.view"] },
        ],
    },
    {
        key: "registration",
        label: "Registration",
        items: [
            { label: "My Registration", href: "/registration/my", permissions: ["registration.view"] },
            { label: "Catalog", href: "/registration/catalog", permissions: ["registration.view"] },
            { label: "Admin", href: "/registration/admin", permissions: ["registration.manage"] },
        ],
    },
    {
        key: "gradecard",
        label: "Grade Cards",
        items: [
            { label: "My Grade Card", href: "/gradecard/my", permissions: ["gradecard.view"] },
            { label: "Verify", href: "/gradecard/verify", permissions: [] },
            { label: "Admin", href: "/gradecard/admin", permissions: ["gradecard.manage"] },
        ],
    },
    {
        key: "backlog",
        label: "Backlog & Revaluation",
        items: [
            { label: "My Backlog", href: "/backlog/my", permissions: ["backlog.view"] },
            { label: "Admin", href: "/backlog/admin", permissions: ["backlog.manage"] },
        ],
    },
    {
        key: "questionbank",
        label: "Question Bank",
        items: [
            { label: "Questions", href: "/questionbank", permissions: ["questionbank.view"] },
            { label: "Exam Duty", href: "/questionbank/duty", permissions: ["questionbank.manage"] },
        ],
    },
    {
        key: "placement",
        label: "Placement",
        items: [
            { label: "Companies", href: "/placement/companies", permissions: ["placement.view"] },
            { label: "Posts", href: "/placement/posts", permissions: ["placement.view"] },
            { label: "My Applications", href: "/placement/my", permissions: ["placement.apply"] },
            { label: "Admin", href: "/placement/admin", permissions: ["placement.manage"] },
        ],
    },
    {
        key: "internships",
        label: "Internships",
        items: [
            { label: "Listings", href: "/internships/listings", permissions: ["internship.view"] },
            { label: "My Internships", href: "/internships/my", permissions: ["internship.apply"] },
            { label: "Admin", href: "/internships/admin", permissions: ["internship.manage"] },
        ],
    },
    {
        key: "alumniJobs",
        label: "Alumni Jobs Board",
        items: [
            { label: "Jobs Board", href: "/alumni-jobs", permissions: ["alumniJobs.view"] },
            { label: "Post a Job", href: "/alumni-jobs/post", permissions: ["alumniJobs.post"] },
        ],
    },
    {
        key: "mentorship",
        label: "Mentorship",
        items: [
            { label: "Mentorship", href: "/mentorship", permissions: ["mentorship.view"] },
        ],
    },
    {
        key: "parent",
        label: "Parent Portal",
        items: [
            { label: "Linked Students", href: "/portal/parent", permissions: ["parent.view"] },
            { label: "Manage Links", href: "/portal/parent/manage", permissions: ["parent.manage"] },
        ],
    },
    {
        key: "reportsCenter",
        label: "Reports Center",
        items: [
            { label: "Reports Center", href: "/reports/center", permissions: ["reports.view"] },
            { label: "NAAC", href: "/reports/naac", permissions: ["report.view"] },
            { label: "NBA", href: "/reports/nba", permissions: ["report.view"] },
            { label: "NIRF", href: "/reports/nirf", permissions: ["report.view"] },
        ],
    },
    {
        key: "idcards",
        label: "ID Cards",
        items: [
            { label: "Generate & Manage", href: "/idcards", permissions: ["idcards.manage"] },
            { label: "My Card", href: "/idcards/my", permissions: ["idcards.view"] },
        ],
    },
    {
        key: "audit",
        label: "Audit",
        items: [
            { label: "Audit Logs", href: "/audit", permissions: ["audit.view"] },
        ],
    },
    {
        key: "admin",
        label: "Administration",
        items: [
            { label: "Admin Console", href: "/admin", permissions: [] },
        ],
    },
];

/**
 * Build a stable command index from a feature set.
 *
 * `features` defaults to the canonical `COMMAND_FEATURES`. Result is
 * deterministic: groups are kept in declaration order, items within a group are
 * sorted alphabetically by label, and empty groups are dropped.
 */
export function buildCommandIndex(features: UxFeature[] = COMMAND_FEATURES): UxCommandGroup[] {
    return features
        .filter((feature) => feature.items.length > 0)
        .map((feature) => ({
            key: feature.key,
            label: feature.label,
            items: [...feature.items].sort((a, b) => a.label.localeCompare(b.label)),
        }));
}

/**
 * Whether an item should be visible to a user with the given effective
 * permission set. A command with no permission requirement is public to any
 * authenticated user.
 */
export function commandVisible(
    item: UxCommandItem,
    effective: Permission[],
    hasPerm: (effective: Permission[], permission?: Permission | null) => boolean
): boolean {
    if (item.permissions.length === 0) return true;
    return item.permissions.some((permission) => hasPerm(effective, permission));
}

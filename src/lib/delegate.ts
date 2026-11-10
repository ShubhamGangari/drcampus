// ==============================================================================
// Delegated Account Creation + Hierarchy (Module: Delegated Accounts & Hierarchy).
//
// Pure, dependency-free delegation core. No DB access and no imports that pull
// server-only modules (prisma / prismaBase) into the client bundle. Both the
// frontend (/accounts) and the backend (/api/accounts*) consume these helpers,
// so authorization gating is identical on both sides (defense in depth).
//
// FROZEN spec: docs/specs/delegated-accounts-hierarchy.md (§2, §4, §6).
// Authorizes by DELEGATION RANK + SCOPE (school / department), not by a new
// permission string — the frozen permission catalog is untouched.
// ==============================================================================

import {
    UserRole,
    Position,
    LEGAL_POSITIONS,
    DEFAULT_POSITION,
} from './perms';

// -----------------------------------------------------------------------------
// Assignable built-in roles (excludes SUPER_ADMIN and PARENT). Mirrors the
// BUILTIN_ROLES contract from the Dynamic RBAC module. Delegated creation may
// only assign one of these; SUPER_ADMIN is never assignable and PARENT is not
// a built-in creatable role here.
// -----------------------------------------------------------------------------
export const BUILTIN_ROLES = [
    'FACULTY',
    'FINANCE_OFFICER',
    'EXAM_CONTROLLER',
    'DEAN',
    'STUDENT',
    'REGISTRAR_ADMIN',
] as const;

export type BuiltinRole = (typeof BUILTIN_ROLES)[number];

export const ROLE_LABELS: Record<string, string> = {
    FACULTY: 'Faculty',
    FINANCE_OFFICER: 'Finance Officer',
    EXAM_CONTROLLER: 'Exam Controller',
    DEAN: 'Dean',
    STUDENT: 'Student',
    REGISTRAR_ADMIN: 'Registrar Admin',
    SUPER_ADMIN: 'Super Admin',
    PARENT: 'Parent',
};

export const POSITION_LABELS: Record<string, string> = {
    SUBJECT_TEACHER: 'Subject Teacher',
    CLASS_COORDINATOR: 'Class Coordinator',
    HOD: 'Head of Department',
    EXAM_CELL_CLERK: 'Exam Cell Clerk',
    HOSTEL_ADMIN: 'Hostel Admin',
    ADMISSIONS_OFFICER: 'Admissions Officer',
    PROGRAM_COORDINATOR: 'Program Coordinator',
    DEPARTMENT_SECRETARY: 'Department Secretary',
};

// -----------------------------------------------------------------------------
// Delegation rank table (spec §2). Lower number = higher authority.
// Ranks are static per role+position, mirroring the FROZEN table.
// -----------------------------------------------------------------------------
// Roles whose rank does not depend on position.
const STATIC_RANK: Record<string, number> = {
    SUPER_ADMIN: 0, // single top head
    REGISTRAR_ADMIN: 1,
    DEAN: 2, // HOD
    EXAM_CONTROLLER: 3, // EXAM_CELL_CLERK
    FINANCE_OFFICER: 3,
    STUDENT: 6,
    PARENT: 6,
};

// FACULTY rank depends on the fine-grained position.
const FACULTY_RANK: Record<string, number> = {
    PROGRAM_COORDINATOR: 4,
    CLASS_COORDINATOR: 4,
    SUBJECT_TEACHER: 5,
};

/**
 * Delegation rank for a role+position. Lower is higher authority.
 * Unknown roles resolve to +Infinity so they can never create anything.
 */
export function rankOf(role: string | null | undefined, position?: string | null): number {
    if (!role) return Number.POSITIVE_INFINITY;
    if (role === 'FACULTY') {
        const raw = position ?? DEFAULT_POSITION.FACULTY;
        const resolved = raw && raw in FACULTY_RANK ? raw : DEFAULT_POSITION.FACULTY;
        return FACULTY_RANK[resolved];
    }
    const rank = STATIC_RANK[role];
    return rank === undefined ? Number.POSITIVE_INFINITY : rank;
}

// -----------------------------------------------------------------------------
// Actor / target shapes (the shape both the client and server use).
// -----------------------------------------------------------------------------
export interface DelegatableActor {
    role: string | null | undefined;
    position?: string | null;
    schoolId?: string;
    departmentId?: string | null;
}

export interface DelegatableTarget {
    role: string | null | undefined;
    position?: string | null;
    schoolId?: string;
    departmentId?: string | null;
}

// Debug/denial reason strings (stable; surfaced in the 403 message).
export type DelegationDenial =
    | 'actor-cannot-create' // PARENT / STUDENT
    | 'target-super-admin' // nobody may create SUPER_ADMIN
    | 'target-higher-rank' // target rank < actor rank
    | 'different-school' // target outside actor's school
    | 'different-department' // target outside actor's department (dean/faculty)
    | 'illegal-position'; // position not legal for the target role

/**
 * Pure delegation predicate (spec §2 "Who can create what"). Returns `null`
 * when delegation is allowed, or a stable denial reason string otherwise.
 *
 * Rules (all must hold for a `null` result):
 *   1. Actor is not PARENT / STUDENT.
 *   2. Target role is not SUPER_ADMIN.
 *   3. Rank rule: rankOf(target) >= rankOf(actor) (equal allowed).
 *   4. Scope rule:
 *        - SUPER_ADMIN → any school / department.
 *        - REGISTRAR_ADMIN → same school (any department).
 *        - DEAN / FACULTY → same school AND same department (when the actor has
 *          a department; an unspecified target department defaults to the
 *          actor's own department).
 *   5. Target position is legal for the target role.
 */
export function delegateDenialReason(actor: DelegatableActor, target: DelegatableTarget): DelegationDenial | null {
    if (!actor.role) return 'actor-cannot-create';
    if (actor.role === 'PARENT' || actor.role === 'STUDENT') return 'actor-cannot-create';

    if (!target.role || target.role === 'SUPER_ADMIN') return 'target-super-admin';

    // Rank rule.
    if (rankOf(target.role, target.position) < rankOf(actor.role, actor.position)) {
        return 'target-higher-rank';
    }

    // Scope rule — school.
    const actorSchool = actor.schoolId;
    const targetSchool = target.schoolId;
    if (actorSchool && targetSchool && actorSchool !== targetSchool) {
        return 'different-school';
    }

    // Scope rule — department (only for subdivision-scoped roles).
    if (actor.role !== 'SUPER_ADMIN' && actor.role !== 'REGISTRAR_ADMIN') {
        if (actor.departmentId) {
            const effectiveTargetDept = target.departmentId ?? actor.departmentId;
            if (effectiveTargetDept !== actor.departmentId) {
                return 'different-department';
            }
        }
    }

    // Position legality for the target role.
    const legal = LEGAL_POSITIONS[target.role as UserRole];
    if (target.position != null && !legal.includes(target.position as Position)) {
        return 'illegal-position';
    }

    return null;
}

/** Boolean convenience wrapper over {@link delegateDenialReason}. */
export function canDelegate(actor: DelegatableActor, target: DelegatableTarget): boolean {
    return delegateDenialReason(actor, target) === null;
}

// -----------------------------------------------------------------------------
// Capabilities (spec §4.1).
// -----------------------------------------------------------------------------
export interface DelegateCapabilityRole {
    role: BuiltinRole;
    label: string;
    /** Legal positions for the role that also satisfy the rank rule ([] when the role has none). */
    positions: string[];
}

export interface DelegateCapabilitiesCore {
    canCreate: boolean;
    roles: DelegateCapabilityRole[];
}

/** True when the actor may create at least one target. */
export function canCreateAny(actor: DelegatableActor): boolean {
    return createableRoles(actor).length > 0;
}

/**
 * The set of built-in roles (with rank-filtered legal positions) the actor may
 * create. Pure; no DB. Only roles in {@link BUILTIN_ROLES} are creatable.
 */
export function createableRoles(actor: DelegatableActor): DelegateCapabilityRole[] {
    const actorRank = rankOf(actor.role, actor.position);
    const result: DelegateCapabilityRole[] = [];

    for (const role of BUILTIN_ROLES) {
        if (!canDelegate(actor, { role, position: null, schoolId: actor.schoolId, departmentId: actor.departmentId })) {
            continue;
        }
        const legal = LEGAL_POSITIONS[role as UserRole];
        const positions = legal.filter((p) => rankOf(role, p) >= actorRank);
        result.push({ role, label: ROLE_LABELS[role] ?? role, positions });
    }

    return result;
}

/**
 * True when the actor can see/choose any department (SUPER_ADMIN or
 * REGISTRAR_ADMIN). Deans/faculty are fixed to their own department.
 */
export function canManageAllDepartments(actor: Pick<DelegatableActor, 'role'>): boolean {
    return actor.role === 'SUPER_ADMIN' || actor.role === 'REGISTRAR_ADMIN';
}

/** Human scope label (spec §3.1 header) for the actor's scope. */
export function scopeLabel(
    actor: DelegatableActor,
    departmentName?: string | null
): string {
    if (actor.role === 'SUPER_ADMIN') return 'All schools & divisions';
    if (actor.role === 'REGISTRAR_ADMIN') return 'Entire school';
    if (actor.departmentId) {
        return departmentName ? `Division: ${departmentName}` : 'Your division';
    }
    return 'Your scope';
}

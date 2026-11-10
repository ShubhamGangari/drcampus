// ==============================================================================
// Dean Oversight — server-side data queries (shared by the API routes).
// These wrap Prisma reads into the exact view shapes the dean dashboard/frontend
// consume. They take an already-tenant-scoped `db` and always pass an explicit
// `schoolId` so central officers (prismaBase) get correct scoping.
// Spec: docs/specs/dean-overview.md
// ==============================================================================

import type { Db } from './prisma';
import {
    classifyLiveSlot,
    resolvePresenceStatus,
    type NowRef,
    type PresenceStatus,
} from './governance-core';

export interface FacultyView {
    userId: string;
    name: string;
    role: string;
    position: string | null;
    departmentId: string | null;
    departmentName: string | null;
}

/** Faculty users in a school, optionally filtered to one department. */
export async function fetchFacultyUsers(
    db: Db,
    schoolId: string,
    departmentId?: string
): Promise<FacultyView[]> {
    const users = await db.user.findMany({
        where: {
            schoolId,
            role: 'FACULTY',
            active: true,
            ...(departmentId ? { departmentId } : {}),
        },
        select: {
            id: true,
            name: true,
            role: true,
            position: true,
            departmentId: true,
            department: { select: { id: true, name: true } },
        },
    });
    return users.map((u) => ({
        userId: u.id,
        name: u.name,
        role: u.role,
        position: u.position ?? null,
        departmentId: u.departmentId ?? null,
        departmentName: u.department?.name ?? null,
    }));
}

export interface LiveClassView {
    slotId: string;
    courseId: string;
    courseTitle: string;
    classGroupId: string;
    classLabel: string;
    room: string | null;
    facultyId: string;
    facultyName: string;
    startTime: string;
    endTime: string;
    status: 'LIVE' | 'UPCOMING';
}

/**
 * Live/upcoming classes for today in a school. When `departmentId` is provided,
 * only classes whose faculty belong to that department are returned.
 */
export async function fetchLiveClasses(
    db: Db,
    schoolId: string,
    departmentId: string | undefined,
    now: NowRef
): Promise<LiveClassView[]> {
    const slots = await db.timetableSlot.findMany({
        where: { schoolId, dayOfWeek: now.dayOfWeek },
        include: {
            course: { select: { id: true, title: true } },
            classGroup: {
                select: {
                    id: true,
                    section: true,
                    programId: true,
                    batchId: true,
                    program: { select: { name: true, code: true } },
                    batch: { select: { name: true } },
                },
            },
            faculty: { select: { id: true, name: true, departmentId: true } },
        },
    });

    const out: LiveClassView[] = [];
    for (const slot of slots) {
        if (departmentId && slot.faculty.departmentId !== departmentId) continue;
        const status = classifyLiveSlot(slot, now.dayOfWeek, now.minutes);
        if (!status) continue;
        const programCode = slot.classGroup.program?.code ?? '';
        const batchName = slot.classGroup.batch?.name ?? '';
        out.push({
            slotId: slot.id,
            courseId: slot.courseId,
            courseTitle: slot.course.title,
            classGroupId: slot.classGroupId,
            classLabel: [programCode, batchName, slot.classGroup.section].filter(Boolean).join(' · '),
            room: slot.room ?? null,
            facultyId: slot.faculty.id,
            facultyName: slot.faculty.name,
            startTime: slot.startTime,
            endTime: slot.endTime,
            status,
        });
    }
    return out;
}

export interface FacultyPresenceView {
    userId: string;
    name: string;
    role: string;
    position: string | null;
    departmentId: string | null;
    departmentName: string | null;
    date: string; // YYYY-MM-DD
    status: ReturnType<typeof resolvePresenceStatus>;
    markedBy: string | null;
}

/**
 * Resolve presence for a set of faculty on a given day. `dateObj` must be the
 * UTC-midnight Date representing the local calendar date; `dateStr` is the same
 * date as YYYY-MM-DD for display.
 */
export async function resolveFacultyPresence(
    db: Db,
    schoolId: string,
    users: FacultyView[],
    dateObj: Date,
    dateStr: string
): Promise<FacultyPresenceView[]> {
    const userIds = users.map((u) => u.userId);
    const rows = userIds.length
        ? await db.facultyPresence.findMany({
            where: { schoolId, date: dateObj, userId: { in: userIds } },
            select: { userId: true, status: true, markedBy: true },
        })
        : [];
    const map = new Map(rows.map((r) => [r.userId, r]));
    return users.map((u) => {
        const row = map.get(u.userId);
        return {
            ...u,
            date: dateStr,
            status: resolvePresenceStatus(row?.status as PresenceStatus | undefined),
            markedBy: row?.markedBy ?? null,
        };
    });
}

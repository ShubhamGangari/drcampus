import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api';
import { withClient } from '@/lib/prisma';
import { hasPermission } from '@/lib/perms';
import { normalizeSearchTerm, isSearchable } from '@/lib/cross-core';

const LIMIT = 10;

type GroupKey =
    | 'students'
    | 'staff'
    | 'applications'
    | 'programs'
    | 'courses'
    | 'alumni'
    | 'events'
    | 'exams';

interface Item {
    id: string;
    label: string;
    href: string | null;
}

// GET /api/search?q=… — tenant-scoped global search, grouped and permission-gated.
export const GET = withAuth(async (request, { user }) => {
    const url = new URL(request.url);
    const raw = url.searchParams.get('q') ?? '';

    if (!isSearchable(raw)) {
        return NextResponse.json(
            { error: { code: 'QUERY_TOO_SHORT', message: 'Search query must be at least 2 characters' } },
            { status: 400 }
        );
    }
    const term = normalizeSearchTerm(raw);

    return withClient(user, async (db) => {
        const results: Record<GroupKey, Item[]> = {
            students: [],
            staff: [],
            applications: [],
            programs: [],
            courses: [],
            alumni: [],
            events: [],
            exams: [],
        };

        if (hasPermission(user.role, user.position, 'org.view')) {
            const students = await db.student.findMany({
                where: {
                    OR: [
                        { firstName: { contains: term } },
                        { lastName: { contains: term } },
                        { rollNo: { contains: term } },
                        { email: { contains: term } },
                    ],
                },
                take: LIMIT,
                select: { id: true, rollNo: true, firstName: true, lastName: true },
            });
            results.students = students.map((s) => ({
                id: s.id,
                label: `${s.rollNo} · ${s.firstName} ${s.lastName}`,
                href: `/students/${s.id}`,
            }));

            const staff = await db.employee.findMany({
                where: { OR: [{ name: { contains: term } }, { employeeId: { contains: term } }] },
                take: LIMIT,
                select: { id: true, employeeId: true, name: true },
            });
            results.staff = staff.map((e) => ({
                id: e.id,
                label: `${e.employeeId} · ${e.name}`,
                href: '/hr/employees',
            }));

            const programs = await db.program.findMany({
                where: { OR: [{ name: { contains: term } }, { code: { contains: term } }] },
                take: LIMIT,
                select: { id: true, name: true },
            });
            results.programs = programs.map((p) => ({ id: p.id, label: p.name, href: null }));

            const courses = await db.course.findMany({
                where: { OR: [{ title: { contains: term } }, { code: { contains: term } }] },
                take: LIMIT,
                select: { id: true, title: true, code: true },
            });
            results.courses = courses.map((c) => ({
                id: c.id,
                label: `${c.code} ${c.title}`,
                href: null,
            }));

            const alumni = await db.alumni.findMany({
                where: { email: { contains: term } },
                take: LIMIT,
                select: { id: true, email: true, batch: true },
            });
            results.alumni = alumni.map((a) => ({
                id: a.id,
                label: `${a.email}${a.batch ? ` · ${a.batch}` : ''}`,
                href: '/alumni/directory',
            }));
        }

        if (hasPermission(user.role, user.position, 'admissions.manage')) {
            const applications = await db.application.findMany({
                where: {
                    OR: [
                        { applicantName: { contains: term } },
                        { applicationNo: { contains: term } },
                        { email: { contains: term } },
                    ],
                },
                take: LIMIT,
                select: { id: true, applicationNo: true, applicantName: true },
            });
            results.applications = applications.map((a) => ({
                id: a.id,
                label: `${a.applicationNo} · ${a.applicantName}`,
                href: '/admissions/applications',
            }));
        }

        if (hasPermission(user.role, user.position, 'calendar.view')) {
            const events = await db.academicEvent.findMany({
                where: { title: { contains: term } },
                take: LIMIT,
                select: { id: true, title: true },
            });
            results.events = events.map((e) => ({
                id: e.id,
                label: e.title,
                href: '/academic/calendar',
            }));
        }

        if (hasPermission(user.role, user.position, 'results.view')) {
            const exams = await db.exam.findMany({
                where: { title: { contains: term } },
                take: LIMIT,
                select: { id: true, title: true },
            });
            results.exams = exams.map((e) => ({
                id: e.id,
                label: e.title,
                href: '/exams/schedules',
            }));
        }

        return NextResponse.json({ results });
    });
});

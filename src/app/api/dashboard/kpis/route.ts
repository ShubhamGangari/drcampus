import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api';
import { withClient } from '@/lib/prisma';
import { hasPermission } from '@/lib/perms';
import { calculateAttendancePercent, meanAttainment } from '@/lib/cross-core';

function currentAcademicYear(now = new Date()): string {
    const y = now.getFullYear();
    const m = now.getMonth() + 1;
    return m >= 7 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
}

function todayRange(now = new Date()): { start: Date; end: Date } {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    return { start, end };
}

function addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}

/** Start of an academic year "YYYY-YYYY": July 1 of the first year. */
function academicYearStart(ay: string): Date {
    const first = Number(ay.split('-')[0]);
    return new Date(first, 6, 1); // month index 6 = July
}

// GET /api/dashboard/kpis — leadership home-screen snapshot (dashboard.kpi).
export const GET = withAuth(async (request, { user }) => {
    if (!hasPermission(user.role, user.position, 'dashboard.kpi')) {
        return NextResponse.json(
            { error: { code: 'FORBIDDEN', message: 'You do not have permission to view dashboard KPIs' } },
            { status: 403 }
        );
    }

    const now = new Date();
    const ay = currentAcademicYear(now);
    const { start, end } = todayRange(now);

    return withClient(user, async (db) => {
        const [
            activeStudents,
            pendingApplications,
            feesAgg,
            dueRows,
            presentCount,
            absentCount,
            upcomingExams,
            facultyCount,
            attainmentAgg,
        ] = await Promise.all([
            db.student.count({ where: { status: 'ACTIVE' } }),
            db.application.count({ where: { status: { notIn: ['ADMITTED', 'REJECTED'] } } }),
            db.payment.aggregate({
                _sum: { amount: true },
                where: { createdAt: { gte: academicYearStart(ay) } },
            }),
            db.invoice.findMany({
                where: { status: { not: 'PAID' } },
                select: { studentId: true },
                distinct: ['studentId'],
            }),
            db.attendanceRecord.count({
                where: { date: { gte: start, lte: end }, status: 'PRESENT' },
            }),
            db.attendanceRecord.count({
                where: { date: { gte: start, lte: end }, status: 'ABSENT' },
            }),
            db.examSchedule.count({
                where: { examDate: { gte: now, lte: addDays(now, 14) } },
            }),
            db.employee.count(),
            db.cOAttainment.aggregate({
                _avg: { attainment: true },
                where: { academicYear: ay },
            }),
        ]);

        const outstandingDues = new Set(dueRows.map((r) => r.studentId)).size;
        const feesCollected = feesAgg._sum?.amount ?? 0;
        const attendanceTodayPercent = calculateAttendancePercent(presentCount, absentCount, 0);
        const avg = attainmentAgg._avg?.attainment;
        const avgCoAttainment = typeof avg === 'number' ? meanAttainment([avg]) : 0;

        return NextResponse.json({
            activeStudents,
            pendingApplications,
            feesCollected,
            outstandingDues,
            attendanceTodayPercent,
            upcomingExams,
            facultyCount,
            avgCoAttainment,
        });
    });
});

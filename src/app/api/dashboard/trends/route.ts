import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api';
import { withClient } from '@/lib/prisma';
import { hasPermission } from '@/lib/perms';

// ==============================================================================
// Dashboard trends API — lightweight time-series aggregates for the dashboard
// chart section (fee collection by month, applications by month, attendance by
// ISO week). Gated on `dashboard.kpi` at the endpoint level; the client further
// gates each individual chart on its module permissions.
// ==============================================================================

interface MonthBucket {
    label: string;
    value: number;
}

interface WeekBucket {
    label: string;
    present: number;
    absent: number;
}

function lastMonths(count: number, now = new Date()): Date[] {
    const out: Date[] = [];
    const y = now.getFullYear();
    const m = now.getMonth();
    for (let i = count - 1; i >= 0; i--) {
        out.push(new Date(y, m - i, 1));
    }
    return out;
}

function monthLabel(date: Date): string {
    return date.toLocaleString('en-US', { month: 'short' });
}

function monthRange(start: Date): { start: Date; end: Date } {
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
    return { start, end };
}

function lastWeeks(count: number, now = new Date()): Date[] {
    const out: Date[] = [];
    const day = now.getDay(); // 0 Sun … 6 Sat
    // most recent Monday
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((day + 6) % 7));
    monday.setHours(0, 0, 0, 0);
    for (let i = count - 1; i >= 0; i--) {
        const s = new Date(monday);
        s.setDate(monday.getDate() - i * 7);
        out.push(s);
    }
    return out;
}

function weekLabel(start: Date): string {
    return `${start.getDate()} ${start.toLocaleString('en-US', { month: 'short' })}`;
}

export const GET = withAuth(async (request, { user }) => {
    if (!hasPermission(user.role, user.position, 'dashboard.kpi')) {
        return NextResponse.json(
            { error: { code: 'FORBIDDEN', message: 'You do not have permission to view dashboard trends' } },
            { status: 403 }
        );
    }

    const now = new Date();
    const months = lastMonths(6, now);
    const monthStart = months[0];
    const firstWeek = lastWeeks(8, now)[0];

    return withClient(user, async (db) => {
        // --- Fees collected by month (last 6 months) ---
        const payments = await db.payment.findMany({
            where: { createdAt: { gte: monthStart } },
            select: { amount: true, createdAt: true },
        });
        const feesMonthly: MonthBucket[] = months.map((ms) => {
            const { start, end } = monthRange(ms);
            const total = payments.reduce((acc, p) => {
                return p.createdAt >= start && p.createdAt < end ? acc + p.amount : acc;
            }, 0);
            return { label: monthLabel(ms), value: total };
        });

        // --- Applications by month (last 6 months) ---
        const applications = await db.application.findMany({
            where: { createdAt: { gte: monthStart } },
            select: { createdAt: true },
        });
        const applicationsMonthly: MonthBucket[] = months.map((ms) => {
            const { start, end } = monthRange(ms);
            const count = applications.filter((a) => a.createdAt >= start && a.createdAt < end).length;
            return { label: monthLabel(ms), value: count };
        });

        // --- Attendance by ISO week (last 8 weeks) ---
        const attendance = await db.attendanceRecord.findMany({
            where: { date: { gte: firstWeek } },
            select: { date: true, status: true },
        });
        const weeks = lastWeeks(8, now);
        const attendanceWeekly: WeekBucket[] = weeks.map((ws, i) => {
            const we = i < weeks.length - 1 ? weeks[i + 1] : new Date(ws.getTime() + 7 * 86400000);
            let present = 0;
            let absent = 0;
            for (const r of attendance) {
                if (r.date >= ws && r.date < we) {
                    if (r.status === 'PRESENT') present += 1;
                    else if (r.status === 'ABSENT') absent += 1;
                }
            }
            return { label: weekLabel(ws), present, absent };
        });

        return NextResponse.json({
            feesMonthly,
            applicationsMonthly,
            attendanceWeekly,
        });
    });
});

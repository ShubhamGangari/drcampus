import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api';
import { withClient } from '@/lib/prisma';

// POST /api/notifications/[id]/read — mark one of my notifications read.
export const POST = withAuth(async (request, { user, params }) => {
    const id = params.id;

    return withClient(user, async (db) => {
        const existing = await db.notification.findFirst({
            where: { id, recipientUserId: user.userId },
        });
        // Never leak other users' notification ids: same 404 for missing or not-owned.
        if (!existing) {
            return NextResponse.json(
                { error: { code: 'NOT_FOUND', message: 'Notification not found' } },
                { status: 404 }
            );
        }

        await db.notification.update({
            where: { id: existing.id },
            data: { read: true },
        });

        return NextResponse.json({ read: true });
    });
});

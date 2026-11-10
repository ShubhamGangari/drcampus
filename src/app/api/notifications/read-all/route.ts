import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api';
import { withClient } from '@/lib/prisma';

// POST /api/notifications/read-all — mark all of my notifications read.
export const POST = withAuth(async (request, { user }) => {
    return withClient(user, async (db) => {
        const result = await db.notification.updateMany({
            where: { recipientUserId: user.userId, read: false },
            data: { read: true },
        });
        return NextResponse.json({ updated: result.count });
    });
});

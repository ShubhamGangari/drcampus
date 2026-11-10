import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api';
import { withClient } from '@/lib/prisma';

// GET /api/notifications/unread-count — count of unread notifications for me.
export const GET = withAuth(async (request, { user }) => {
    return withClient(user, async (db) => {
        const count = await db.notification.count({
            where: { recipientUserId: user.userId, read: false },
        });
        return NextResponse.json({ count });
    });
});

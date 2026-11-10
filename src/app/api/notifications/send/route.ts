import { NextResponse } from 'next/server';
import { withAuth, validateBody } from '@/lib/api';
import { withClient } from '@/lib/prisma';
import { hasPermission } from '@/lib/perms';
import { sendNotificationSchema, SendNotificationInput } from '@/lib/cross-schemas';

// POST /api/notifications/send — internal/system notification writer (admin only).
export const POST = withAuth(async (request, { user }) => {
    if (!hasPermission(user.role, user.position, 'audit.view')) {
        return NextResponse.json(
            { error: { code: 'FORBIDDEN', message: 'You do not have permission to send system notifications' } },
            { status: 403 }
        );
    }

    const body = await validateBody<SendNotificationInput>(request, sendNotificationSchema);

    return withClient(user, async (db) => {
        const created = await db.notification.create({
            data: {
                schoolId: user.schoolId,
                recipientUserId: body.recipientUserId,
                type: body.type,
                title: body.title,
                body: body.body ?? null,
                link: body.link ?? null,
            },
        });
        return NextResponse.json({ id: created.id }, { status: 201 });
    });
});

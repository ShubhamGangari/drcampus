import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api';
import { withClient } from '@/lib/prisma';
import { parseLimit } from '@/lib/cross-core';

// GET /api/notifications — current user's notification inbox (cursor paginated).
export const GET = withAuth(async (request, { user }) => {
    const url = new URL(request.url);
    const limit = parseLimit(url.searchParams.get('limit'), 20, 50);
    const unreadOnly = url.searchParams.get('unreadOnly') === 'true';
    const cursor = url.searchParams.get('cursor') ?? undefined;

    return withClient(user, async (db) => {
        const where: Record<string, unknown> = { recipientUserId: user.userId };
        if (unreadOnly) where.read = false;

        const findArgs: Record<string, unknown> = {
            where,
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            take: limit + 1,
        };
        if (cursor) {
            findArgs.cursor = { id: cursor };
            findArgs.skip = 1;
        }

        type NotificationRow = {
            id: string;
            type: string;
            title: string;
            body: string | null;
            link: string | null;
            read: boolean;
            createdAt: Date;
        };

        const rows = (await db.notification.findMany(findArgs as never)) as unknown as NotificationRow[];
        const hasMore = rows.length > limit;
        const page = hasMore ? rows.slice(0, limit) : rows;
        const nextCursor = hasMore ? page[page.length - 1]?.id ?? null : null;

        const notifications = page.map((n) => ({
            id: n.id,
            type: n.type,
            title: n.title,
            body: n.body,
            link: n.link,
            read: n.read,
            createdAt: n.createdAt.toISOString(),
        }));

        return NextResponse.json({ notifications, nextCursor });
    });
});

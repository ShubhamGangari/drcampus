import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api';
import { withClient } from '@/lib/prisma';
import { hasPermission } from '@/lib/perms';
import { parseLimit } from '@/lib/cross-core';

// GET /api/audit-logs — tenant-scoped audit trail (REGISTRAR_ADMIN only).
export const GET = withAuth(async (request, { user }) => {
    if (!hasPermission(user.role, user.position, 'audit.view')) {
        return NextResponse.json(
            { error: { code: 'FORBIDDEN', message: 'You do not have permission to view audit logs' } },
            { status: 403 }
        );
    }

    const url = new URL(request.url);
    const limit = parseLimit(url.searchParams.get('limit'), 25, 100);
    const entityType = url.searchParams.get('entityType') ?? undefined;
    const entityId = url.searchParams.get('entityId') ?? undefined;
    const actorId = url.searchParams.get('actorId') ?? undefined;
    const q = url.searchParams.get('q') ?? undefined;
    const cursor = url.searchParams.get('cursor') ?? undefined;

    return withClient(user, async (db) => {
        const where: Record<string, unknown> = {};
        if (entityType) where.entityType = entityType;
        if (entityId) where.entityId = entityId;
        if (actorId) where.actorId = actorId;
        if (q) {
            where.OR = [{ action: { contains: q } }, { summary: { contains: q } }];
        }

        const findArgs: Record<string, unknown> = {
            where,
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            take: limit + 1,
        };
        if (cursor) {
            findArgs.cursor = { id: cursor };
            findArgs.skip = 1;
        }

        type AuditRow = {
            id: string;
            actorId: string;
            action: string;
            entityType: string;
            entityId: string;
            summary: string;
            metadata: string | null;
            createdAt: Date;
        };

        const rows = (await db.auditLog.findMany(findArgs as never)) as unknown as AuditRow[];
        const hasMore = rows.length > limit;
        const page = hasMore ? rows.slice(0, limit) : rows;
        const nextCursor = hasMore ? page[page.length - 1]?.id ?? null : null;

        const actorIds = Array.from(new Set(page.map((r) => r.actorId)));
        const actors = actorIds.length
            ? await db.user.findMany({
                where: { id: { in: actorIds } },
                select: { id: true, name: true, role: true },
            })
            : [];
        const actorMap = new Map(actors.map((a) => [a.id, a]));

        const logs = page.map((r) => ({
            id: r.id,
            actorId: r.actorId,
            actorName: actorMap.get(r.actorId)?.name ?? 'Unknown',
            actorRole: actorMap.get(r.actorId)?.role ?? '',
            action: r.action,
            entityType: r.entityType,
            entityId: r.entityId,
            summary: r.summary,
            metadata: r.metadata,
            createdAt: r.createdAt.toISOString(),
        }));

        return NextResponse.json({ logs, nextCursor });
    });
});

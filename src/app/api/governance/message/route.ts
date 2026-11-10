import { withClient } from '@/lib/prisma';
import { withAuth, successResponse, errorResponse, validateBody, ApiError } from '@/lib/api';
import { hasPermission } from '@/lib/perms';
import { resolveCreateTenant } from '@/lib/student-lifecycle';
import { messageSchema } from '@/lib/governance-schemas';
import { writeAuditLog } from '@/lib/audit-writer';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// POST /api/governance/message — in-app message to faculty/staff.
//   Body: { schoolId?, recipientUserIds: string[], subject, body?, link? }.
//   Creates a Notification (type MESSAGE) per recipient. Recipients must be
//   active users in the actor's school.
// Errors: 400 no recipients/empty subject or recipient outside school;
//         403 not permitted; 400 central missing schoolId.
// ---------------------------------------------------------------------------
export const POST = withAuth(async (request, { user }) => {
    try {
        if (!hasPermission(user.role, user.position, 'messages.send')) {
            throw new ApiError(403, 'FORBIDDEN', 'Not permitted to send messages');
        }

        const body = await validateBody(request, messageSchema);

        return await withClient(user, async (db) => {
            const schoolId = resolveCreateTenant(user, body.schoolId);

            const recipients = await db.user.findMany({
                where: { schoolId, id: { in: body.recipientUserIds } },
                select: { id: true },
            });
            if (recipients.length !== body.recipientUserIds.length) {
                throw new ApiError(400, 'INVALID_RECIPIENT', 'One or more recipients are not active in this school');
            }

            await db.notification.createMany({
                data: body.recipientUserIds.map((rid) => ({
                    schoolId,
                    recipientUserId: rid,
                    type: 'MESSAGE',
                    title: body.subject,
                    body: body.body ?? null,
                    link: body.link ?? null,
                })),
            });

            await writeAuditLog(db, {
                schoolId,
                actorId: user.userId,
                action: 'MESSAGE_SENT',
                entityType: 'NOTIFICATION',
                entityId: 'MESSAGE',
                summary: `Message "${body.subject}" sent to ${body.recipientUserIds.length} recipient(s)`,
            });

            return successResponse({ sent: body.recipientUserIds.length });
        });
    } catch (error) {
        return errorResponse(error);
    }
});

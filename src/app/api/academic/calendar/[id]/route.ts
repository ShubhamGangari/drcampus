import { Prisma } from '@prisma/client';
import { withClient } from '@/lib/prisma';
import { withAuth, successResponse, validateBody, errorResponse, ApiError } from '@/lib/api';
import { requirePermission, getActingUser } from '@/lib/org';
import { updateEventSchema } from '@/lib/academic-schemas';
import { requireManageEvent } from '@/lib/academic-core';

export const dynamic = 'force-dynamic';

const EVENT_SELECT = {
  id: true,
  schoolId: true,
  programId: true,
  title: true,
  type: true,
  startDate: true,
  endDate: true,
} as const;

// ---------------------------------------------------------------------------
// PATCH /api/academic/calendar/[id] — partial update (calendar.manage).
// ---------------------------------------------------------------------------
export const PATCH = withAuth(async (request, { user, params }) => {
  try {
    const me = await withClient(user, (db) => getActingUser(db, user.userId));
    if (!me) throw new ApiError(401, 'UNAUTHORIZED', 'User not found');
    requirePermission(me, 'calendar.manage');

    const body = await validateBody(request, updateEventSchema);
    const tenant = me.schoolId === 'ALL' ? null : me.schoolId;

    return await withClient(user, async (db) => {
      const existing = await db.academicEvent.findUnique({
        where: { id: params.id },
        include: { program: { select: { coordinatorUserId: true } } },
      });
      if (!existing) throw new ApiError(404, 'NOT_FOUND', 'Event not found');

      // Ownership gate against the current program for the event.
      requireManageEvent(me, {
        programId: existing.programId,
        programCoordinatorUserId: existing.program?.coordinatorUserId ?? null,
      });

      const data: Prisma.AcademicEventUncheckedUpdateInput = {};
      if (body.title !== undefined) data.title = body.title;
      if (body.type !== undefined) data.type = body.type;
      if (body.startDate !== undefined) data.startDate = new Date(body.startDate);
      if (body.endDate !== undefined) data.endDate = body.endDate != null ? new Date(body.endDate) : null;

      if (body.programId !== undefined) {
        if (body.programId == null) {
          data.programId = null;
        } else {
          const program = await db.program.findUnique({
            where: { id: body.programId },
            select: { id: true, schoolId: true, coordinatorUserId: true },
          });
          if (!program) throw new ApiError(404, 'NOT_FOUND', 'Program not found');
          if (tenant && program.schoolId !== tenant) {
            throw new ApiError(400, 'SCHOOL_MISMATCH', 'Program does not belong to this school');
          }
          // Re-check ownership against the new program.
          requireManageEvent(me, {
            programId: body.programId,
            programCoordinatorUserId: program.coordinatorUserId ?? null,
          });
          data.programId = body.programId;
        }
      }

      const row = await db.academicEvent.update({
        where: { id: existing.id },
        data,
        select: EVENT_SELECT,
      });

      return successResponse(row);
    });
  } catch (error) {
    return errorResponse(error);
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/academic/calendar/[id] — delete event (calendar.manage). 204.
// ---------------------------------------------------------------------------
export const DELETE = withAuth(async (request, { user, params }) => {
  try {
    const me = await withClient(user, (db) => getActingUser(db, user.userId));
    if (!me) throw new ApiError(401, 'UNAUTHORIZED', 'User not found');
    requirePermission(me, 'calendar.manage');

    return await withClient(user, async (db) => {
      const existing = await db.academicEvent.findUnique({
        where: { id: params.id },
        include: { program: { select: { coordinatorUserId: true } } },
      });
      if (!existing) throw new ApiError(404, 'NOT_FOUND', 'Event not found');

      requireManageEvent(me, {
        programId: existing.programId,
        programCoordinatorUserId: existing.program?.coordinatorUserId ?? null,
      });

      await db.academicEvent.delete({ where: { id: existing.id } });
      return new Response(null, { status: 204 });
    });
  } catch (error) {
    return errorResponse(error);
  }
});

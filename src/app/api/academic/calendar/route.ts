import { withClient, isCentralUser } from '@/lib/prisma';
import { withAuth, successResponse, validateBody, errorResponse, ApiError } from '@/lib/api';
import { requirePermission, getActingUser } from '@/lib/org';
import { createEventSchema } from '@/lib/academic-schemas';
import { resolveCreateTenant, requireManageEvent } from '@/lib/academic-core';

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
// GET /api/academic/calendar — list events (staff + students).
// Query: ?schoolId=(central)&programId=&type=&from=&to=
// ---------------------------------------------------------------------------
export const GET = withAuth(async (request, { user }) => {
  try {
    const me = await withClient(user, (db) => getActingUser(db, user.userId));
    if (!me) throw new ApiError(401, 'UNAUTHORIZED', 'User not found');
    requirePermission(me, 'calendar.view');

    const { searchParams } = new URL(request.url);
    const where: Record<string, unknown> = {};

    if (isCentralUser(user)) {
      const schoolId = searchParams.get('schoolId');
      if (schoolId) where.schoolId = schoolId;
    }

    const programId = searchParams.get('programId');
    if (programId) where.programId = programId;

    const type = searchParams.get('type');
    if (type) where.type = type;

    const from = searchParams.get('from');
    const to = searchParams.get('to');
    if (from || to) {
      const startDateFilter: { gte?: Date; lte?: Date } = {};
      if (from) startDateFilter.gte = new Date(from);
      if (to) startDateFilter.lte = new Date(to);
      where.startDate = startDateFilter;
    }

    const items = await withClient(user, (db) =>
      db.academicEvent.findMany({ where, orderBy: { startDate: 'asc' }, select: EVENT_SELECT })
    );

    return successResponse({ items });
  } catch (error) {
    return errorResponse(error);
  }
});

// ---------------------------------------------------------------------------
// POST /api/academic/calendar — create event (calendar.manage). 201 row.
// ---------------------------------------------------------------------------
export const POST = withAuth(async (request, { user }) => {
  try {
    const me = await withClient(user, (db) => getActingUser(db, user.userId));
    if (!me) throw new ApiError(401, 'UNAUTHORIZED', 'User not found');
    requirePermission(me, 'calendar.manage');

    const body = await validateBody(request, createEventSchema);
    const tenant = resolveCreateTenant(user, body.schoolId);

    return await withClient(user, async (db) => {
      if (isCentralUser(user)) {
        const school = await db.school.findUnique({ where: { id: tenant }, select: { id: true } });
        if (!school) throw new ApiError(404, 'NOT_FOUND', 'School not found');
      }

      let programOwner: string | null = null;
      if (body.programId) {
        const program = await db.program.findUnique({
          where: { id: body.programId },
          select: { id: true, schoolId: true, coordinatorUserId: true },
        });
        if (!program) throw new ApiError(404, 'NOT_FOUND', 'Program not found');
        if (program.schoolId !== tenant) {
          throw new ApiError(400, 'SCHOOL_MISMATCH', 'Program does not belong to this school');
        }
        programOwner = program.coordinatorUserId ?? null;
      }

      // Ownership gate: coordinators may only create events for their own program;
      // HOD/secretary must be department-attached; registrar is unrestricted.
      requireManageEvent(me, { programId: body.programId ?? null, programCoordinatorUserId: programOwner });

      const row = await db.academicEvent.create({
        data: {
          schoolId: tenant,
          programId: body.programId ?? null,
          title: body.title,
          type: body.type,
          startDate: new Date(body.startDate),
          endDate: body.endDate != null ? new Date(body.endDate) : null,
        },
        select: EVENT_SELECT,
      });

      return successResponse(row, 201);
    });
  } catch (error) {
    return errorResponse(error);
  }
});

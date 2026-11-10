import { withClient, isCentralUser } from '@/lib/prisma';
import { withAuth, successResponse, validateBody, errorResponse, ApiError } from '@/lib/api';
import { createEventSchema } from '@/lib/alumni-schemas';
import {
  resolveCreateTenant,
  findSelfStudent,
  tenantFilter,
} from '@/lib/alumni-core';
import { guardRole } from '@/lib/perms';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET /api/alumni/events?schoolId= — list events.
// REGISTRAR_ADMIN | DEAN | STUDENT.
// 200 [{ id, title, date, location, registrations, registered }]
// (registrations = attendee count; registered = true when the current alumni
//  student has booked a seat).
// ---------------------------------------------------------------------------
export const GET = withAuth(async (request, { user }) => {
  try {
    if (!guardRole(user.role, 'REGISTRAR_ADMIN', 'DEAN', 'STUDENT')) {
      throw new ApiError(403, 'FORBIDDEN', 'You do not have permission to view events');
    }

    const url = new URL(request.url);
    const schoolId = url.searchParams.get('schoolId') ?? undefined;

    const result = await withClient(user, async (db) => {
      const events = await db.alumniEvent.findMany({
        where: tenantFilter(isCentralUser(user), schoolId),
        orderBy: { date: 'asc' },
      });

      const registrations = await db.alumniRegistration.findMany({
        where: tenantFilter(isCentralUser(user), schoolId),
        select: { eventId: true, alumniId: true },
      });

      const countByEvent = new Map<string, number>();
      for (const r of registrations) {
        countByEvent.set(r.eventId, (countByEvent.get(r.eventId) ?? 0) + 1);
      }

      let myAlumniId: string | undefined;
      if (user.role === 'STUDENT') {
        const self = await findSelfStudent(db, user);
        if (self) {
          const al = await db.alumni.findFirst({
            where: { studentId: self.id },
            select: { id: true },
          });
          if (al) myAlumniId = al.id;
        }
      }

      const myEventIds = new Set<string>();
      for (const r of registrations) {
        if (r.alumniId === myAlumniId) myEventIds.add(r.eventId);
      }

      return events.map((e) => ({
        id: e.id,
        title: e.title,
        date: e.date,
        location: e.location,
        registrations: countByEvent.get(e.id) ?? 0,
        registered: myAlumniId ? myEventIds.has(e.id) : false,
      }));
    });

    return successResponse(result);
  } catch (error) {
    return errorResponse(error);
  }
});

// ---------------------------------------------------------------------------
// POST /api/alumni/events — create an event.
// REGISTRAR_ADMIN only. Body { schoolId?, title, date, location? }.
// 201 { eventId } | 400 invalid/missing fields.
// ---------------------------------------------------------------------------
export const POST = withAuth(async (request, { user }) => {
  try {
    if (!guardRole(user.role, 'REGISTRAR_ADMIN')) {
      throw new ApiError(403, 'FORBIDDEN', 'Registrar access required');
    }

    const body = await validateBody(request, createEventSchema);
    const date = new Date(body.date);
    if (Number.isNaN(date.getTime())) {
      throw new ApiError(400, 'INVALID_DATE', 'date must be a valid date string');
    }
    const schoolId = resolveCreateTenant(user, body.schoolId);

    const eventId = await withClient(user, async (db) => {
      const created = await db.alumniEvent.create({
        data: {
          schoolId,
          title: body.title,
          date,
          location: body.location ?? null,
        },
        select: { id: true },
      });
      return created.id;
    });

    return successResponse({ eventId }, 201);
  } catch (error) {
    return errorResponse(error);
  }
});

import { withClient, type Db } from '@/lib/prisma';
import { withAuth, successResponse, errorResponse, ApiError } from '@/lib/api';
import { findSelfStudent } from '@/lib/alumni-core';
import { type AuthPayload } from '@/lib/auth';
import { guardRole } from '@/lib/perms';

export const dynamic = 'force-dynamic';

// Finds the current student's own alumni record (403 when they are not alumni).
async function selfAlumni(db: Db, user: AuthPayload): Promise<{ id: string }> {
  const self = await findSelfStudent(db, user);
  if (!self) {
    throw new ApiError(403, 'FORBIDDEN', 'No student account linked to this user');
  }
  const alumni = await db.alumni.findFirst({
    where: { studentId: self.id },
    select: { id: true },
  });
  if (!alumni) {
    throw new ApiError(403, 'FORBIDDEN', 'You are not an alumni member');
  }
  return alumni;
}

// ---------------------------------------------------------------------------
// POST /api/alumni/events/[id]/register — alumni student books a seat.
// STUDENT (own alumni) only. 201 { registrationId } | 409 duplicate.
// ---------------------------------------------------------------------------
export const POST = withAuth(async (request, { user, params }) => {
  try {
    if (!guardRole(user.role, 'STUDENT')) {
      throw new ApiError(403, 'FORBIDDEN', 'Alumni student access required');
    }

    const eventId = params.id as string;

    const registrationId = await withClient(user, async (db) => {
      const alumni = await selfAlumni(db, user);

      const evt = await db.alumniEvent.findUnique({
        where: { id: eventId },
        select: { id: true },
      });
      if (!evt) {
        throw new ApiError(404, 'NOT_FOUND', 'Event not found');
      }

      const existing = await db.alumniRegistration.findFirst({
        where: { eventId, alumniId: alumni.id },
        select: { id: true },
      });
      if (existing) {
        throw new ApiError(409, 'ALREADY_REGISTERED', 'Already registered for this event');
      }

      const created = await db.alumniRegistration.create({
        data: { alumniId: alumni.id, eventId, schoolId: user.schoolId },
        select: { id: true },
      });
      return created.id;
    });

    return successResponse({ registrationId }, 201);
  } catch (error) {
    return errorResponse(error);
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/alumni/events/[id]/register — alumni student cancels a seat.
// STUDENT (own alumni) only. 200 { deregistered: true } | 404 not registered.
// ---------------------------------------------------------------------------
export const DELETE = withAuth(async (request, { user, params }) => {
  try {
    if (!guardRole(user.role, 'STUDENT')) {
      throw new ApiError(403, 'FORBIDDEN', 'Alumni student access required');
    }

    const eventId = params.id as string;

    await withClient(user, async (db) => {
      const alumni = await selfAlumni(db, user);
      const deleted = await db.alumniRegistration.deleteMany({
        where: { eventId, alumniId: alumni.id },
      });
      if (deleted.count === 0) {
        throw new ApiError(404, 'NOT_FOUND', 'Registration not found');
      }
    });

    return successResponse({ deregistered: true });
  } catch (error) {
    return errorResponse(error);
  }
});

import { Prisma } from '@prisma/client';
import { withClient, isCentralUser } from '@/lib/prisma';
import { withAuth, successResponse, validateBody, errorResponse, ApiError } from '@/lib/api';
import { allocateSchema } from '@/lib/hostel-schemas';
import {
  resolveCreateTenant,
  assertStudentBelongsToSchool,
} from '@/lib/hostel-core';

export const dynamic = 'force-dynamic';

const MANAGER_ROLES = ['DEAN', 'REGISTRAR_ADMIN'] as const;

// ---------------------------------------------------------------------------
// POST /api/hostel/allocate — allocate a student to a room.
// DEAN / REGISTRAR_ADMIN. 201 { allocationId }
// Error codes:
//   400 student/room not in tenant | 404 room missing
//   409 ACTIVE_ALLOCATION_EXISTS (student already has an active allocation)
//   409 ROOM_FULL (occupied >= capacity)
//
// The occupied count and the allocation insert happen inside a single
// interactive transaction so two concurrent allocations cannot overshoot the
// room's capacity (no race).
// ---------------------------------------------------------------------------
export const POST = withAuth(async (request, { user }) => {
  try {
    if (!MANAGER_ROLES.includes(user.role as (typeof MANAGER_ROLES)[number])) {
      throw new ApiError(403, 'FORBIDDEN', 'Dean or registrar access required');
    }

    const body = await validateBody(request, allocateSchema);
    const tenant = resolveCreateTenant(user, body.schoolId);

    const allocationId = await withClient(user, async (db) => {
      await assertStudentBelongsToSchool(db, body.studentId, tenant);

      const room = await db.hostelRoom.findUnique({ where: { id: body.roomId } });
      if (!room) {
        throw new ApiError(404, 'NOT_FOUND', 'Room not found');
      }
      if (room.schoolId !== tenant) {
        throw new ApiError(400, 'SCHOOL_MISMATCH', 'Room does not belong to this school');
      }

      return await db.$transaction(async (tx) => {
        // Occupied count for this room — computed atomically inside the tx.
        const occupiedWhere: Record<string, unknown> = {
          roomId: body.roomId,
          vacatedAt: null,
        };
        if (isCentralUser(user)) occupiedWhere.schoolId = tenant;
        const occupied = await tx.hostelAllocation.count({ where: occupiedWhere });

        // One-active-allocation rule.
        const activeWhere: Record<string, unknown> = {
          studentId: body.studentId,
          vacatedAt: null,
        };
        if (isCentralUser(user)) activeWhere.schoolId = tenant;
        const existingActive = await tx.hostelAllocation.findFirst({ where: activeWhere });
        if (existingActive) {
          throw new ApiError(
            409,
            'ACTIVE_ALLOCATION_EXISTS',
            'Student already has an active allocation'
          );
        }

        // Capacity rule: occupied >= capacity -> ROOM_FULL.
        if (occupied >= room.capacity) {
          throw new ApiError(409, 'ROOM_FULL', 'Room is at capacity');
        }

        const data: Prisma.HostelAllocationUncheckedCreateInput = {
          studentId: body.studentId,
          roomId: body.roomId,
          schoolId: tenant,
        };

        const allocation = await tx.hostelAllocation.create({ data });
        return allocation.id as string;
      });
    });

    return successResponse({ allocationId }, 201);
  } catch (error) {
    return errorResponse(error);
  }
});

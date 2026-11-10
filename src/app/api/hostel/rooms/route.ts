import { withClient, isCentralUser } from '@/lib/prisma';
import { withAuth, successResponse, validateBody, errorResponse, ApiError } from '@/lib/api';
import { createRoomSchema } from '@/lib/hostel-schemas';
import { resolveCreateTenant, occupiedCount, tenantFilter } from '@/lib/hostel-core';
import { guardRole } from '@/lib/perms';

export const dynamic = 'force-dynamic';


// ---------------------------------------------------------------------------
// GET /api/hostel/rooms?schoolId= — list rooms with occupied count.
// DEAN / REGISTRAR_ADMIN / STUDENT. 200 [{ id, roomNo, type, capacity, occupied }]
// ---------------------------------------------------------------------------
export const GET = withAuth(async (request, { user }) => {
  try {
    if (!guardRole(user.role, 'DEAN', 'REGISTRAR_ADMIN', 'STUDENT', 'FINANCE_OFFICER')) {
      throw new ApiError(403, 'FORBIDDEN', 'You do not have permission to view rooms');
    }

    const url = new URL(request.url);
    const schoolId = url.searchParams.get('schoolId') ?? undefined;

    const rooms = await withClient(user, async (db) => {
      const where = tenantFilter(isCentralUser(user), schoolId);

      const roomRows = await db.hostelRoom.findMany({
        where,
        orderBy: { roomNo: 'asc' },
      });

      // Gather all allocations for the listed rooms, then count active ones per
      // room via the pure `occupiedCount` helper.
      const roomIds = roomRows.map((r) => r.id);
      const allocations = roomIds.length
        ? await db.hostelAllocation.findMany({
          where: { roomId: { in: roomIds } },
          select: { roomId: true, vacatedAt: true },
        })
        : [];
      const byRoom = new Map<string, Array<{ vacatedAt: Date | null }>>();
      for (const a of allocations) {
        const arr = byRoom.get(a.roomId) ?? [];
        arr.push({ vacatedAt: a.vacatedAt });
        byRoom.set(a.roomId, arr);
      }

      return roomRows.map((r) => ({
        id: r.id,
        roomNo: r.roomNo,
        type: r.type,
        capacity: r.capacity,
        occupied: occupiedCount(byRoom.get(r.id) ?? []),
      }));
    });

    return successResponse(rooms);
  } catch (error) {
    return errorResponse(error);
  }
});

// ---------------------------------------------------------------------------
// POST /api/hostel/rooms — create a hostel room (DEAN, REGISTRAR_ADMIN).
// 201 { roomId } | 400 duplicate roomNo / invalid capacity
// ---------------------------------------------------------------------------
export const POST = withAuth(async (request, { user }) => {
  try {
    if (!guardRole(user.role, 'DEAN', 'REGISTRAR_ADMIN')) {
      throw new ApiError(403, 'FORBIDDEN', 'Dean or registrar access required');
    }

    const body = await validateBody(request, createRoomSchema);
    const tenant = resolveCreateTenant(user, body.schoolId);

    const roomId = await withClient(user, async (db) => {
      const dupWhere: Record<string, unknown> = { roomNo: body.roomNo };
      if (isCentralUser(user)) dupWhere.schoolId = tenant;

      const existing = await db.hostelRoom.findFirst({ where: dupWhere });
      if (existing) {
        throw new ApiError(400, 'DUPLICATE_ROOM', 'A room with this roomNo already exists');
      }

      const room = await db.hostelRoom.create({
        data: {
          roomNo: body.roomNo,
          type: body.type,
          capacity: body.capacity,
          schoolId: tenant,
        },
      });
      return room.id as string;
    });

    return successResponse({ roomId }, 201);
  } catch (error) {
    return errorResponse(error);
  }
});

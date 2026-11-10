import { withClient, isCentralUser } from '@/lib/prisma';
import {
    withAuth,
    successResponse,
    errorResponse,
} from '@/lib/api';
import {
    tenantFilter,
    findSelfStudent,
    findSelfMentor,
    resolveStudentNames,
    resolveMentorNames,
} from '@/lib/mentorship-core';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET /api/mentorship/my?schoolId=
// Returns the current user's mentorship perspective:
//   - students → their current pairing (if any) + requests they made;
//   - mentors → incoming requests to them.
// 200 { pairing?, requests: [...] }
// ---------------------------------------------------------------------------
export const GET = withAuth(async (request, { user }) => {
    try {
        const url = new URL(request.url);
        const schoolId = url.searchParams.get('schoolId') ?? undefined;

        const data = await withClient(user, async (db) => {
            const self = await findSelfStudent(db, user);
            const mentor = await findSelfMentor(db, user);

            let pairing: {
                id: string;
                mentorId: string;
                mentorName: string;
                studentId: string;
                studentName: string;
                status: string;
                createdAt: string;
            } | undefined;

            let requests: Array<{
                id: string;
                mentorId: string;
                mentorName: string;
                studentId: string;
                studentName: string;
                message: string | null;
                status: string;
                createdAt: string;
            }> = [];

            if (self) {
                const pairingRow = await db.mentorshipPairing.findFirst({
                    where: {
                        ...tenantFilter(isCentralUser(user), schoolId),
                        studentId: self.id,
                    },
                    orderBy: { createdAt: 'desc' },
                });

                if (pairingRow) {
                    const mentorNames = await resolveMentorNames(db, [pairingRow.mentorId]);
                    pairing = {
                        id: pairingRow.id,
                        mentorId: pairingRow.mentorId,
                        mentorName: mentorNames.get(pairingRow.mentorId) ?? 'Mentor',
                        studentId: pairingRow.studentId,
                        studentName: `${self.firstName} ${self.lastName}`.trim(),
                        status: pairingRow.status,
                        createdAt: pairingRow.createdAt.toISOString(),
                    };
                }

                const reqRows = await db.mentorshipRequest.findMany({
                    where: {
                        ...tenantFilter(isCentralUser(user), schoolId),
                        studentId: self.id,
                    },
                    orderBy: { createdAt: 'desc' },
                });

                if (reqRows.length) {
                    const mentorNames = await resolveMentorNames(db, reqRows.map((r) => r.mentorId));
                    requests = reqRows.map((r) => ({
                        id: r.id,
                        mentorId: r.mentorId,
                        mentorName: mentorNames.get(r.mentorId) ?? 'Mentor',
                        studentId: r.studentId,
                        studentName: `${self.firstName} ${self.lastName}`.trim(),
                        message: r.message,
                        status: r.status,
                        createdAt: r.createdAt.toISOString(),
                    }));
                }
            } else if (mentor) {
                const reqRows = await db.mentorshipRequest.findMany({
                    where: {
                        ...tenantFilter(isCentralUser(user), schoolId),
                        mentorId: mentor.id,
                    },
                    orderBy: { createdAt: 'desc' },
                });

                if (reqRows.length) {
                    const studentNames = await resolveStudentNames(db, reqRows.map((r) => r.studentId));
                    requests = reqRows.map((r) => ({
                        id: r.id,
                        mentorId: r.mentorId,
                        mentorName: mentor.name,
                        studentId: r.studentId,
                        studentName: studentNames.get(r.studentId) ?? 'Student',
                        message: r.message,
                        status: r.status,
                        createdAt: r.createdAt.toISOString(),
                    }));
                }
            }

            return { pairing, requests };
        });

        return successResponse(data);
    } catch (error) {
        return errorResponse(error);
    }
});

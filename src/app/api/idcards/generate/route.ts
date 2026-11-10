import { withClient } from '@/lib/prisma';
import { withAuth, successResponse, errorResponse, validateBody } from '@/lib/api';
import { generateCardsSchema } from '@/lib/idcards-schemas';
import {
    generateCards,
    requireIdCardsManage,
    resolveCreateTenant,
    userHasPermission,
} from '@/lib/idcards-core';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// POST /api/idcards/generate — bulk/single card generation (manage).
// Body: { holderType, studentIds?, staffIds?, batchId?, schoolId? } → 201 { cards }.
// Validates holders exist (404) and is idempotent per holder (returns the
// existing ACTIVE card; re-issues a REVOKED card with a new number).
// ---------------------------------------------------------------------------
export const POST = withAuth(async (request, { user }) => {
    try {
        if (!(await userHasPermission(user, 'idcards.manage'))) throw requireIdCardsManage();

        const body = await validateBody(request, generateCardsSchema);
        const schoolId = resolveCreateTenant(user, body.schoolId);

        const cards = await withClient(user, (db) => generateCards(db, schoolId, body));
        return successResponse({ cards }, 201);
    } catch (error) {
        return errorResponse(error);
    }
});

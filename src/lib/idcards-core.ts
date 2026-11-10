// ==============================================================================
// ID Cards module (Batch E) — backend business logic.
// Pure functions (card number builder, QR payload hash, holder-type guards) live
// here so the tester can unit-test them without a database. Thin tenant/permission
// gates mirror the other modules.
//
// FROZEN rules (docs/specs/id-cards.md §6):
//   - Card numbers are unique per school: `nextCardNumber(prefix, seq)`.
//   - One active card per holder (`@@unique([schoolId, holderType, holderId])`);
//     generating again returns the existing active card rather than duplicating.
//   - A REVOKED holder is re-issued by updating the existing row with a new card
//     number (unique constraint forbids a second row per holder).
//   - The QR payload is a deterministic hash: `cardQrPayload(card)`.
// ==============================================================================

import { createHash } from 'node:crypto';

import { resolveUserEffectivePermissions } from './rbac';
import { ApiError } from './errors';
import { computeNextSeq, getNextSequence } from './fee-core';
import { type Db } from './prisma';
import { type AuthPayload } from './auth';
import { type Permission } from './perms';

// Re-export shared ownership helpers (one source of truth).
export { resolveCreateTenant, assertStudentBelongsToSchool } from './fee-core';

// ---- Constants ---------------------------------------------------------------

export const CARD_STATUS = {
    ACTIVE: 'ACTIVE',
    REVOKED: 'REVOKED',
} as const;

export const HOLDER_TYPES = {
    STUDENT: 'STUDENT',
    STAFF: 'STAFF',
} as const;

export type CardStatus = (typeof CARD_STATUS)[keyof typeof CARD_STATUS];
export type HolderType = (typeof HOLDER_TYPES)[keyof typeof HOLDER_TYPES];

export const CARD_NUMBER_PREFIXES: Record<HolderType, string> = {
    [HOLDER_TYPES.STUDENT]: 'UGC-STU-',
    [HOLDER_TYPES.STAFF]: 'UGC-STAFF-',
};

// ---- Shapes ------------------------------------------------------------------

export interface IdentityCardShape {
    id: string;
    holderId: string;
    holderName: string;
    holderType: HolderType;
    cardNumber: string;
    status: CardStatus;
    issuedAt: string;
}

export interface GenerateCardsInput {
    holderType: HolderType;
    studentIds?: string[];
    staffIds?: string[];
    batchId?: string;
}

// ---- Pure helpers (unit-tested) ----------------------------------------------

export function isHolderType(value: unknown): value is HolderType {
    return value === HOLDER_TYPES.STUDENT || value === HOLDER_TYPES.STAFF;
}

/**
 * Sequential card number builder: `{prefix}{6-digit seq}` (e.g. `UGC-STU-000123`).
 */
export function nextCardNumber(prefix: string, seq: number): string {
    const n = String(Math.max(1, Math.floor(Number(seq) || 1))).padStart(6, '0');
    return `${prefix}${n}`;
}

/**
 * Deterministic, stable verification payload for a card (schoolId + cardNumber +
 * holderId + issuedAt). Same card always yields the same hash; any field change
 * changes the hash, so a stale/copied card can be detected.
 */
export function cardQrPayload(card: {
    schoolId: string;
    cardNumber: string;
    holderId: string;
    issuedAt: Date | string;
}): string {
    const raw = [
        card.schoolId,
        card.cardNumber,
        card.holderId,
        new Date(card.issuedAt).toISOString(),
    ].join('|');
    return createHash('sha256').update(raw).digest('hex');
}

// ---- Tenant filter (mirrors other modules) -----------------------------------

export function tenantFilter(
    isCentral: boolean,
    schoolId: string | undefined
): Record<string, unknown> {
    if (!isCentral || !schoolId) return {};
    return { schoolId };
}

// ---- Permission gates (server-side) ------------------------------------------

export async function userHasPermission(
    user: { role: string; position?: string | null; customRoleId?: string | null },
    permission: string
): Promise<boolean> {
    const effective = await resolveUserEffectivePermissions(user);
    return effective.includes(permission as Permission);
}

export function requireIdCardsManage(): ApiError {
    return new ApiError(403, 'FORBIDDEN', 'ID card management permission required');
}

export function requireIdCardsView(): ApiError {
    return new ApiError(403, 'FORBIDDEN', 'ID card view permission required');
}

// ---- Holder name attachment --------------------------------------------------

async function attachHolderNames(
    db: Db,
    schoolId: string,
    cards: Array<{ id: string; holderId: string; holderType: string; cardNumber: string; status: string; issuedAt: Date }>
): Promise<IdentityCardShape[]> {
    const nameMap = new Map<string, string>();

    const studentIds = cards
        .filter((c) => c.holderType === HOLDER_TYPES.STUDENT)
        .map((c) => c.holderId);
    const staffIds = cards
        .filter((c) => c.holderType === HOLDER_TYPES.STAFF)
        .map((c) => c.holderId);

    if (studentIds.length) {
        const students = await db.student.findMany({
            where: { id: { in: studentIds }, schoolId },
            select: { id: true, firstName: true, lastName: true },
        });
        for (const s of students) {
            nameMap.set(s.id, `${s.firstName} ${s.lastName}`.trim() || s.id);
        }
    }
    if (staffIds.length) {
        const staff = await db.user.findMany({
            where: { id: { in: staffIds }, schoolId },
            select: { id: true, name: true },
        });
        for (const u of staff) nameMap.set(u.id, u.name);
    }

    return cards.map((c) => ({
        id: c.id,
        holderId: c.holderId,
        holderName: nameMap.get(c.holderId) ?? 'Unknown',
        holderType: isHolderType(c.holderType) ? c.holderType : HOLDER_TYPES.STUDENT,
        cardNumber: c.cardNumber,
        status: c.status === CARD_STATUS.REVOKED ? CARD_STATUS.REVOKED : CARD_STATUS.ACTIVE,
        issuedAt: c.issuedAt.toISOString(),
    }));
}

// ---- DB operations -----------------------------------------------------------

export async function listCards(
    db: Db,
    schoolId: string,
    opts: { status?: string } = {}
): Promise<IdentityCardShape[]> {
    const where: { schoolId: string; status?: string } = { schoolId };
    if (opts.status) where.status = opts.status;

    const cards = await db.identityCard.findMany({
        where,
        orderBy: { issuedAt: 'desc' },
    });
    return attachHolderNames(db, schoolId, cards);
}

/** Resolves holder ids for a generate request; validates holders exist (404). */
async function resolveHolders(
    db: Db,
    schoolId: string,
    input: GenerateCardsInput
): Promise<Array<{ type: HolderType; id: string }>> {
    const holders: Array<{ type: HolderType; id: string }> = [];

    if (input.holderType === HOLDER_TYPES.STUDENT) {
        let ids = input.studentIds ?? [];
        if (input.batchId) {
            const batchStudents = await db.student.findMany({
                where: { batchId: input.batchId, schoolId },
                select: { id: true },
            });
            ids = Array.from(new Set([...ids, ...batchStudents.map((s) => s.id)]));
        }
        if (ids.length === 0) {
            throw new ApiError(400, 'VALIDATION_ERROR', 'Choose students or a batch');
        }
        const found = await db.student.findMany({
            where: { id: { in: ids }, schoolId },
            select: { id: true },
        });
        const foundSet = new Set(found.map((f) => f.id));
        for (const id of ids) {
            if (!foundSet.has(id)) {
                throw new ApiError(404, 'NOT_FOUND', 'Unknown student');
            }
            holders.push({ type: HOLDER_TYPES.STUDENT, id });
        }
    } else {
        const ids = input.staffIds ?? [];
        if (ids.length === 0) {
            throw new ApiError(400, 'VALIDATION_ERROR', 'Choose staff members');
        }
        const found = await db.user.findMany({
            where: { id: { in: ids }, schoolId },
            select: { id: true },
        });
        const foundSet = new Set(found.map((f) => f.id));
        for (const id of ids) {
            if (!foundSet.has(id)) {
                throw new ApiError(404, 'NOT_FOUND', 'Unknown staff member');
            }
            holders.push({ type: HOLDER_TYPES.STAFF, id });
        }
    }

    return holders;
}

export async function generateCards(
    db: Db,
    schoolId: string,
    input: GenerateCardsInput
): Promise<IdentityCardShape[]> {
    const holders = await resolveHolders(db, schoolId, input);
    const resultIds: string[] = [];

    for (const h of holders) {
        const existing = await db.identityCard.findFirst({
            where: { schoolId, holderType: h.type, holderId: h.id },
            select: { id: true, status: true },
        });

        if (existing) {
            if (existing.status === CARD_STATUS.ACTIVE) {
                resultIds.push(existing.id);
                continue;
            }
            // REVOKED → re-issue in place with a new card number (unique constraint
            // forbids a second row for the same holder).
            const prefix = CARD_NUMBER_PREFIXES[h.type];
            const seq = await getNextSequence(db, 'identityCard', 'cardNumber', prefix, schoolId);
            const updated = await db.identityCard.update({
                where: { id: existing.id },
                data: {
                    cardNumber: nextCardNumber(prefix, seq),
                    status: CARD_STATUS.ACTIVE,
                    revokedAt: null,
                },
                select: { id: true },
            });
            resultIds.push(updated.id);
            continue;
        }

        const prefix = CARD_NUMBER_PREFIXES[h.type];
        const seq = await getNextSequence(db, 'identityCard', 'cardNumber', prefix, schoolId);
        const created = await db.identityCard.create({
            data: {
                schoolId,
                holderType: h.type,
                holderId: h.id,
                cardNumber: nextCardNumber(prefix, seq),
                status: CARD_STATUS.ACTIVE,
            },
            select: { id: true },
        });
        resultIds.push(created.id);
    }

    const cards = await db.identityCard.findMany({
        where: { id: { in: resultIds }, schoolId },
    });
    return attachHolderNames(db, schoolId, cards);
}

export async function getMyCard(
    db: Db,
    user: AuthPayload,
    schoolId: string
): Promise<IdentityCardShape | null> {
    let holderType: HolderType;
    let holderId: string;

    if (user.role === 'STUDENT') {
        const u = await db.user.findUnique({
            where: { id: user.userId },
            select: { email: true },
        });
        if (!u?.email) return null;
        const student = await db.student.findFirst({ where: { email: u.email } });
        if (!student) return null;
        holderType = HOLDER_TYPES.STUDENT;
        holderId = student.id;
    } else if (user.role === 'SUPER_ADMIN') {
        // Central officers have no personal card.
        return null;
    } else {
        holderType = HOLDER_TYPES.STAFF;
        holderId = user.userId;
    }

    const card = await db.identityCard.findFirst({
        where: { schoolId, holderType, holderId },
    });
    if (!card) return null;

    const [shape] = await attachHolderNames(db, schoolId, [card]);
    return shape;
}

export async function revokeCard(
    db: Db,
    schoolId: string,
    id: string
): Promise<IdentityCardShape | null> {
    const res = await db.identityCard.updateMany({
        where: { id, schoolId },
        data: { status: CARD_STATUS.REVOKED, revokedAt: new Date() },
    });
    if (res.count === 0) return null;

    const card = await db.identityCard.findUnique({ where: { id } });
    if (!card) return null;

    const [shape] = await attachHolderNames(db, schoolId, [card]);
    return shape;
}

// Re-export shared seq helper so routes/tests use one source of truth.
export { computeNextSeq, getNextSequence };

// ==============================================================================
// Audit log writer (server-side helper).
//
// Called from documented mutation routes (students create/update/enroll/graduate/
// leave-transfer review, fees payment, exams publish/unpublish, attendance mark)
// to append an immutable, tenant-scoped audit row describing the change.
//
// The `db` argument must be the client resolved by `withClient(user, …)`:
//  - school-scoped users -> extended tenant client (schoolId auto-injected)
//  - central officers       -> base client (schoolId must be passed explicitly)
// We always pass `schoolId` explicitly so both paths behave consistently.
//
// Spec: docs/specs/cross-cutting-infra.md §6.2
// ==============================================================================

export interface AuditWriteInput {
    schoolId: string;
    actorId: string;
    action: string;
    entityType: string;
    entityId: string;
    summary: string;
    /** Optional JSON string with extra context (e.g. prior/new values). */
    metadata?: string | null;
}

/**
 * Minimal structural client contract. Any Prisma client exposing the
 * `auditLog` delegate (extended tenant client, base client, or a
 * $transaction client) satisfies it, so callers never need to thread the
 * full `Db` type through.
 */
export interface AuditLogDb {
    auditLog: {
        create(args: { data: AuditWriteInput }): Promise<unknown>;
    };
}

export async function writeAuditLog(db: AuditLogDb, input: AuditWriteInput): Promise<void> {
    await db.auditLog.create({
        data: {
            schoolId: input.schoolId,
            actorId: input.actorId,
            action: input.action,
            entityType: input.entityType,
            entityId: input.entityId,
            summary: input.summary,
            metadata: input.metadata ?? null,
        },
    });
}

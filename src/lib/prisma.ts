import { PrismaClient } from '@prisma/client';
import { AsyncLocalStorage } from 'async_hooks';
import { ApiError } from './errors';

export const schoolIdStorage = new AsyncLocalStorage<string>();

// Models that are not scoped to a school tenant (the tenant root itself).
const NON_TENANTED_MODELS = new Set(['School']);

/**
 * Resolves the tenant id for a given model.
 * - Tenant-rooted models (e.g. School) are never scoped and never require a store.
 * - All other models REQUIRE a schoolId context. If none is present the query fails
 *   loudly instead of silently running unscoped (cross-tenant leak).
 */
function requireTenant(model: string): string | undefined {
  if (NON_TENANTED_MODELS.has(model)) {
    return undefined;
  }

  const schoolId = schoolIdStorage.getStore();
  if (!schoolId) {
    throw new ApiError(
      403,
      'TENANT_CONTEXT_REQUIRED',
      `Multi-tenant scoping requires a schoolId context for model "${model}"`
    );
  }
  return schoolId;
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prismaBase =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

export const prisma = prismaBase.$extends({
  query: {
    $allModels: {
      async findMany({ model, args, query }) {
        const schoolId = requireTenant(model as string);
        if (schoolId) {
          args.where = { ...args.where, schoolId };
        }
        return query(args);
      },
      async findUnique({ model, args, query }) {
        const schoolId = requireTenant(model as string);
        if (schoolId) {
          args.where = { ...args.where, schoolId };
        }
        return query(args);
      },
      async findFirst({ model, args, query }) {
        const schoolId = requireTenant(model as string);
        if (schoolId) {
          args.where = { ...args.where, schoolId };
        }
        return query(args);
      },
      async update({ model, args, query }) {
        const schoolId = requireTenant(model as string);
        if (schoolId) {
          args.where = { ...args.where, schoolId };
        }
        return query(args);
      },
      async delete({ model, args, query }) {
        const schoolId = requireTenant(model as string);
        if (schoolId) {
          args.where = { ...args.where, schoolId };
        }
        return query(args);
      },
      async create({ model, args, query }) {
        const schoolId = requireTenant(model as string);
        if (schoolId) {
          const wide = args as unknown as { data: Record<string, unknown> };
          wide.data = { ...wide.data, schoolId };
        }
        return query(args);
      },
      async createMany({ model, args, query }) {
        const schoolId = requireTenant(model as string);
        if (schoolId) {
          const wide = args as unknown as {
            data: Record<string, unknown> | Array<Record<string, unknown>>;
          };
          if (Array.isArray(wide.data)) {
            wide.data = wide.data.map((row) => ({ ...row, schoolId }));
          } else {
            wide.data = { ...wide.data, schoolId };
          }
        }
        return query(args);
      },
      async updateMany({ model, args, query }) {
        const schoolId = requireTenant(model as string);
        if (schoolId) {
          args.where = { ...args.where, schoolId };
        }
        return query(args);
      },
      async deleteMany({ model, args, query }) {
        const schoolId = requireTenant(model as string);
        if (schoolId) {
          args.where = { ...args.where, schoolId };
        }
        return query(args);
      },
      async count({ model, args, query }) {
        const schoolId = requireTenant(model as string);
        if (schoolId) {
          args.where = { ...args.where, schoolId };
        }
        return query(args);
      },
      async aggregate({ model, args, query }) {
        const schoolId = requireTenant(model as string);
        if (schoolId) {
          args.where = { ...args.where, schoolId };
        }
        return query(args);
      },
      async groupBy({ model, args, query }) {
        const schoolId = requireTenant(model as string);
        if (schoolId) {
          args.where = { ...args.where, schoolId };
        }
        return query(args);
      },
      async upsert({ model, args, query }) {
        const schoolId = requireTenant(model as string);
        if (schoolId) {
          args.where = { ...args.where, schoolId };
          const wide = args as unknown as {
            create: Record<string, unknown>;
            update: Record<string, unknown>;
          };
          wide.create = { ...wide.create, schoolId };
          wide.update = { ...wide.update, schoolId };
        }
        return query(args);
      },
    },
  },
});

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prismaBase;

// ---------------------------------------------------------------------------
// Central-officer support.
//
// A central officer (e.g. REGISTRAR_ADMIN) has `schoolId === 'ALL'`. The
// Prisma extension above injects that literal value into every scoped query,
// which matches no school row and therefore returns nothing. For central
// officers we intentionally run against the BASE client (no schoolId
// injection) so a single central account can operate across every school.
// School-scoped users continue to use the extended, tenant-scoped client, so
// tenant isolation for normal users is not weakened.
// ---------------------------------------------------------------------------
export const CENTRAL_SCHOOL_ID = 'ALL';

export function isCentralUser(user: { schoolId: string }): boolean {
  return user.schoolId === CENTRAL_SCHOOL_ID;
}

/** Type alias for a Prisma client passed through helpers. Both the base client
 * (`prismaBase`) and the extended tenant-scoped client (`prisma`) expose the
 * same standard CRUD surface used here, so `Db` abstracts over them. */
export type Db = PrismaClient;

/**
 * Runs a DB callback against the correct client for a user:
 *  - school-scoped users -> extended tenant-scoped client (auto-injects schoolId)
 *  - central officers       -> base client (no injection; across-school view)
 * The callback receives the client typed as `Db`; the returned value keeps its
 * full type through the generic.
 */
export async function withClient<T>(
  user: { schoolId: string },
  fn: (db: Db) => Promise<T>
): Promise<T> {
  const db = isCentralUser(user) ? prismaBase : prisma;
  return fn(db as Db);
}

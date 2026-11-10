import { withClient, isCentralUser } from '@/lib/prisma';
import { withAuth, successResponse, validateBody, errorResponse, ApiError } from '@/lib/api';
import { createBookSchema } from '@/lib/library-schemas';
import { resolveCreateTenant, tenantFilter, userHasPermission } from '@/lib/library-core';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET /api/library/books?schoolId=&search=
// Any authenticated user may search the catalogue (self-service). 200
// { books: [{ id, accessionNo, title, author, isbn, category, totalCopies,
//            availableCopies, shelf }] }
// ---------------------------------------------------------------------------
export const GET = withAuth(async (request, { user }) => {
    try {
        const url = new URL(request.url);
        const schoolId = url.searchParams.get('schoolId') ?? undefined;
        const search = url.searchParams.get('search')?.trim() ?? '';

        const books = await withClient(user, async (db) => {
            const where = tenantFilter(isCentralUser(user), schoolId);
            const listWhere: Record<string, unknown> = { ...where };
            if (search) {
                listWhere.OR = [
                    { title: { contains: search } },
                    { author: { contains: search } },
                    { isbn: { contains: search } },
                    { category: { contains: search } },
                ];
            }

            const rows = await db.libraryBook.findMany({
                where: listWhere,
                orderBy: { title: 'asc' },
                include: {
                    copies: {
                        select: {
                            id: true, available: true, accessionNo: true, loans: {
                                where: { status: { not: 'RETURNED' } },
                                select: { status: true },
                            }
                        }
                    },
                },
            });

            return rows.map((b) => {
                const availableCopies = b.copies.filter((c) => c.available).length;
                return {
                    id: b.id,
                    accessionNo: b.copies[0]?.accessionNo ?? null,
                    title: b.title,
                    author: b.author,
                    isbn: b.isbn,
                    category: b.category,
                    totalCopies: b.totalCopies,
                    availableCopies,
                    shelf: b.shelf,
                };
            });
        });

        return successResponse({ books });
    } catch (error) {
        return errorResponse(error);
    }
});

// ---------------------------------------------------------------------------
// POST /api/library/books — add a book (library.manage). 201 { book }
// ---------------------------------------------------------------------------
export const POST = withAuth(async (request, { user }) => {
    try {
        if (!(await userHasPermission(user, 'library.manage'))) {
            throw new ApiError(403, 'FORBIDDEN', 'Library management permission required');
        }

        const body = await validateBody(request, createBookSchema);
        const tenant = resolveCreateTenant(user, body.schoolId);

        const book = await withClient(user, async (db) => {
            const totalCopies = body.totalCopies ?? 1;
            const created = await db.libraryBook.create({
                data: {
                    title: body.title,
                    author: body.author,
                    isbn: body.isbn ?? null,
                    category: body.category ?? null,
                    shelf: body.shelf ?? null,
                    totalCopies,
                    schoolId: tenant,
                    copies: {
                        create: Array.from({ length: totalCopies }, (_, i) => ({
                            accessionNo: `ACC-${tenant.substring(0, 3).toUpperCase()}-${Date.now()}-${i + 1}`,
                            schoolId: tenant,
                        })),
                    },
                },
                include: {
                    copies: { select: { id: true, accessionNo: true, available: true } },
                },
            });

            return {
                id: created.id,
                title: created.title,
                author: created.author,
                isbn: created.isbn,
                category: created.category,
                shelf: created.shelf,
                totalCopies: created.totalCopies,
                availableCopies: created.copies.filter((c) => c.available).length,
            };
        });

        return successResponse({ book }, 201);
    } catch (error) {
        return errorResponse(error);
    }
});

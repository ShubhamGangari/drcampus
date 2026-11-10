import { withClient } from '@/lib/prisma';
import { withAuth, successResponse, validateBody, errorResponse, ApiError } from '@/lib/api';
import { updateBookSchema } from '@/lib/library-schemas';
import { userHasPermission } from '@/lib/library-core';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// PATCH /api/library/books/[id] — update a book (library.manage). 200 { book }
// If totalCopies increases, additional copies are created to match.
// ---------------------------------------------------------------------------
export const PATCH = withAuth(async (request, { user, params }) => {
    try {
        if (!(await userHasPermission(user, 'library.manage'))) {
            throw new ApiError(403, 'FORBIDDEN', 'Library management permission required');
        }

        const body = await validateBody(request, updateBookSchema);
        const id = params.id;

        const book = await withClient(user, async (db) => {
            const existing = await db.libraryBook.findUnique({ where: { id } });
            if (!existing) {
                throw new ApiError(404, 'NOT_FOUND', 'Book not found');
            }

            const newTotal = body.totalCopies ?? existing.totalCopies;
            const copiesToAdd = Math.max(0, newTotal - existing.totalCopies);

            const updated = await db.libraryBook.update({
                where: { id },
                data: {
                    title: body.title ?? existing.title,
                    author: body.author ?? existing.author,
                    isbn: body.isbn !== undefined ? body.isbn : existing.isbn,
                    category: body.category !== undefined ? body.category : existing.category,
                    shelf: body.shelf !== undefined ? body.shelf : existing.shelf,
                    totalCopies: newTotal,
                    copies: {
                        create: Array.from({ length: copiesToAdd }, (_, i) => ({
                            accessionNo: `ACC-${existing.schoolId.substring(0, 3).toUpperCase()}-${Date.now()}-${i + 1}`,
                            schoolId: existing.schoolId,
                        })),
                    },
                },
                include: {
                    copies: { select: { id: true, accessionNo: true, available: true } },
                },
            });

            return {
                id: updated.id,
                title: updated.title,
                author: updated.author,
                isbn: updated.isbn,
                category: updated.category,
                shelf: updated.shelf,
                totalCopies: updated.totalCopies,
                availableCopies: updated.copies.filter((c) => c.available).length,
            };
        });

        return successResponse({ book });
    } catch (error) {
        return errorResponse(error);
    }
});

// ---------------------------------------------------------------------------
// DELETE /api/library/books/[id] (library.manage) → 200 { success: true }
// Blocked while any copy carries an active (non-RETURNED) loan.
// ---------------------------------------------------------------------------
export const DELETE = withAuth(async (_request, { user, params }) => {
    try {
        if (!(await userHasPermission(user, 'library.manage'))) {
            throw new ApiError(403, 'FORBIDDEN', 'Library management permission required');
        }

        const id = params.id;
        await withClient(user, async (db) => {
            const existing = await db.libraryBook.findUnique({
                where: { id },
                include: { copies: { select: { id: true } } },
            });
            if (!existing) {
                throw new ApiError(404, 'NOT_FOUND', 'Book not found');
            }

            const copyIds = existing.copies.map((c) => c.id);
            if (copyIds.length) {
                const activeLoans = await db.libraryLoan.count({
                    where: { copyId: { in: copyIds }, status: { not: 'RETURNED' } },
                });
                if (activeLoans > 0) {
                    throw new ApiError(409, 'BOOK_IN_USE', 'Cannot delete a book with active loans');
                }
            }

            await db.libraryBook.delete({ where: { id } });
        });

        return successResponse({ success: true });
    } catch (error) {
        return errorResponse(error);
    }
});

"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { PageTitle } from "@/components/library/LibraryShell";
import { BookFormModal } from "@/components/library/BookFormModal";
import { Toast } from "@/components/admissions/Toast";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/admissions/States";
import { useUniversity } from "@/context/UniversityContext";
import {
    canManageLibrary,
    createBook,
    CreateBookInput,
    deleteBook,
    fetchBooks,
    LibraryApiError,
    LibraryBook,
    updateBook,
    UpdateBookInput,
} from "@/lib/library";

type AvailabilityFilter = "all" | "available" | "unavailable";

const inputCls =
    "h-10 px-3 rounded-xl border border-slate-300 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500";

export default function LibraryCataloguePage() {
    const { currentUser } = useUniversity();
    const isCentral = currentUser?.schoolId === "ALL";
    const canManage = canManageLibrary(currentUser?.role);

    const [schoolId, setSchoolId] = useState("");
    const [rows, setRows] = useState<LibraryBook[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [search, setSearch] = useState("");
    const [category, setCategory] = useState("");
    const [availability, setAvailability] = useState<AvailabilityFilter>("all");

    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<LibraryBook | null>(null);
    const [busy, setBusy] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

    useEffect(() => {
        const q = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("search") : null;
        if (q) setSearch(q);
    }, []);

    const load = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        try {
            const list = await fetchBooks({ schoolId: isCentral && schoolId ? schoolId : undefined });
            setRows(list.books);
        } catch (e) {
            setLoadError(e instanceof LibraryApiError ? e.message : "Unable to load catalogue.");
        } finally {
            setLoading(false);
        }
    }, [isCentral, schoolId]);

    useEffect(() => {
        load();
    }, [load]);

    const categories = Array.from(new Set(rows.map((b) => b.category).filter((c): c is string => !!c))).sort();

    const q = search.trim().toLowerCase();
    const filtered = rows.filter((b) => {
        if (q) {
            const hit =
                b.title.toLowerCase().includes(q) ||
                b.author.toLowerCase().includes(q) ||
                (b.isbn ?? "").toLowerCase().includes(q) ||
                (b.category ?? "").toLowerCase().includes(q);
            if (!hit) return false;
        }
        if (category && b.category !== category) return false;
        if (availability === "available" && b.availableCopies <= 0) return false;
        if (availability === "unavailable" && b.availableCopies > 0) return false;
        return true;
    });

    const submit = async (input: CreateBookInput | UpdateBookInput) => {
        setBusy(true);
        setSubmitError(null);
        try {
            if (editing) {
                await updateBook(editing.id, input as UpdateBookInput);
                setToast({ message: "Book updated.", type: "success" });
            } else {
                await createBook(input as CreateBookInput);
                setToast({ message: "Book added.", type: "success" });
            }
            setModalOpen(false);
            setEditing(null);
            load();
        } catch (e) {
            setSubmitError(e instanceof LibraryApiError ? e.message : "Unable to save book.");
        } finally {
            setBusy(false);
        }
    };

    const remove = async (book: LibraryBook) => {
        if (!window.confirm(`Delete "${book.title}"? This cannot be undone.`)) return;
        setBusy(true);
        try {
            await deleteBook(book.id);
            setToast({ message: "Book deleted.", type: "success" });
            load();
        } catch (e) {
            setToast({ message: e instanceof LibraryApiError ? e.message : "Unable to delete book.", type: "error" });
        } finally {
            setBusy(false);
        }
    };

    return (
        <div>
            <PageTitle
                title="Catalogue"
                subtitle="Books, editions and copies in the library collection."
                action={
                    canManage ? (
                        <button
                            type="button"
                            onClick={() => {
                                setEditing(null);
                                setModalOpen(true);
                            }}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-colors cursor-pointer"
                        >
                            <Plus className="h-4 w-4" /> Add Book
                        </button>
                    ) : undefined
                }
            />

            {isCentral && (
                <div className="mb-5 max-w-xs">
                    <select
                        id="catalogue-school"
                        value={schoolId}
                        onChange={(e) => setSchoolId(e.target.value)}
                        className={`${inputCls} w-full`}
                    >
                        <option value="">All schools</option>
                        <option value="SCHOOL_1">School 1</option>
                        <option value="SCHOOL_2">School 2</option>
                    </select>
                </div>
            )}

            <div className="mb-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="relative sm:col-span-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search title, author, ISBN…"
                        className={`${inputCls} w-full pl-10`}
                    />
                </div>
                <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls}>
                    <option value="">All categories</option>
                    {categories.map((c) => (
                        <option key={c} value={c}>
                            {c}
                        </option>
                    ))}
                </select>
                <select
                    value={availability}
                    onChange={(e) => setAvailability(e.target.value as AvailabilityFilter)}
                    className={inputCls}
                >
                    <option value="all">All availability</option>
                    <option value="available">Available copies</option>
                    <option value="unavailable">No copies available</option>
                </select>
            </div>

            {loading ? (
                <LoadingSkeleton rows={6} />
            ) : loadError ? (
                <ErrorState message={loadError} onRetry={load} />
            ) : filtered.length === 0 ? (
                <div className="rounded-2xl bg-white border border-slate-200 shadow-sm">
                    <EmptyState
                        title="No books in the catalogue yet"
                        description={
                            canManage
                                ? "Add your first book to build the library collection."
                                : "No books match your current filters."
                        }
                    />
                </div>
            ) : (
                <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] uppercase tracking-wider text-slate-500">
                                    <th className="px-5 py-3 font-bold">Accession No</th>
                                    <th className="px-5 py-3 font-bold">Title</th>
                                    <th className="px-5 py-3 font-bold">Author</th>
                                    <th className="px-5 py-3 font-bold">ISBN</th>
                                    <th className="px-5 py-3 font-bold">Category</th>
                                    <th className="px-5 py-3 font-bold text-right">Copies</th>
                                    <th className="px-5 py-3 font-bold">Shelf</th>
                                    {canManage && <th className="px-5 py-3 font-bold text-right">Actions</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((book) => (
                                    <tr
                                        key={book.id}
                                        className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/60 transition-colors"
                                    >
                                        <td className="px-5 py-3.5 font-mono text-xs text-slate-500">{book.accessionNo}</td>
                                        <td className="px-5 py-3.5 font-bold text-slate-900">{book.title}</td>
                                        <td className="px-5 py-3.5 text-slate-600">{book.author}</td>
                                        <td className="px-5 py-3.5 font-mono text-xs text-slate-500">{book.isbn ?? "—"}</td>
                                        <td className="px-5 py-3.5 text-slate-600">{book.category ?? "—"}</td>
                                        <td className="px-5 py-3.5 text-right whitespace-nowrap">
                                            <span className="text-slate-600">{book.totalCopies}</span>
                                            <span className="text-slate-400 mx-1">/</span>
                                            <span
                                                className={`inline-flex text-xs font-bold px-2 py-0.5 rounded-full border ${book.availableCopies > 0
                                                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                                        : "bg-rose-50 text-rose-700 border-rose-200"
                                                    }`}
                                            >
                                                {book.availableCopies} avail
                                            </span>
                                        </td>
                                        <td className="px-5 py-3.5 text-slate-600">{book.shelf ?? "—"}</td>
                                        {canManage && (
                                            <td className="px-5 py-3.5">
                                                <div className="flex items-center justify-end gap-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setEditing(book);
                                                            setModalOpen(true);
                                                        }}
                                                        aria-label={`Edit ${book.title}`}
                                                        className="p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                                                    >
                                                        <Pencil className="h-4 w-4" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => remove(book)}
                                                        aria-label={`Delete ${book.title}`}
                                                        className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            <BookFormModal
                open={modalOpen}
                book={editing}
                busy={busy}
                error={submitError}
                schoolRequired={isCentral && !editing}
                onClose={() => {
                    setModalOpen(false);
                    setEditing(null);
                    setSubmitError(null);
                }}
                onSubmit={submit}
            />

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    );
}

"use client";

import { useState } from "react";
import { Modal } from "@/components/admissions/Modal";
import {
    CreateBookInput,
    LibraryBook,
    UpdateBookInput,
} from "@/lib/library";

interface BookFormModalProps {
    open: boolean;
    book: LibraryBook | null;
    busy: boolean;
    error: string | null;
    schoolRequired: boolean;
    onClose: () => void;
    onSubmit: (input: CreateBookInput | UpdateBookInput) => void;
}

const inputCls =
    "w-full h-10 px-3 rounded-xl border border-slate-300 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500";

export function BookFormModal({ open, book, busy, error, schoolRequired, onClose, onSubmit }: BookFormModalProps) {
    const [title, setTitle] = useState(book?.title ?? "");
    const [author, setAuthor] = useState(book?.author ?? "");
    const [isbn, setIsbn] = useState(book?.isbn ?? "");
    const [category, setCategory] = useState(book?.category ?? "");
    const [shelf, setShelf] = useState(book?.shelf ?? "");
    const [totalCopies, setTotalCopies] = useState(String(book?.totalCopies ?? 1));
    const [schoolId, setSchoolId] = useState("");

    if (!open) return null;

    const canSubmit = title.trim() && author.trim() && (!schoolRequired || schoolId);

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!canSubmit) return;
        const base = {
            title: title.trim(),
            author: author.trim(),
            isbn: isbn.trim() || null,
            category: category.trim() || null,
            shelf: shelf.trim() || null,
        };
        if (book) {
            onSubmit({ ...base, totalCopies: Number(totalCopies) || 1 });
        } else {
            onSubmit({ ...base, totalCopies: Number(totalCopies) || 1, schoolId: schoolId || undefined });
        }
    };

    return (
        <Modal open={open} title={book ? "Edit book" : "Add book"} onClose={onClose}>
            <form onSubmit={submit} className="space-y-4">
                {schoolRequired && (
                    <div>
                        <label htmlFor="book-school" className="block text-xs font-bold text-slate-600 mb-1.5">
                            School
                        </label>
                        <select
                            id="book-school"
                            value={schoolId}
                            onChange={(e) => setSchoolId(e.target.value)}
                            className={inputCls}
                        >
                            <option value="">Select school…</option>
                            <option value="SCHOOL_1">School 1</option>
                            <option value="SCHOOL_2">School 2</option>
                        </select>
                    </div>
                )}

                <div>
                    <label htmlFor="book-title" className="block text-xs font-bold text-slate-600 mb-1.5">
                        Title
                    </label>
                    <input
                        id="book-title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="e.g. Database Systems"
                        className={inputCls}
                        required
                    />
                </div>

                <div>
                    <label htmlFor="book-author" className="block text-xs font-bold text-slate-600 mb-1.5">
                        Author
                    </label>
                    <input
                        id="book-author"
                        value={author}
                        onChange={(e) => setAuthor(e.target.value)}
                        placeholder="e.g. C.J. Date"
                        className={inputCls}
                        required
                    />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="book-isbn" className="block text-xs font-bold text-slate-600 mb-1.5">
                            ISBN
                        </label>
                        <input
                            id="book-isbn"
                            value={isbn}
                            onChange={(e) => setIsbn(e.target.value)}
                            placeholder="Optional"
                            className={inputCls}
                        />
                    </div>
                    <div>
                        <label htmlFor="book-category" className="block text-xs font-bold text-slate-600 mb-1.5">
                            Category
                        </label>
                        <input
                            id="book-category"
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            placeholder="e.g. Computer Science"
                            className={inputCls}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="book-shelf" className="block text-xs font-bold text-slate-600 mb-1.5">
                            Shelf
                        </label>
                        <input
                            id="book-shelf"
                            value={shelf}
                            onChange={(e) => setShelf(e.target.value)}
                            placeholder="e.g. A-12"
                            className={inputCls}
                        />
                    </div>
                    <div>
                        <label htmlFor="book-copies" className="block text-xs font-bold text-slate-600 mb-1.5">
                            Total copies
                        </label>
                        <input
                            id="book-copies"
                            type="number"
                            min={1}
                            value={totalCopies}
                            onChange={(e) => setTotalCopies(e.target.value)}
                            className={inputCls}
                        />
                    </div>
                </div>

                {error && <p className="text-xs font-medium text-rose-600">{error}</p>}

                <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 h-10 rounded-xl border border-slate-300 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={busy || !canSubmit}
                        className="inline-flex items-center gap-2 px-5 h-10 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 transition-colors cursor-pointer"
                    >
                        {busy ? "Saving…" : book ? "Save changes" : "Add book"}
                    </button>
                </div>
            </form>
        </Modal>
    );
}

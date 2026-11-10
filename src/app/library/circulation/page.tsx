"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeftRight, BookOpen, Undo2 } from "lucide-react";
import { PageTitle } from "@/components/library/LibraryShell";
import { Toast } from "@/components/admissions/Toast";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/admissions/States";
import { useUniversity } from "@/context/UniversityContext";
import {
    canManageLibrary,
    fetchBookCopies,
    fetchBooks,
    fetchLoans,
    fetchMemberships,
    issueLoan,
    LibraryApiError,
    LibraryBook,
    LibraryCopy,
    LibraryLoan,
    LibraryMembership,
    returnLoan,
} from "@/lib/library";

const inputCls =
    "w-full h-10 px-3 rounded-xl border border-slate-300 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500";

function statusBadge(status: string, overdue: boolean) {
    if (status === "RETURNED") {
        return <span className="inline-flex text-xs font-bold px-2.5 py-1 rounded-full border bg-slate-100 text-slate-600 border-slate-200">RETURNED</span>;
    }
    if (overdue) {
        return <span className="inline-flex text-xs font-bold px-2.5 py-1 rounded-full border bg-rose-50 text-rose-700 border-rose-200">OVERDUE</span>;
    }
    return <span className="inline-flex text-xs font-bold px-2.5 py-1 rounded-full border bg-indigo-50 text-indigo-700 border-indigo-200">ISSUED</span>;
}

export default function LibraryCirculationPage() {
    const { currentUser } = useUniversity();
    const isCentral = currentUser?.schoolId === "ALL";
    const canManage = canManageLibrary(currentUser?.role);

    const [schoolId, setSchoolId] = useState("");
    const [loans, setLoans] = useState<LibraryLoan[]>([]);
    const [books, setBooks] = useState<LibraryBook[]>([]);
    const [memberships, setMemberships] = useState<LibraryMembership[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    const [copies, setCopies] = useState<LibraryCopy[]>([]);
    const [selBook, setSelBook] = useState("");
    const [selCopy, setSelCopy] = useState("");
    const [selMember, setSelMember] = useState("");
    const [dueDate, setDueDate] = useState("");
    const [issueBusy, setIssueBusy] = useState(false);
    const [issueError, setIssueError] = useState<string | null>(null);
    const [returnBusyId, setReturnBusyId] = useState<string | null>(null);
    const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        try {
            const scoped = isCentral && schoolId ? schoolId : undefined;
            const [l, b, m] = await Promise.all([
                fetchLoans({ schoolId: scoped }),
                fetchBooks({ schoolId: scoped }),
                fetchMemberships({ schoolId: scoped }),
            ]);
            setLoans(l.loans);
            setBooks(b.books);
            setMemberships(m.memberships);
        } catch (e) {
            setLoadError(e instanceof LibraryApiError ? e.message : "Unable to load circulation.");
        } finally {
            setLoading(false);
        }
    }, [isCentral, schoolId]);

    useEffect(() => {
        load();
    }, [load]);

    useEffect(() => {
        if (!selBook) {
            setCopies([]);
            setSelCopy("");
            return;
        }
        let cancelled = false;
        fetchBookCopies(selBook)
            .then((res) => {
                if (!cancelled) {
                    setCopies(res.copies.filter((c) => c.available));
                    setSelCopy("");
                }
            })
            .catch(() => {
                if (!cancelled) setCopies([]);
            });
        return () => {
            cancelled = true;
        };
    }, [selBook]);

    useEffect(() => {
        if (!dueDate) {
            const d = new Date();
            d.setDate(d.getDate() + 14);
            setDueDate(d.toISOString().slice(0, 10));
        }
    }, [dueDate]);

    const issue = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!canManage || !selMember || !selCopy || !dueDate) return;
        setIssueBusy(true);
        setIssueError(null);
        try {
            await issueLoan({
                memberId: selMember,
                copyId: selCopy,
                dueDate: new Date(dueDate).toISOString(),
                schoolId: isCentral && schoolId ? schoolId : undefined,
            });
            setToast({ message: "Book issued.", type: "success" });
            setSelBook("");
            setSelCopy("");
            setSelMember("");
            load();
        } catch (err) {
            setIssueError(err instanceof LibraryApiError ? err.message : "Unable to issue book.");
        } finally {
            setIssueBusy(false);
        }
    };

    const doReturn = async (loan: LibraryLoan) => {
        setReturnBusyId(loan.id);
        try {
            await returnLoan(loan.id);
            setToast({ message: "Book returned. Fine updated if overdue.", type: "success" });
            load();
        } catch (e) {
            setToast({ message: e instanceof LibraryApiError ? e.message : "Unable to return book.", type: "error" });
        } finally {
            setReturnBusyId(null);
        }
    };

    const now = Date.now();
    const activeLoans = loans.filter((loan) => loan.status !== "RETURNED");

    return (
        <div>
            <PageTitle title="Circulation" subtitle="Issue and return books, and track active loans." />

            {isCentral && (
                <div className="mb-5 max-w-xs">
                    <select
                        id="circulation-school"
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

            {canManage && (
                <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5 mb-6">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="h-8 w-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                            <ArrowLeftRight className="h-4 w-4" />
                        </div>
                        <h2 className="text-sm font-black text-slate-900">Issue a book</h2>
                    </div>
                    <form onSubmit={issue} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div>
                            <label htmlFor="issue-member" className="block text-xs font-bold text-slate-600 mb-1.5">Member</label>
                            <select id="issue-member" value={selMember} onChange={(e) => setSelMember(e.target.value)} className={inputCls}>
                                <option value="">Select member…</option>
                                {memberships.filter((m) => m.active).map((m) => (
                                    <option key={m.userId} value={m.userId}>
                                        {m.name} ({m.type})
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="issue-book" className="block text-xs font-bold text-slate-600 mb-1.5">Book</label>
                            <select id="issue-book" value={selBook} onChange={(e) => setSelBook(e.target.value)} className={inputCls}>
                                <option value="">Select book…</option>
                                {books.filter((b) => b.availableCopies > 0).map((b) => (
                                    <option key={b.id} value={b.id}>
                                        {b.title} — {b.author}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="issue-copy" className="block text-xs font-bold text-slate-600 mb-1.5">Copy</label>
                            <select id="issue-copy" value={selCopy} onChange={(e) => setSelCopy(e.target.value)} className={inputCls} disabled={!selBook}>
                                <option value="">{!selBook ? "Select a book first" : copies.length ? "Select copy…" : "No copies available"}</option>
                                {copies.map((c) => (
                                    <option key={c.id} value={c.id}>{c.accessionNo}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="issue-due" className="block text-xs font-bold text-slate-600 mb-1.5">Due date</label>
                            <input id="issue-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputCls} />
                        </div>
                        <div className="sm:col-span-2 lg:col-span-4">
                            {issueError && <p className="text-xs font-medium text-rose-600 mb-3">{issueError}</p>}
                            <button
                                type="submit"
                                disabled={issueBusy || !selMember || !selCopy || !dueDate}
                                className="inline-flex items-center gap-2 px-5 h-10 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 transition-colors cursor-pointer"
                            >
                                <BookOpen className="h-4 w-4" /> {issueBusy ? "Issuing…" : "Issue book"}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <h2 className="text-sm font-black text-slate-900 mb-3">Active loans</h2>

            {loading ? (
                <LoadingSkeleton rows={5} />
            ) : loadError ? (
                <ErrorState message={loadError} onRetry={load} />
            ) : activeLoans.length === 0 ? (
                <div className="rounded-2xl bg-white border border-slate-200 shadow-sm">
                    <EmptyState title="No active loans" description="Issued books will appear here until they are returned." />
                </div>
            ) : (
                <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] uppercase tracking-wider text-slate-500">
                                    <th className="px-5 py-3 font-bold">Member</th>
                                    <th className="px-5 py-3 font-bold">Book</th>
                                    <th className="px-5 py-3 font-bold">Issue date</th>
                                    <th className="px-5 py-3 font-bold">Due date</th>
                                    <th className="px-5 py-3 font-bold">Status</th>
                                    {canManage && <th className="px-5 py-3 font-bold text-right">Actions</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {activeLoans.map((loan) => {
                                    const overdue = new Date(loan.dueDate).getTime() < now;
                                    return (
                                        <tr key={loan.id} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/60 transition-colors">
                                            <td className="px-5 py-3.5 font-bold text-slate-900">{loan.memberName}</td>
                                            <td className="px-5 py-3.5 text-slate-600">{loan.bookTitle}</td>
                                            <td className="px-5 py-3.5 text-slate-600">{new Date(loan.issueDate).toLocaleDateString()}</td>
                                            <td className="px-5 py-3.5 text-slate-600">{new Date(loan.dueDate).toLocaleDateString()}</td>
                                            <td className="px-5 py-3.5">{statusBadge(loan.status, overdue)}</td>
                                            {canManage && (
                                                <td className="px-5 py-3.5">
                                                    <div className="flex items-center justify-end">
                                                        <button
                                                            type="button"
                                                            onClick={() => doReturn(loan)}
                                                            disabled={returnBusyId === loan.id}
                                                            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors cursor-pointer"
                                                        >
                                                            <Undo2 className="h-3.5 w-3.5" />
                                                            {returnBusyId === loan.id ? "Returning…" : "Return"}
                                                        </button>
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    );
}

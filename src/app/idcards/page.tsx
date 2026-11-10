"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, ShieldAlert } from "lucide-react";
import { PageTitle } from "@/components/idcards/IdCardsShell";
import { Spinner, EmptyState, ErrorState } from "@/components/admissions/States";
import { Button } from "@/components/ui/Button";
import { fetchBatches, fetchStudents, type BatchOption, type StudentSummary } from "@/lib/students";
import { fetchUsers, type RbacUser } from "@/lib/rbac-client";
import {
    fetchIdCards,
    generateIdCards,
    revokeIdCard,
    type IdentityCardShape,
    type HolderType,
} from "@/lib/idcards";
import { cn } from "@/lib/cn";

type StatusFilter = "ALL" | "ACTIVE" | "REVOKED";

function formatDate(value: string): string {
    try {
        return new Date(value).toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
        });
    } catch {
        return value;
    }
}

function StatusBadge({ status }: { status: IdentityCardShape["status"] }) {
    return (
        <span
            className={cn(
                "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border",
                status === "ACTIVE"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-rose-50 text-rose-700 border-rose-200"
            )}
        >
            {status}
        </span>
    );
}

export default function IdCardsCenterPage() {
    const schoolId = useMemo(() => {
        if (typeof window === "undefined") return undefined;
        return new URLSearchParams(window.location.search).get("schoolId") ?? undefined;
    }, []);

    const [cards, setCards] = useState<IdentityCardShape[]>([]);
    const [batches, setBatches] = useState<BatchOption[]>([]);
    const [students, setStudents] = useState<StudentSummary[]>([]);
    const [staff, setStaff] = useState<RbacUser[]>([]);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");

    const [holderType, setHolderType] = useState<HolderType>("STUDENT");
    const [batchId, setBatchId] = useState("");
    const [selStudents, setSelStudents] = useState<string[]>([]);
    const [selStaff, setSelStaff] = useState<string[]>([]);
    const [genLoading, setGenLoading] = useState(false);
    const [genMsg, setGenMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
    const [revokingId, setRevokingId] = useState<string | null>(null);

    const loadCards = useCallback(async () => {
        try {
            const data = await fetchIdCards({
                ...(schoolId ? { schoolId } : {}),
                ...(statusFilter !== "ALL" ? { status: statusFilter } : {}),
            });
            setCards(data.cards);
            setError(null);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to load ID cards");
        }
    }, [schoolId, statusFilter]);

    useEffect(() => {
        let alive = true;
        (async () => {
            setLoading(true);
            const [cardsRes, batchesRes, studentsRes, staffRes] = await Promise.allSettled([
                fetchIdCards(schoolId ? { schoolId } : {}),
                fetchBatches(),
                fetchStudents(),
                fetchUsers(),
            ]);
            if (!alive) return;
            if (cardsRes.status === "fulfilled") setCards(cardsRes.value.cards);
            else setError(cardsRes.reason instanceof Error ? cardsRes.reason.message : "Failed to load ID cards");
            if (batchesRes.status === "fulfilled") setBatches(batchesRes.value);
            if (studentsRes.status === "fulfilled") setStudents(studentsRes.value);
            if (staffRes.status === "fulfilled") setStaff(staffRes.value.users);
            setLoading(false);
        })();
        return () => {
            alive = false;
        };
    }, [schoolId]);

    useEffect(() => {
        if (!loading) void loadCards();
    }, [statusFilter, loadCards, loading]);

    const toggleId = (list: string[], id: string, setter: (v: string[]) => void) => {
        setter(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
    };

    const canSubmit = useMemo(() => {
        if (holderType === "STUDENT") return Boolean(batchId || selStudents.length);
        return selStaff.length > 0;
    }, [holderType, batchId, selStudents, selStaff]);

    const submit = async () => {
        if (!canSubmit) return;
        setGenLoading(true);
        setGenMsg(null);
        try {
            await generateIdCards({
                holderType,
                schoolId,
                ...(holderType === "STUDENT"
                    ? {
                        ...(batchId ? { batchId } : {}),
                        ...(selStudents.length ? { studentIds: selStudents } : {}),
                    }
                    : { staffIds: selStaff }),
            });
            setGenMsg({ type: "success", text: "Cards generated." });
            setBatchId("");
            setSelStudents([]);
            setSelStaff([]);
            await loadCards();
        } catch (e) {
            setGenMsg({ type: "error", text: e instanceof Error ? e.message : "Generation failed" });
        } finally {
            setGenLoading(false);
        }
    };

    const revoke = async (id: string) => {
        if (!window.confirm("Revoke this card? It can be re-issued later.")) return;
        setRevokingId(id);
        try {
            await revokeIdCard(id, schoolId);
            await loadCards();
        } catch (e) {
            setGenMsg({
                type: "error",
                text: e instanceof Error ? e.message : "Failed to revoke card",
            });
        } finally {
            setRevokingId(null);
        }
    };

    const filteredCards = useMemo(() => {
        if (statusFilter === "ALL") return cards;
        return cards.filter((c) => c.status === statusFilter);
    }, [cards, statusFilter]);

    return (
        <div>
            <PageTitle
                title="ID Card Center"
                subtitle="Issue, print and manage identity cards for students and staff."
                action={
                    <Button variant="outline" size="sm" onClick={() => void loadCards()} disabled={loading}>
                        <RefreshCw className="h-3.5 w-3.5" /> Refresh
                    </Button>
                }
            />

            {/* Registry + generate */}
            {loading ? (
                <Spinner label="Loading ID cards…" />
            ) : error ? (
                <ErrorState message={error} onRetry={() => void loadCards()} />
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Generate panel */}
                    <section className="lg:col-span-1">
                        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5">
                            <h2 className="text-sm font-black text-slate-900">Generate cards</h2>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                                For a batch/class, individual students, or staff.
                            </p>

                            <div className="mt-4 space-y-4">
                                <div>
                                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                        Holder type
                                    </label>
                                    <div className="mt-1.5 grid grid-cols-2 gap-2">
                                        {(["STUDENT", "STAFF"] as HolderType[]).map((t) => (
                                            <button
                                                key={t}
                                                type="button"
                                                onClick={() => setHolderType(t)}
                                                className={cn(
                                                    "px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer",
                                                    holderType === t
                                                        ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                                                        : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                                                )}
                                            >
                                                {t === "STUDENT" ? "Students" : "Staff"}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {holderType === "STUDENT" ? (
                                    <>
                                        <div>
                                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                                Batch / class
                                            </label>
                                            <select
                                                value={batchId}
                                                onChange={(e) => setBatchId(e.target.value)}
                                                className="mt-1.5 w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            >
                                                <option value="">Select a batch…</option>
                                                {batches.map((b) => (
                                                    <option key={b.id} value={b.id}>
                                                        {b.name} ({b.academicYear})
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                                Or pick individual students
                                            </label>
                                            <div className="mt-1.5 max-h-44 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100">
                                                {students.length === 0 ? (
                                                    <p className="px-3 py-3 text-xs text-slate-400">
                                                        No students available.
                                                    </p>
                                                ) : (
                                                    students.map((s) => (
                                                        <label
                                                            key={s.id}
                                                            className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-slate-50 cursor-pointer"
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                checked={selStudents.includes(s.id)}
                                                                onChange={() => toggleId(selStudents, s.id, setSelStudents)}
                                                                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                                            />
                                                            <span className="text-sm font-medium text-slate-700">
                                                                {s.firstName} {s.lastName}
                                                            </span>
                                                            <span className="ml-auto text-[11px] text-slate-400 font-medium">
                                                                {s.rollNo}
                                                            </span>
                                                        </label>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <div>
                                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                            Pick staff
                                        </label>
                                        <div className="mt-1.5 max-h-56 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100">
                                            {staff.length === 0 ? (
                                                <p className="px-3 py-3 text-xs text-slate-400">
                                                    No staff found.
                                                </p>
                                            ) : (
                                                staff.map((u) => (
                                                    <label
                                                        key={u.id}
                                                        className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-slate-50 cursor-pointer"
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={selStaff.includes(u.id)}
                                                            onChange={() => toggleId(selStaff, u.id, setSelStaff)}
                                                            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                                        />
                                                        <span className="text-sm font-medium text-slate-700">{u.name}</span>
                                                        <span className="ml-auto text-[11px] text-slate-400 font-medium">
                                                            {u.role}
                                                        </span>
                                                    </label>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                )}

                                {genMsg && (
                                    <div
                                        className={cn(
                                            "rounded-xl px-3 py-2.5 text-xs font-semibold border flex items-start gap-2",
                                            genMsg.type === "success"
                                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                                : "bg-rose-50 text-rose-700 border-rose-200"
                                        )}
                                    >
                                        <ShieldAlert className="h-3.5 w-3.5 mt-px shrink-0" />
                                        {genMsg.text}
                                    </div>
                                )}

                                <Button
                                    className="w-full"
                                    onClick={() => void submit()}
                                    disabled={!canSubmit}
                                    loading={genLoading}
                                >
                                    Generate card{holderType === "STUDENT" && selStudents.length > 1 ? "s" : ""}
                                </Button>
                            </div>
                        </div>
                    </section>

                    {/* Registry table */}
                    <section className="lg:col-span-2">
                        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 pt-5 pb-3">
                                <h2 className="text-sm font-black text-slate-900">Issued cards</h2>
                                <div className="flex items-center gap-1.5">
                                    {(["ALL", "ACTIVE", "REVOKED"] as StatusFilter[]).map((s) => (
                                        <button
                                            key={s}
                                            type="button"
                                            onClick={() => setStatusFilter(s)}
                                            className={cn(
                                                "px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer border",
                                                statusFilter === s
                                                    ? "bg-slate-900 text-white border-slate-900"
                                                    : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                                            )}
                                        >
                                            {s === "ALL" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {filteredCards.length === 0 ? (
                                <EmptyState
                                    title={statusFilter === "ALL" ? "No cards issued yet" : "No cards in this status"}
                                    description={
                                        statusFilter === "ALL"
                                            ? "Use the generate panel to issue cards for a batch or individual holders."
                                            : "Cards in this status will appear here."
                                    }
                                />
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="text-[10px] uppercase tracking-wider text-slate-400 font-bold border-b border-slate-100 bg-slate-50/60">
                                                <th className="py-3 px-5">Holder</th>
                                                <th className="py-3 px-4">Type</th>
                                                <th className="py-3 px-4">Card number</th>
                                                <th className="py-3 px-4">Status</th>
                                                <th className="py-3 px-4">Issued</th>
                                                <th className="py-3 px-5 text-right">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {filteredCards.map((card) => (
                                                <tr
                                                    key={card.id}
                                                    className="hover:bg-slate-50/40 transition-colors"
                                                >
                                                    <td className="py-3.5 px-5">
                                                        <p className="text-sm font-bold text-slate-800">{card.holderName}</p>
                                                        <p className="text-[11px] text-slate-400 font-medium">
                                                            {card.holderId}
                                                        </p>
                                                    </td>
                                                    <td className="py-3.5 px-4">
                                                        <span className="text-xs font-semibold text-slate-600">
                                                            {card.holderType === "STUDENT" ? "Student" : "Staff"}
                                                        </span>
                                                    </td>
                                                    <td className="py-3.5 px-4">
                                                        <span className="text-xs font-bold text-indigo-700 font-mono">
                                                            {card.cardNumber}
                                                        </span>
                                                    </td>
                                                    <td className="py-3.5 px-4">
                                                        <StatusBadge status={card.status} />
                                                    </td>
                                                    <td className="py-3.5 px-4 text-xs text-slate-500 font-medium">
                                                        {formatDate(card.issuedAt)}
                                                    </td>
                                                    <td className="py-3.5 px-5 text-right">
                                                        {card.status === "ACTIVE" && (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                loading={revokingId === card.id}
                                                                onClick={() => void revoke(card.id)}
                                                                className="text-rose-600 hover:bg-rose-50"
                                                            >
                                                                Revoke
                                                            </Button>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </section>
                </div>
            )}
        </div>
    );
}

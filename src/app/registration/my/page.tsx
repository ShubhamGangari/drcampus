"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, ClipboardList, Search } from "lucide-react";
import { PageTitle } from "@/components/registration/RegistrationShell";
import { ErrorState, LoadingSkeleton } from "@/components/admissions/States";
import {
    RegistrationApiError,
    fetchCatalog,
    fetchMyRegistrations,
    submitMyRegistrations,
} from "@/lib/registration";

const CREDIT_CAP = 24;

export default function RegistrationMyPage() {
    const [registered, setRegistered] = useState<Awaited<ReturnType<typeof fetchMyRegistrations>>["registrations"]>([]);
    const [catalog, setCatalog] = useState<Awaited<ReturnType<typeof fetchCatalog>>["courses"]>([]);
    const [selected, setSelected] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [submitOk, setSubmitOk] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        try {
            const [m, c] = await Promise.all([fetchMyRegistrations(), fetchCatalog()]);
            setRegistered(m.registrations);
            setCatalog(c.courses);
        } catch (e) {
            setLoadError(e instanceof RegistrationApiError ? e.message : "Unable to load your registrations.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const registeredIds = new Set(registered.map((r) => r.courseId));
    const available = catalog.filter((c) => !registeredIds.has(c.id));

    const selectedCredits = useMemo(() => {
        return available.filter((c) => selected.includes(c.id)).reduce((sum, c) => sum + c.credits, 0);
    }, [available, selected]);

    const overCap = selectedCredits > CREDIT_CAP;

    const toggle = (id: string) => {
        setSubmitOk(false);
        setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    };

    const handleSubmit = async () => {
        if (selected.length === 0 || overCap) return;
        setSubmitting(true);
        setSubmitError(null);
        try {
            const res = await submitMyRegistrations({ courseIds: selected });
            setRegistered(res.registrations);
            setSelected([]);
            setSubmitOk(true);
        } catch (e) {
            setSubmitError(e instanceof RegistrationApiError ? e.message : "Could not submit registration.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div>
            <PageTitle title="My Registration" subtitle="Select electives within the credit cap and submit." />

            {loading ? (
                <LoadingSkeleton rows={5} />
            ) : loadError ? (
                <ErrorState message={loadError} onRetry={load} />
            ) : (
                <div className="space-y-6">
                    {submitOk && (
                        <div className="flex items-start gap-3 rounded-2xl bg-emerald-50 border border-emerald-200 p-4">
                            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                            <div>
                                <p className="text-sm font-bold text-emerald-800">Registration submitted</p>
                                <p className="text-xs text-emerald-700 mt-0.5">
                                    Your selections were registered for the current semester.
                                </p>
                            </div>
                        </div>
                    )}

                    {submitError && (
                        <div className="rounded-2xl bg-rose-50 border border-rose-200 p-4 text-sm text-rose-700">
                            {submitError}
                        </div>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2 rounded-2xl bg-white border border-slate-200 shadow-sm p-6">
                            <h3 className="text-sm font-black text-slate-900 tracking-tight mb-4">Available courses</h3>
                            {available.length === 0 ? (
                                <div className="text-center py-8">
                                    <Search className="mx-auto h-8 w-8 text-slate-300 mb-3" />
                                    <p className="text-sm font-bold text-slate-700">Nothing left to register</p>
                                    <p className="text-xs text-slate-500 mt-1">
                                        You are already registered for every course in the catalog.
                                    </p>
                                </div>
                            ) : (
                                <ul className="divide-y divide-slate-100">
                                    {available.map((c) => {
                                        const isSelected = selected.includes(c.id);
                                        const full = c.seatsFilled >= c.seatsTotal;
                                        return (
                                            <li key={c.id} className="py-3 flex items-center justify-between gap-4">
                                                <div className="min-w-0">
                                                    <p className="text-sm font-bold text-slate-800">
                                                        {c.code} · {c.title}
                                                    </p>
                                                    <p className="text-xs text-slate-500">
                                                        {c.credits} credits · {c.type} · {c.seatsFilled}/{c.seatsTotal} seats
                                                    </p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => toggle(c.id)}
                                                    disabled={full}
                                                    className={`shrink-0 text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors cursor-pointer ${isSelected
                                                            ? "bg-indigo-600 text-white border-indigo-600"
                                                            : full
                                                                ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                                                                : "bg-white text-indigo-700 border-indigo-200 hover:bg-indigo-50"
                                                        }`}
                                                >
                                                    {isSelected ? "Selected" : full ? "Full" : "Select"}
                                                </button>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </div>

                        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-6 h-fit">
                            <h3 className="text-sm font-black text-slate-900 tracking-tight mb-4">Summary</h3>
                            <dl className="space-y-3 text-sm">
                                <div className="flex items-center justify-between">
                                    <dt className="text-slate-500">Selected courses</dt>
                                    <dd className="font-bold text-slate-900">{selected.length}</dd>
                                </div>
                                <div className="flex items-center justify-between">
                                    <dt className="text-slate-500">Selected credits</dt>
                                    <dd className={`font-bold ${overCap ? "text-rose-600" : "text-slate-900"}`}>
                                        {selectedCredits} / {CREDIT_CAP}
                                    </dd>
                                </div>
                            </dl>
                            {overCap && (
                                <p className="mt-4 text-xs text-rose-600">
                                    Selected credits exceed the {CREDIT_CAP} credit cap for this semester.
                                </p>
                            )}
                            <button
                                type="button"
                                onClick={handleSubmit}
                                disabled={selected.length === 0 || overCap || submitting}
                                className="mt-5 w-full inline-flex items-center justify-center gap-2 text-xs font-bold px-4 py-2.5 rounded-xl bg-slate-900 text-white hover:bg-indigo-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                            >
                                <ClipboardList className="h-3.5 w-3.5" />
                                {submitting ? "Submitting…" : "Submit registration"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

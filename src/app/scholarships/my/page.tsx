"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { PageTitle } from "@/components/scholarships/ScholarshipsShell";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/admissions/States";
import {
    createApplication,
    fetchApplications,
    fetchSchemes,
    ScholarshipsApiError,
    ScholarshipApplication,
    ScholarshipScheme,
} from "@/lib/scholarships";

const inputCls =
    "w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500";

export default function MyApplicationsPage() {

    const [applications, setApplications] = useState<ScholarshipApplication[]>([]);
    const [schemes, setSchemes] = useState<ScholarshipScheme[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    const [formOpen, setFormOpen] = useState(false);
    const [schemeId, setSchemeId] = useState("");
    const [notes, setNotes] = useState("");
    const [busy, setBusy] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [fieldError, setFieldError] = useState<string | null>(null);
    const [eligibility, setEligibility] = useState<{ eligible: boolean; reason?: string } | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        try {
            const [a, s] = await Promise.all([fetchApplications(), fetchSchemes()]);
            setApplications(a.applications);
            setSchemes(s.schemes.filter((x) => x.active));
        } catch (e) {
            setLoadError(e instanceof ScholarshipsApiError ? e.message : "Unable to load applications.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const submit = async () => {
        setFieldError(null);
        setSubmitError(null);
        setEligibility(null);
        if (!schemeId) {
            setFieldError("Select a scheme.");
            return;
        }
        setBusy(true);
        try {
            const res = await createApplication({
                schemeId,
                notes: notes.trim() ? notes.trim() : undefined,
            });
            setApplications((prev) => [res.application, ...prev]);
            setEligibility({ eligible: res.application.eligible });
            setFormOpen(false);
            setSchemeId("");
            setNotes("");
        } catch (e) {
            setSubmitError(e instanceof ScholarshipsApiError ? e.message : "Unable to apply.");
        } finally {
            setBusy(false);
        }
    };

    return (
        <div>
            <PageTitle
                title="My applications"
                subtitle="Track your scholarship applications and eligibility."
                action={
                    <button
                        type="button"
                        onClick={() => {
                            setFormOpen((v) => !v);
                            setEligibility(null);
                            setSubmitError(null);
                        }}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-colors cursor-pointer"
                    >
                        <Plus className="h-4 w-4" /> Apply
                    </button>
                }
            />

            {formOpen && (
                <div className="mb-6 rounded-2xl bg-white border border-slate-200 shadow-sm p-6">
                    <h2 className="text-base font-bold text-slate-900 mb-4">New application</h2>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                                Scheme
                            </label>
                            <select value={schemeId} onChange={(e) => setSchemeId(e.target.value)} className={inputCls}>
                                <option value="">Select a scheme…</option>
                                {schemes.map((s) => (
                                    <option key={s.id} value={s.id}>
                                        {s.name} ({s.type.replace("_", " ")})
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                                Notes (optional)
                            </label>
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                rows={3}
                                placeholder="Any supporting information…"
                                className={inputCls}
                            />
                        </div>
                    </div>

                    {(fieldError || submitError) && (
                        <p className="mt-3 text-xs font-medium text-rose-600">{fieldError ?? submitError}</p>
                    )}
                    {eligibility && (
                        <p
                            className={`mt-3 text-xs font-bold px-3 py-2 rounded-xl ${eligibility.eligible
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-amber-50 text-amber-700"
                                }`}
                        >
                            {eligibility.eligible
                                ? "You are eligible for this scheme."
                                : "Application submitted — eligibility will be evaluated by the admin."}
                        </p>
                    )}

                    <div className="mt-4 flex items-center gap-2">
                        <button
                            type="button"
                            onClick={submit}
                            disabled={busy}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-indigo-600 transition-colors disabled:opacity-60 cursor-pointer"
                        >
                            {busy ? "Submitting…" : "Submit application"}
                        </button>
                        <button
                            type="button"
                            onClick={() => setFormOpen(false)}
                            className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {loading ? (
                <LoadingSkeleton rows={6} />
            ) : loadError ? (
                <ErrorState message={loadError} onRetry={load} />
            ) : applications.length === 0 ? (
                <div className="rounded-2xl bg-white border border-slate-200 shadow-sm">
                    <EmptyState
                        title="No applications yet"
                        description="Browse active schemes and submit your first application."
                    />
                </div>
            ) : (
                <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
                    <ul className="divide-y divide-slate-100">
                        {applications.map((a) => (
                            <li key={a.id} className="px-5 py-4">
                                <div className="flex items-center justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="text-sm font-bold text-slate-900 truncate">{a.schemeName}</p>
                                        <p className="text-[11px] text-slate-500 mt-0.5">
                                            Submitted {new Date(a.createdAt).toLocaleDateString()}
                                            {a.eligible ? " · Eligible" : " · Pending review"}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-3 shrink-0">
                                        {a.status === "APPROVED" && (
                                            <span className="text-sm font-black text-emerald-600">
                                                ₹{a.awardedAmount.toLocaleString("en-IN")}
                                            </span>
                                        )}
                                        <span
                                            className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${a.status === "APPROVED"
                                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                                : a.status === "REJECTED"
                                                    ? "bg-rose-50 text-rose-700 border-rose-200"
                                                    : "bg-amber-50 text-amber-700 border-amber-200"
                                                }`}
                                        >
                                            {a.status}
                                        </span>
                                    </div>
                                </div>
                                {a.remark && (
                                    <p className="mt-2 text-xs text-slate-500 bg-slate-50 rounded-xl px-3 py-2">
                                        <span className="font-bold text-slate-600">Remark: </span>
                                        {a.remark}
                                    </p>
                                )}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}

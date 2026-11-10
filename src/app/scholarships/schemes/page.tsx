"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, PencilLine, Power } from "lucide-react";
import { PageTitle } from "@/components/scholarships/ScholarshipsShell";
import { ErrorState, LoadingSkeleton } from "@/components/admissions/States";
import { useUniversity } from "@/context/UniversityContext";
import {
    canManageScholarships,
    createScheme,
    fetchSchemes,
    SCHEME_TYPES,
    SCHEME_VALUE_KINDS,
    ScholarshipsApiError,
    ScholarshipScheme,
    updateScheme,
} from "@/lib/scholarships";

const inputCls =
    "h-10 px-3 rounded-xl border border-slate-300 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500";

interface CriteriaForm {
    minPercentage: string;
    category: string;
    sports: boolean;
}

function parseCriteria(json: string): Record<string, unknown> {
    try {
        const p = JSON.parse(json) as Record<string, unknown>;
        return typeof p === "object" && p !== null ? p : {};
    } catch {
        return {};
    }
}

function CriteriaLabel({ json }: { json: string }) {
    const c = parseCriteria(json);
    const parts: string[] = [];
    if (c.minPercentage !== undefined && c.minPercentage !== null && c.minPercentage !== "") {
        parts.push(`min ${c.minPercentage}%`);
    }
    if (c.category) parts.push(`category: ${String(c.category)}`);
    if (c.sports) parts.push("sports");
    if (c.academicYear) parts.push(`AY ${String(c.academicYear)}`);
    return <span>{parts.length ? parts.join(" · ") : "—"}</span>;
}

export default function SchemesPage() {
    const { currentUser } = useUniversity();
    const canManage = canManageScholarships(currentUser);

    const [schemes, setSchemes] = useState<ScholarshipScheme[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    const [formOpen, setFormOpen] = useState(false);
    const [editing, setEditing] = useState<ScholarshipScheme | null>(null);
    const [name, setName] = useState("");
    const [type, setType] = useState("MERIT");
    const [value, setValue] = useState("");
    const [valueKind, setValueKind] = useState("AMOUNT");
    const [criteria, setCriteria] = useState<CriteriaForm>({ minPercentage: "", category: "", sports: false });
    const [busy, setBusy] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [fieldError, setFieldError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        try {
            const res = await fetchSchemes();
            setSchemes(res.schemes);
        } catch (e) {
            setLoadError(e instanceof ScholarshipsApiError ? e.message : "Unable to load schemes.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const openCreate = () => {
        setEditing(null);
        setName("");
        setType("MERIT");
        setValue("");
        setValueKind("AMOUNT");
        setCriteria({ minPercentage: "", category: "", sports: false });
        setSubmitError(null);
        setFieldError(null);
        setFormOpen(true);
    };

    const openEdit = (s: ScholarshipScheme) => {
        const c = parseCriteria(s.criteriaJson);
        setEditing(s);
        setName(s.name);
        setType(s.type);
        setValue(String(s.value));
        setValueKind(s.valueKind);
        setCriteria({
            minPercentage: c.minPercentage !== undefined ? String(c.minPercentage) : "",
            category: c.category !== undefined ? String(c.category) : "",
            sports: Boolean(c.sports),
        });
        setSubmitError(null);
        setFieldError(null);
        setFormOpen(true);
    };

    const submit = async () => {
        setFieldError(null);
        setSubmitError(null);
        if (!name.trim()) {
            setFieldError("Scheme name is required.");
            return;
        }
        const numValue = Number(value);
        if (!value || Number.isNaN(numValue) || numValue < 0) {
            setFieldError("Enter a valid value.");
            return;
        }
        const criteriaJson = JSON.stringify({
            ...(criteria.minPercentage ? { minPercentage: Number(criteria.minPercentage) } : {}),
            ...(criteria.category ? { category: criteria.category } : {}),
            ...(criteria.sports ? { sports: true } : {}),
        });
        setBusy(true);
        try {
            if (editing) {
                const res = await updateScheme(editing.id, {
                    name: name.trim(),
                    type: type as ScholarshipScheme["type"],
                    value: numValue,
                    valueKind: valueKind as ScholarshipScheme["valueKind"],
                    criteriaJson,
                });
                setSchemes((prev) => prev.map((x) => (x.id === editing.id ? res.scheme : x)));
            } else {
                const res = await createScheme({
                    name: name.trim(),
                    type: type as ScholarshipScheme["type"],
                    value: numValue,
                    valueKind: valueKind as ScholarshipScheme["valueKind"],
                    criteriaJson,
                });
                setSchemes((prev) => [...prev, res.scheme]);
            }
            setFormOpen(false);
        } catch (e) {
            setSubmitError(e instanceof ScholarshipsApiError ? e.message : "Unable to save scheme.");
        } finally {
            setBusy(false);
        }
    };

    const toggleActive = async (s: ScholarshipScheme) => {
        try {
            const res = await updateScheme(s.id, { active: !s.active });
            setSchemes((prev) => prev.map((x) => (x.id === s.id ? res.scheme : x)));
        } catch (e) {
            setSubmitError(e instanceof ScholarshipsApiError ? e.message : "Unable to update scheme.");
        }
    };

    return (
        <div>
            <PageTitle
                title="Schemes"
                subtitle="Scholarship and concession schemes offered by the university."
                action={
                    canManage ? (
                        <button
                            type="button"
                            onClick={openCreate}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-colors cursor-pointer"
                        >
                            <Plus className="h-4 w-4" /> New scheme
                        </button>
                    ) : undefined
                }
            />

            {formOpen && canManage && (
                <div className="mb-6 rounded-2xl bg-white border border-slate-200 shadow-sm p-6">
                    <h2 className="text-base font-bold text-slate-900 mb-4">
                        {editing ? "Edit scheme" : "Create scheme"}
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                                Name
                            </label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="e.g. Merit 75%"
                                className={`${inputCls} w-full`}
                            />
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                                Type
                            </label>
                            <select value={type} onChange={(e) => setType(e.target.value)} className={`${inputCls} w-full`}>
                                {SCHEME_TYPES.map((t) => (
                                    <option key={t} value={t}>
                                        {t.replace("_", " ")}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                                Value
                            </label>
                            <input
                                type="number"
                                min={0}
                                value={value}
                                onChange={(e) => setValue(e.target.value)}
                                placeholder="5000"
                                className={`${inputCls} w-full`}
                            />
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                                Value kind
                            </label>
                            <select value={valueKind} onChange={(e) => setValueKind(e.target.value)} className={`${inputCls} w-full`}>
                                {SCHEME_VALUE_KINDS.map((k) => (
                                    <option key={k} value={k}>
                                        {k}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                                Min percentage (MERIT)
                            </label>
                            <input
                                type="number"
                                min={0}
                                max={100}
                                value={criteria.minPercentage}
                                onChange={(e) => setCriteria((c) => ({ ...c, minPercentage: e.target.value }))}
                                placeholder="75"
                                className={`${inputCls} w-full`}
                            />
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                                Category (CATEGORY)
                            </label>
                            <input
                                type="text"
                                value={criteria.category}
                                onChange={(e) => setCriteria((c) => ({ ...c, category: e.target.value }))}
                                placeholder="SC / OBC / EWS…"
                                className={`${inputCls} w-full`}
                            />
                        </div>
                        <label className="flex items-center gap-2 text-sm font-medium text-slate-700 sm:col-span-2">
                            <input
                                type="checkbox"
                                checked={criteria.sports}
                                onChange={(e) => setCriteria((c) => ({ ...c, sports: e.target.checked }))}
                                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            Sports quota (SPORTS)
                        </label>
                    </div>

                    {(fieldError || submitError) && (
                        <p className="mt-3 text-xs font-medium text-rose-600">{fieldError ?? submitError}</p>
                    )}

                    <div className="mt-4 flex items-center gap-2">
                        <button
                            type="button"
                            onClick={submit}
                            disabled={busy}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-indigo-600 transition-colors disabled:opacity-60 cursor-pointer"
                        >
                            {busy ? "Saving…" : editing ? "Save changes" : "Create scheme"}
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
            ) : (
                <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-200/80">
                                <th className="px-5 py-3">Name</th>
                                <th className="px-5 py-3">Type</th>
                                <th className="px-5 py-3">Value</th>
                                <th className="px-5 py-3">Eligibility</th>
                                <th className="px-5 py-3">Status</th>
                                {canManage && <th className="px-5 py-3 text-right">Actions</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {schemes.map((s) => (
                                <tr key={s.id} className="hover:bg-slate-50/60">
                                    <td className="px-5 py-3.5 font-bold text-slate-900">{s.name}</td>
                                    <td className="px-5 py-3.5 text-slate-600">{s.type.replace("_", " ")}</td>
                                    <td className="px-5 py-3.5 text-slate-600">
                                        {s.valueKind === "PERCENT" ? `${s.value}%` : `₹${s.value.toLocaleString("en-IN")}`}
                                    </td>
                                    <td className="px-5 py-3.5 text-slate-600">
                                        <CriteriaLabel json={s.criteriaJson} />
                                    </td>
                                    <td className="px-5 py-3.5">
                                        <span
                                            className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${s.active
                                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                                : "bg-slate-100 text-slate-500 border-slate-200"
                                                }`}
                                        >
                                            {s.active ? "Active" : "Inactive"}
                                        </span>
                                    </td>
                                    {canManage && (
                                        <td className="px-5 py-3.5">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => openEdit(s)}
                                                    className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors cursor-pointer"
                                                    title="Edit"
                                                >
                                                    <PencilLine className="h-4 w-4" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => toggleActive(s)}
                                                    className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors cursor-pointer"
                                                    title={s.active ? "Deactivate" : "Activate"}
                                                >
                                                    <Power className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {schemes.length === 0 && (
                        <div className="py-8 text-center text-xs text-slate-500">No schemes defined yet.</div>
                    )}
                </div>
            )}
        </div>
    );
}

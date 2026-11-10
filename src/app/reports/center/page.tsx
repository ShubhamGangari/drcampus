"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
    ArrowDownToLine,
    FileJson,
    FileText,
    LayoutGrid,
    Play,
    Plus,
    RefreshCw,
    Save,
    Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/admissions/States";

// ---- DTOs (mirror the API contract) ----------------------------------------
interface FilterDef {
    key: string;
    label: string;
    kind: "text" | "select" | "date";
}
interface ReportTypeDef {
    key: string;
    domain: string;
    label: string;
    description: string;
    filters: FilterDef[];
}
interface ReportTable {
    columns: string[];
    rows: Record<string, unknown>[];
}
interface SavedReport {
    id: string;
    name: string;
    type: string;
    filters: Record<string, unknown>;
    createdAt: string;
}

const DOMAIN_ORDER = ["fees", "results", "attendance", "certificates", "admissions"];

const DOMAIN_META: Record<string, { label: string; chip: string }> = {
    fees: { label: "Fees", chip: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    results: { label: "Results", chip: "bg-indigo-50 text-indigo-700 border-indigo-200" },
    attendance: { label: "Attendance", chip: "bg-amber-50 text-amber-700 border-amber-200" },
    certificates: { label: "Certificates", chip: "bg-sky-50 text-sky-700 border-sky-200" },
    admissions: { label: "Admissions", chip: "bg-violet-50 text-violet-700 border-violet-200" },
};

// Static option sets for select-kind filters that don't come from a module endpoint.
const STATIC_OPTIONS: Record<string, string[]> = {
    // admissions application status
    status: ["APPLIED", "SHORTLISTED", "ALLOTTED", "ADMITTED", "REJECTED"],
    // certificate type
    type: ["PROVISIONAL", "TRANSCRIPT", "BONAFIDE", "CHARACTER", "TC"],
};

// Endpoint per entity select filter key.
const OPTION_ENDPOINTS: Record<string, string> = {
    examId: "/api/exams",
    courseId: "/api/classes",
    cycleId: "/api/admissions/cycles",
};

function extractArray(data: unknown): unknown[] {
    if (Array.isArray(data)) return data;
    if (data && typeof data === "object") {
        for (const key of ["exams", "courses", "classes", "cycles", "items", "rows", "results"]) {
            const v = (data as Record<string, unknown>)[key];
            if (Array.isArray(v)) return v;
        }
    }
    return [];
}

async function loadEntityOptions(urlPath: string): Promise<Array<{ value: string; label: string }>> {
    try {
        const res = await fetch(urlPath, { cache: "no-store" });
        if (!res.ok) return [];
        const data: unknown = await res.json();
        return extractArray(data)
            .map((item) => {
                const rec = (item ?? {}) as Record<string, unknown>;
                const value = rec.id ?? rec.value ?? "";
                const label = rec.title ?? rec.name ?? rec.label ?? rec.code ?? value;
                return { value: String(value), label: String(label) };
            })
            .filter((o) => o.value);
    } catch {
        return [];
    }
}

export default function ReportsCenterPage() {
    const [tab, setTab] = useState<"builder" | "saved">("builder");

    const [types, setTypes] = useState<ReportTypeDef[]>([]);
    const [typesLoading, setTypesLoading] = useState(true);
    const [typesError, setTypesError] = useState<string | null>(null);

    const [activeType, setActiveType] = useState<ReportTypeDef | null>(null);
    const [filterValues, setFilterValues] = useState<Record<string, string>>({});
    const [options, setOptions] = useState<Record<string, Array<{ value: string; label: string }>>>({});
    const [optionsLoading, setOptionsLoading] = useState<Record<string, boolean>>({});

    const [table, setTable] = useState<ReportTable | null>(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [previewError, setPreviewError] = useState<string | null>(null);
    const [exportError, setExportError] = useState<string | null>(null);
    const [dirty, setDirty] = useState(false);

    const [saved, setSaved] = useState<SavedReport[]>([]);
    const [savedLoading, setSavedLoading] = useState(false);
    const [savedError, setSavedError] = useState<string | null>(null);
    const [saveName, setSaveName] = useState("");
    const [saving, setSaving] = useState(false);

    const loadTypes = useCallback(async () => {
        setTypesLoading(true);
        setTypesError(null);
        try {
            const res = await fetch("/api/reports/center/types", { cache: "no-store" });
            if (!res.ok) {
                const body = await res.json().catch(() => null);
                setTypesError(body?.error?.message ?? "Failed to load report catalog.");
                return;
            }
            const data = (await res.json()) as { types: ReportTypeDef[] };
            setTypes(data.types);
            if (data.types.length > 0) {
                setActiveType(data.types[0]);
            }
        } catch {
            setTypesError("Unable to reach the reports service.");
        } finally {
            setTypesLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadTypes();
    }, [loadTypes]);

    // Group available types by domain (ordered).
    const grouped = useMemo(() => {
        const byDomain = new Map<string, ReportTypeDef[]>();
        for (const t of types) {
            const list = byDomain.get(t.domain) ?? [];
            list.push(t);
            byDomain.set(t.domain, list);
        }
        return DOMAIN_ORDER.filter((d) => byDomain.has(d)).map((d) => ({
            domain: d,
            types: byDomain.get(d)!,
        }));
    }, [types]);

    // Load options for select-kind filters of the active type.
    useEffect(() => {
        if (!activeType) return;
        let cancelled = false;
        const selectFilters = activeType.filters.filter((f) => f.kind === "select");
        for (const f of selectFilters) {
            if (options[f.key] || optionsLoading[f.key]) continue;
            const staticOpts = STATIC_OPTIONS[f.key];
            if (staticOpts) {
                setOptions((prev) => ({
                    ...prev,
                    [f.key]: staticOpts.map((v) => ({ value: v, label: v })),
                }));
                continue;
            }
            const endpoint = OPTION_ENDPOINTS[f.key];
            if (!endpoint) continue;
            setOptionsLoading((prev) => ({ ...prev, [f.key]: true }));
            void loadEntityOptions(endpoint).then((opts) => {
                if (cancelled) return;
                setOptions((prev) => ({ ...prev, [f.key]: opts }));
                setOptionsLoading((prev) => ({ ...prev, [f.key]: false }));
            });
        }
        return () => {
            cancelled = true;
        };
    }, [activeType, options, optionsLoading]);

    const compactFilters = useCallback(() => {
        if (!activeType) return {};
        const out: Record<string, string> = {};
        for (const f of activeType.filters) {
            const v = filterValues[f.key];
            if (v && v.trim()) out[f.key] = v.trim();
        }
        return out;
    }, [activeType, filterValues]);

    const buildQuery = useCallback(
        (extra?: Record<string, string>) => {
            const p = new URLSearchParams();
            if (activeType) p.set("type", activeType.key);
            for (const [k, v] of Object.entries(compactFilters())) p.set(k, v);
            if (extra) {
                for (const [k, v] of Object.entries(extra)) p.set(k, v);
            }
            return p.toString();
        },
        [activeType, compactFilters]
    );

    const runPreview = useCallback(async () => {
        if (!activeType) return;
        setPreviewLoading(true);
        setPreviewError(null);
        setExportError(null);
        setDirty(false);
        try {
            const res = await fetch(`/api/reports/center/data?${buildQuery()}`, { cache: "no-store" });
            if (!res.ok) {
                const body = await res.json().catch(() => null);
                setPreviewError(body?.error?.message ?? "Failed to generate preview.");
                setTable(null);
                return;
            }
            const data = (await res.json()) as ReportTable;
            setTable(data);
        } catch {
            setPreviewError("Unable to generate the report preview.");
            setTable(null);
        } finally {
            setPreviewLoading(false);
        }
    }, [activeType, buildQuery]);

    const download = useCallback(
        async (fmt: "csv" | "pdf") => {
            if (!activeType) return;
            setExportError(null);
            try {
                const res = await fetch(`/api/reports/center/export?${buildQuery({ fmt })}`, {
                    cache: "no-store",
                });
                if (!res.ok) {
                    const body = await res.json().catch(() => null);
                    setExportError(body?.error?.message ?? "Export failed.");
                    return;
                }
                const data = (await res.json()) as { filename: string; content: string; contentType: string };
                const blob = new Blob([data.content], { type: data.contentType });
                const link = document.createElement("a");
                link.href = URL.createObjectURL(blob);
                link.download = data.filename;
                document.body.appendChild(link);
                link.click();
                link.remove();
                URL.revokeObjectURL(link.href);
            } catch {
                setExportError("Unable to export the report.");
            }
        },
        [activeType, buildQuery]
    );

    const loadSaved = useCallback(async () => {
        setSavedLoading(true);
        setSavedError(null);
        try {
            const res = await fetch("/api/reports/center/saved", { cache: "no-store" });
            if (!res.ok) {
                const body = await res.json().catch(() => null);
                setSavedError(body?.error?.message ?? "Failed to load saved reports.");
                return;
            }
            const data = (await res.json()) as { saved: SavedReport[] };
            setSaved(data.saved);
        } catch {
            setSavedError("Unable to load saved reports.");
        } finally {
            setSavedLoading(false);
        }
    }, []);

    useEffect(() => {
        if (tab === "saved") void loadSaved();
    }, [tab, loadSaved]);

    const saveCurrent = useCallback(async () => {
        if (!activeType || !saveName.trim()) return;
        setSaving(true);
        try {
            const res = await fetch("/api/reports/center/saved", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: saveName.trim(), type: activeType.key, filters: compactFilters() }),
            });
            if (!res.ok) {
                const body = await res.json().catch(() => null);
                setSavedError(body?.error?.message ?? "Failed to save report.");
                return;
            }
            const data = (await res.json()) as { saved: SavedReport };
            setSaved((prev) => [data.saved, ...prev]);
            setSaveName("");
            setDirty(false);
        } catch {
            setSavedError("Unable to save the report.");
        } finally {
            setSaving(false);
        }
    }, [activeType, saveName, compactFilters]);

    const deleteSaved = useCallback(
        async (id: string) => {
            try {
                const res = await fetch(`/api/reports/center/saved/${id}`, { method: "DELETE" });
                if (!res.ok) {
                    const body = await res.json().catch(() => null);
                    setSavedError(body?.error?.message ?? "Failed to delete saved report.");
                    return;
                }
                setSaved((prev) => prev.filter((s) => s.id !== id));
            } catch {
                setSavedError("Unable to delete the saved report.");
            }
        },
        []
    );

    const runSaved = useCallback(
        (s: SavedReport) => {
            const def = types.find((t) => t.key === s.type);
            if (!def) return;
            setActiveType(def);
            const next: Record<string, string> = {};
            for (const f of def.filters) {
                const v = s.filters?.[f.key];
                next[f.key] = typeof v === "string" ? v : "";
            }
            setFilterValues(next);
            setTab("builder");
            setDirty(true);
        },
        [types]
    );

    const setFilter = useCallback((key: string, value: string) => {
        setFilterValues((prev) => ({ ...prev, [key]: value }));
        setDirty(true);
    }, []);

    // ---- Render ----------------------------------------------------------------

    const tabCls = (active: boolean) =>
        `inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${active
            ? "bg-slate-900 text-white shadow-2xs"
            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        }`;

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex items-center gap-3">
                    <div className="h-11 w-11 rounded-2xl bg-indigo-50 border border-indigo-200/80 flex items-center justify-center text-indigo-600">
                        <LayoutGrid className="h-5 w-5" />
                    </div>
                    <div>
                        <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                            Reports Center
                        </h1>
                        <p className="text-xs text-slate-500 mt-0.5 font-medium">
                            Generate & export standard university reports
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl p-1 shadow-sm sm:ml-auto">
                    <button onClick={() => setTab("builder")} className={tabCls(tab === "builder")}>
                        <FileText className="h-4 w-4" /> Create report
                    </button>
                    <button onClick={() => setTab("saved")} className={tabCls(tab === "saved")}>
                        <Save className="h-4 w-4" /> Saved reports
                    </button>
                </div>
            </div>

            {typesLoading ? (
                <LoadingSkeleton rows={5} />
            ) : typesError ? (
                <ErrorState message={typesError} />
            ) : types.length === 0 ? (
                <EmptyState
                    title="No report access"
                    description="You don't have permission to use any report type yet."
                />
            ) : tab === "saved" ? (
                <SavedReportsTab
                    loading={savedLoading}
                    error={savedError}
                    saved={saved}
                    onRun={runSaved}
                    onDelete={deleteSaved}
                    onRefresh={loadSaved}
                />
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
                    {/* Catalog + filter panel */}
                    <div className="space-y-4">
                        {grouped.map(({ domain, types: domainTypes }) => (
                            <Card key={domain}>
                                <CardHeader>
                                    <CardTitle className="text-sm flex items-center gap-2">
                                        <Badge className={DOMAIN_META[domain]?.chip ?? ""}>
                                            {DOMAIN_META[domain]?.label ?? domain}
                                        </Badge>
                                    </CardTitle>
                                    <CardDescription>Choose a report type</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-2">
                                    {domainTypes.map((t) => (
                                        <button
                                            key={t.key}
                                            onClick={() => {
                                                setActiveType(t);
                                                setFilterValues({});
                                                setTable(null);
                                                setPreviewError(null);
                                                setExportError(null);
                                                setDirty(false);
                                            }}
                                            className={`w-full text-left rounded-xl border px-3.5 py-3 transition-all ${activeType?.key === t.key
                                                ? "border-indigo-300 bg-indigo-50/60 shadow-2xs"
                                                : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60"
                                                }`}
                                        >
                                            <div className="text-sm font-bold text-slate-800">{t.label}</div>
                                            <div className="text-[11px] text-slate-500 mt-0.5 leading-4">
                                                {t.description}
                                            </div>
                                        </button>
                                    ))}
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    {/* Preview + export */}
                    <div className="space-y-4">
                        {activeType && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-sm">{activeType.label}</CardTitle>
                                    <CardDescription>Set filters, preview, then download</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {activeType.filters.map((f) => (
                                            <FilterInput
                                                key={f.key}
                                                filter={f}
                                                value={filterValues[f.key] ?? ""}
                                                options={options[f.key] ?? []}
                                                optionsLoading={!!optionsLoading[f.key]}
                                                onChange={(v) => setFilter(f.key, v)}
                                            />
                                        ))}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <Button onClick={() => void runPreview()} disabled={previewLoading}>
                                            {previewLoading ? (
                                                <RefreshCw className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <Play className="h-4 w-4" />
                                            )}
                                            Generate preview
                                        </Button>
                                        {dirty && activeType && table && (
                                            <span className="text-[11px] font-medium text-amber-600">
                                                Filters changed — regenerate to refresh preview
                                            </span>
                                        )}
                                        {exportError && <span className="text-xs text-rose-600">{exportError}</span>}
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {previewLoading ? (
                            <LoadingSkeleton rows={6} />
                        ) : previewError ? (
                            <ErrorState message={previewError} />
                        ) : table ? (
                            <>
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-sm flex items-center gap-2">
                                            <FileJson className="h-4 w-4 text-slate-400" />
                                            Preview · {table.rows.length} rows
                                        </CardTitle>
                                        <CardDescription>Printable / CSV view</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left text-sm">
                                                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                                                    <tr>
                                                        {table.columns.map((c) => (
                                                            <th key={c} className="px-4 py-2.5 whitespace-nowrap">
                                                                {c}
                                                            </th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 text-slate-700">
                                                    {table.rows.length === 0 ? (
                                                        <tr>
                                                            <td colSpan={table.columns.length} className="px-4 py-8 text-center text-sm text-slate-400">
                                                                No rows match the current filters.
                                                            </td>
                                                        </tr>
                                                    ) : (
                                                        table.rows.map((row, i) => (
                                                            <tr key={i} className="hover:bg-slate-50/60">
                                                                {table.columns.map((c) => (
                                                                    <td key={c} className="px-4 py-2.5 whitespace-nowrap">
                                                                        {String(row[c] ?? "")}
                                                                    </td>
                                                                ))}
                                                            </tr>
                                                        ))
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </CardContent>
                                </Card>

                                <div className="flex flex-wrap items-center gap-3">
                                    <Button onClick={() => void download("csv")}>
                                        <ArrowDownToLine className="h-4 w-4" /> Download CSV
                                    </Button>
                                    <Button onClick={() => void download("pdf")}>
                                        <FileText className="h-4 w-4" /> Export PDF
                                    </Button>
                                    <div className="flex items-center gap-2 ml-auto">
                                        <input
                                            type="text"
                                            value={saveName}
                                            onChange={(e) => setSaveName(e.target.value)}
                                            placeholder="Bookmark name…"
                                            className="rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 bg-white w-44"
                                        />
                                        <Button onClick={() => void saveCurrent()} disabled={saving || !saveName.trim()}>
                                            {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                                            Save
                                        </Button>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <EmptyState
                                title="No preview yet"
                                description="Select a report type, set filters, and press “Generate preview”."
                            />
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

// ---- Sub-components -----------------------------------------------------------

function FilterInput({
    filter,
    value,
    options,
    optionsLoading,
    onChange,
}: {
    filter: FilterDef;
    value: string;
    options: Array<{ value: string; label: string }>;
    optionsLoading: boolean;
    onChange: (v: string) => void;
}) {
    const inputCls =
        "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200";

    if (filter.kind === "date") {
        return (
            <label className="block">
                <span className="block text-[11px] font-semibold text-slate-500 mb-1">{filter.label}</span>
                <input type="date" value={value} onChange={(e) => onChange(e.target.value)} className={inputCls} />
            </label>
        );
    }

    if (filter.kind === "select") {
        return (
            <label className="block">
                <span className="block text-[11px] font-semibold text-slate-500 mb-1">{filter.label}</span>
                <select value={value} onChange={(e) => onChange(e.target.value)} className={inputCls}>
                    <option value="">Any</option>
                    {optionsLoading ? (
                        <option value="" disabled>
                            Loading…
                        </option>
                    ) : (
                        options.map((o) => (
                            <option key={o.value} value={o.value}>
                                {o.label}
                            </option>
                        ))
                    )}
                </select>
            </label>
        );
    }

    return (
        <label className="block">
            <span className="block text-[11px] font-semibold text-slate-500 mb-1">{filter.label}</span>
            <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder="Any"
                className={inputCls}
            />
        </label>
    );
}

function SavedReportsTab({
    loading,
    error,
    saved,
    onRun,
    onDelete,
    onRefresh,
}: {
    loading: boolean;
    error: string | null;
    saved: SavedReport[];
    onRun: (s: SavedReport) => void;
    onDelete: (id: string) => void;
    onRefresh: () => void;
}) {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                    <Save className="h-4 w-4 text-slate-400" /> Saved reports
                    <button
                        onClick={onRefresh}
                        className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-50"
                    >
                        <RefreshCw className="h-3 w-3" /> Refresh
                    </button>
                </CardTitle>
                <CardDescription>Bookmarked report filters for quick re-run</CardDescription>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <LoadingSkeleton rows={4} />
                ) : error ? (
                    <ErrorState message={error} />
                ) : saved.length === 0 ? (
                    <EmptyState
                        title="No saved reports"
                        description="Generate a report and press Save to bookmark it here."
                    />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                                <tr>
                                    <th className="px-4 py-2.5">Name</th>
                                    <th className="px-4 py-2.5">Type</th>
                                    <th className="px-4 py-2.5">Saved</th>
                                    <th className="px-4 py-2.5 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-slate-700">
                                {saved.map((s) => (
                                    <tr key={s.id} className="hover:bg-slate-50/60">
                                        <td className="px-4 py-3 font-semibold">{s.name}</td>
                                        <td className="px-4 py-3 text-slate-500">{s.type}</td>
                                        <td className="px-4 py-3 text-slate-500">
                                            {new Date(s.createdAt).toLocaleDateString()}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <div className="inline-flex items-center gap-1.5">
                                                <Button onClick={() => onRun(s)}>
                                                    <Play className="h-3.5 w-3.5" /> Run
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    onClick={() => onDelete(s.id)}
                                                    aria-label={`Delete ${s.name}`}
                                                >
                                                    <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

"use client";

import { useEffect, useState, useCallback } from "react";
import { Building2, Plus, X, MapPin, Package } from "lucide-react";
import { useUniversity } from "@/context/UniversityContext";
import { PageTitle } from "@/components/placement/PlacementShell";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui";
import { canManagePlacement } from "@/lib/placement";
import {
    fetchCompanies,
    createCompany,
    createDrive,
    DRIVE_MODES,
} from "@/lib/placement";
import type { PlacementCompany } from "@/lib/placement";

interface DriveForm {
    companyId: string;
    title: string;
    date: string;
    mode: string;
    role: string;
    package: string;
    location: string;
}

export default function PlacementCompaniesPage() {
    const { currentUser } = useUniversity();
    const canManage = canManagePlacement(currentUser);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [companies, setCompanies] = useState<PlacementCompany[]>([]);

    const [showCompanyForm, setShowCompanyForm] = useState(false);
    const [companyName, setCompanyName] = useState("");
    const [companySector, setCompanySector] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const [driveForm, setDriveForm] = useState<DriveForm | null>(null);
    const [driveError, setDriveError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetchCompanies();
            setCompanies(res.companies);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to load companies");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const handleCreateCompany = async () => {
        setSubmitting(true);
        setError(null);
        try {
            await createCompany({
                name: companyName.trim(),
                sector: companySector.trim() || undefined,
            });
            setCompanyName("");
            setCompanySector("");
            setShowCompanyForm(false);
            await load();
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to create company");
        } finally {
            setSubmitting(false);
        }
    };

    const handleCreateDrive = async () => {
        if (!driveForm) return;
        setDriveError(null);
        setSubmitting(true);
        try {
            await createDrive(driveForm.companyId, {
                title: driveForm.title.trim(),
                date: driveForm.date,
                mode: driveForm.mode as "ONLINE" | "OFFLINE",
                role: driveForm.role.trim(),
                package: driveForm.package.trim() || undefined,
                location: driveForm.location.trim() || undefined,
            });
            setDriveForm(null);
            await load();
        } catch (e) {
            setDriveError(e instanceof Error ? e.message : "Failed to create drive");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div>
            <PageTitle
                title="Companies"
                subtitle="Partner companies and their placement drives."
                action={
                    canManage ? (
                        <button
                            onClick={() => setShowCompanyForm((v) => !v)}
                            className="inline-flex items-center gap-2 text-xs font-bold px-4 py-2.5 rounded-xl bg-slate-900 text-white hover:bg-indigo-600 transition-colors cursor-pointer"
                        >
                            {showCompanyForm ? <><X className="h-3.5 w-3.5" /> Cancel</> : <><Plus className="h-3.5 w-3.5" /> Add company</>}
                        </button>
                    ) : undefined
                }
            />

            {canManage && showCompanyForm && (
                <div className="mb-6 rounded-2xl bg-white border border-slate-200 shadow-xs p-5">
                    <h3 className="text-sm font-black text-slate-900 mb-4">New company</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Name *</label>
                            <input
                                value={companyName}
                                onChange={(e) => setCompanyName(e.target.value)}
                                placeholder="e.g. Acme Corp"
                                className="w-full text-sm px-3 py-2 rounded-xl border border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Sector</label>
                            <input
                                value={companySector}
                                onChange={(e) => setCompanySector(e.target.value)}
                                placeholder="e.g. Information Technology"
                                className="w-full text-sm px-3 py-2 rounded-xl border border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none"
                            />
                        </div>
                    </div>
                    <div className="mt-4 flex justify-end">
                        <button
                            onClick={handleCreateCompany}
                            disabled={submitting || !companyName.trim()}
                            className="inline-flex items-center gap-2 text-xs font-bold px-4 py-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                        >
                            <Plus className="h-3.5 w-3.5" /> {submitting ? "Creating…" : "Create company"}
                        </button>
                    </div>
                </div>
            )}

            {driveForm && (
                <div className="mb-6 rounded-2xl bg-white border border-slate-200 shadow-xs p-5">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-black text-slate-900">
                            New drive — {companies.find((c) => c.id === driveForm.companyId)?.name ?? ""}
                        </h3>
                        <button
                            onClick={() => setDriveForm(null)}
                            className="h-7 w-7 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 flex items-center justify-center cursor-pointer"
                            aria-label="Close"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Title *</label>
                            <input
                                value={driveForm.title}
                                onChange={(e) => setDriveForm({ ...driveForm, title: e.target.value })}
                                placeholder="e.g. Campus Drive 2026"
                                className="w-full text-sm px-3 py-2 rounded-xl border border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Date *</label>
                            <input
                                type="datetime-local"
                                value={driveForm.date}
                                onChange={(e) => setDriveForm({ ...driveForm, date: e.target.value })}
                                className="w-full text-sm px-3 py-2 rounded-xl border border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Mode *</label>
                            <select
                                value={driveForm.mode}
                                onChange={(e) => setDriveForm({ ...driveForm, mode: e.target.value })}
                                className="w-full text-sm px-3 py-2 rounded-xl border border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none bg-white"
                            >
                                {DRIVE_MODES.map((m) => (
                                    <option key={m} value={m}>{m}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Role *</label>
                            <input
                                value={driveForm.role}
                                onChange={(e) => setDriveForm({ ...driveForm, role: e.target.value })}
                                placeholder="e.g. Software Engineer"
                                className="w-full text-sm px-3 py-2 rounded-xl border border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Package</label>
                            <input
                                value={driveForm.package}
                                onChange={(e) => setDriveForm({ ...driveForm, package: e.target.value })}
                                placeholder="e.g. 12 LPA"
                                className="w-full text-sm px-3 py-2 rounded-xl border border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Location</label>
                            <input
                                value={driveForm.location}
                                onChange={(e) => setDriveForm({ ...driveForm, location: e.target.value })}
                                placeholder="e.g. Hyderabad"
                                className="w-full text-sm px-3 py-2 rounded-xl border border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none"
                            />
                        </div>
                    </div>
                    {driveError && (
                        <p className="mt-3 text-xs font-semibold text-rose-600">{driveError}</p>
                    )}
                    <div className="mt-4 flex justify-end">
                        <button
                            onClick={handleCreateDrive}
                            disabled={submitting || !driveForm.title.trim() || !driveForm.date || !driveForm.role.trim()}
                            className="inline-flex items-center gap-2 text-xs font-bold px-4 py-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                        >
                            <Plus className="h-3.5 w-3.5" /> {submitting ? "Creating…" : "Create drive"}
                        </button>
                    </div>
                </div>
            )}

            {loading ? (
                <LoadingState rows={4} />
            ) : error ? (
                <ErrorState message={error} retry={load} />
            ) : companies.length === 0 ? (
                <EmptyState title="No companies yet" description="Add your first partner company to get started." />
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {companies.map((company) => (
                        <div key={company.id} className="rounded-2xl bg-white border border-slate-200 shadow-xs p-5">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                                    <Building2 className="h-5 w-5" />
                                </div>
                                <div className="min-w-0">
                                    <h3 className="text-sm font-black text-slate-900 truncate">{company.name}</h3>
                                    <p className="text-[11px] text-slate-500">{company.sector ?? "—"}</p>
                                </div>
                            </div>

                            {company.drives && company.drives.length > 0 ? (
                                <ul className="mt-4 space-y-2">
                                    {company.drives.map((drive) => (
                                        <li key={drive.id} className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2.5">
                                            <p className="text-xs font-bold text-slate-800">{drive.title}</p>
                                            <p className="text-[11px] text-slate-500 mt-0.5">{drive.mode} · {drive.role}</p>
                                            <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
                                                <span>{new Date(drive.date).toLocaleDateString()}</span>
                                                {drive.package && (<span className="inline-flex items-center gap-1"><Package className="h-3 w-3" />{drive.package}</span>)}
                                                {drive.location && (<span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{drive.location}</span>)}
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="mt-4 text-xs text-slate-400">No drives yet.</p>
                            )}

                            {canManage && (
                                <button
                                    onClick={() => setDriveForm({
                                        companyId: company.id,
                                        title: "",
                                        date: "",
                                        mode: "ONLINE",
                                        role: "",
                                        package: "",
                                        location: "",
                                    })}
                                    className="mt-4 w-full inline-flex items-center justify-center gap-2 text-xs font-bold px-3 py-2 rounded-xl border border-slate-200 text-slate-700 hover:border-indigo-300 hover:text-indigo-700 transition-colors cursor-pointer"
                                >
                                    <Plus className="h-3.5 w-3.5" /> Add drive
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

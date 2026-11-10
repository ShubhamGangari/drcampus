"use client";

import { useCallback, useEffect, useState } from "react";
import { BadgeCheck, Download, FileText, Plus } from "lucide-react";
import { PageTitle } from "@/components/certificates/CertificatesShell";
import { NewCertificateRequestModal } from "@/components/certificates/NewCertificateRequestModal";
import { Toast } from "@/components/admissions/Toast";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/admissions/States";
import {
    CertificatesApiError,
    certificateDownloadUrl,
    CERTIFICATE_TYPE_LABELS,
    CreateCertificateInput,
    fetchMyCertificates,
    Certificate,
    requestCertificate,
} from "@/lib/certificates";

const statusStyles: Record<string, string> = {
    PENDING: "bg-amber-50 text-amber-700 border-amber-200",
    APPROVED: "bg-sky-50 text-sky-700 border-sky-200",
    REJECTED: "bg-rose-50 text-rose-700 border-rose-200",
    ISSUED: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

export default function MyCertificatesPage() {
    const [rows, setRows] = useState<Certificate[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    const [modalOpen, setModalOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        try {
            const data = await fetchMyCertificates();
            setRows(data.certificates);
        } catch (e) {
            setLoadError(e instanceof CertificatesApiError ? e.message : "Unable to load your certificates.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const submit = async (input: CreateCertificateInput) => {
        setBusy(true);
        setSubmitError(null);
        try {
            await requestCertificate(input);
            setToast({ message: "Certificate request submitted.", type: "success" });
            setModalOpen(false);
            load();
        } catch (e) {
            setSubmitError(e instanceof CertificatesApiError ? e.message : "Unable to submit request.");
        } finally {
            setBusy(false);
        }
    };

    const formatDate = (iso: string | null) => {
        if (!iso) return "—";
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return iso;
        return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    };

    return (
        <div>
            <PageTitle
                title="My Certificates"
                subtitle="Request official documents and download issued certificates."
                action={
                    <button
                        type="button"
                        onClick={() => setModalOpen(true)}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-colors cursor-pointer"
                    >
                        <Plus className="h-4 w-4" /> New request
                    </button>
                }
            />

            {loading ? (
                <LoadingSkeleton rows={5} />
            ) : loadError ? (
                <ErrorState message={loadError} onRetry={load} />
            ) : rows.length === 0 ? (
                <div className="rounded-2xl bg-white border border-slate-200 shadow-sm">
                    <EmptyState
                        title="No certificate requests yet"
                        description="Request a Transfer Certificate, Migration, Character, Bonafide or Provisional Degree."
                    />
                </div>
            ) : (
                <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] uppercase tracking-wider text-slate-500">
                                    <th className="px-5 py-3 font-bold">Type</th>
                                    <th className="px-5 py-3 font-bold">Request ref</th>
                                    <th className="px-5 py-3 font-bold">Requested</th>
                                    <th className="px-5 py-3 font-bold">Issued</th>
                                    <th className="px-5 py-3 font-bold">Status</th>
                                    <th className="px-5 py-3 font-bold text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((cert) => (
                                    <tr
                                        key={cert.id}
                                        className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/60 transition-colors"
                                    >
                                        <td className="px-5 py-3.5">
                                            <div className="flex items-center gap-3">
                                                <div className="h-8 w-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
                                                    <FileText className="h-4 w-4" />
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-900">
                                                        {CERTIFICATE_TYPE_LABELS[cert.type]}
                                                    </p>
                                                    {cert.purpose && (
                                                        <p className="text-xs text-slate-500">{cert.purpose}</p>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-5 py-3.5 font-mono text-xs text-slate-600">{cert.requestNo}</td>
                                        <td className="px-5 py-3.5 text-slate-600">{formatDate(cert.createdAt)}</td>
                                        <td className="px-5 py-3.5 text-slate-600">{formatDate(cert.issuedAt)}</td>
                                        <td className="px-5 py-3.5">
                                            <span
                                                className={`inline-flex text-xs font-bold px-2.5 py-1 rounded-full border ${statusStyles[cert.status] ?? "bg-slate-100 text-slate-500 border-slate-200"}`}
                                            >
                                                {cert.status}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3.5">
                                            <div className="flex items-center justify-end">
                                                {cert.status === "ISSUED" && (
                                                    <a
                                                        href={certificateDownloadUrl(cert.id)}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 px-2.5 py-1.5 rounded-lg transition-colors"
                                                    >
                                                        <Download className="h-3.5 w-3.5" /> Download
                                                    </a>
                                                )}
                                                {cert.status === "APPROVED" && (
                                                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-sky-600">
                                                        <BadgeCheck className="h-3.5 w-3.5" /> Awaiting issue
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            <NewCertificateRequestModal
                open={modalOpen}
                busy={busy}
                error={submitError}
                onClose={() => {
                    setModalOpen(false);
                    setSubmitError(null);
                }}
                onSubmit={submit}
            />

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    );
}

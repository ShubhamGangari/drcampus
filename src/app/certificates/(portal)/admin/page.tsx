"use client";

import { useCallback, useEffect, useState } from "react";
import { Ban, CheckCircle, Download, Stamp, User } from "lucide-react";
import { PageTitle } from "@/components/certificates/CertificatesShell";
import { Modal } from "@/components/admissions/Modal";
import { Toast } from "@/components/admissions/Toast";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/admissions/States";
import { useUniversity } from "@/context/UniversityContext";
import {
    canManageCertificates,
    CertificatesApiError,
    certificateDownloadUrl,
    CERTIFICATE_TYPE_LABELS,
    fetchAllCertificates,
    Certificate,
    updateCertificate,
} from "@/lib/certificates";

const inputCls =
    "w-full h-10 px-3 rounded-xl border border-slate-300 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500";

const statusStyles: Record<string, string> = {
    PENDING: "bg-amber-50 text-amber-700 border-amber-200",
    APPROVED: "bg-sky-50 text-sky-700 border-sky-200",
    REJECTED: "bg-rose-50 text-rose-700 border-rose-200",
    ISSUED: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

export default function CertificatesAdminPage() {
    const { currentUser } = useUniversity();
    const isCentral = currentUser?.schoolId === "ALL";
    const canManage = canManageCertificates(currentUser?.role);

    const [schoolId, setSchoolId] = useState("");
    const [rows, setRows] = useState<Certificate[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    const [busyId, setBusyId] = useState<string | null>(null);
    const [rejectTarget, setRejectTarget] = useState<Certificate | null>(null);
    const [rejectRemark, setRejectRemark] = useState("");
    const [rejectBusy, setRejectBusy] = useState(false);
    const [rejectError, setRejectError] = useState<string | null>(null);
    const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        try {
            const data = await fetchAllCertificates({
                schoolId: isCentral && schoolId ? schoolId : undefined,
            });
            setRows(data.certificates);
        } catch (e) {
            setLoadError(e instanceof CertificatesApiError ? e.message : "Unable to load the requests queue.");
        } finally {
            setLoading(false);
        }
    }, [isCentral, schoolId]);

    useEffect(() => {
        load();
    }, [load]);

    const transition = async (cert: Certificate, status: "APPROVED" | "REJECTED" | "ISSUED", remark?: string) => {
        setBusyId(cert.id);
        try {
            const res = await updateCertificate(cert.id, { status, remark });
            const message =
                status === "ISSUED"
                    ? `Certificate issued (${res.certificate.referenceNo}).`
                    : status === "APPROVED"
                        ? "Certificate approved."
                        : "Certificate rejected.";
            setToast({ message, type: "success" });
            load();
        } catch (e) {
            setToast({ message: e instanceof CertificatesApiError ? e.message : "Unable to update certificate.", type: "error" });
        } finally {
            setBusyId(null);
        }
    };

    const submitReject = async () => {
        if (!rejectTarget) return;
        setRejectBusy(true);
        setRejectError(null);
        try {
            const res = await updateCertificate(rejectTarget.id, { status: "REJECTED", remark: rejectRemark.trim() || undefined });
            setToast({ message: `Certificate rejected (${res.certificate.requestNo}).`, type: "success" });
            setRejectTarget(null);
            setRejectRemark("");
            load();
        } catch (e) {
            setRejectError(e instanceof CertificatesApiError ? e.message : "Unable to reject certificate.");
        } finally {
            setRejectBusy(false);
        }
    };

    return (
        <div>
            <PageTitle
                title="Requests Queue"
                subtitle="Approve, reject or issue certificate requests."
            />

            {isCentral && (
                <div className="mb-5 max-w-xs">
                    <select
                        id="certificates-school"
                        value={schoolId}
                        onChange={(e) => setSchoolId(e.target.value)}
                        className={`${inputCls} h-10`}
                    >
                        <option value="">All schools</option>
                        <option value="SCHOOL_1">School 1</option>
                        <option value="SCHOOL_2">School 2</option>
                    </select>
                </div>
            )}

            {loading ? (
                <LoadingSkeleton rows={6} />
            ) : loadError ? (
                <ErrorState message={loadError} onRetry={load} />
            ) : rows.length === 0 ? (
                <div className="rounded-2xl bg-white border border-slate-200 shadow-sm">
                    <EmptyState
                        title="No certificate requests"
                        description="Student requests will appear here for approval and issue."
                    />
                </div>
            ) : (
                <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] uppercase tracking-wider text-slate-500">
                                    <th className="px-5 py-3 font-bold">Student</th>
                                    <th className="px-5 py-3 font-bold">Type</th>
                                    <th className="px-5 py-3 font-bold">Purpose</th>
                                    <th className="px-5 py-3 font-bold">Request ref</th>
                                    <th className="px-5 py-3 font-bold">Status</th>
                                    {canManage && <th className="px-5 py-3 font-bold text-right">Actions</th>}
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
                                                <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                                                    <User className="h-4 w-4" />
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-900">{cert.studentName ?? "—"}</p>
                                                    {cert.studentRollNo && (
                                                        <p className="text-xs text-slate-500">{cert.studentRollNo}</p>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-5 py-3.5 text-slate-600">
                                            {CERTIFICATE_TYPE_LABELS[cert.type]}
                                        </td>
                                        <td className="px-5 py-3.5 text-slate-600">{cert.purpose ?? "—"}</td>
                                        <td className="px-5 py-3.5 font-mono text-xs text-slate-600">{cert.requestNo}</td>
                                        <td className="px-5 py-3.5">
                                            <span
                                                className={`inline-flex text-xs font-bold px-2.5 py-1 rounded-full border ${statusStyles[cert.status] ?? "bg-slate-100 text-slate-500 border-slate-200"}`}
                                            >
                                                {cert.status}
                                            </span>
                                            {cert.referenceNo && (
                                                <p className="text-[10px] font-mono text-slate-400 mt-1">
                                                    {cert.referenceNo}
                                                </p>
                                            )}
                                        </td>
                                        {canManage && (
                                            <td className="px-5 py-3.5">
                                                <div className="flex items-center justify-end gap-1">
                                                    {cert.status === "PENDING" && (
                                                        <>
                                                            <button
                                                                type="button"
                                                                onClick={() => transition(cert, "APPROVED")}
                                                                disabled={busyId === cert.id}
                                                                aria-label="Approve certificate"
                                                                title="Approve"
                                                                className="p-2 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 disabled:opacity-50 transition-colors cursor-pointer"
                                                            >
                                                                <CheckCircle className="h-4 w-4" />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setRejectTarget(cert);
                                                                    setRejectRemark("");
                                                                    setRejectError(null);
                                                                }}
                                                                disabled={busyId === cert.id}
                                                                aria-label="Reject certificate"
                                                                title="Reject"
                                                                className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-50 transition-colors cursor-pointer"
                                                            >
                                                                <Ban className="h-4 w-4" />
                                                            </button>
                                                        </>
                                                    )}
                                                    {cert.status === "APPROVED" && (
                                                        <>
                                                            <button
                                                                type="button"
                                                                onClick={() => transition(cert, "ISSUED")}
                                                                disabled={busyId === cert.id}
                                                                aria-label="Issue certificate"
                                                                title="Mark issued"
                                                                className="p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 disabled:opacity-50 transition-colors cursor-pointer"
                                                            >
                                                                <Stamp className="h-4 w-4" />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setRejectTarget(cert);
                                                                    setRejectRemark("");
                                                                    setRejectError(null);
                                                                }}
                                                                disabled={busyId === cert.id}
                                                                aria-label="Reject certificate"
                                                                title="Reject"
                                                                className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-50 transition-colors cursor-pointer"
                                                            >
                                                                <Ban className="h-4 w-4" />
                                                            </button>
                                                        </>
                                                    )}
                                                    {cert.status === "ISSUED" && (
                                                        <a
                                                            href={certificateDownloadUrl(cert.id)}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                                                            aria-label="Download certificate"
                                                            title="Download"
                                                        >
                                                            <Download className="h-4 w-4" />
                                                        </a>
                                                    )}
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

            <Modal
                open={rejectTarget !== null}
                title="Reject request"
                description={rejectTarget ? `${CERTIFICATE_TYPE_LABELS[rejectTarget.type]} (${rejectTarget.requestNo})` : undefined}
                onClose={() => setRejectTarget(null)}
            >
                <div className="space-y-4">
                    <div>
                        <label htmlFor="reject-remark" className="block text-xs font-bold text-slate-600 mb-1.5">
                            Remark (optional)
                        </label>
                        <textarea
                            id="reject-remark"
                            value={rejectRemark}
                            onChange={(e) => setRejectRemark(e.target.value)}
                            rows={3}
                            placeholder="Reason for rejection"
                            className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                        />
                    </div>
                    {rejectError && <p className="text-xs font-medium text-rose-600">{rejectError}</p>}
                    <div className="flex items-center justify-end gap-2 pt-2">
                        <button
                            type="button"
                            onClick={() => setRejectTarget(null)}
                            className="px-4 h-10 rounded-xl border border-slate-300 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={submitReject}
                            disabled={rejectBusy}
                            className="inline-flex items-center gap-2 px-5 h-10 rounded-xl bg-rose-600 text-white text-sm font-bold hover:bg-rose-700 disabled:opacity-50 transition-colors cursor-pointer"
                        >
                            {rejectBusy ? "Rejecting…" : "Reject request"}
                        </button>
                    </div>
                </div>
            </Modal>

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    );
}

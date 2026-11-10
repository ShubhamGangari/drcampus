"use client";

import { useState } from "react";
import { BadgeCheck, Search, ShieldCheck, XCircle } from "lucide-react";
import { CertificatesApiError, CERTIFICATE_TYPE_LABELS, verifyCertificate } from "@/lib/certificates";

export default function VerifyCertificatePage() {
    const [code, setCode] = useState("");
    const [result, setResult] = useState<{
        valid: boolean;
        type: string;
        studentName: string | null;
        issuedDate: string | null;
        referenceNo: string | null;
    } | null>(null);
    const [searching, setSearching] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const verify = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = code.trim();
        if (!trimmed) return;
        setSearching(true);
        setError(null);
        setResult(null);
        try {
            const data = await verifyCertificate(trimmed);
            setResult(data);
        } catch (err) {
            if (err instanceof CertificatesApiError && err.status === 404) {
                setResult({
                    valid: false,
                    type: "",
                    studentName: null,
                    issuedDate: null,
                    referenceNo: null,
                });
            } else {
                setError(err instanceof CertificatesApiError ? err.message : "Unable to verify certificate.");
            }
        } finally {
            setSearching(false);
        }
    };

    const formatDate = (iso: string | null) => {
        if (!iso) return "—";
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return iso;
        return d.toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
    };

    return (
        <div className="min-h-screen bg-slate-50 font-sans antialiased text-slate-800">
            <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12">
                <div className="text-center mb-8">
                    <div className="mx-auto h-14 w-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mb-4">
                        <ShieldCheck className="h-7 w-7" />
                    </div>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight">Verify a certificate</h1>
                    <p className="text-sm text-slate-500 mt-1.5">
                        Enter the certificate reference number (e.g. CERT-2026-0001) to verify its authenticity.
                    </p>
                </div>

                <form
                    onSubmit={verify}
                    className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5 flex flex-col sm:flex-row gap-3"
                >
                    <label htmlFor="verify-code" className="sr-only">
                        Certificate reference number
                    </label>
                    <input
                        id="verify-code"
                        type="text"
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        placeholder="CERT-2026-0001"
                        autoComplete="off"
                        className="flex-1 h-12 px-4 rounded-xl border border-slate-300 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                    />
                    <button
                        type="submit"
                        disabled={searching || !code.trim()}
                        className="inline-flex items-center justify-center gap-2 px-5 h-12 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 transition-colors cursor-pointer"
                    >
                        <Search className="h-4 w-4" />
                        {searching ? "Verifying…" : "Verify"}
                    </button>
                </form>

                {error && (
                    <p className="text-xs font-medium text-rose-600 mt-4 text-center">{error}</p>
                )}

                {result && (
                    <div className={`mt-6 rounded-2xl border p-6 ${result.valid
                        ? "bg-emerald-50/50 border-emerald-200"
                        : "bg-rose-50/50 border-rose-200"
                        }`}>
                        {result.valid ? (
                            <div className="flex items-start gap-4">
                                <div className="h-10 w-10 rounded-xl bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-600 shrink-0">
                                    <BadgeCheck className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="text-base font-black text-emerald-800">Valid certificate</p>
                                    <p className="text-xs font-medium text-emerald-700 mt-1">
                                        This certificate was issued by the university.
                                    </p>
                                    <dl className="mt-4 space-y-1.5 text-sm">
                                        <div className="flex justify-between gap-4">
                                            <dt className="text-emerald-700/70">Type</dt>
                                            <dd className="font-bold text-emerald-900 text-right">
                                                {CERTIFICATE_TYPE_LABELS[result.type as keyof typeof CERTIFICATE_TYPE_LABELS] ?? result.type}
                                            </dd>
                                        </div>
                                        <div className="flex justify-between gap-4">
                                            <dt className="text-emerald-700/70">Issued to</dt>
                                            <dd className="font-bold text-emerald-900 text-right">{result.studentName ?? "—"}</dd>
                                        </div>
                                        <div className="flex justify-between gap-4">
                                            <dt className="text-emerald-700/70">Issued on</dt>
                                            <dd className="font-bold text-emerald-900 text-right">{formatDate(result.issuedDate)}</dd>
                                        </div>
                                        <div className="flex justify-between gap-4">
                                            <dt className="text-emerald-700/70">Reference no</dt>
                                            <dd className="font-bold text-emerald-900 text-right font-mono">{result.referenceNo}</dd>
                                        </div>
                                    </dl>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-start gap-4">
                                <div className="h-10 w-10 rounded-xl bg-rose-100 border border-rose-200 flex items-center justify-center text-rose-600 shrink-0">
                                    <XCircle className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="text-base font-black text-rose-800">Not found</p>
                                    <p className="text-xs font-medium text-rose-700 mt-1">
                                        No issued certificate matches that reference number.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

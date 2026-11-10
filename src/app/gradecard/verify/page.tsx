"use client";

import { useState } from "react";
import { BadgeCheck, Search, ShieldCheck } from "lucide-react";
import { PageTitle } from "@/components/gradecard/GradecardShell";
import { ErrorState } from "@/components/admissions/States";
import { GradecardApiError, verifyTranscript, type VerifyResult } from "@/lib/gradecard";

export default function GradecardVerifyPage() {
    const [transcriptNo, setTranscriptNo] = useState("");
    const [result, setResult] = useState<VerifyResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleVerify = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!transcriptNo.trim()) return;
        setLoading(true);
        setError(null);
        setResult(null);
        try {
            const res = await verifyTranscript(transcriptNo.trim());
            setResult(res.transcript);
        } catch (err) {
            setError(err instanceof GradecardApiError ? err.message : "Could not verify this transcript.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div>
            <PageTitle title="Transcript Verification" subtitle="Verify an official transcript by its number." />

            <div className="max-w-xl">
                <form
                    onSubmit={handleVerify}
                    className="rounded-2xl bg-white border border-slate-200 shadow-sm p-6"
                >
                    <label
                        htmlFor="transcriptNo"
                        className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1"
                    >
                        Transcript number
                    </label>
                    <div className="flex gap-2">
                        <input
                            id="transcriptNo"
                            type="text"
                            value={transcriptNo}
                            onChange={(e) => setTranscriptNo(e.target.value)}
                            placeholder="e.g. TC-2026-0001"
                            className="flex-1 h-10 px-3 rounded-xl border border-slate-300 bg-white text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        <button
                            type="submit"
                            disabled={!transcriptNo.trim() || loading}
                            className="inline-flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-xl bg-slate-900 text-white hover:bg-indigo-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                        >
                            {loading ? "Checking…" : "Verify"}
                        </button>
                    </div>
                </form>

                {error && (
                    <div className="mt-4">
                        <ErrorState message={error} onRetry={() => setError(null)} />
                    </div>
                )}

                {result && (
                    <div className="mt-4 rounded-2xl bg-white border border-slate-200 shadow-sm p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <BadgeCheck className="h-5 w-5 text-emerald-600" />
                            <h3 className="text-sm font-black text-slate-900">Verified transcript</h3>
                        </div>
                        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                            <div>
                                <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                                    Transcript No
                                </dt>
                                <dd className="font-bold text-slate-900 mt-0.5">{result.transcriptNo}</dd>
                            </div>
                            <div>
                                <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Name</dt>
                                <dd className="text-slate-800 mt-0.5">{result.name}</dd>
                            </div>
                            <div>
                                <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Program</dt>
                                <dd className="text-slate-800 mt-0.5">{result.program}</dd>
                            </div>
                            <div>
                                <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Result</dt>
                                <dd className="text-slate-800 mt-0.5">{result.result}</dd>
                            </div>
                            <div className="sm:col-span-2">
                                <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-500">CGPA</dt>
                                <dd className="font-bold text-slate-900 mt-0.5">{result.cgpa ?? "—"}</dd>
                            </div>
                        </dl>
                        <p className="mt-4 flex items-center gap-1.5 text-xs text-emerald-700">
                            <ShieldCheck className="h-3.5 w-3.5" /> This document was issued by the university record.
                        </p>
                    </div>
                )}

                {!result && !error && (
                    <div className="mt-4 rounded-2xl bg-white border border-slate-200 shadow-sm p-8 text-center">
                        <Search className="mx-auto h-8 w-8 text-slate-300 mb-3" />
                        <p className="text-sm font-bold text-slate-700">Enter a transcript number</p>
                        <p className="text-xs text-slate-500 mt-1">
                            The official result summary is shown after verification.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}

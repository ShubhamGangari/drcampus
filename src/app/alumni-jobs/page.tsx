"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Briefcase, Building2, MapPin, Clock, UserRound, CheckCircle2, ShieldCheck } from "lucide-react";
import { PageTitle } from "@/components/alumni-jobs/AlumniJobsShell";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui";
import { useUniversity } from "@/context/UniversityContext";
import { fetchJobs, applyToJob, canPostAlumniJobs } from "@/lib/alumni-jobs";
import type { AlumniJob } from "@/lib/alumni-jobs";

const TYPE_LABELS: Record<string, string> = {
    FULL_TIME: "Full-time",
    PART_TIME: "Part-time",
    CONTRACT: "Contract",
};

export default function AlumniJobsBoardPage() {
    const { currentUser } = useUniversity();
    const isStudent = currentUser?.role === "STUDENT";
    const canPost = canPostAlumniJobs(currentUser);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [jobs, setJobs] = useState<AlumniJob[]>([]);
    const [applied, setApplied] = useState<Record<string, boolean>>({});
    const [actionError, setActionError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetchJobs();
            setJobs(res.jobs);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to load job posts");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const handleApply = async (jobId: string) => {
        setActionError(null);
        try {
            await applyToJob({ jobId });
            setApplied((a) => ({ ...a, [jobId]: true }));
        } catch (e) {
            setActionError(e instanceof Error ? e.message : "Failed to apply");
        }
    };

    return (
        <div>
            <PageTitle
                title="Alumni Job Board"
                subtitle="Approved opportunities shared by the alumni network."
                action={
                    canPost ? (
                        <Link
                            href="/alumni-jobs/post"
                            className="inline-flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-xl bg-slate-900 text-white hover:bg-indigo-600 transition-colors cursor-pointer"
                        >
                            <Briefcase className="h-3.5 w-3.5" /> Post a job
                        </Link>
                    ) : undefined
                }
            />

            {actionError && (
                <div className="mb-4 rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-xs font-semibold text-rose-700">
                    {actionError}
                </div>
            )}

            {loading ? (
                <LoadingState rows={4} />
            ) : error ? (
                <ErrorState message={error} retry={load} />
            ) : jobs.length === 0 ? (
                <EmptyState
                    title="No jobs posted yet"
                    description="Approved job posts from the alumni network will appear here."
                />
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {jobs.map((job) => {
                        const done = applied[job.id];
                        return (
                            <div
                                key={job.id}
                                className="rounded-2xl bg-white border border-slate-200 shadow-xs p-5 flex flex-col gap-4"
                            >
                                <div className="flex items-start gap-3">
                                    <div className="h-10 w-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                                        <Building2 className="h-5 w-5" />
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="font-black text-slate-900 leading-tight">{job.title}</h3>
                                        <p className="text-xs text-slate-500 font-medium">{job.company}</p>
                                    </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-500">
                                    <span className="inline-flex items-center gap-1.5">
                                        <MapPin className="h-3.5 w-3.5" />
                                        {job.location || "Remote / unspecified"}
                                    </span>
                                    <span className="inline-flex items-center gap-1.5">
                                        <Briefcase className="h-3.5 w-3.5" />
                                        {TYPE_LABELS[job.type] ?? job.type}
                                    </span>
                                    <span className="inline-flex items-center gap-1.5">
                                        <Clock className="h-3.5 w-3.5" />
                                        {new Date(job.createdAt).toLocaleDateString()}
                                    </span>
                                </div>

                                <div className="mt-auto flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
                                    <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-500">
                                        <UserRound className="h-3.5 w-3.5" />
                                        {job.postedByName}
                                    </span>
                                    {isStudent ? (
                                        done ? (
                                            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                <CheckCircle2 className="h-3.5 w-3.5" /> Applied
                                            </span>
                                        ) : (
                                            <button
                                                onClick={() => handleApply(job.id)}
                                                className="text-[11px] font-bold px-3 py-1.5 rounded-lg bg-slate-900 text-white hover:bg-indigo-600 transition-colors cursor-pointer"
                                            >
                                                Apply
                                            </button>
                                        )
                                    ) : (
                                        <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-400">
                                            <ShieldCheck className="h-3.5 w-3.5" /> Approved
                                        </span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Briefcase, ShieldAlert } from "lucide-react";
import { PageTitle } from "@/components/alumni-jobs/AlumniJobsShell";
import { InlineLoader } from "@/components/admissions/States";
import { useUniversity } from "@/context/UniversityContext";
import { createJob, canPostAlumniJobs, JOB_TYPES } from "@/lib/alumni-jobs";
import type { JobType } from "@/lib/alumni-jobs";

export default function AlumniJobsPostPage() {
    const router = useRouter();
    const { currentUser } = useUniversity();
    const canPost = canPostAlumniJobs(currentUser);

    const [title, setTitle] = useState("");
    const [company, setCompany] = useState("");
    const [location, setLocation] = useState("");
    const [type, setType] = useState<JobType>("FULL_TIME");
    const [description, setDescription] = useState("");
    const [contact, setContact] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const canSubmit =
        title.trim() && company.trim() && description.trim() && contact.trim() && !submitting;

    const handleSubmit = async () => {
        if (!canSubmit) return;
        setError(null);
        setSubmitting(true);
        try {
            await createJob({
                title: title.trim(),
                company: company.trim(),
                location: location.trim() || undefined,
                type,
                description: description.trim(),
                contact: contact.trim(),
            });
            router.push("/alumni-jobs/my");
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to post job");
            setSubmitting(false);
        }
    };

    if (!canPost) {
        return (
            <div>
                <PageTitle title="Post a Job" subtitle="Share an opportunity with current students." />
                <div className="rounded-2xl bg-white border border-slate-200 shadow-sm px-6 py-10 text-center">
                    <div className="mx-auto h-12 w-12 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center mb-4">
                        <ShieldAlert className="h-6 w-6 text-rose-500" />
                    </div>
                    <h2 className="text-base font-black text-slate-900">Posting requires an alumni profile</h2>
                    <p className="text-sm text-slate-500 mt-1.5 max-w-sm mx-auto">
                        Only alumni and staff with the posting permission can publish job opportunities.
                    </p>
                </div>
            </div>
        );
    }

    const inputCls =
        "w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white focus:border-indigo-400 outline-none transition-colors text-slate-800";
    const labelCls = "block text-xs font-bold text-slate-700 mb-1.5";

    return (
        <div>
            <PageTitle title="Post a Job" subtitle="New posts are submitted for moderation and go live after approval." />

            {error && (
                <div className="mb-4 rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-xs font-semibold text-rose-700">
                    {error}
                </div>
            )}

            <div className="max-w-2xl rounded-2xl bg-white border border-slate-200 shadow-xs p-6 space-y-5">
                <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                        <label className={labelCls}>Job title</label>
                        <input
                            className={inputCls}
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="e.g. Software Engineer Intern"
                        />
                    </div>
                    <div>
                        <label className={labelCls}>Company</label>
                        <input
                            className={inputCls}
                            value={company}
                            onChange={(e) => setCompany(e.target.value)}
                            placeholder="e.g. Drivion Solutions"
                        />
                    </div>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                        <label className={labelCls}>Location</label>
                        <input
                            className={inputCls}
                            value={location}
                            onChange={(e) => setLocation(e.target.value)}
                            placeholder="City / remote"
                        />
                    </div>
                    <div>
                        <label className={labelCls}>Job type</label>
                        <select className={inputCls} value={type} onChange={(e) => setType(e.target.value as JobType)}>
                            {JOB_TYPES.map((t) => (
                                <option key={t} value={t}>{t.replace("_", " ")}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div>
                    <label className={labelCls}>Description</label>
                    <textarea
                        className={`${inputCls} min-h-[120px] resize-y`}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Role responsibilities, qualifications, perks…"
                    />
                </div>

                <div>
                    <label className={labelCls}>Contact</label>
                    <input
                        className={inputCls}
                        value={contact}
                        onChange={(e) => setContact(e.target.value)}
                        placeholder="Email or phone for applicants"
                    />
                </div>

                <div className="flex items-center justify-end gap-3 pt-1">
                    <button
                        onClick={() => router.push("/alumni-jobs")}
                        className="text-xs font-bold px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={!canSubmit}
                        className="inline-flex items-center gap-2 text-xs font-bold px-4 py-2.5 rounded-xl bg-slate-900 text-white hover:bg-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    >
                        {submitting ? <InlineLoader label="Posting…" /> : <><Briefcase className="h-3.5 w-3.5" /> Submit for approval</>}
                    </button>
                </div>
            </div>
        </div>
    );
}

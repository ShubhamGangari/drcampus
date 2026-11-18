"use client";

import { useEffect, useState, useCallback } from "react";
import {
    HeartHandshake,
    Calendar,
    Clock,
    Plus,
    X,
    CheckCircle2,
    XCircle,
    UserCheck,
    MessageSquare,
    CalendarPlus,
} from "lucide-react";
import { PageTitle } from "@/components/mentorship/MentorshipShell";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui";
import { useUniversity } from "@/context/UniversityContext";
import {
    fetchMyMentorship,
    respondToMentorshipRequest,
    logMeeting,
} from "@/lib/mentorship";
import type { MyMentorship, MentorshipPairingRow, MentorshipRequestRow } from "@/lib/mentorship";

export default function MyMentorshipPage() {
    const { currentUser, showToast } = useUniversity();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<MyMentorship | null>(null);

    // Meeting modal
    const [isMeetingModalOpen, setIsMeetingModalOpen] = useState(false);
    const [meetingDate, setMeetingDate] = useState(new Date().toISOString().split("T")[0]);
    const [meetingNotes, setMeetingNotes] = useState("");
    const [submittingMeeting, setSubmittingMeeting] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetchMyMentorship();
            setData(res);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to load mentorship records");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const handleRespond = async (requestId: string, action: "ACCEPT" | "REJECT") => {
        try {
            await respondToMentorshipRequest(requestId, { action });
            showToast(`Request ${action === "ACCEPT" ? "accepted" : "declined"}`, "success");
            load();
        } catch (e) {
            showToast(e instanceof Error ? e.message : "Action failed", "warning");
        }
    };

    const handleLogMeeting = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!data?.pairing) return;
        setSubmittingMeeting(true);
        try {
            await logMeeting({
                pairingId: data.pairing.id,
                date: meetingDate,
                notes: meetingNotes,
                schoolId: currentUser?.schoolId,
            });
            showToast("Meeting logged successfully!", "success");
            setIsMeetingModalOpen(false);
            setMeetingNotes("");
            load();
        } catch (e) {
            showToast(e instanceof Error ? e.message : "Failed to log meeting", "warning");
        } finally {
            setSubmittingMeeting(false);
        }
    };

    return (
        <div className="space-y-6">
            <PageTitle
                title="My Mentorship Workspace"
                subtitle="Track your active mentorship partnership, log discussion sessions, and manage mentorship requests."
            />

            {loading ? (
                <LoadingState rows={3} />
            ) : error ? (
                <ErrorState message={error} retry={load} />
            ) : (
                <div className="space-y-6">
                    {/* Active Pairing Card */}
                    {data?.pairing ? (
                        <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs p-6 space-y-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                                <div className="flex items-center gap-3.5">
                                    <div className="h-12 w-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                                        <HeartHandshake className="h-6 w-6" />
                                    </div>
                                    <div>
                                        <span className="inline-block text-[10px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full mb-1">
                                            Active Pairing
                                        </span>
                                        <h2 className="text-base font-bold text-slate-900">
                                            {data.pairing.mentorName} & {data.pairing.studentName}
                                        </h2>
                                        <p className="text-xs text-slate-500">
                                            Established on {new Date(data.pairing.createdAt).toLocaleDateString()}
                                        </p>
                                    </div>
                                </div>

                                <button
                                    onClick={() => setIsMeetingModalOpen(true)}
                                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition shadow-xs cursor-pointer"
                                >
                                    <CalendarPlus className="h-4 w-4" />
                                    <span>Log Mentorship Session</span>
                                </button>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
                                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                                    <span className="text-slate-400 font-medium">Status</span>
                                    <p className="font-bold text-slate-800 mt-0.5">Active Relationship</p>
                                </div>
                                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                                    <span className="text-slate-400 font-medium">Mentor</span>
                                    <p className="font-bold text-slate-800 mt-0.5">{data.pairing.mentorName}</p>
                                </div>
                                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                                    <span className="text-slate-400 font-medium">Mentee</span>
                                    <p className="font-bold text-slate-800 mt-0.5">{data.pairing.studentName}</p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-8 text-center space-y-3">
                            <div className="mx-auto h-12 w-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                                <UserCheck className="h-6 w-6" />
                            </div>
                            <h3 className="text-sm font-bold text-slate-800">No active mentorship pairing yet</h3>
                            <p className="text-xs text-slate-500 max-w-sm mx-auto">
                                You can browse the mentors directory and send a request to alumni in your field of interest.
                            </p>
                        </div>
                    )}

                    {/* Mentorship Requests Section */}
                    <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs p-6 space-y-4">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                            <div>
                                <h3 className="text-sm font-bold text-slate-900">Mentorship Requests</h3>
                                <p className="text-xs text-slate-500">Pending and past application history</p>
                            </div>
                            <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full">
                                {data?.requests.length || 0} Total
                            </span>
                        </div>

                        {!data?.requests || data.requests.length === 0 ? (
                            <p className="text-xs text-slate-400 py-4 text-center">No requests recorded.</p>
                        ) : (
                            <div className="space-y-3">
                                {data.requests.map((req) => (
                                    <div
                                        key={req.id}
                                        className="p-4 rounded-2xl border border-slate-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-300 transition"
                                    >
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <h4 className="text-xs font-bold text-slate-900">
                                                    {req.studentName} &rarr; {req.mentorName}
                                                </h4>
                                                <span
                                                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                        req.status === "PENDING"
                                                            ? "bg-amber-50 text-amber-700 border border-amber-200"
                                                            : req.status === "ACCEPTED"
                                                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                                            : "bg-rose-50 text-rose-700 border border-rose-200"
                                                    }`}
                                                >
                                                    {req.status}
                                                </span>
                                            </div>
                                            {req.message && (
                                                <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                                                    &ldquo;{req.message}&rdquo;
                                                </p>
                                            )}
                                            <p className="text-[11px] text-slate-400">
                                                Requested on {new Date(req.createdAt).toLocaleDateString()}
                                            </p>
                                        </div>

                                        {req.status === "PENDING" && (
                                            <div className="flex items-center gap-2 shrink-0">
                                                <button
                                                    onClick={() => handleRespond(req.id, "ACCEPT")}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 cursor-pointer shadow-xs"
                                                >
                                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                                    <span>Accept</span>
                                                </button>
                                                <button
                                                    onClick={() => handleRespond(req.id, "REJECT")}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-rose-600 text-xs font-bold hover:bg-rose-50 cursor-pointer"
                                                >
                                                    <XCircle className="h-3.5 w-3.5" />
                                                    <span>Decline</span>
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Log Meeting Modal */}
            {isMeetingModalOpen && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                            <div className="flex items-center gap-2.5">
                                <div className="h-9 w-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                                    <CalendarPlus className="h-4 w-4" />
                                </div>
                                <h3 className="text-sm font-bold text-slate-900">Log Mentorship Session</h3>
                            </div>
                            <button
                                onClick={() => setIsMeetingModalOpen(false)}
                                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <form onSubmit={handleLogMeeting} className="mt-4 space-y-4">
                            <div className="space-y-1.5">
                                <label className="block text-xs font-bold text-slate-700">Date of Meeting</label>
                                <input
                                    type="date"
                                    required
                                    value={meetingDate}
                                    onChange={(e) => setMeetingDate(e.target.value)}
                                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="block text-xs font-bold text-slate-700">
                                    Session Notes & Key Action Items
                                </label>
                                <textarea
                                    rows={4}
                                    placeholder="Topics covered, resume feedback, milestone check-ins, or next steps agreed upon..."
                                    value={meetingNotes}
                                    onChange={(e) => setMeetingNotes(e.target.value)}
                                    className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-400 resize-none"
                                />
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsMeetingModalOpen(false)}
                                    className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 hover:bg-slate-100 cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submittingMeeting}
                                    className="px-5 py-2 text-xs font-bold rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition shadow-xs cursor-pointer disabled:opacity-50"
                                >
                                    {submittingMeeting ? "Saving..." : "Save Session"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

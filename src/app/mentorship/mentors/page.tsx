"use client";

import { useEffect, useState, useCallback } from "react";
import {
    HeartHandshake,
    Briefcase,
    Building2,
    Clock,
    Search,
    Send,
    CheckCircle2,
    X,
    Filter,
} from "lucide-react";
import { PageTitle } from "@/components/mentorship/MentorshipShell";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui";
import { useUniversity } from "@/context/UniversityContext";
import { fetchMentors, requestMentor } from "@/lib/mentorship";
import type { MentorProfileRow } from "@/lib/mentorship";

export default function MentorsDirectoryPage() {
    const { currentUser, showToast } = useUniversity();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [mentors, setMentors] = useState<MentorProfileRow[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [fieldFilter, setFieldFilter] = useState("ALL");

    // Modal state for Request Mentorship
    const [selectedMentor, setSelectedMentor] = useState<MentorProfileRow | null>(null);
    const [requestMessage, setRequestMessage] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await fetchMentors();
            setMentors(data.mentors);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to load mentors directory");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const handleSendRequest = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedMentor) return;
        setSubmitting(true);
        try {
            await requestMentor({
                mentorId: selectedMentor.id,
                message: requestMessage,
                schoolId: currentUser?.schoolId,
            });
            showToast(`Mentorship request sent to ${selectedMentor.name}!`, "success");
            setSelectedMentor(null);
            setRequestMessage("");
        } catch (e) {
            showToast(e instanceof Error ? e.message : "Failed to submit request", "warning");
        } finally {
            setSubmitting(false);
        }
    };

    const fields = Array.from(new Set(mentors.map((m) => m.field))).filter(Boolean);

    const filtered = mentors.filter((m) => {
        const matchesSearch =
            m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (m.company && m.company.toLowerCase().includes(searchQuery.toLowerCase())) ||
            m.field.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesField = fieldFilter === "ALL" || m.field === fieldFilter;
        return matchesSearch && matchesField;
    });

    return (
        <div className="space-y-6">
            <PageTitle
                title="Alumni & Industry Mentors"
                subtitle="Browse experienced alumni and corporate mentors available for guidance, career planning, and interview prep."
            />

            {/* Filter Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
                <div className="relative flex-1">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search by mentor name, company, or domain..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-slate-400 shrink-0" />
                    <select
                        value={fieldFilter}
                        onChange={(e) => setFieldFilter(e.target.value)}
                        className="text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                        <option value="ALL">All Specializations</option>
                        {fields.map((f) => (
                            <option key={f} value={f}>
                                {f}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {loading ? (
                <LoadingState rows={4} />
            ) : error ? (
                <ErrorState message={error} retry={load} />
            ) : filtered.length === 0 ? (
                <EmptyState
                    title="No mentors match your search"
                    description="Try adjusting your keywords or clearing specialization filters."
                />
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {filtered.map((mentor) => (
                        <div
                            key={mentor.id}
                            className="bg-white rounded-2xl border border-slate-200 shadow-2xs hover:shadow-md transition-all p-5 flex flex-col justify-between"
                        >
                            <div className="space-y-3">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="h-11 w-11 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700 font-bold shrink-0">
                                        <Briefcase className="h-5 w-5" />
                                    </div>
                                    <span
                                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                            mentor.available
                                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                                : "bg-slate-100 text-slate-500"
                                        }`}
                                    >
                                        {mentor.available ? "Accepting Mentees" : "Max Capacity"}
                                    </span>
                                </div>

                                <div>
                                    <h3 className="text-sm font-bold text-slate-900">{mentor.name}</h3>
                                    <p className="text-xs font-semibold text-indigo-600">{mentor.field}</p>
                                </div>

                                <div className="space-y-1.5 pt-2 border-t border-slate-100 text-xs text-slate-600">
                                    {mentor.company && (
                                        <p className="flex items-center gap-1.5">
                                            <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                            <span className="font-medium text-slate-700">{mentor.company}</span>
                                        </p>
                                    )}
                                    <p className="flex items-center gap-1.5">
                                        <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                        <span>{mentor.experience} Years Industry Experience</span>
                                    </p>
                                </div>
                            </div>

                            <div className="mt-5 pt-3 border-t border-slate-100">
                                <button
                                    onClick={() => setSelectedMentor(mentor)}
                                    disabled={!mentor.available}
                                    className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed bg-slate-900 text-white hover:bg-indigo-600 shadow-2xs"
                                >
                                    <HeartHandshake className="h-4 w-4" />
                                    <span>Request Mentorship</span>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Request Mentorship Modal */}
            {selectedMentor && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                            <div className="flex items-center gap-2.5">
                                <div className="h-9 w-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                                    <Send className="h-4 w-4" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-slate-900">Request Mentorship</h3>
                                    <p className="text-[11px] text-slate-500">With {selectedMentor.name}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setSelectedMentor(null)}
                                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <form onSubmit={handleSendRequest} className="mt-4 space-y-4">
                            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-600">
                                <p className="font-semibold text-slate-800">Domain: {selectedMentor.field}</p>
                                {selectedMentor.company && (
                                    <p className="text-slate-500">Company: {selectedMentor.company}</p>
                                )}
                            </div>

                            <div className="space-y-1.5">
                                <label className="block text-xs font-bold text-slate-700">
                                    Your Goals / Introduction Note
                                </label>
                                <textarea
                                    required
                                    rows={4}
                                    placeholder="Briefly describe your career aspirations, projects, and what guidance you are seeking..."
                                    value={requestMessage}
                                    onChange={(e) => setRequestMessage(e.target.value)}
                                    className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-400 resize-none"
                                />
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setSelectedMentor(null)}
                                    className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 hover:bg-slate-100 cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="px-5 py-2 text-xs font-bold rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition shadow-xs cursor-pointer disabled:opacity-50"
                                >
                                    {submitting ? "Sending..." : "Submit Request"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

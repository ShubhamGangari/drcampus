"use client";

import { useEffect, useState, useCallback } from "react";
import {
    ShieldCheck,
    Users,
    HeartHandshake,
    Link2,
    Plus,
    X,
    Trash2,
    Calendar,
    Search,
} from "lucide-react";
import { PageTitle } from "@/components/mentorship/MentorshipShell";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui";
import { useUniversity } from "@/context/UniversityContext";
import {
    fetchAdminMentorship,
    fetchMentors,
    createPairing,
    endPairing,
    canManageMentorship,
} from "@/lib/mentorship";
import type { MentorshipAdminData, MentorProfileRow } from "@/lib/mentorship";

export default function MentorshipAdminPage() {
    const { currentUser, showToast } = useUniversity();
    const canManage = canManageMentorship(currentUser);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<MentorshipAdminData | null>(null);
    const [mentors, setMentors] = useState<MentorProfileRow[]>([]);
    const [search, setSearch] = useState("");

    // Create pairing modal
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [selectedMentorId, setSelectedMentorId] = useState("");
    const [studentId, setStudentId] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [adminRes, mentorsRes] = await Promise.all([
                fetchAdminMentorship(),
                fetchMentors(),
            ]);
            setData(adminRes);
            setMentors(mentorsRes.mentors);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to load mentorship admin data");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const handleCreatePairing = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedMentorId || !studentId.trim()) return;
        setSubmitting(true);
        try {
            await createPairing({
                mentorId: selectedMentorId,
                studentId: studentId.trim(),
                schoolId: currentUser?.schoolId,
            });
            showToast("Mentorship pairing created successfully!", "success");
            setIsCreateModalOpen(false);
            setSelectedMentorId("");
            setStudentId("");
            load();
        } catch (e) {
            showToast(e instanceof Error ? e.message : "Failed to create pairing", "warning");
        } finally {
            setSubmitting(false);
        }
    };

    const handleEndPairing = async (pairingId: string) => {
        if (!confirm("Are you sure you want to end this mentorship pairing?")) return;
        try {
            await endPairing(pairingId);
            showToast("Pairing terminated.", "info");
            load();
        } catch (e) {
            showToast(e instanceof Error ? e.message : "Failed to end pairing", "warning");
        }
    };

    const pairings = data?.pairings || [];
    const filteredPairings = pairings.filter(
        (p) =>
            p.mentorName.toLowerCase().includes(search.toLowerCase()) ||
            p.studentName.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <PageTitle
                    title="Mentorship Administration"
                    subtitle="Monitor active university-alumni pairings, review session volume, and manually match students."
                />
                {canManage && (
                    <button
                        onClick={() => setIsCreateModalOpen(true)}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition shadow-xs cursor-pointer shrink-0"
                    >
                        <Plus className="h-4 w-4" />
                        <span>Create Manual Pairing</span>
                    </button>
                )}
            </div>

            {loading ? (
                <LoadingState rows={4} />
            ) : error ? (
                <ErrorState message={error} retry={load} />
            ) : (
                <div className="space-y-6">
                    {/* Stats Strip */}
                    {data?.stats && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-2xs flex items-center gap-4">
                                <div className="h-11 w-11 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                                    <Users className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="text-2xl font-black text-slate-900">{data.stats.mentors}</p>
                                    <p className="text-xs text-slate-500 font-medium">Enrolled Mentors</p>
                                </div>
                            </div>

                            <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-2xs flex items-center gap-4">
                                <div className="h-11 w-11 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                                    <HeartHandshake className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="text-2xl font-black text-slate-900">{data.stats.activePairings}</p>
                                    <p className="text-xs text-slate-500 font-medium">Active Mentorships</p>
                                </div>
                            </div>

                            <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-2xs flex items-center gap-4">
                                <div className="h-11 w-11 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
                                    <Link2 className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="text-2xl font-black text-slate-900">{data.stats.mentees}</p>
                                    <p className="text-xs text-slate-500 font-medium">Guided Students</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Pairings Table */}
                    <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
                        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                                <h3 className="text-sm font-bold text-slate-900">Pairings Directory</h3>
                                <p className="text-xs text-slate-500">All current and historical student-mentor connections</p>
                            </div>

                            <div className="relative w-full sm:w-64">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Search by mentor or student..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                        </div>

                        {filteredPairings.length === 0 ? (
                            <EmptyState
                                title="No pairings found"
                                description="Create a pairing manually or wait for mentor request approvals."
                            />
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold uppercase tracking-wider">
                                        <tr>
                                            <th className="px-5 py-3.5">Mentor</th>
                                            <th className="px-5 py-3.5">Student / Mentee</th>
                                            <th className="px-5 py-3.5">Status</th>
                                            <th className="px-5 py-3.5 text-center">Sessions Logged</th>
                                            {canManage && <th className="px-5 py-3.5 text-right">Actions</th>}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {filteredPairings.map((p) => (
                                            <tr key={p.id} className="hover:bg-slate-50/50 transition">
                                                <td className="px-5 py-3.5 font-bold text-slate-900">
                                                    {p.mentorName}
                                                </td>
                                                <td className="px-5 py-3.5 text-slate-700 font-medium">
                                                    {p.studentName}
                                                </td>
                                                <td className="px-5 py-3.5">
                                                    <span
                                                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                            p.status === "ACTIVE"
                                                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                                                : "bg-slate-100 text-slate-500"
                                                        }`}
                                                    >
                                                        {p.status}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-3.5 text-center">
                                                    <span className="font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                                                        {p.meetingsCount}
                                                    </span>
                                                </td>
                                                {canManage && (
                                                    <td className="px-5 py-3.5 text-right">
                                                        {p.status === "ACTIVE" && (
                                                            <button
                                                                onClick={() => handleEndPairing(p.id)}
                                                                className="text-rose-600 hover:text-rose-700 font-semibold inline-flex items-center gap-1 cursor-pointer"
                                                            >
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                                <span>End</span>
                                                            </button>
                                                        )}
                                                    </td>
                                                )}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Create Pairing Modal */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                            <div className="flex items-center gap-2.5">
                                <div className="h-9 w-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                                    <Plus className="h-4 w-4" />
                                </div>
                                <h3 className="text-sm font-bold text-slate-900">Create Mentorship Pairing</h3>
                            </div>
                            <button
                                onClick={() => setIsCreateModalOpen(false)}
                                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <form onSubmit={handleCreatePairing} className="mt-4 space-y-4">
                            <div className="space-y-1.5">
                                <label className="block text-xs font-bold text-slate-700">Select Mentor</label>
                                <select
                                    required
                                    value={selectedMentorId}
                                    onChange={(e) => setSelectedMentorId(e.target.value)}
                                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                                >
                                    <option value="">-- Choose Alumni Mentor --</option>
                                    {mentors.map((m) => (
                                        <option key={m.id} value={m.id}>
                                            {m.name} ({m.field} {m.company ? `· ${m.company}` : ""})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-1.5">
                                <label className="block text-xs font-bold text-slate-700">
                                    Student ID or Enrollment No
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g. stu_01 or EN2024001"
                                    value={studentId}
                                    onChange={(e) => setStudentId(e.target.value)}
                                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsCreateModalOpen(false)}
                                    className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 hover:bg-slate-100 cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="px-5 py-2 text-xs font-bold rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition shadow-xs cursor-pointer disabled:opacity-50"
                                >
                                    {submitting ? "Pairing..." : "Establish Pairing"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

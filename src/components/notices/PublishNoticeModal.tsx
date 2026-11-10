"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/admissions/Modal";
import {
    CreateNoticeInput,
    Notice,
    NOTICE_CATEGORIES,
    NOTICE_CATEGORY_LABELS,
} from "@/lib/notices";

interface PublishNoticeModalProps {
    open: boolean;
    busy: boolean;
    error: string | null;
    schoolRequired: boolean;
    initial?: Notice | null;
    onClose: () => void;
    onSubmit: (input: CreateNoticeInput) => void;
}

const inputCls =
    "w-full h-10 px-3 rounded-xl border border-slate-300 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500";

const ROLE_OPTIONS = [
    { value: "FACULTY", label: "Faculty" },
    { value: "STUDENT", label: "Students" },
    { value: "FINANCE_OFFICER", label: "Finance Officers" },
    { value: "EXAM_CONTROLLER", label: "Exam Controllers" },
    { value: "DEAN", label: "Deans" },
    { value: "REGISTRAR_ADMIN", label: "Registrar Admins" },
    { value: "SUPER_ADMIN", label: "Super Admins" },
];

function parseAudience(json: string): { roles: string[]; schoolIds: string[] } {
    try {
        const parsed = JSON.parse(json);
        return {
            roles: Array.isArray(parsed?.roles) ? parsed.roles : [],
            schoolIds: Array.isArray(parsed?.schoolIds) ? parsed.schoolIds : [],
        };
    } catch {
        return { roles: [], schoolIds: [] };
    }
}

export function PublishNoticeModal({
    open,
    busy,
    error,
    schoolRequired,
    initial,
    onClose,
    onSubmit,
}: PublishNoticeModalProps) {
    const [title, setTitle] = useState("");
    const [category, setCategory] = useState<string>(NOTICE_CATEGORIES[0]);
    const [body, setBody] = useState("");
    const [pinned, setPinned] = useState(false);
    const [expiresAt, setExpiresAt] = useState("");
    const [roles, setRoles] = useState<string[]>([]);
    const [schoolId, setSchoolId] = useState("");

    useEffect(() => {
        if (!open) return;
        if (initial) {
            setTitle(initial.title);
            setCategory(initial.category);
            setBody(initial.body);
            setPinned(initial.pinned);
            setExpiresAt(initial.expiresAt ? initial.expiresAt.slice(0, 10) : "");
            const audience = parseAudience(initial.audienceJson);
            setRoles(audience.roles);
            setSchoolId("");
        } else {
            setTitle("");
            setCategory(NOTICE_CATEGORIES[0]);
            setBody("");
            setPinned(false);
            setExpiresAt("");
            setRoles([]);
            setSchoolId("");
        }
    }, [open, initial]);

    if (!open) return null;

    const canSubmit = title.trim() && body.trim() && (!schoolRequired || schoolId);

    const toggleRole = (role: string) => {
        setRoles((prev) => (prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]));
    };

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!canSubmit) return;
        onSubmit({
            schoolId: schoolId || undefined,
            title: title.trim(),
            category: category as CreateNoticeInput["category"],
            body: body.trim(),
            audience: roles.length ? { roles } : undefined,
            pinned,
            expiresAt: expiresAt ? new Date(`${expiresAt}T23:59:59`).toISOString() : null,
        });
    };

    return (
        <Modal
            open={open}
            title={initial ? "Edit notice" : "Publish notice"}
            description={initial ? "Update the notice details and audience." : "Compose a new notice or circular for the board."}
            onClose={onClose}
            wide
        >
            <form onSubmit={submit} className="space-y-4">
                {schoolRequired && (
                    <div>
                        <label htmlFor="notice-school" className="block text-xs font-bold text-slate-600 mb-1.5">
                            School
                        </label>
                        <select
                            id="notice-school"
                            value={schoolId}
                            onChange={(e) => setSchoolId(e.target.value)}
                            className={inputCls}
                        >
                            <option value="">Select school…</option>
                            <option value="SCHOOL_1">School 1</option>
                            <option value="SCHOOL_2">School 2</option>
                        </select>
                    </div>
                )}

                <div>
                    <label htmlFor="notice-title" className="block text-xs font-bold text-slate-600 mb-1.5">
                        Title
                    </label>
                    <input
                        id="notice-title"
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="e.g. Mid-term examination timetable"
                        maxLength={200}
                        className={inputCls}
                    />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="notice-category" className="block text-xs font-bold text-slate-600 mb-1.5">
                            Category
                        </label>
                        <select
                            id="notice-category"
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            className={inputCls}
                        >
                            {NOTICE_CATEGORIES.map((c) => (
                                <option key={c} value={c}>
                                    {NOTICE_CATEGORY_LABELS[c]}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="notice-expires" className="block text-xs font-bold text-slate-600 mb-1.5">
                            Expires on <span className="font-medium text-slate-400">(optional)</span>
                        </label>
                        <input
                            id="notice-expires"
                            type="date"
                            value={expiresAt}
                            onChange={(e) => setExpiresAt(e.target.value)}
                            className={inputCls}
                        />
                    </div>
                </div>

                <div>
                    <label htmlFor="notice-body" className="block text-xs font-bold text-slate-600 mb-1.5">
                        Message
                    </label>
                    <textarea
                        id="notice-body"
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        placeholder="Write the notice details…"
                        rows={5}
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
                    />
                </div>

                <div className="flex items-center justify-between gap-4">
                    <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={pinned}
                            onChange={(e) => setPinned(e.target.checked)}
                            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        Pin to top
                    </label>
                    <span className="text-xs text-slate-500">Pinned notices stay at the top of the board.</span>
                </div>

                <div>
                    <p className="text-xs font-bold text-slate-600 mb-2">
                        Audience <span className="font-medium text-slate-400">(blank = everyone)</span>
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {ROLE_OPTIONS.map((role) => {
                            const active = roles.includes(role.value);
                            return (
                                <button
                                    key={role.value}
                                    type="button"
                                    onClick={() => toggleRole(role.value)}
                                    aria-pressed={active}
                                    className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl border transition-colors cursor-pointer ${active
                                        ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                                        : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                                        }`}
                                >
                                    {role.label}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {error && <p className="text-xs font-medium text-rose-600">{error}</p>}

                <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 h-10 rounded-xl border border-slate-300 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={busy || !canSubmit}
                        className="inline-flex items-center gap-2 px-5 h-10 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 transition-colors cursor-pointer"
                    >
                        {busy ? "Saving…" : initial ? "Save changes" : "Publish"}
                    </button>
                </div>
            </form>
        </Modal>
    );
}

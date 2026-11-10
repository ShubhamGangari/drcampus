"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/admissions/Modal";
import { Field, TextInput, SelectInput } from "@/components/admissions/FormControls";
import { InlineLoader } from "@/components/admissions/States";
import { SchoolSelect } from "@/components/fees/SchoolSelect";
import { LEGAL_POSITIONS } from "@/lib/perms";
import {
    BUILTIN_ROLES,
    CreateOfficerInput,
    POSITION_LABELS,
    RbacRole,
    ROLE_LABELS,
} from "@/lib/rbac-client";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface OfficerModalProps {
    open: boolean;
    /** Custom roles available for assignment (already filtered to this school). */
    customRoles: RbacRole[];
    busy: boolean;
    error?: string | null;
    onClose: () => void;
    onSubmit: (input: CreateOfficerInput) => void;
}

/**
 * Create an officer account. Spec §3.2: School (select), Name, Email, Temporary
 * password (min 8), built-in role (one of the 6), Position (optional, legal for
 * the role), Custom role (optional, from custom roles applicable to the school).
 */
export function OfficerModal({ open, customRoles, busy, error, onClose, onSubmit }: OfficerModalProps) {
    const [schoolId, setSchoolId] = useState("");
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [role, setRole] = useState("");
    const [position, setPosition] = useState("");
    const [customRoleId, setCustomRoleId] = useState("");
    const [fieldErrors, setFieldErrors] = useState<{
        schoolId?: string;
        name?: string;
        email?: string;
        password?: string;
        role?: string;
        position?: string;
    }>({});

    useEffect(() => {
        if (!open) return;
        setSchoolId("");
        setName("");
        setEmail("");
        setPassword("");
        setRole("");
        setPosition("");
        setCustomRoleId("");
        setFieldErrors({});
    }, [open]);

    const positionOptions = role ? (LEGAL_POSITIONS[role as keyof typeof LEGAL_POSITIONS] ?? []) : [];

    const handleSubmit = () => {
        const errors: typeof fieldErrors = {};
        if (!schoolId) errors.schoolId = "Select a school.";
        if (!name.trim()) errors.name = "Name is required.";
        if (!email.trim()) errors.email = "Email is required.";
        else if (!EMAIL_RE.test(email.trim())) errors.email = "Enter a valid email address.";
        if (!password || password.length < 8) errors.password = "Temporary password must be at least 8 characters.";
        if (!role) errors.role = "Select a built-in role.";
        if (position && !positionOptions.includes(position as never)) errors.position = "Position is not legal for this role.";
        setFieldErrors(errors);
        if (Object.keys(errors).length > 0) return;

        onSubmit({
            schoolId,
            name: name.trim(),
            email: email.trim().toLowerCase(),
            password,
            role: role as CreateOfficerInput["role"],
            position: position || null,
            customRoleId: customRoleId || null,
        });
    };

    return (
        <Modal
            open={open}
            onClose={() => (busy ? undefined : onClose())}
            title="Create officer"
            description="Provision a login account for an officer with a built-in or custom role."
            wide
        >
            <div className="space-y-4">
                <SchoolSelect value={schoolId} onChange={setSchoolId} disabled={busy} error={fieldErrors.schoolId} />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Full name" htmlFor="officer-name" error={fieldErrors.name}>
                        <TextInput
                            id="officer-name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Dr. R. Verma"
                            disabled={busy}
                        />
                    </Field>
                    <Field label="Email" htmlFor="officer-email" error={fieldErrors.email}>
                        <TextInput
                            id="officer-email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="officer@university.edu"
                            disabled={busy}
                        />
                    </Field>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Temporary password" htmlFor="officer-password" error={fieldErrors.password} hint="Min 8 characters. Hashed on the server.">
                        <TextInput
                            id="officer-password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            disabled={busy}
                            autoComplete="new-password"
                        />
                    </Field>
                    <Field label="Built-in role" htmlFor="officer-role" error={fieldErrors.role}>
                        <SelectInput
                            id="officer-role"
                            value={role}
                            onChange={(e) => {
                                setRole(e.target.value);
                                setPosition("");
                            }}
                            disabled={busy}
                        >
                            <option value="">Select role</option>
                            {BUILTIN_ROLES.map((r) => (
                                <option key={r} value={r}>
                                    {ROLE_LABELS[r]}
                                </option>
                            ))}
                        </SelectInput>
                    </Field>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Position" htmlFor="officer-position" hint="Optional — must be legal for the role." error={fieldErrors.position}>
                        <SelectInput
                            id="officer-position"
                            value={position}
                            onChange={(e) => setPosition(e.target.value)}
                            disabled={busy || !role}
                        >
                            <option value="">No specific position</option>
                            {positionOptions.map((p) => (
                                <option key={p} value={p}>
                                    {POSITION_LABELS[p] ?? p}
                                </option>
                            ))}
                        </SelectInput>
                    </Field>
                    <Field label="Custom role" htmlFor="officer-custom-role" hint="Optional — replaces built-in permissions when set.">
                        <SelectInput
                            id="officer-custom-role"
                            value={customRoleId}
                            onChange={(e) => setCustomRoleId(e.target.value)}
                            disabled={busy || !schoolId}
                        >
                            <option value="">No custom role</option>
                            {customRoles.map((r) => (
                                <option key={r.id} value={r.id}>
                                    {r.name}
                                </option>
                            ))}
                        </SelectInput>
                    </Field>
                </div>

                {error && (
                    <p
                        className="text-xs font-medium text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3.5 py-2.5"
                        role="alert"
                    >
                        {error}
                    </p>
                )}

                <div className="flex items-center justify-end gap-3 pt-1">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={busy}
                        className="px-4 py-2.5 rounded-xl text-sm font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={busy}
                        className="px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                    >
                        {busy ? <InlineLoader label="Creating…" /> : "Create officer"}
                    </button>
                </div>
            </div>
        </Modal>
    );
}

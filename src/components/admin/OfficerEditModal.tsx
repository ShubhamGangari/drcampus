"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/admissions/Modal";
import { Field, SelectInput } from "@/components/admissions/FormControls";
import { InlineLoader } from "@/components/admissions/States";
import { LEGAL_POSITIONS } from "@/lib/perms";
import {
    BUILTIN_ROLES,
    POSITION_LABELS,
    RbacRole,
    RbacUser,
    ROLE_LABELS,
    UpdateOfficerInput,
} from "@/lib/rbac-client";

interface OfficerEditModalProps {
    open: boolean;
    /** The officer being edited (null when closed). */
    record: RbacUser | null;
    /** Custom roles applicable to the officer's school. */
    customRoles: RbacRole[];
    busy: boolean;
    error?: string | null;
    onClose: () => void;
    onSubmit: (id: string, input: UpdateOfficerInput) => void;
}

/**
 * Edit an officer's role assignment. Spec §3.2: change built-in role, position,
 * or assign / clear a custom role (within the officer's school scope).
 * Deactivation is a separate action on the list.
 */
export function OfficerEditModal({ open, record, customRoles, busy, error, onClose, onSubmit }: OfficerEditModalProps) {
    const [role, setRole] = useState("");
    const [position, setPosition] = useState("");
    const [customRoleId, setCustomRoleId] = useState("");
    const [fieldErrors, setFieldErrors] = useState<{ role?: string; position?: string }>({});

    useEffect(() => {
        if (!open || !record) return;
        setRole(record.role);
        setPosition(record.position ?? "");
        setCustomRoleId(record.customRoleId ?? "");
        setFieldErrors({});
    }, [open, record]);

    const positionOptions = role ? (LEGAL_POSITIONS[role as keyof typeof LEGAL_POSITIONS] ?? []) : [];

    const handleSubmit = () => {
        const errors: { role?: string; position?: string } = {};
        if (!role) errors.role = "Select a built-in role.";
        if (position && !positionOptions.includes(position as never)) errors.position = "Position is not legal for this role.";
        setFieldErrors(errors);
        if (Object.keys(errors).length > 0) return;

        if (record) {
            onSubmit(record.id, {
                role: role as UpdateOfficerInput["role"],
                position: position || null,
                customRoleId: customRoleId || null,
            });
        }
    };

    return (
        <Modal
            open={open}
            onClose={() => (busy ? undefined : onClose())}
            title="Assign role"
            description={record ? `Change the role / position for ${record.name}.` : undefined}
        >
            <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4">
                    <Field label="Built-in role" htmlFor="edit-role" error={fieldErrors.role}>
                        <SelectInput
                            id="edit-role"
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

                    <Field label="Position" htmlFor="edit-position" hint="Optional — must be legal for the role." error={fieldErrors.position}>
                        <SelectInput
                            id="edit-position"
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

                    <Field label="Custom role" htmlFor="edit-custom-role" hint="Setting one replaces built-in permissions for this officer.">
                        <SelectInput
                            id="edit-custom-role"
                            value={customRoleId}
                            onChange={(e) => setCustomRoleId(e.target.value)}
                            disabled={busy}
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
                        {busy ? <InlineLoader label="Saving…" /> : "Save changes"}
                    </button>
                </div>
            </div>
        </Modal>
    );
}

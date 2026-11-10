"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { Modal } from "@/components/admissions/Modal";
import { Field, TextInput, SelectInput, TextArea } from "@/components/admissions/FormControls";
import { InlineLoader } from "@/components/admissions/States";
import { PERMISSION_CATALOG } from "@/lib/perms";
import {
    CreateRoleInput,
    RbacRole,
    UpdateRoleInput,
} from "@/lib/rbac-client";

interface RoleModalProps {
    open: boolean;
    mode: "create" | "edit";
    initial?: RbacRole | null;
    /** Schools available for scoping a new role (Global = null). */
    schools: { id: string; name: string }[];
    busy: boolean;
    error?: string | null;
    onClose: () => void;
    onSubmit: (input: CreateRoleInput | UpdateRoleInput) => void;
}

/**
 * Create / edit a custom role. Spec §3.1: Name (required), Scope select (Global
 * or a specific school — hidden on edit since scope is immutable), Description,
 * and a grouped permission checklist from the catalog. Permissions toggle into a
 * `Set` and at least one is required.
 */
export function RoleModal({
    open,
    mode,
    initial,
    schools,
    busy,
    error,
    onClose,
    onSubmit,
}: RoleModalProps) {
    const [name, setName] = useState("");
    const [scope, setScope] = useState(""); // "" = Global (schoolId null)
    const [description, setDescription] = useState("");
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [fieldErrors, setFieldErrors] = useState<{ name?: string; permissions?: string }>({});

    useEffect(() => {
        if (!open) return;
        setFieldErrors({});
        if (mode === "edit" && initial) {
            setName(initial.name);
            setScope(initial.schoolId ?? "");
            setDescription(initial.description ?? "");
            setSelected(new Set(initial.permissions));
        } else {
            setName("");
            setScope("");
            setDescription("");
            setSelected(new Set());
        }
    }, [open, mode, initial]);

    const toggle = (key: string) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    const toggleArea = (keys: string[], on: boolean) => {
        setSelected((prev) => {
            const next = new Set(prev);
            keys.forEach((k) => (on ? next.add(k) : next.delete(k)));
            return next;
        });
    };

    const handleSubmit = () => {
        const errors: { name?: string; permissions?: string } = {};
        if (!name.trim()) errors.name = "Role name is required.";
        if (name.trim().length < 2 || name.trim().length > 60) errors.name = "Role name must be 2–60 characters.";
        if (selected.size === 0) errors.permissions = "Select at least one permission.";
        setFieldErrors(errors);
        if (errors.name || errors.permissions) return;

        if (mode === "edit" && initial) {
            onSubmit({
                name: name.trim(),
                description: description.trim() || null,
                permissions: Array.from(selected),
            } satisfies UpdateRoleInput);
        } else {
            onSubmit({
                schoolId: scope || null,
                name: name.trim(),
                description: description.trim() || null,
                permissions: Array.from(selected),
            } satisfies CreateRoleInput);
        }
    };

    return (
        <Modal
            open={open}
            onClose={() => (busy ? undefined : onClose())}
            title={mode === "edit" ? "Edit role" : "Create role"}
            description={
                mode === "edit"
                    ? "Update the permissions granted by this role. Scope is immutable."
                    : "Define a custom role by picking permissions from the catalog."
            }
            wide
        >
            <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Role name" htmlFor="role-name" error={fieldErrors.name}>
                        <TextInput
                            id="role-name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Hostel Warden"
                            disabled={busy}
                            maxLength={60}
                        />
                    </Field>

                    {mode === "create" ? (
                        <Field label="Scope" htmlFor="role-scope" hint="Global roles apply to all schools.">
                            <SelectInput
                                id="role-scope"
                                value={scope}
                                onChange={(e) => setScope(e.target.value)}
                                disabled={busy}
                            >
                                <option value="">Global (All schools)</option>
                                {schools.map((s) => (
                                    <option key={s.id} value={s.id}>
                                        {s.name}
                                    </option>
                                ))}
                            </SelectInput>
                        </Field>
                    ) : (
                        <Field label="Scope" htmlFor="role-scope-static">
                            <div className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-600">
                                {scope ? schools.find((s) => s.id === scope)?.name ?? "School" : "Global (All schools)"}
                            </div>
                        </Field>
                    )}
                </div>

                <Field label="Description" htmlFor="role-desc">
                    <TextArea
                        id="role-desc"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="What should officers with this role be able to do?"
                        disabled={busy}
                    />
                </Field>

                <div>
                    <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-bold text-slate-700">Permissions</span>
                        <span className="text-[11px] font-medium text-slate-400">
                            {selected.size} selected
                        </span>
                    </div>

                    <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1 rounded-xl border border-slate-200 p-3">
                        {PERMISSION_CATALOG.map((area) => {
                            const areaKeys = area.permissions.map((p) => p.key);
                            const allOn = areaKeys.every((k) => selected.has(k));
                            return (
                                <div key={area.name} className="border border-slate-100 rounded-xl p-3">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs font-bold text-slate-700">{area.name}</span>
                                        <button
                                            type="button"
                                            onClick={() => toggleArea(areaKeys, !allOn)}
                                            disabled={busy}
                                            className={`text-[11px] font-bold px-2 py-1 rounded-lg transition-colors cursor-pointer disabled:opacity-50 ${allOn
                                                ? "text-indigo-700 bg-indigo-50 hover:bg-indigo-100"
                                                : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                                                }`}
                                        >
                                            {allOn ? "Clear all" : "Select all"}
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {area.permissions.map((p) => {
                                            const on = selected.has(p.key);
                                            return (
                                                <label
                                                    key={p.key}
                                                    className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 cursor-pointer transition-colors ${on
                                                        ? "border-indigo-200 bg-indigo-50/70"
                                                        : "border-slate-200 bg-white hover:bg-slate-50"
                                                        }`}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={on}
                                                        disabled={busy}
                                                        onChange={() => toggle(p.key)}
                                                        className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                                    />
                                                    <span className={`text-xs font-medium ${on ? "text-indigo-800" : "text-slate-600"}`}>
                                                        {p.label}
                                                    </span>
                                                    {on && <Check className="h-3.5 w-3.5 text-indigo-600 ml-auto shrink-0" />}
                                                </label>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {fieldErrors.permissions && (
                        <p className="text-[11px] font-medium text-rose-600 mt-2" role="alert">
                            {fieldErrors.permissions}
                        </p>
                    )}
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
                        {busy ? (
                            <InlineLoader label={mode === "edit" ? "Saving…" : "Creating…"} />
                        ) : mode === "edit" ? (
                            "Save changes"
                        ) : (
                            "Create role"
                        )}
                    </button>
                </div>
            </div>
        </Modal>
    );
}

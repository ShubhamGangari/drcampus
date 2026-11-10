"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { UserPlus, Shield, Users } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/States";
import { Modal } from "@/components/admissions/Modal";
import { Field, TextInput, SelectInput } from "@/components/admissions/FormControls";
import {
    fetchAccountCapabilities,
    createAccount,
    DelegateApiError,
    type AccountCapabilities,
    type CreateAccountInput,
} from "@/lib/delegate-client";

interface CreateForm {
    name: string;
    email: string;
    password: string;
    role: string;
    position: string;
    departmentId: string;
    schoolId: string;
}

const EMPTY_FORM: CreateForm = {
    name: "",
    email: "",
    password: "",
    role: "",
    position: "",
    departmentId: "",
    schoolId: "",
};

export default function AccountsPage() {
    const [caps, setCaps] = useState<AccountCapabilities | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    const [modalOpen, setModalOpen] = useState(false);
    const [form, setForm] = useState<CreateForm>(EMPTY_FORM);
    const [formErrors, setFormErrors] = useState<Partial<Record<keyof CreateForm, string>>>({});
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [created, setCreated] = useState<{ name: string; email: string } | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        try {
            const data = await fetchAccountCapabilities();
            setCaps(data);
        } catch (e) {
            setLoadError(e instanceof Error ? e.message : "Failed to load capabilities");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    // Position options depend on the selected role.
    const selectedRole = useMemo(() => {
        return caps?.roles.find((r) => r.role === form.role) ?? null;
    }, [caps, form.role]);

    const openModal = () => {
        setForm(EMPTY_FORM);
        setFormErrors({});
        setSubmitError(null);
        setCreated(null);
        setModalOpen(true);
    };

    const validate = (): boolean => {
        const errs: Partial<Record<keyof CreateForm, string>> = {};
        if (!form.name.trim()) errs.name = "Name is required";
        if (!form.email.trim()) errs.email = "Email is required";
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = "Enter a valid email";
        if (!form.password) errs.password = "Password is required";
        else if (form.password.length < 8) errs.password = "Password must be at least 8 characters";
        if (!form.role) errs.role = "Select a role";
        if (selectedRole && selectedRole.positions.length > 0 && !form.position) {
            errs.position = "Select a position";
        }
        setFormErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const submit = async () => {
        setSubmitError(null);
        setCreated(null);
        if (!validate()) return;
        setSubmitting(true);
        try {
            const input: CreateAccountInput = {
                name: form.name.trim(),
                email: form.email.trim(),
                password: form.password,
                role: form.role as CreateAccountInput["role"],
                position: selectedRole && selectedRole.positions.length > 0 ? form.position : null,
                departmentId: form.departmentId || null,
                schoolId: form.schoolId || undefined,
            };
            const { user } = await createAccount(input);
            setCreated({ name: user.name, email: user.email });
            setModalOpen(false);
            setForm(EMPTY_FORM);
        } catch (e) {
            setSubmitError(e instanceof DelegateApiError ? e.message : e instanceof Error ? e.message : "Failed to create account");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="p-6">
                <LoadingState rows={4} />
            </div>
        );
    }

    if (loadError) {
        return (
            <div className="p-6">
                <ErrorState message={loadError} retry={() => void load()} />
            </div>
        );
    }

    if (!caps) {
        return (
            <div className="p-6">
                <ErrorState message="Unable to determine your account permissions." />
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-6 space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-lg font-bold text-slate-900 tracking-tight">Accounts & Roles</h1>
                    <p className="text-sm text-slate-500 mt-0.5">Create accounts for staff, faculty and students within your scope.</p>
                </div>
                <Button onClick={openModal} disabled={!caps.canCreate}>
                    <UserPlus className="h-4 w-4" />
                    Create Account
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                        <Shield className="h-4 w-4 text-indigo-500" />
                        Your Scope
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-slate-700">{caps.scope.scopeLabel}</p>
                    {!caps.canCreate && (
                        <p className="text-xs text-slate-500 mt-2">
                            Your role does not permit creating accounts. Contact the Registrar or Super Admin.
                        </p>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                        <Users className="h-4 w-4 text-indigo-500" />
                        Roles You Can Create
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {caps.roles.length === 0 ? (
                        <EmptyState
                            title="No creatable roles"
                            description="You don't have permission to create any account types."
                        />
                    ) : (
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {caps.roles.map((r) => (
                                <div key={r.role} className="rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3">
                                    <p className="text-sm font-semibold text-slate-800">{r.label}</p>
                                    <p className="text-xs text-slate-500 mt-1">
                                        {r.positions.length > 0 ? r.positions.join(" · ") : "No specific position"}
                                    </p>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            <Modal
                open={modalOpen}
                title="Create Account"
                description="The system will verify you can create this account within your scope."
                onClose={() => setModalOpen(false)}
                wide
            >
                <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field label="Full name" error={formErrors.name}>
                            <TextInput
                                value={form.name}
                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                                placeholder="e.g. Aarav Sharma"
                            />
                        </Field>
                        <Field label="Email" error={formErrors.email}>
                            <TextInput
                                type="email"
                                value={form.email}
                                onChange={(e) => setForm({ ...form, email: e.target.value })}
                                placeholder="name@college.edu"
                            />
                        </Field>
                    </div>

                    <Field label="Password" hint="Minimum 8 characters." error={formErrors.password}>
                        <TextInput
                            type="password"
                            value={form.password}
                            onChange={(e) => setForm({ ...form, password: e.target.value })}
                            placeholder="••••••••"
                        />
                    </Field>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field label="Role" error={formErrors.role}>
                            <SelectInput value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value, position: "" })}>
                                <option value="">Select a role</option>
                                {caps.roles.map((r) => (
                                    <option key={r.role} value={r.role}>
                                        {r.label}
                                    </option>
                                ))}
                            </SelectInput>
                        </Field>
                        {selectedRole && selectedRole.positions.length > 0 ? (
                            <Field label="Position" error={formErrors.position}>
                                <SelectInput
                                    value={form.position}
                                    onChange={(e) => setForm({ ...form, position: e.target.value })}
                                >
                                    <option value="">Select a position</option>
                                    {selectedRole.positions.map((p) => (
                                        <option key={p} value={p}>
                                            {p.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                                        </option>
                                    ))}
                                </SelectInput>
                            </Field>
                        ) : (
                            <div className="hidden sm:block" />
                        )}
                    </div>

                    {caps.departments && caps.departments.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Field label="Department">
                                <SelectInput
                                    value={form.departmentId}
                                    onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
                                >
                                    <option value="">All departments</option>
                                    {caps.departments.map((d) => (
                                        <option key={d.id} value={d.id}>
                                            {d.name}
                                        </option>
                                    ))}
                                </SelectInput>
                            </Field>
                            <div className="hidden sm:block" />
                        </div>
                    )}

                    {submitError && (
                        <div className="rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-sm text-rose-700">
                            {submitError}
                        </div>
                    )}

                    <div className="flex justify-end gap-2 pt-1">
                        <Button variant="outline" onClick={() => setModalOpen(false)} disabled={submitting}>
                            Cancel
                        </Button>
                        <Button onClick={() => void submit()} disabled={submitting}>
                            {submitting ? "Creating…" : "Create Account"}
                        </Button>
                    </div>
                </div>
            </Modal>

            {created && (
                <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800">
                    Account created for <strong>{created.name}</strong> ({created.email}).
                </div>
            )}
        </div>
    );
}

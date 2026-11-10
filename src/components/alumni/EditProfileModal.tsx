"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/admissions/Modal";
import { Field, TextInput } from "@/components/admissions/FormControls";
import { InlineLoader } from "@/components/admissions/States";
import { UpdateAlumniInput } from "@/lib/alumni";

interface EditProfileModalProps {
  open: boolean;
  busy: boolean;
  error?: string | null;
  initial: {
    email: string;
    phone?: string | null;
    currentCompany?: string | null;
    batch?: string | null;
  };
  onClose: () => void;
  onSubmit: (input: UpdateAlumniInput) => void;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function EditProfileModal({
  open,
  busy,
  error,
  initial,
  onClose,
  onSubmit,
}: EditProfileModalProps) {
  const [email, setEmail] = useState(initial.email);
  const [phone, setPhone] = useState(initial.phone ?? "");
  const [currentCompany, setCurrentCompany] = useState(initial.currentCompany ?? "");
  const [batch, setBatch] = useState(initial.batch ?? "");
  const [emailError, setEmailError] = useState<string>();

  useEffect(() => {
    if (!open) return;
    setEmail(initial.email);
    setPhone(initial.phone ?? "");
    setCurrentCompany(initial.currentCompany ?? "");
    setBatch(initial.batch ?? "");
    setEmailError(undefined);
  }, [open, initial]);

  const handleSubmit = () => {
    if (!email.trim()) {
      setEmailError("Email is required.");
      return;
    }
    if (!EMAIL_RE.test(email.trim())) {
      setEmailError("Enter a valid email address.");
      return;
    }
    setEmailError(undefined);

    onSubmit({
      email: email.trim(),
      phone: phone.trim() || undefined,
      currentCompany: currentCompany.trim() || undefined,
      batch: batch.trim() || undefined,
    });
  };

  return (
    <Modal
      open={open}
      title="Edit Profile"
      description="Update your alumni contact and employment details."
      onClose={busy ? () => undefined : onClose}
    >
      <div className="p-6 space-y-4">
        <Field label="Email" htmlFor="edit-email" error={emailError}>
          <TextInput
            id="edit-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={busy}
          />
        </Field>

        <Field label="Phone" htmlFor="edit-phone">
          <TextInput
            id="edit-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="e.g. 98765 43210"
            disabled={busy}
          />
        </Field>

        <Field label="Current company" htmlFor="edit-company">
          <TextInput
            id="edit-company"
            value={currentCompany}
            onChange={(e) => setCurrentCompany(e.target.value)}
            placeholder="e.g. Drivion Solutions"
            disabled={busy}
          />
        </Field>

        <Field label="Batch" htmlFor="edit-batch" hint="Graduation batch/year.">
          <TextInput
            id="edit-batch"
            value={batch}
            onChange={(e) => setBatch(e.target.value)}
            placeholder="e.g. 2025"
            disabled={busy}
          />
        </Field>

        {error && (
          <p className="text-[11px] font-medium text-rose-600" role="alert">
            {error}
          </p>
        )}

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={busy}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-indigo-600 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? <InlineLoader label="Saving…" /> : "Save changes"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

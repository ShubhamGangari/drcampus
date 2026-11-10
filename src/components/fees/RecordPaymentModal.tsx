"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/admissions/Modal";
import { Field, TextInput, SelectInput } from "@/components/admissions/FormControls";
import { InlineLoader } from "@/components/admissions/States";
import { SchoolSelect } from "@/components/fees/SchoolSelect";
import {
  CreatePaymentInput,
  formatAmount,
  Invoice,
  PAYMENT_MODE_OPTIONS,
} from "@/lib/fees";

interface RecordPaymentModalProps {
  open: boolean;
  invoices: Invoice[];
  defaultInvoice?: Invoice | null;
  busy: boolean;
  error?: string | null;
  /** True for Central officers (schoolId "ALL"); shows a School select. */
  schoolRequired?: boolean;
  onClose: () => void;
  onSubmit: (input: CreatePaymentInput) => void;
}

export function RecordPaymentModal({
  open,
  invoices,
  defaultInvoice,
  busy,
  error,
  schoolRequired,
  onClose,
  onSubmit,
}: RecordPaymentModalProps) {
  const [schoolId, setSchoolId] = useState("");
  const [invoiceId, setInvoiceId] = useState("");
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState("");
  const [transactionRef, setTransactionRef] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{
    schoolId?: string;
    invoiceId?: string;
    amount?: string;
    mode?: string;
  }>({});

  useEffect(() => {
    if (!open) return;
    setSchoolId("");
    if (defaultInvoice) {
      setInvoiceId(defaultInvoice.id);
      setAmount(String(defaultInvoice.amount - defaultInvoice.paidAmount));
    } else {
      setInvoiceId("");
      setAmount("");
    }
    setMode("");
    setTransactionRef("");
    setFieldErrors({});
  }, [open, defaultInvoice]);

  const selected = invoices.find((i) => i.id === invoiceId);
  const remaining = selected ? selected.amount - selected.paidAmount : 0;

  const handleSubmit = () => {
    const errors: typeof fieldErrors = {};
    if (schoolRequired && !schoolId) errors.schoolId = "Select a school.";
    if (!invoiceId) errors.invoiceId = "Select an invoice.";
    const amt = Number(amount);
    if (!amt || amt <= 0) errors.amount = "Enter a valid amount.";
    else if (selected && amt > remaining) errors.amount = `Exceeds amount due (${formatAmount(remaining)}).`;
    if (!mode) errors.mode = "Select a payment mode.";

    setFieldErrors(errors);
    if (errors.schoolId || errors.invoiceId || errors.amount || errors.mode) return;

    onSubmit({
      invoiceId,
      amount: amt,
      mode,
      transactionRef: transactionRef.trim() ? transactionRef.trim() : undefined,
      ...(schoolRequired ? { schoolId } : {}),
    });
  };

  return (
    <Modal open={open} onClose={() => (busy ? undefined : onClose())} title="Record payment" description="Apply a payment against an invoice.">
      <div className="space-y-4">
        {schoolRequired && (
          <SchoolSelect value={schoolId} onChange={setSchoolId} disabled={busy} error={fieldErrors.schoolId} />
        )}
        <Field label="Invoice" htmlFor="pay-invoice" error={fieldErrors.invoiceId}>
          <SelectInput
            id="pay-invoice"
            value={invoiceId}
            onChange={(e) => {
              setInvoiceId(e.target.value);
              setAmount("");
            }}
            disabled={busy || !!defaultInvoice}
          >
            <option value="">Select invoice</option>
            {invoices.map((inv) => (
              <option key={inv.id} value={inv.id}>
                {inv.invoiceNo} — {formatAmount(inv.amount)} (due {formatAmount(inv.amount - inv.paidAmount)})
              </option>
            ))}
          </SelectInput>
        </Field>

        {selected && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 flex items-center justify-between text-xs">
            <span className="font-bold text-slate-500">Amount outstanding</span>
            <span className="font-extrabold text-slate-900 text-base">{formatAmount(remaining)}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Amount (₹)" htmlFor="pay-amount" error={fieldErrors.amount}>
            <TextInput
              id="pay-amount"
              type="number"
              min={0}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              disabled={busy}
            />
          </Field>

          <Field label="Payment mode" htmlFor="pay-mode" error={fieldErrors.mode}>
            <SelectInput id="pay-mode" value={mode} onChange={(e) => setMode(e.target.value)} disabled={busy}>
              <option value="">Select mode</option>
              {PAYMENT_MODE_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </SelectInput>
          </Field>
        </div>

        <Field label="Transaction reference" htmlFor="pay-ref" hint="Optional. e.g. UPI ref, cheque no.">
          <TextInput
            id="pay-ref"
            value={transactionRef}
            onChange={(e) => setTransactionRef(e.target.value)}
            placeholder="Optional reference"
            disabled={busy}
          />
        </Field>

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
            {busy ? <InlineLoader label="Recording…" /> : "Record payment"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

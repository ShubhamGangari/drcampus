"use client";

import { Modal } from "@/components/admissions/Modal";
import { InvoiceStatusBadge } from "@/components/fees/InvoiceStatusBadge";
import { formatAmount, formatDate, Invoice } from "@/lib/fees";

interface InvoiceDetailModalProps {
  open: boolean;
  invoice: Invoice | null;
  studentLabel?: string;
  programLabel?: string;
  onClose: () => void;
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5 border-b border-slate-100 last:border-0">
      <span className="text-xs font-bold text-slate-500">{label}</span>
      <span className={`text-sm font-semibold text-slate-900 ${mono ? "tabular-nums" : ""}`}>{value}</span>
    </div>
  );
}

export function InvoiceDetailModal({ open, invoice, studentLabel, programLabel, onClose }: InvoiceDetailModalProps) {
  if (!invoice) return null;
  const balance = invoice.amount - invoice.paidAmount;

  return (
    <Modal open={open} onClose={onClose} title="Invoice details" description={invoice.invoiceNo}>
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-bold text-slate-500">Status</span>
          <InvoiceStatusBadge status={invoice.status} />
        </div>
        <Row label="Student" value={studentLabel ?? "—"} />
        {programLabel && <Row label="Program" value={programLabel} />}
        <Row label="Invoice amount" value={formatAmount(invoice.amount)} mono />
        <Row label="Paid" value={formatAmount(invoice.paidAmount)} mono />
        <Row label="Balance due" value={formatAmount(balance)} mono />
        <Row label="Due date" value={formatDate(invoice.dueDate)} />
      </div>
    </Modal>
  );
}

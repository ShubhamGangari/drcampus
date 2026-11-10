"use client";

import { Modal } from "@/components/admissions/Modal";
import { formatAmount, formatDate, PaymentRecord } from "@/lib/fees";

interface ReceiptModalProps {
  open: boolean;
  payment: PaymentRecord | null;
  studentLabel?: string;
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

export function ReceiptModal({ open, payment, studentLabel, onClose }: ReceiptModalProps) {
  if (!payment) return null;

  return (
    <Modal open={open} onClose={onClose} title="Payment receipt" description={`Receipt ${payment.receiptNo}`}>
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-bold text-slate-500">Receipt no.</span>
          <span className="text-sm font-extrabold text-indigo-700 tabular-nums">{payment.receiptNo}</span>
        </div>
        <Row label="Student" value={studentLabel ?? "—"} />
        <Row label="Invoice no." value={payment.invoiceNo ?? "—"} mono />
        <Row label="Amount" value={formatAmount(payment.amount)} mono />
        <Row label="Mode" value={payment.mode} />
        {payment.transactionRef && <Row label="Transaction ref" value={payment.transactionRef} mono />}
        <Row label="Payment date" value={formatDate(payment.createdAt)} />
      </div>
    </Modal>
  );
}

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeLateFee,
  computeInvoicePaid,
  computeComponentsTotal,
  buildInvoiceNo,
  buildReceiptNo,
  computeNextSeq,
  resolveCreateTenant,
  isDueDateInPast,
} from '../fee-core';
import { ApiError } from '../errors';
import { createPaymentSchema } from '../fees-schemas';

// ---- computeLateFee ----------------------------------------------------------

test('lateFee: no months overdue -> 0', () => {
  assert.equal(computeLateFee(10000, 0), 0);
  assert.equal(computeLateFee(10000, -3), 0);
});

test('lateFee: 2% per month, capped at 10%', () => {
  // 1 month -> 2%
  assert.equal(computeLateFee(10000, 1), 200);
  // 3 months -> 6%
  assert.equal(computeLateFee(10000, 3), 600);
  // 10 months -> 20% would be, but capped at 10% = 1000
  assert.equal(computeLateFee(10000, 10), 1000);
  assert.equal(computeLateFee(10000, 100), 1000);
});

test('lateFee: fractional months floor to whole months', () => {
  assert.equal(computeLateFee(10000, 1.9), 200);
  assert.equal(computeLateFee(10000, 2.1), 400);
});

test('lateFee: rounds to 2 decimals', () => {
  assert.equal(computeLateFee(3333.33, 1), 66.67);
});

// ---- computeInvoicePaid ------------------------------------------------------

test('invoicePaid: nothing paid -> UNPAID, 0', () => {
  const r = computeInvoicePaid(5000, []);
  assert.equal(r.paidAmount, 0);
  assert.equal(r.status, 'UNPAID');
});

test('invoicePaid: partial payment -> PARTIAL', () => {
  const r = computeInvoicePaid(5000, [{ amount: 2000 }]);
  assert.equal(r.paidAmount, 2000);
  assert.equal(r.status, 'PARTIAL');
});

test('invoicePaid: full payment -> PAID', () => {
  const r = computeInvoicePaid(5000, [{ amount: 3000 }, { amount: 2000 }]);
  assert.equal(r.paidAmount, 5000);
  assert.equal(r.status, 'PAID');
});

test('invoicePaid: over-payment still PAID, keeps actual paid', () => {
  const r = computeInvoicePaid(5000, [{ amount: 5500 }]);
  assert.equal(r.paidAmount, 5500);
  assert.equal(r.status, 'PAID');
});

test('invoicePaid: sums float cents exactly at cent precision', () => {
  const r = computeInvoicePaid(100, [{ amount: 33.33 }, { amount: 33.33 }, { amount: 33.34 }]);
  assert.equal(r.paidAmount, 100);
  assert.equal(r.status, 'PAID');
});

// ---- number builders ----------------------------------------------------------

test('buildInvoiceNo: formats 6-digit padded sequence', () => {
  assert.equal(buildInvoiceNo(1, 2026), 'INV-2026-000001');
  assert.equal(buildInvoiceNo(42, 2026), 'INV-2026-000042');
  assert.equal(buildInvoiceNo(123456, 2026), 'INV-2026-123456');
});

test('buildInvoiceNo: clamps sequences below 1 to 1', () => {
  assert.equal(buildInvoiceNo(0, 2026), 'INV-2026-000001');
  assert.equal(buildInvoiceNo(-5, 2026), 'INV-2026-000001');
});

test('buildReceiptNo: formats RCPT-YEAR-6digit', () => {
  assert.equal(buildReceiptNo(7, 2026), 'RCPT-2026-000007');
  assert.equal(buildReceiptNo(1234567, 2026), 'RCPT-2026-1234567');
});

// ---- computeNextSeq ----------------------------------------------------------

test('computeNextSeq: max suffix + 1 (gap-safe), 1 when empty', () => {
  assert.equal(computeNextSeq(['INV-2026-000001', 'INV-2026-000003'], 'INV-2026-'), 4);
  assert.equal(computeNextSeq([], 'INV-2026-'), 1);
  assert.equal(computeNextSeq(['RCPT-2026-000007'], 'RCPT-2026-'), 8);
});

test('computeNextSeq: ignores non-matching prefixes', () => {
  assert.equal(computeNextSeq(['INV-2025-000050', 'RCPT-2026-000002'], 'INV-2026-'), 1);
});

// ---- resolveCreateTenant ------------------------------------------------------

test('resolveCreateTenant: school-scoped user returns their own schoolId', () => {
  assert.equal(resolveCreateTenant({ schoolId: 'sch_eng' }, 'sch_med'), 'sch_eng');
  assert.equal(resolveCreateTenant({ schoolId: 'sch_eng' }, undefined), 'sch_eng');
});

test('resolveCreateTenant: central user returns body schoolId', () => {
  assert.equal(resolveCreateTenant({ schoolId: 'ALL' }, 'sch_eng'), 'sch_eng');
});

test('resolveCreateTenant: central user without body schoolId throws SCHOOL_ID_REQUIRED', () => {
  assert.throws(
    () => resolveCreateTenant({ schoolId: 'ALL' }, undefined),
    (err: unknown) => err instanceof ApiError && err.code === 'SCHOOL_ID_REQUIRED' && err.statusCode === 400
  );
});

// ---- computeComponentsTotal ----------------------------------------------------

test('computeComponentsTotal: sums components to cent precision', () => {
  assert.equal(
    computeComponentsTotal([{ amount: 1000 }, { amount: 2500.5 }, { amount: 499.5 }]),
    4000
  );
});

test('computeComponentsTotal: empty components -> 0', () => {
  assert.equal(computeComponentsTotal([]), 0);
});

test('computeComponentsTotal: rounds float cents to 2 decimals', () => {
  assert.equal(computeComponentsTotal([{ amount: 33.33 }, { amount: 33.33 }, { amount: 33.34 }]), 100);
  assert.equal(computeComponentsTotal([{ amount: 0.005 }]), 0.01);
});

test('computeComponentsTotal: ignores non-numeric amounts', () => {
  assert.equal(computeComponentsTotal([{ amount: 100 }, { amount: NaN }, { amount: 50 }]), 150);
});

// ---- payment mode enum ----------------------------------------------------------

test('payment mode: accepts only the allowed enum values', () => {
  for (const mode of ['UPI', 'NET_BANKING', 'CREDIT_CARD', 'DEBIT_CARD', 'NEFT_RTGS', 'CASH']) {
    const parsed = createPaymentSchema.parse({ invoiceId: 'inv_1', amount: 100, mode });
    assert.equal(parsed.mode, mode);
  }
  assert.throws(() =>
    createPaymentSchema.parse({ invoiceId: 'inv_1', amount: 100, mode: 'bitcoin' })
  );
});

test('payment mode: idempotencyKey is optional and accepted', () => {
  const parsed = createPaymentSchema.parse({
    invoiceId: 'inv_1',
    amount: 100,
    mode: 'UPI',
    idempotencyKey: 'key-1',
  });
  assert.equal(parsed.idempotencyKey, 'key-1');
});

// ---- dueDate-in-past ------------------------------------------------------------

test('dueDate: rejects dates before the start of today', () => {
  const now = new Date(2026, 10, 6, 12, 0, 0); // local noon on a fixed day
  // yesterday -> past
  assert.equal(isDueDateInPast(new Date(2026, 10, 5, 23, 59), now), true);
  // today at midnight -> NOT past (equals start of today)
  assert.equal(isDueDateInPast(new Date(2026, 10, 6, 0, 0), now), false);
  // later today -> not past
  assert.equal(isDueDateInPast(new Date(2026, 10, 6, 23, 59), now), false);
  // tomorrow -> not past
  assert.equal(isDueDateInPast(new Date(2026, 10, 7, 0, 0), now), false);
});

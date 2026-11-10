import test from 'node:test';
import assert from 'node:assert/strict';
import {
    CERTIFICATE_TYPES,
    CERTIFICATE_STATUSES,
    buildRequestNo,
    buildReferenceNo,
    canTransitionStatus,
    requiresActiveStudent,
    requiresGraduatedStudent,
    tenantFilter,
    requireCertificatesManage,
    requireCertificatesView,
} from '../certificates-core';
import { ApiError } from '../errors';

// ---- buildRequestNo (spec §6.1) -------------------------------------------
test('buildRequestNo: zero-pads sequence to 6 digits', () => {
    assert.strictEqual(buildRequestNo(5, '2026'), 'REQ-2026-000005');
});

test('buildRequestNo: uses year and larger sequences as-is', () => {
    assert.strictEqual(buildRequestNo(123456, '2026'), 'REQ-2026-123456');
});

test('buildRequestNo: seq <= 0 clamps to 1', () => {
    assert.strictEqual(buildRequestNo(0, '2026'), 'REQ-2026-000001');
    assert.strictEqual(buildRequestNo(-3, '2026'), 'REQ-2026-000001');
});

test('buildRequestNo: non-numeric seq clamps to 1', () => {
    assert.strictEqual(buildRequestNo(Number.NaN, '2026'), 'REQ-2026-000001');
});

// ---- buildReferenceNo -----------------------------------------------------
test('buildReferenceNo: zero-pads sequence to 6 digits with CERT prefix', () => {
    assert.strictEqual(buildReferenceNo(12, '2026'), 'CERT-2026-000012');
});

test('buildReferenceNo: uses year and larger sequences as-is', () => {
    assert.strictEqual(buildReferenceNo(987654, '2026'), 'CERT-2026-987654');
});

test('buildReferenceNo: seq <= 0 clamps to 1', () => {
    assert.strictEqual(buildReferenceNo(0, '2026'), 'CERT-2026-000001');
});

// ---- canTransitionStatus (spec §6.4) --------------------------------------
test('canTransitionStatus: PENDING -> APPROVED', () => {
    assert.strictEqual(
        canTransitionStatus(CERTIFICATE_STATUSES.PENDING, CERTIFICATE_STATUSES.APPROVED),
        true
    );
});

test('canTransitionStatus: PENDING -> REJECTED', () => {
    assert.strictEqual(
        canTransitionStatus(CERTIFICATE_STATUSES.PENDING, CERTIFICATE_STATUSES.REJECTED),
        true
    );
});

test('canTransitionStatus: APPROVED -> ISSUED', () => {
    assert.strictEqual(
        canTransitionStatus(CERTIFICATE_STATUSES.APPROVED, CERTIFICATE_STATUSES.ISSUED),
        true
    );
});

test('canTransitionStatus: APPROVED -> REJECTED', () => {
    assert.strictEqual(
        canTransitionStatus(CERTIFICATE_STATUSES.APPROVED, CERTIFICATE_STATUSES.REJECTED),
        true
    );
});

test('canTransitionStatus: same-state -> false', () => {
    assert.strictEqual(
        canTransitionStatus(CERTIFICATE_STATUSES.PENDING, CERTIFICATE_STATUSES.PENDING),
        false
    );
    assert.strictEqual(
        canTransitionStatus(CERTIFICATE_STATUSES.APPROVED, CERTIFICATE_STATUSES.APPROVED),
        false
    );
});

test('canTransitionStatus: terminal states have no outgoing transitions', () => {
    assert.strictEqual(
        canTransitionStatus(CERTIFICATE_STATUSES.REJECTED, CERTIFICATE_STATUSES.APPROVED),
        false
    );
    assert.strictEqual(
        canTransitionStatus(CERTIFICATE_STATUSES.ISSUED, CERTIFICATE_STATUSES.PENDING),
        false
    );
    assert.strictEqual(
        canTransitionStatus(CERTIFICATE_STATUSES.ISSUED, CERTIFICATE_STATUSES.APPROVED),
        false
    );
});

test('canTransitionStatus: unknown from-state -> false', () => {
    assert.strictEqual(canTransitionStatus('ARCHIVED', CERTIFICATE_STATUSES.ISSUED), false);
});

// ---- requiresActiveStudent -------------------------------------------------
test('requiresActiveStudent: BONAFIDE -> true', () => {
    assert.strictEqual(requiresActiveStudent(CERTIFICATE_TYPES.BONAFIDE), true);
});

test('requiresActiveStudent: TC / MIGRATION -> false', () => {
    assert.strictEqual(requiresActiveStudent(CERTIFICATE_TYPES.TC), false);
    assert.strictEqual(requiresActiveStudent(CERTIFICATE_TYPES.MIGRATION), false);
});

test('requiresActiveStudent: unknown type -> false', () => {
    assert.strictEqual(requiresActiveStudent('CUSTOM'), false);
});

// ---- requiresGraduatedStudent ---------------------------------------------
test('requiresGraduatedStudent: TC -> true', () => {
    assert.strictEqual(requiresGraduatedStudent(CERTIFICATE_TYPES.TC), true);
});

test('requiresGraduatedStudent: MIGRATION -> true', () => {
    assert.strictEqual(requiresGraduatedStudent(CERTIFICATE_TYPES.MIGRATION), true);
});

test('requiresGraduatedStudent: BONAFIDE -> false', () => {
    assert.strictEqual(requiresGraduatedStudent(CERTIFICATE_TYPES.BONAFIDE), false);
});

test('requiresGraduatedStudent: unknown type -> false', () => {
    assert.strictEqual(requiresGraduatedStudent('CUSTOM'), false);
});

// ---- tenantFilter ----------------------------------------------------------
test('tenantFilter: central + schoolId -> { schoolId }', () => {
    assert.deepEqual(tenantFilter(true, 'school-1'), { schoolId: 'school-1' });
});

test('tenantFilter: central without schoolId -> {}', () => {
    assert.deepEqual(tenantFilter(true, undefined), {});
    assert.deepEqual(tenantFilter(true, ''), {});
});

test('tenantFilter: school-scoped user -> {} (client injects schoolId)', () => {
    assert.deepEqual(tenantFilter(false, 'school-1'), {});
    assert.deepEqual(tenantFilter(false, undefined), {});
});

// ---- Permission gates (spec §7) ------------------------------------------
test('requireCertificatesManage: 403 FORBIDDEN', () => {
    const err = requireCertificatesManage();
    assert.ok(err instanceof ApiError);
    assert.strictEqual(err.statusCode, 403);
    assert.strictEqual(err.code, 'FORBIDDEN');
});

test('requireCertificatesView: 403 FORBIDDEN', () => {
    const err = requireCertificatesView();
    assert.ok(err instanceof ApiError);
    assert.strictEqual(err.statusCode, 403);
    assert.strictEqual(err.code, 'FORBIDDEN');
});

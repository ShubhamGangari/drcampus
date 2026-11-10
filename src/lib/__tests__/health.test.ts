import test from 'node:test';
import assert from 'node:assert/strict';
import {
    validateVisitPayload,
    tenantFilter,
    requireHealthManage,
    requireHealthView,
} from '../health-core';
import { ApiError } from '../errors';

// ---- validateVisitPayload (spec §6.1) --------------------------------------
test('validateVisitPayload: non follow-up status -> valid regardless of date', () => {
    assert.deepEqual(validateVisitPayload({ status: 'COMPLETED' }), { valid: true });
    assert.deepEqual(validateVisitPayload({ status: 'COMPLETED', followUpDate: null }), { valid: true });
    assert.deepEqual(validateVisitPayload({ status: 'SCHEDULED' }), { valid: true });
});

test('validateVisitPayload: FOLLOW_UP_REQUIRED with date -> valid', () => {
    assert.deepEqual(validateVisitPayload({ status: 'FOLLOW_UP_REQUIRED', followUpDate: '2026-02-01' }), {
        valid: true,
    });
    assert.deepEqual(
        validateVisitPayload({ status: 'FOLLOW_UP_REQUIRED', followUpDate: new Date('2026-02-01') }),
        { valid: true }
    );
});

test('validateVisitPayload: FOLLOW_UP_REQUIRED without date -> invalid with error', () => {
    const r = validateVisitPayload({ status: 'FOLLOW_UP_REQUIRED' });
    assert.strictEqual(r.valid, false);
    assert.ok(r.error && r.error.includes('followUpDate'));
});

test('validateVisitPayload: FOLLOW_UP_REQUIRED with null/empty date -> invalid', () => {
    assert.strictEqual(validateVisitPayload({ status: 'FOLLOW_UP_REQUIRED', followUpDate: null }).valid, false);
    assert.strictEqual(validateVisitPayload({ status: 'FOLLOW_UP_REQUIRED', followUpDate: '' }).valid, false);
});

// ---- tenantFilter ---------------------------------------------------------
test('tenantFilter: central + schoolId -> { schoolId }', () => {
    assert.deepEqual(tenantFilter(true, 'school-1'), { schoolId: 'school-1' });
});

test('tenantFilter: central without schoolId -> {}', () => {
    assert.deepEqual(tenantFilter(true, undefined), {});
});

test('tenantFilter: school-scoped user -> {}', () => {
    assert.deepEqual(tenantFilter(false, 'school-1'), {});
});

// ---- Permission gates (spec §7) ------------------------------------------
test('requireHealthManage: 403 FORBIDDEN', () => {
    const err = requireHealthManage();
    assert.ok(err instanceof ApiError);
    assert.strictEqual(err.statusCode, 403);
    assert.strictEqual(err.code, 'FORBIDDEN');
});

test('requireHealthView: 403 FORBIDDEN', () => {
    const err = requireHealthView();
    assert.ok(err instanceof ApiError);
    assert.strictEqual(err.statusCode, 403);
    assert.strictEqual(err.code, 'FORBIDDEN');
});

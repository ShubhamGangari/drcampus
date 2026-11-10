import test from 'node:test';
import assert from 'node:assert/strict';
import {
    REGISTRATION_STATUS,
    isWindowOpen,
    validateCreditCap,
    tenantFilter,
    requireRegistrationManage,
    requireRegistrationView,
} from '../registration-core';
import { ApiError } from '../errors';

// ---- Fixed reference dates ------------------------------------------------
const OPEN = new Date('2026-01-10T00:00:00.000Z');
const BEFORE = new Date('2026-01-09T00:00:00.000Z');
const AFTER = new Date('2026-01-11T00:00:00.000Z');
const LATER = new Date('2026-01-12T00:00:00.000Z');

const window = (overrides: Partial<{ active: boolean; opensAt: Date; closesAt: Date }> = {}) => ({
    active: true,
    opensAt: OPEN,
    closesAt: AFTER,
    ...overrides,
});

// ---- isWindowOpen (spec §6: open window required) --------------------------
test('isWindowOpen: inactive window -> false', () => {
    assert.strictEqual(isWindowOpen(window({ active: false }), OPEN), false);
});

test('isWindowOpen: before opensAt -> false', () => {
    assert.strictEqual(isWindowOpen(window(), BEFORE), false);
});

test('isWindowOpen: after closesAt -> false', () => {
    assert.strictEqual(isWindowOpen(window(), LATER), false);
});

test('isWindowOpen: exactly at opensAt -> true (inclusive)', () => {
    assert.strictEqual(isWindowOpen(window(), OPEN), true);
});

test('isWindowOpen: within window -> true', () => {
    const mid = new Date('2026-01-10T12:00:00.000Z');
    assert.strictEqual(isWindowOpen(window(), mid), true);
});

test('isWindowOpen: exactly at closesAt -> true (inclusive)', () => {
    assert.strictEqual(isWindowOpen(window(), AFTER), true);
});

test('isWindowOpen: null window -> false', () => {
    assert.strictEqual(isWindowOpen(null as never, OPEN), false);
});

// ---- validateCreditCap (spec §6: 24-credit cap) ----------------------------
test('validateCreditCap: exactly at cap -> true', () => {
    assert.strictEqual(validateCreditCap(20, 4), true);
});

test('validateCreditCap: over cap -> false', () => {
    assert.strictEqual(validateCreditCap(20, 5), false);
});

test('validateCreditCap: non-numeric treated as 0', () => {
    assert.strictEqual(validateCreditCap(NaN, NaN), true);
    assert.strictEqual(validateCreditCap(undefined as never, 10), true);
});

test('validateCreditCap: custom cap', () => {
    assert.strictEqual(validateCreditCap(18, 4, 20), false);
    assert.strictEqual(validateCreditCap(16, 4, 20), true);
});

test('validateCreditCap: negative inputs clamped to 0', () => {
    assert.strictEqual(validateCreditCap(-5, -5), true);
});

// ---- tenantFilter --------------------------------------------------------
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
test('requireRegistrationManage: 403 FORBIDDEN', () => {
    const err = requireRegistrationManage();
    assert.ok(err instanceof ApiError);
    assert.strictEqual(err.statusCode, 403);
    assert.strictEqual(err.code, 'FORBIDDEN');
});

test('requireRegistrationView: 403 FORBIDDEN', () => {
    const err = requireRegistrationView();
    assert.ok(err instanceof ApiError);
    assert.strictEqual(err.statusCode, 403);
    assert.strictEqual(err.code, 'FORBIDDEN');
});

// ---- Constants -----------------------------------------------------------
test('registration-status constants', () => {
    assert.strictEqual(REGISTRATION_STATUS.REGISTERED, 'REGISTERED');
    assert.strictEqual(REGISTRATION_STATUS.DROPPED, 'DROPPED');
});

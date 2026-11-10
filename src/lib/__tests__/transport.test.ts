import test from 'node:test';
import assert from 'node:assert/strict';
import {
    PASS_STATUS,
    VEHICLE_STATUS,
    isPassExpired,
    computePassStatus,
    canAssignVehicle,
    parseStops,
    computePassValidity,
    tenantFilter,
    requireTransportManage,
    requireTransportView,
} from '../transport-core';
import { ApiError } from '../errors';

// ---- Fixed reference dates ------------------------------------------------
const BASE = new Date('2026-01-10T00:00:00.000Z');
const BEFORE = new Date('2026-01-09T00:00:00.000Z');
const AFTER = new Date('2026-01-11T00:00:00.000Z');

// ---- isPassExpired (spec §6.1) -------------------------------------------
test('isPassExpired: before validTo -> false', () => {
    assert.strictEqual(isPassExpired(BASE, BEFORE), false);
});

test('isPassExpired: exactly at validTo -> false (valid through the instant)', () => {
    assert.strictEqual(isPassExpired(BASE, BASE), false);
});

test('isPassExpired: after validTo -> true', () => {
    assert.strictEqual(isPassExpired(BASE, AFTER), true);
});

// ---- computePassStatus ----------------------------------------------------
test('computePassStatus: stored PENDING is preserved', () => {
    assert.strictEqual(computePassStatus(PASS_STATUS.PENDING, BASE, BEFORE), PASS_STATUS.PENDING);
    assert.strictEqual(computePassStatus(PASS_STATUS.PENDING, BASE, AFTER), PASS_STATUS.PENDING);
});

test('computePassStatus: ACTIVE before validTo', () => {
    assert.strictEqual(computePassStatus(PASS_STATUS.ACTIVE, BASE, BEFORE), PASS_STATUS.ACTIVE);
});

test('computePassStatus: after validTo -> EXPIRED', () => {
    assert.strictEqual(computePassStatus(PASS_STATUS.ACTIVE, BASE, AFTER), PASS_STATUS.EXPIRED);
});

// ---- canAssignVehicle (spec §6.3) ----------------------------------------
test('canAssignVehicle: MAINTENANCE -> false', () => {
    assert.strictEqual(canAssignVehicle(VEHICLE_STATUS.MAINTENANCE), false);
});

test('canAssignVehicle: ACTIVE -> true', () => {
    assert.strictEqual(canAssignVehicle(VEHICLE_STATUS.ACTIVE), true);
});

test('canAssignVehicle: unknown status -> true', () => {
    assert.strictEqual(canAssignVehicle('RETIRED'), true);
});

// ---- parseStops -----------------------------------------------------------
test('parseStops: null/empty -> []', () => {
    assert.deepEqual(parseStops(null), []);
    assert.deepEqual(parseStops(''), []);
    assert.deepEqual(parseStops(undefined), []);
});

test('parseStops: valid JSON array returned ordered', () => {
    const raw = JSON.stringify([
        { name: 'Station A', order: 1, time: '08:00' },
        { name: 'Station B', order: 2, time: '08:30' },
    ]);
    assert.deepEqual(parseStops(raw), [
        { name: 'Station A', order: 1, time: '08:00' },
        { name: 'Station B', order: 2, time: '08:30' },
    ]);
});

test('parseStops: invalid JSON -> []', () => {
    assert.deepEqual(parseStops('{not json'), []);
});

test('parseStops: non-array JSON -> []', () => {
    assert.deepEqual(parseStops('{"name":"x"}'), []);
    assert.deepEqual(parseStops('42'), []);
});

// ---- computePassValidity ------------------------------------------------
test('computePassValidity: before validFrom -> PENDING', () => {
    const pass = { validFrom: BASE, validTo: AFTER, status: PASS_STATUS.ACTIVE };
    assert.strictEqual(computePassValidity(pass, BEFORE), PASS_STATUS.PENDING);
});

test('computePassValidity: within window -> ACTIVE', () => {
    const pass = { validFrom: BASE, validTo: AFTER, status: PASS_STATUS.ACTIVE };
    assert.strictEqual(computePassValidity(pass, BASE), PASS_STATUS.ACTIVE);
});

test('computePassValidity: after validTo -> EXPIRED', () => {
    const pass = { validFrom: BEFORE, validTo: BASE, status: PASS_STATUS.ACTIVE };
    assert.strictEqual(computePassValidity(pass, AFTER), PASS_STATUS.EXPIRED);
});

test('computePassValidity: stored PENDING preserved even within window', () => {
    const pass = { validFrom: BASE, validTo: AFTER, status: PASS_STATUS.PENDING };
    assert.strictEqual(computePassValidity(pass, BASE), PASS_STATUS.PENDING);
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
test('requireTransportManage: 403 FORBIDDEN', () => {
    const err = requireTransportManage();
    assert.ok(err instanceof ApiError);
    assert.strictEqual(err.statusCode, 403);
    assert.strictEqual(err.code, 'FORBIDDEN');
});

test('requireTransportView: 403 FORBIDDEN', () => {
    const err = requireTransportView();
    assert.ok(err instanceof ApiError);
    assert.strictEqual(err.statusCode, 403);
    assert.strictEqual(err.code, 'FORBIDDEN');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {
    canTransitionEventStatus,
    tenantFilter,
    requireClubsManage,
    requireClubsView,
} from '../clubs-core';
import { ApiError } from '../errors';

// ---- canTransitionEventStatus (spec §6.1) ----------------------------------
test('canTransitionEventStatus: UPCOMING -> COMPLETED allowed', () => {
    assert.strictEqual(canTransitionEventStatus('UPCOMING', 'COMPLETED'), true);
});

test('canTransitionEventStatus: UPCOMING -> CANCELLED allowed', () => {
    assert.strictEqual(canTransitionEventStatus('UPCOMING', 'CANCELLED'), true);
});

test('canTransitionEventStatus: invalid transitions -> false', () => {
    assert.strictEqual(canTransitionEventStatus('COMPLETED', 'UPCOMING'), false);
    assert.strictEqual(canTransitionEventStatus('CANCELLED', 'UPCOMING'), false);
    assert.strictEqual(canTransitionEventStatus('COMPLETED', 'CANCELLED'), false);
    assert.strictEqual(canTransitionEventStatus('UPCOMING', 'UPCOMING'), false);
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
test('requireClubsManage: 403 FORBIDDEN', () => {
    const err = requireClubsManage();
    assert.ok(err instanceof ApiError);
    assert.strictEqual(err.statusCode, 403);
    assert.strictEqual(err.code, 'FORBIDDEN');
});

test('requireClubsView: 403 FORBIDDEN', () => {
    const err = requireClubsView();
    assert.ok(err instanceof ApiError);
    assert.strictEqual(err.statusCode, 403);
    assert.strictEqual(err.code, 'FORBIDDEN');
});

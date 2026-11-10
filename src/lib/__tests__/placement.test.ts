import test from 'node:test';
import assert from 'node:assert/strict';

import { ApiError } from '../errors';
import {
    PLACEMENT_STATUS,
    VALID_PLACEMENT_STATUSES,
    isPlacementStatus,
    canTransitionPlacementStatus,
    tenantFilter,
    requirePlacementManage,
    requirePlacementView,
} from '../placement-core';

test('PLACEMENT_STATUS constants', () => {
    assert.equal(PLACEMENT_STATUS.APPLIED, 'APPLIED');
    assert.equal(PLACEMENT_STATUS.SHORTLISTED, 'SHORTLISTED');
    assert.equal(PLACEMENT_STATUS.OFFERED, 'OFFERED');
    assert.equal(PLACEMENT_STATUS.PLACED, 'PLACED');
    assert.equal(PLACEMENT_STATUS.REJECTED, 'REJECTED');
    assert.deepEqual(VALID_PLACEMENT_STATUSES, [
        'APPLIED',
        'SHORTLISTED',
        'OFFERED',
        'PLACED',
        'REJECTED',
    ]);
});

test('isPlacementStatus: valid values -> true', () => {
    for (const s of VALID_PLACEMENT_STATUSES) {
        assert.equal(isPlacementStatus(s), true, s);
    }
});

test('isPlacementStatus: invalid values -> false', () => {
    assert.equal(isPlacementStatus('PENDING'), false);
    assert.equal(isPlacementStatus(''), false);
    assert.equal(isPlacementStatus('placed'), false);
});

test('canTransitionPlacementStatus: forward one step', () => {
    assert.equal(canTransitionPlacementStatus('APPLIED', 'SHORTLISTED'), true);
    assert.equal(canTransitionPlacementStatus('SHORTLISTED', 'OFFERED'), true);
    assert.equal(canTransitionPlacementStatus('OFFERED', 'PLACED'), true);
});

test('canTransitionPlacementStatus: blocks same-state', () => {
    assert.equal(canTransitionPlacementStatus('APPLIED', 'APPLIED'), false);
    assert.equal(canTransitionPlacementStatus('PLACED', 'PLACED'), false);
});

test('canTransitionPlacementStatus: blocks backwards jumps', () => {
    assert.equal(canTransitionPlacementStatus('SHORTLISTED', 'APPLIED'), false);
    assert.equal(canTransitionPlacementStatus('PLACED', 'OFFERED'), false);
});

test('canTransitionPlacementStatus: blocks multi-step forward jumps', () => {
    assert.equal(canTransitionPlacementStatus('APPLIED', 'OFFERED'), false);
    assert.equal(canTransitionPlacementStatus('APPLIED', 'PLACED'), false);
});

test('canTransitionPlacementStatus: any state -> REJECTED', () => {
    assert.equal(canTransitionPlacementStatus('APPLIED', 'REJECTED'), true);
    assert.equal(canTransitionPlacementStatus('OFFERED', 'REJECTED'), true);
    assert.equal(canTransitionPlacementStatus('PLACED', 'REJECTED'), true);
});

test('canTransitionPlacementStatus: invalid inputs -> false', () => {
    assert.equal(canTransitionPlacementStatus('APPLIED', 'PENDING'), false);
    assert.equal(canTransitionPlacementStatus('PENDING', 'APPLIED'), false);
    assert.equal(canTransitionPlacementStatus('', ''), false);
});

test('tenantFilter: central without schoolId -> {}', () => {
    assert.deepEqual(tenantFilter(true, undefined), {});
});

test('tenantFilter: central with schoolId -> { schoolId }', () => {
    assert.deepEqual(tenantFilter(true, 'SCHOOL_1'), { schoolId: 'SCHOOL_1' });
});

test('tenantFilter: school-scoped user -> {} (client injects schoolId)', () => {
    assert.deepEqual(tenantFilter(false, 'SCHOOL_1'), {});
});

test('requirePlacementManage: 403 FORBIDDEN', () => {
    const err = requirePlacementManage();
    assert.ok(err instanceof ApiError);
    assert.equal(err.statusCode, 403);
    assert.equal(err.code, 'FORBIDDEN');
});

test('requirePlacementView: 403 FORBIDDEN', () => {
    const err = requirePlacementView();
    assert.ok(err instanceof ApiError);
    assert.equal(err.statusCode, 403);
    assert.equal(err.code, 'FORBIDDEN');
});

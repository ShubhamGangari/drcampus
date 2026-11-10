import test from 'node:test';
import assert from 'node:assert/strict';

import { ApiError } from '../errors';
import {
    INTERNSHIP_STATUS,
    VALID_INTERNSHIP_STATUSES,
    isInternshipStatus,
    canTransitionInternshipStatus,
    tenantFilter,
    requireInternshipManage,
    requireInternshipView,
} from '../internships-core';

test('INTERNSHIP_STATUS constants', () => {
    assert.equal(INTERNSHIP_STATUS.APPLIED, 'APPLIED');
    assert.equal(INTERNSHIP_STATUS.APPROVED, 'APPROVED');
    assert.equal(INTERNSHIP_STATUS.ONGOING, 'ONGOING');
    assert.equal(INTERNSHIP_STATUS.COMPLETED, 'COMPLETED');
    assert.equal(INTERNSHIP_STATUS.REJECTED, 'REJECTED');
    assert.deepEqual(VALID_INTERNSHIP_STATUSES, [
        'APPLIED',
        'APPROVED',
        'ONGOING',
        'COMPLETED',
        'REJECTED',
    ]);
});

test('isInternshipStatus: valid values -> true', () => {
    for (const s of VALID_INTERNSHIP_STATUSES) {
        assert.equal(isInternshipStatus(s), true, s);
    }
});

test('isInternshipStatus: invalid values -> false', () => {
    assert.equal(isInternshipStatus('PENDING'), false);
    assert.equal(isInternshipStatus(''), false);
    assert.equal(isInternshipStatus('applied'), false);
});

test('canTransitionInternshipStatus: forward one step', () => {
    assert.equal(canTransitionInternshipStatus('APPLIED', 'APPROVED'), true);
    assert.equal(canTransitionInternshipStatus('APPROVED', 'ONGOING'), true);
    assert.equal(canTransitionInternshipStatus('ONGOING', 'COMPLETED'), true);
});

test('canTransitionInternshipStatus: blocks same-state', () => {
    assert.equal(canTransitionInternshipStatus('APPLIED', 'APPLIED'), false);
    assert.equal(canTransitionInternshipStatus('COMPLETED', 'COMPLETED'), false);
});

test('canTransitionInternshipStatus: blocks backwards jumps', () => {
    assert.equal(canTransitionInternshipStatus('APPROVED', 'APPLIED'), false);
    assert.equal(canTransitionInternshipStatus('COMPLETED', 'ONGOING'), false);
});

test('canTransitionInternshipStatus: blocks multi-step forward jumps', () => {
    assert.equal(canTransitionInternshipStatus('APPLIED', 'ONGOING'), false);
    assert.equal(canTransitionInternshipStatus('APPLIED', 'COMPLETED'), false);
});

test('canTransitionInternshipStatus: any state -> REJECTED', () => {
    assert.equal(canTransitionInternshipStatus('APPLIED', 'REJECTED'), true);
    assert.equal(canTransitionInternshipStatus('APPROVED', 'REJECTED'), true);
    assert.equal(canTransitionInternshipStatus('ONGOING', 'REJECTED'), true);
    assert.equal(canTransitionInternshipStatus('COMPLETED', 'REJECTED'), true);
});

test('canTransitionInternshipStatus: invalid inputs -> false', () => {
    assert.equal(canTransitionInternshipStatus('APPLIED', 'PENDING'), false);
    assert.equal(canTransitionInternshipStatus('PENDING', 'APPLIED'), false);
    assert.equal(canTransitionInternshipStatus('', ''), false);
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

test('requireInternshipManage: 403 FORBIDDEN', () => {
    const err = requireInternshipManage();
    assert.ok(err instanceof ApiError);
    assert.equal(err.statusCode, 403);
    assert.equal(err.code, 'FORBIDDEN');
});

test('requireInternshipView: 403 FORBIDDEN', () => {
    const err = requireInternshipView();
    assert.ok(err instanceof ApiError);
    assert.equal(err.statusCode, 403);
    assert.equal(err.code, 'FORBIDDEN');
});

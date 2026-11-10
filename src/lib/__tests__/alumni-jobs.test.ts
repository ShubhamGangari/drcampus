import test from 'node:test';
import assert from 'node:assert/strict';

import { ApiError } from '../errors';
import {
    JOB_STATUS,
    VALID_JOB_STATUSES,
    VALID_JOB_TYPES,
    isJobStatus,
    isJobType,
    canTransitionJobStatus,
    tenantFilter,
    requireAlumniJobsManage,
    requireAlumniJobsPost,
    requireStudentApplication,
} from '../alumni-jobs-core';

test('JOB_STATUS constants', () => {
    assert.equal(JOB_STATUS.PENDING, 'PENDING');
    assert.equal(JOB_STATUS.APPROVED, 'APPROVED');
    assert.equal(JOB_STATUS.REJECTED, 'REJECTED');
    assert.deepEqual(VALID_JOB_STATUSES, ['PENDING', 'APPROVED', 'REJECTED']);
});

test('isJobStatus: valid values -> true', () => {
    for (const s of VALID_JOB_STATUSES) {
        assert.equal(isJobStatus(s), true, s);
    }
});

test('isJobStatus: invalid values -> false', () => {
    assert.equal(isJobStatus('APPLIED'), false);
    assert.equal(isJobStatus(''), false);
    assert.equal(isJobStatus('pending'), false);
});

test('isJobType: valid values -> true', () => {
    for (const t of VALID_JOB_TYPES) {
        assert.equal(isJobType(t), true, t);
    }
});

test('isJobType: invalid values -> false', () => {
    assert.equal(isJobType('REMOTE'), false);
    assert.equal(isJobType(''), false);
    assert.equal(isJobType('full_time'), false);
});

test('canTransitionJobStatus: PENDING -> APPROVED / REJECTED', () => {
    assert.equal(canTransitionJobStatus('PENDING', 'APPROVED'), true);
    assert.equal(canTransitionJobStatus('PENDING', 'REJECTED'), true);
});

test('canTransitionJobStatus: APPROVED -> REJECTED', () => {
    assert.equal(canTransitionJobStatus('APPROVED', 'REJECTED'), true);
});

test('canTransitionJobStatus: REJECTED -> APPROVED', () => {
    assert.equal(canTransitionJobStatus('REJECTED', 'APPROVED'), true);
});

test('canTransitionJobStatus: blocks same-state', () => {
    assert.equal(canTransitionJobStatus('PENDING', 'PENDING'), false);
    assert.equal(canTransitionJobStatus('APPROVED', 'APPROVED'), false);
    assert.equal(canTransitionJobStatus('REJECTED', 'REJECTED'), false);
});

test('canTransitionJobStatus: blocks invalid transitions', () => {
    assert.equal(canTransitionJobStatus('APPROVED', 'PENDING'), false);
    assert.equal(canTransitionJobStatus('REJECTED', 'PENDING'), false);
});

test('canTransitionJobStatus: invalid inputs -> false', () => {
    assert.equal(canTransitionJobStatus('', ''), false);
    assert.equal(canTransitionJobStatus('PENDING', 'APPLIED'), false);
    assert.equal(canTransitionJobStatus('DRAFT', 'APPROVED'), false);
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

test('requireAlumniJobsManage: 403 FORBIDDEN', () => {
    const err = requireAlumniJobsManage();
    assert.ok(err instanceof ApiError);
    assert.equal(err.statusCode, 403);
    assert.equal(err.code, 'FORBIDDEN');
});

test('requireAlumniJobsPost: 403 FORBIDDEN', () => {
    const err = requireAlumniJobsPost();
    assert.ok(err instanceof ApiError);
    assert.equal(err.statusCode, 403);
    assert.equal(err.code, 'FORBIDDEN');
});

test('requireStudentApplication: 403 FORBIDDEN', () => {
    const err = requireStudentApplication();
    assert.ok(err instanceof ApiError);
    assert.equal(err.statusCode, 403);
    assert.equal(err.code, 'FORBIDDEN');
});

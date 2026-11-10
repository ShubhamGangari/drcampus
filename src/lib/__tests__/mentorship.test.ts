import test from 'node:test';
import assert from 'node:assert/strict';

import { ApiError } from '../errors';
import {
    REQUEST_STATUS,
    PAIRING_STATUS,
    VALID_REQUEST_STATUSES,
    VALID_PAIRING_STATUSES,
    isMentorshipRequestStatus,
    isMentorshipPairingStatus,
    canApplyRequestAction,
    canLogMeeting,
    tenantFilter,
    requireMentorshipManage,
    requireMentorshipView,
    requireMentorshipJoin,
} from '../mentorship-core';

test('REQUEST_STATUS constants', () => {
    assert.equal(REQUEST_STATUS.PENDING, 'PENDING');
    assert.equal(REQUEST_STATUS.ACCEPTED, 'ACCEPTED');
    assert.equal(REQUEST_STATUS.REJECTED, 'REJECTED');
    assert.deepEqual(VALID_REQUEST_STATUSES, ['PENDING', 'ACCEPTED', 'REJECTED']);
});

test('PAIRING_STATUS constants', () => {
    assert.equal(PAIRING_STATUS.ACTIVE, 'ACTIVE');
    assert.equal(PAIRING_STATUS.ENDED, 'ENDED');
    assert.deepEqual(VALID_PAIRING_STATUSES, ['ACTIVE', 'ENDED']);
});

test('isMentorshipRequestStatus: valid values -> true', () => {
    for (const s of VALID_REQUEST_STATUSES) {
        assert.equal(isMentorshipRequestStatus(s), true, s);
    }
});

test('isMentorshipRequestStatus: invalid values -> false', () => {
    assert.equal(isMentorshipRequestStatus('APPLIED'), false);
    assert.equal(isMentorshipRequestStatus(''), false);
    assert.equal(isMentorshipRequestStatus('pending'), false);
});

test('isMentorshipPairingStatus: valid values -> true', () => {
    for (const s of VALID_PAIRING_STATUSES) {
        assert.equal(isMentorshipPairingStatus(s), true, s);
    }
});

test('isMentorshipPairingStatus: invalid values -> false', () => {
    assert.equal(isMentorshipPairingStatus('PENDING'), false);
    assert.equal(isMentorshipPairingStatus(''), false);
    assert.equal(isMentorshipPairingStatus('active'), false);
});

test('canApplyRequestAction: PENDING can be ACCEPT / REJECT', () => {
    assert.equal(canApplyRequestAction('PENDING', 'ACCEPT'), true);
    assert.equal(canApplyRequestAction('PENDING', 'REJECT'), true);
});

test('canApplyRequestAction: blocks non-PENDING actions', () => {
    assert.equal(canApplyRequestAction('ACCEPTED', 'ACCEPT'), false);
    assert.equal(canApplyRequestAction('ACCEPTED', 'REJECT'), false);
    assert.equal(canApplyRequestAction('REJECTED', 'ACCEPT'), false);
});

test('canApplyRequestAction: blocks same-state and unknown actions', () => {
    assert.equal(canApplyRequestAction('PENDING', 'PENDING'), false);
    assert.equal(canApplyRequestAction('PENDING', 'CANCEL'), false);
});

test('canApplyRequestAction: invalid inputs -> false', () => {
    assert.equal(canApplyRequestAction('', 'ACCEPT'), false);
    assert.equal(canApplyRequestAction('PENDING', ''), false);
});

test('canLogMeeting: only ACTIVE pairings', () => {
    assert.equal(canLogMeeting('ACTIVE'), true);
    assert.equal(canLogMeeting('ENDED'), false);
    assert.equal(canLogMeeting('PENDING'), false);
    assert.equal(canLogMeeting(''), false);
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

test('requireMentorshipManage: 403 FORBIDDEN', () => {
    const err = requireMentorshipManage();
    assert.ok(err instanceof ApiError);
    assert.equal(err.statusCode, 403);
    assert.equal(err.code, 'FORBIDDEN');
});

test('requireMentorshipView: 403 FORBIDDEN', () => {
    const err = requireMentorshipView();
    assert.ok(err instanceof ApiError);
    assert.equal(err.statusCode, 403);
    assert.equal(err.code, 'FORBIDDEN');
});

test('requireMentorshipJoin: 403 FORBIDDEN', () => {
    const err = requireMentorshipJoin();
    assert.ok(err instanceof ApiError);
    assert.equal(err.statusCode, 403);
    assert.equal(err.code, 'FORBIDDEN');
});

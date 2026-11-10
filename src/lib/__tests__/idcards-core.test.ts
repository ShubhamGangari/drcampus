import test from 'node:test';
import assert from 'node:assert/strict';

import {
    CARD_STATUS,
    HOLDER_TYPES,
    CARD_NUMBER_PREFIXES,
    isHolderType,
    nextCardNumber,
    cardQrPayload,
    tenantFilter,
    requireIdCardsManage,
    requireIdCardsView,
} from '../idcards-core';
import { ApiError } from '../errors';

test('CARD_STATUS: constants', () => {
    assert.equal(CARD_STATUS.ACTIVE, 'ACTIVE');
    assert.equal(CARD_STATUS.REVOKED, 'REVOKED');
});

test('HOLDER_TYPES: constants and card number prefixes', () => {
    assert.equal(HOLDER_TYPES.STUDENT, 'STUDENT');
    assert.equal(HOLDER_TYPES.STAFF, 'STAFF');
    assert.equal(CARD_NUMBER_PREFIXES[HOLDER_TYPES.STUDENT], 'UGC-STU-');
    assert.equal(CARD_NUMBER_PREFIXES[HOLDER_TYPES.STAFF], 'UGC-STAFF-');
});

test('isHolderType: valid values -> true', () => {
    assert.equal(isHolderType('STUDENT'), true);
    assert.equal(isHolderType('STAFF'), true);
});

test('isHolderType: invalid values -> false', () => {
    assert.equal(isHolderType('ALUMNI'), false);
    assert.equal(isHolderType(''), false);
    assert.equal(isHolderType('student'), false);
    assert.equal(isHolderType(undefined), false);
    assert.equal(isHolderType(null), false);
});

test('nextCardNumber: zero-pads a 6-digit sequence', () => {
    assert.equal(nextCardNumber('UGC-STU-', 123), 'UGC-STU-000123');
    assert.equal(nextCardNumber('UGC-STAFF-', 42), 'UGC-STAFF-000042');
    assert.equal(nextCardNumber('UGC-STU-', 999999), 'UGC-STU-999999');
});

test('nextCardNumber: clamps to >= 1', () => {
    assert.equal(nextCardNumber('UGC-STU-', 0), 'UGC-STU-000001');
    assert.equal(nextCardNumber('UGC-STU-', -5), 'UGC-STU-000001');
});

test('nextCardNumber: handles non-integer input safely', () => {
    assert.equal(nextCardNumber('UGC-STU-', NaN), 'UGC-STU-000001');
    assert.equal(nextCardNumber('UGC-STU-', 3.9), 'UGC-STU-000003');
});

test('cardQrPayload: deterministic for identical cards', () => {
    const card = {
        schoolId: 'SCHOOL_1',
        cardNumber: 'UGC-STU-000123',
        holderId: 'stu_1',
        issuedAt: new Date('2025-01-01T00:00:00.000Z'),
    };
    assert.equal(cardQrPayload(card), cardQrPayload({ ...card }));
});

test('cardQrPayload: changes when any field changes', () => {
    const card = {
        schoolId: 'SCHOOL_1',
        cardNumber: 'UGC-STU-000123',
        holderId: 'stu_1',
        issuedAt: '2025-01-01T00:00:00.000Z',
    };
    assert.notEqual(cardQrPayload(card), cardQrPayload({ ...card, cardNumber: 'UGC-STU-000124' }));
    assert.notEqual(cardQrPayload(card), cardQrPayload({ ...card, holderId: 'stu_2' }));
    assert.notEqual(cardQrPayload(card), cardQrPayload({ ...card, schoolId: 'SCHOOL_2' }));
    assert.notEqual(cardQrPayload(card), cardQrPayload({ ...card, issuedAt: '2025-02-01T00:00:00.000Z' }));
});

test('cardQrPayload: returns a 64-char hex sha256 digest', () => {
    const payload = cardQrPayload({
        schoolId: 'SCHOOL_1',
        cardNumber: 'UGC-STU-000123',
        holderId: 'stu_1',
        issuedAt: new Date('2025-01-01T00:00:00.000Z'),
    });
    assert.match(payload, /^[0-9a-f]{64}$/);
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

test('requireIdCardsManage: 403 FORBIDDEN', () => {
    const err = requireIdCardsManage();
    assert.ok(err instanceof ApiError);
    assert.equal(err.statusCode, 403);
    assert.equal(err.code, 'FORBIDDEN');
});

test('requireIdCardsView: 403 FORBIDDEN', () => {
    const err = requireIdCardsView();
    assert.ok(err instanceof ApiError);
    assert.equal(err.statusCode, 403);
    assert.equal(err.code, 'FORBIDDEN');
});

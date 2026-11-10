// ==============================================================================
// Unit tests for Dean Oversight pure helpers (governance-core.ts).
// Run via: node scripts/test.cjs
// ==============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
    minutesFromMidnight,
    classifyLiveSlot,
    resolvePresenceStatus,
    PRESENCE_STATUSES,
} from '../governance-core';

test('minutesFromMidnight parses HH:mm into minutes', () => {
    assert.equal(minutesFromMidnight('09:30'), 570);
    assert.equal(minutesFromMidnight('00:00'), 0);
    assert.equal(minutesFromMidnight('23:59'), 1439);
    assert.equal(minutesFromMidnight('08:00'), 480);
});

test('classifyLiveSlot: slot containing "now" is LIVE', () => {
    const slot = { dayOfWeek: 1, startTime: '09:00', endTime: '10:00' };
    assert.equal(classifyLiveSlot(slot, 1, 540), 'LIVE'); // 09:00
    assert.equal(classifyLiveSlot(slot, 1, 599), 'LIVE'); // 09:59
});

test('classifyLiveSlot: slot starting within 60 minutes is UPCOMING', () => {
    const slot = { dayOfWeek: 3, startTime: '10:00', endTime: '11:00' };
    assert.equal(classifyLiveSlot(slot, 3, 540), 'UPCOMING'); // 09:00 -> start in 60m
    assert.equal(classifyLiveSlot(slot, 3, 585), 'UPCOMING'); // 09:45 -> start in 15m
});

test('classifyLiveSlot: past / ended slots return null', () => {
    const slot = { dayOfWeek: 2, startTime: '09:00', endTime: '10:00' };
    assert.equal(classifyLiveSlot(slot, 2, 639), null); // 10:39 after end
    assert.equal(classifyLiveSlot(slot, 2, 479), null); // 07:59 before start, >60m away
});

test('classifyLiveSlot: different day returns null', () => {
    const slot = { dayOfWeek: 5, startTime: '09:00', endTime: '10:00' };
    assert.equal(classifyLiveSlot(slot, 1, 540), null);
    assert.equal(classifyLiveSlot(slot, 6, 540), null);
});

test('classifyLiveSlot: end == start is an empty interval (neither LIVE nor UPCOMING when after)', () => {
    const slot = { dayOfWeek: 1, startTime: '10:00', endTime: '10:00' };
    assert.equal(classifyLiveSlot(slot, 1, 600), null);
});

test('resolvePresenceStatus: explicit row wins, missing is UNMARKED', () => {
    assert.equal(resolvePresenceStatus('PRESENT'), 'PRESENT');
    assert.equal(resolvePresenceStatus('ABSENT'), 'ABSENT');
    assert.equal(resolvePresenceStatus('ON_LEAVE'), 'ON_LEAVE');
    assert.equal(resolvePresenceStatus(null), 'UNMARKED');
    assert.equal(resolvePresenceStatus(undefined), 'UNMARKED');
});

test('PRESENCE_STATUSES are exactly the three legal statuses', () => {
    assert.deepEqual([...PRESENCE_STATUSES], ['PRESENT', 'ABSENT', 'ON_LEAVE']);
});

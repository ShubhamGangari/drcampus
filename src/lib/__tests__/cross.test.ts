import test from 'node:test';
import assert from 'node:assert/strict';
import {
    parseLimit,
    calculateAttendancePercent,
    meanAttainment,
    normalizeSearchTerm,
    isSearchable,
} from '../cross-core';
import { ApiError } from '../errors';

// ---- parseLimit (spec §4.2) ------------------------------------------------
test('parseLimit: null/empty -> default 25', () => {
    assert.strictEqual(parseLimit(null), 25);
    assert.strictEqual(parseLimit(''), 25);
});

test('parseLimit: valid integer returns it', () => {
    assert.strictEqual(parseLimit('10'), 10);
    assert.strictEqual(parseLimit('100', 25, 100), 100);
});

test('parseLimit: custom default respected', () => {
    assert.strictEqual(parseLimit(null, 50), 50);
});

test('parseLimit: throws 400 on non-integer', () => {
    assert.throws(() => parseLimit('abc'), (err: ApiError) => {
        assert.strictEqual(err.statusCode, 400);
        assert.strictEqual(err.code, 'INVALID_LIMIT');
        return true;
    });
});

test('parseLimit: throws 400 on 0 / negative', () => {
    assert.throws(() => parseLimit('0'), ApiError);
    assert.throws(() => parseLimit('-5'), ApiError);
});

test('parseLimit: throws 400 above max', () => {
    assert.throws(() => parseLimit('101'), ApiError);
    assert.throws(() => parseLimit('200', 25, 100), ApiError);
});

test('parseLimit: throws 400 on float', () => {
    assert.throws(() => parseLimit('12.5'), ApiError);
});

// ---- calculateAttendancePercent (spec §6.1) --------------------------------
test('attendance percent: no records -> 0', () => {
    assert.strictEqual(calculateAttendancePercent(0, 0, 0), 0);
});

test('attendance percent: all present -> 100', () => {
    assert.strictEqual(calculateAttendancePercent(4, 0, 0), 100);
});

test('attendance percent: half -> 50', () => {
    assert.strictEqual(calculateAttendancePercent(2, 2, 0), 50);
});

test('attendance percent: 1/3 -> 33.3 (rounded to 1 decimal)', () => {
    assert.strictEqual(calculateAttendancePercent(1, 2, 0), 33.3);
});

test('attendance percent: OD counts in denominator', () => {
    assert.strictEqual(calculateAttendancePercent(2, 1, 1), 50);
});

test('attendance percent: 0 present with records -> 0', () => {
    assert.strictEqual(calculateAttendancePercent(0, 5, 1), 0);
});

// ---- meanAttainment (spec §6.3) -------------------------------------------
test('mean attainment: empty -> 0', () => {
    assert.strictEqual(meanAttainment([]), 0);
});

test('mean attainment: single value', () => {
    assert.strictEqual(meanAttainment([3]), 3);
});

test('mean attainment: mean rounded to 2 decimals', () => {
    assert.strictEqual(meanAttainment([1, 2, 3]), 2);
    // 1/3 = 0.333... -> 0.33
    assert.strictEqual(meanAttainment([1, 0, 0]), 0.33);
});

test('mean attainment: (2+3+4)/3 = 3', () => {
    assert.strictEqual(meanAttainment([2, 3, 4]), 3);
});

// ---- normalizeSearchTerm / isSearchable (spec §5.3) ------------------------
test('normalizeSearchTerm: trims and lowercases', () => {
    assert.strictEqual(normalizeSearchTerm('  Rohan Kumar  '), 'rohan kumar');
    assert.strictEqual(normalizeSearchTerm('CS401'), 'cs401');
});

test('isSearchable: requires ≥2 chars after trim', () => {
    assert.strictEqual(isSearchable('ab'), true);
    assert.strictEqual(isSearchable('  ab  '), true);
    assert.strictEqual(isSearchable('a'), false);
    assert.strictEqual(isSearchable(''), false);
    assert.strictEqual(isSearchable('   '), false);
    assert.strictEqual(isSearchable(123), false);
    assert.strictEqual(isSearchable(null), false);
    assert.strictEqual(isSearchable(undefined), false);
});

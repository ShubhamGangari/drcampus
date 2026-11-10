import test from 'node:test';
import assert from 'node:assert/strict';
import {
    evaluateEligibility,
    computeAward,
    parseCriteria,
    tenantFilter,
    requireScholarshipsManage,
    requireScholarshipsView,
} from '../scholarships-core';
import { ApiError } from '../errors';

// ---- parseCriteria (spec §6.1) -------------------------------------------
test('parseCriteria: null/empty -> {}', () => {
    assert.deepEqual(parseCriteria(null), {});
    assert.deepEqual(parseCriteria(''), {});
    assert.deepEqual(parseCriteria(undefined), {});
});

test('parseCriteria: valid JSON object returned', () => {
    assert.deepEqual(parseCriteria('{"minPercentage":75}'), { minPercentage: 75 });
});

test('parseCriteria: malformed or non-object JSON -> {}', () => {
    assert.deepEqual(parseCriteria('{not json'), {});
    assert.deepEqual(parseCriteria('42'), {});
    assert.deepEqual(parseCriteria('"str"'), {});
});

// ---- evaluateEligibility (spec §6.2) --------------------------------------
test('evaluateEligibility: MERIT meets minPercentage -> eligible', () => {
    const scheme = { type: 'MERIT', criteriaJson: '{"minPercentage":75}' };
    assert.deepEqual(evaluateEligibility({ aggregatePercentage: 80 }, scheme), { eligible: true });
});

test('evaluateEligibility: MERIT below minPercentage -> ineligible with reason', () => {
    const scheme = { type: 'MERIT', criteriaJson: '{"minPercentage":75}' };
    assert.deepEqual(evaluateEligibility({ aggregatePercentage: 60 }, scheme), {
        eligible: false,
        reason: 'Requires 75% aggregate',
    });
});

test('evaluateEligibility: MERIT missing aggregate -> ineligible', () => {
    const scheme = { type: 'MERIT', criteriaJson: '{"minPercentage":75}' };
    const r = evaluateEligibility({}, scheme);
    assert.strictEqual(r.eligible, false);
});

test('evaluateEligibility: MERIT without minPercentage -> eligible', () => {
    const scheme = { type: 'MERIT', criteriaJson: '{}' };
    assert.deepEqual(evaluateEligibility({ aggregatePercentage: 50 }, scheme), { eligible: true });
});

test('evaluateEligibility: CATEGORY match -> eligible', () => {
    const scheme = { type: 'CATEGORY', criteriaJson: '{"category":"OBC"}' };
    assert.deepEqual(evaluateEligibility({ category: 'OBC' }, scheme), { eligible: true });
});

test('evaluateEligibility: CATEGORY mismatch -> ineligible with reason', () => {
    const scheme = { type: 'CATEGORY', criteriaJson: '{"category":"OBC"}' };
    assert.deepEqual(evaluateEligibility({ category: 'SC' }, scheme), {
        eligible: false,
        reason: 'Category must be OBC',
    });
});

test('evaluateEligibility: SPORTS requires sports flag', () => {
    const scheme = { type: 'SPORTS' };
    assert.deepEqual(evaluateEligibility({ sports: true }, scheme), { eligible: true });
    assert.deepEqual(evaluateEligibility({ sports: false }, scheme), {
        eligible: false,
        reason: 'Sports participation required',
    });
});

test('evaluateEligibility: NEED_BASED eligible by default', () => {
    assert.deepEqual(evaluateEligibility({}, { type: 'NEED_BASED' }), { eligible: true });
});

// ---- computeAward (spec §6.3) --------------------------------------------
test('computeAward: AMOUNT returns flat value', () => {
    assert.strictEqual(computeAward({ value: 5000, valueKind: 'AMOUNT' }, 70000), 5000);
});

test('computeAward: PERCENT computes percent of tuition, rounded', () => {
    assert.strictEqual(computeAward({ value: 50, valueKind: 'PERCENT' }, 70000), 35000);
    assert.strictEqual(computeAward({ value: 33.33, valueKind: 'PERCENT' }, 70000), 23331);
});

test('computeAward: missing valueKind defaults to AMOUNT', () => {
    assert.strictEqual(computeAward({ value: 2500 }, 70000), 2500);
});

test('computeAward: zero/safe handling', () => {
    assert.strictEqual(computeAward({ value: 0, valueKind: 'AMOUNT' }, 70000), 0);
    assert.strictEqual(computeAward({ value: 10, valueKind: 'PERCENT' }, 0), 0);
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
test('requireScholarshipsManage: 403 FORBIDDEN', () => {
    const err = requireScholarshipsManage();
    assert.ok(err instanceof ApiError);
    assert.strictEqual(err.statusCode, 403);
    assert.strictEqual(err.code, 'FORBIDDEN');
});

test('requireScholarshipsView: 403 FORBIDDEN', () => {
    const err = requireScholarshipsView();
    assert.ok(err instanceof ApiError);
    assert.strictEqual(err.statusCode, 403);
    assert.strictEqual(err.code, 'FORBIDDEN');
});

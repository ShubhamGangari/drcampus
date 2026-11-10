import test from 'node:test';
import assert from 'node:assert/strict';
import {
    QUESTION_STATUS,
    QUESTION_TYPES,
    QUESTION_DIFFICULTIES,
    DUTY_DEFAULT_ROLE,
    canTransitionQuestionStatus,
    tenantFilter,
    requireQuestionbankManage,
    requireQuestionbankView,
} from '../questionbank-core';
import { ApiError } from '../errors';

// ---- canTransitionQuestionStatus (spec §6: DRAFT→SUBMITTED→APPROVED|REJECTED) ---
test('canTransitionQuestionStatus: DRAFT → SUBMITTED', () => {
    assert.strictEqual(canTransitionQuestionStatus('DRAFT', 'SUBMITTED'), true);
});

test('canTransitionQuestionStatus: SUBMITTED → APPROVED', () => {
    assert.strictEqual(canTransitionQuestionStatus('SUBMITTED', 'APPROVED'), true);
});

test('canTransitionQuestionStatus: SUBMITTED → REJECTED', () => {
    assert.strictEqual(canTransitionQuestionStatus('SUBMITTED', 'REJECTED'), true);
});

test('canTransitionQuestionStatus: illegal transitions', () => {
    assert.strictEqual(canTransitionQuestionStatus('DRAFT', 'APPROVED'), false);
    assert.strictEqual(canTransitionQuestionStatus('DRAFT', 'REJECTED'), false);
    assert.strictEqual(canTransitionQuestionStatus('APPROVED', 'SUBMITTED'), false);
    assert.strictEqual(canTransitionQuestionStatus('REJECTED', 'APPROVED'), false);
    assert.strictEqual(canTransitionQuestionStatus('UNKNOWN', 'SUBMITTED'), false);
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
test('requireQuestionbankManage: 403 FORBIDDEN', () => {
    const err = requireQuestionbankManage();
    assert.ok(err instanceof ApiError);
    assert.strictEqual(err.statusCode, 403);
    assert.strictEqual(err.code, 'FORBIDDEN');
});

test('requireQuestionbankView: 403 FORBIDDEN', () => {
    const err = requireQuestionbankView();
    assert.ok(err instanceof ApiError);
    assert.strictEqual(err.statusCode, 403);
    assert.strictEqual(err.code, 'FORBIDDEN');
});

// ---- Constants -----------------------------------------------------------
test('question-status constants', () => {
    assert.strictEqual(QUESTION_STATUS.DRAFT, 'DRAFT');
    assert.strictEqual(QUESTION_STATUS.SUBMITTED, 'SUBMITTED');
    assert.strictEqual(QUESTION_STATUS.APPROVED, 'APPROVED');
    assert.strictEqual(QUESTION_STATUS.REJECTED, 'REJECTED');
});

test('question type / difficulty constants', () => {
    assert.deepEqual(QUESTION_TYPES, ['MCQ', 'SHORT', 'LONG', 'VIVA']);
    assert.deepEqual(QUESTION_DIFFICULTIES, ['EASY', 'MEDIUM', 'HARD']);
});

test('duty default role', () => {
    assert.strictEqual(DUTY_DEFAULT_ROLE, 'INVIGILATOR');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {
    BACKLOG_STATUS,
    REVALUATION_STATUS,
    deriveBacklogFromF,
    canTransitionRevaluation,
    tenantFilter,
    requireBacklogManage,
    requireBacklogView,
} from '../backlog-core';
import { ApiError } from '../errors';

// ---- deriveBacklogFromF (spec §6: F yields backlog) -----------------------
test('deriveBacklogFromF: F -> true', () => {
    assert.strictEqual(deriveBacklogFromF('F'), true);
});

test('deriveBacklogFromF: lowercase/whitespace F -> true', () => {
    assert.strictEqual(deriveBacklogFromF('f'), true);
    assert.strictEqual(deriveBacklogFromF(' F '), true);
});

test('deriveBacklogFromF: non-F grades -> false', () => {
    assert.strictEqual(deriveBacklogFromF('A+'), false);
    assert.strictEqual(deriveBacklogFromF('D'), false);
});

test('deriveBacklogFromF: missing grade -> false', () => {
    assert.strictEqual(deriveBacklogFromF(''), false);
    assert.strictEqual(deriveBacklogFromF(undefined as never), false);
});

// ---- canTransitionRevaluation (spec §6: REQUESTED→APPROVED|REJECTED; APPROVED→COMPLETED) ---
test('canTransitionRevaluation: REQUESTED → APPROVED', () => {
    assert.strictEqual(canTransitionRevaluation('REQUESTED', 'APPROVED'), true);
});

test('canTransitionRevaluation: REQUESTED → REJECTED', () => {
    assert.strictEqual(canTransitionRevaluation('REQUESTED', 'REJECTED'), true);
});

test('canTransitionRevaluation: APPROVED → COMPLETED', () => {
    assert.strictEqual(canTransitionRevaluation('APPROVED', 'COMPLETED'), true);
});

test('canTransitionRevaluation: illegal transitions', () => {
    assert.strictEqual(canTransitionRevaluation('REQUESTED', 'COMPLETED'), false);
    assert.strictEqual(canTransitionRevaluation('APPROVED', 'APPROVED'), false);
    assert.strictEqual(canTransitionRevaluation('COMPLETED', 'REQUESTED'), false);
    assert.strictEqual(canTransitionRevaluation('REJECTED', 'COMPLETED'), false);
    assert.strictEqual(canTransitionRevaluation('UNKNOWN', 'APPROVED'), false);
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
test('requireBacklogManage: 403 FORBIDDEN', () => {
    const err = requireBacklogManage();
    assert.ok(err instanceof ApiError);
    assert.strictEqual(err.statusCode, 403);
    assert.strictEqual(err.code, 'FORBIDDEN');
});

test('requireBacklogView: 403 FORBIDDEN', () => {
    const err = requireBacklogView();
    assert.ok(err instanceof ApiError);
    assert.strictEqual(err.statusCode, 403);
    assert.strictEqual(err.code, 'FORBIDDEN');
});

// ---- Constants -----------------------------------------------------------
test('backlog-status constants', () => {
    assert.strictEqual(BACKLOG_STATUS.BACKLOG, 'BACKLOG');
    assert.strictEqual(BACKLOG_STATUS.CLEARED, 'CLEARED');
});

test('revaluation-status constants', () => {
    assert.strictEqual(REVALUATION_STATUS.REQUESTED, 'REQUESTED');
    assert.strictEqual(REVALUATION_STATUS.APPROVED, 'APPROVED');
    assert.strictEqual(REVALUATION_STATUS.COMPLETED, 'COMPLETED');
    assert.strictEqual(REVALUATION_STATUS.REJECTED, 'REJECTED');
});

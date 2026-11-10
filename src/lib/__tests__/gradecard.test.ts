import test from 'node:test';
import assert from 'node:assert/strict';
import {
    GRADE_POINTS,
    gradeToPoints,
    computeSGPA,
    computeCGPA,
    tenantFilter,
    requireGradecardManage,
    requireGradecardView,
} from '../gradecard-core';
import { ApiError } from '../errors';

// ---- gradeToPoints (spec §6: A+=10 … F=0) --------------------------------
test('gradeToPoints: known grades map to grade points', () => {
    assert.strictEqual(gradeToPoints('A+'), 10);
    assert.strictEqual(gradeToPoints('A'), 9);
    assert.strictEqual(gradeToPoints('B+'), 8);
    assert.strictEqual(gradeToPoints('B'), 7);
    assert.strictEqual(gradeToPoints('C+'), 6);
    assert.strictEqual(gradeToPoints('C'), 5);
    assert.strictEqual(gradeToPoints('D'), 4);
    assert.strictEqual(gradeToPoints('F'), 0);
});

test('gradeToPoints: case/whitespace insensitive', () => {
    assert.strictEqual(gradeToPoints('a+'), 10);
    assert.strictEqual(gradeToPoints(' b '), 7);
    assert.strictEqual(gradeToPoints('f'), 0);
});

test('gradeToPoints: unknown grade -> 0', () => {
    assert.strictEqual(gradeToPoints('X'), 0);
    assert.strictEqual(gradeToPoints(''), 0);
    assert.strictEqual(gradeToPoints(undefined as never), 0);
});

test('GRADE_POINTS table is frozen per spec', () => {
    assert.strictEqual(GRADE_POINTS['A+'], 10);
    assert.strictEqual(GRADE_POINTS.F, 0);
});

// ---- computeSGPA (spec §6: credit-weighted mean) --------------------------
test('computeSGPA: single course equals its grade point', () => {
    const sgpa = computeSGPA([{ credits: 4, grade: 'A' }]);
    assert.strictEqual(sgpa, 9);
});

test('computeSGPA: credit-weighted mean', () => {
    // 4×A(9) + 2×B+(8) = 36 + 16 = 52 over 6 credits -> 8.6667 -> 8.67
    const sgpa = computeSGPA([
        { credits: 4, grade: 'A' },
        { credits: 2, grade: 'B+' },
    ]);
    assert.strictEqual(sgpa, 8.67);
});

test('computeSGPA: zero credits -> 0', () => {
    assert.strictEqual(computeSGPA([]), 0);
    assert.strictEqual(computeSGPA([{ credits: 0, grade: 'A' }]), 0);
});

test('computeSGPA: F contributes zero points but still weight', () => {
    const sgpa = computeSGPA([
        { credits: 4, grade: 'A' },
        { credits: 2, grade: 'F' },
    ]);
    assert.strictEqual(sgpa, 6);
});

test('computeSGPA: unknown grade contributes 0 points', () => {
    const sgpa = computeSGPA([{ credits: 3, grade: 'X' }]);
    assert.strictEqual(sgpa, 0);
});

// ---- computeCGPA (spec §6: unweighted mean of SGPAs) ----------------------
test('computeCGPA: mean of semester SGPAs', () => {
    const cgpa = computeCGPA([{ sgpa: 8.5 }, { sgpa: 9.25 }]);
    assert.strictEqual(cgpa, 8.88);
});

test('computeCGPA: non-finite SGPAs skipped', () => {
    const cgpa = computeCGPA([{ sgpa: 8.5 }, { sgpa: NaN }]);
    assert.strictEqual(cgpa, 8.5);
});

test('computeCGPA: empty -> 0', () => {
    assert.strictEqual(computeCGPA([]), 0);
    assert.strictEqual(computeCGPA(undefined as never), 0);
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
test('requireGradecardManage: 403 FORBIDDEN', () => {
    const err = requireGradecardManage();
    assert.ok(err instanceof ApiError);
    assert.strictEqual(err.statusCode, 403);
    assert.strictEqual(err.code, 'FORBIDDEN');
});

test('requireGradecardView: 403 FORBIDDEN', () => {
    const err = requireGradecardView();
    assert.ok(err instanceof ApiError);
    assert.strictEqual(err.statusCode, 403);
    assert.strictEqual(err.code, 'FORBIDDEN');
});

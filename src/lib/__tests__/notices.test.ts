import test from 'node:test';
import assert from 'node:assert/strict';
import {
    NOTICE_CATEGORIES,
    parseAudience,
    isNoticeVisible,
    matchesAudience,
    tenantFilter,
    requireNoticesManage,
    requireNoticesView,
} from '../notices-core';
import { ApiError } from '../errors';

// ---- Fixed reference dates ------------------------------------------------
const BASE = new Date('2026-01-10T00:00:00.000Z');
const BEFORE = new Date('2026-01-09T00:00:00.000Z');
const AFTER = new Date('2026-01-11T00:00:00.000Z');

// ---- parseAudience (spec §6.2) --------------------------------------------
test('parseAudience: null/empty/undefined -> {}', () => {
    assert.deepEqual(parseAudience(null), {});
    assert.deepEqual(parseAudience(''), {});
    assert.deepEqual(parseAudience(undefined), {});
});

test('parseAudience: roles and schoolIds array kept', () => {
    const raw = JSON.stringify({
        roles: ['STUDENT', 'FACULTY'],
        schoolIds: ['school-1'],
    });
    assert.deepEqual(parseAudience(raw), {
        roles: ['STUDENT', 'FACULTY'],
        schoolIds: ['school-1'],
    });
});

test('parseAudience: roles only, no schoolIds', () => {
    const raw = JSON.stringify({ roles: ['STUDENT'] });
    assert.deepEqual(parseAudience(raw), { roles: ['STUDENT'], schoolIds: undefined });
});

test('parseAudience: non-array values dropped', () => {
    const raw = JSON.stringify({ roles: 'STUDENT', schoolIds: 'school-1' });
    assert.deepEqual(parseAudience(raw), { roles: undefined, schoolIds: undefined });
});

test('parseAudience: invalid JSON -> {}', () => {
    assert.deepEqual(parseAudience('{not json'), {});
});

// ---- isNoticeVisible (spec §6.1) ------------------------------------------
test('isNoticeVisible: before publishedAt -> false', () => {
    assert.strictEqual(isNoticeVisible(AFTER, null, BASE), false);
});

test('isNoticeVisible: at publishedAt -> true', () => {
    assert.strictEqual(isNoticeVisible(BASE, null, BASE), true);
});

test('isNoticeVisible: within window and no expiry -> true', () => {
    assert.strictEqual(isNoticeVisible(BASE, null, AFTER), true);
});

test('isNoticeVisible: after expiresAt -> false', () => {
    assert.strictEqual(isNoticeVisible(BASE, BASE, AFTER), false);
});

test('isNoticeVisible: at expiresAt (inclusive) -> true', () => {
    assert.strictEqual(isNoticeVisible(BEFORE, BASE, BASE), true);
});

// ---- matchesAudience ------------------------------------------------------
test('matchesAudience: empty audience matches everyone', () => {
    assert.strictEqual(matchesAudience(null, { schoolId: 'school-1', role: 'STUDENT' }), true);
    assert.strictEqual(matchesAudience('{}', { schoolId: 'school-1', role: 'STUDENT' }), true);
});

test('matchesAudience: schoolIds filter matches', () => {
    const raw = JSON.stringify({ schoolIds: ['school-1', 'school-2'] });
    assert.strictEqual(matchesAudience(raw, { schoolId: 'school-2', role: 'STUDENT' }), true);
});

test('matchesAudience: schoolIds filter excludes', () => {
    const raw = JSON.stringify({ schoolIds: ['school-1'] });
    assert.strictEqual(matchesAudience(raw, { schoolId: 'school-3', role: 'STUDENT' }), false);
});

test('matchesAudience: roles filter matches', () => {
    const raw = JSON.stringify({ roles: ['STUDENT', 'FACULTY'] });
    assert.strictEqual(matchesAudience(raw, { schoolId: 'school-1', role: 'FACULTY' }), true);
});

test('matchesAudience: roles filter excludes', () => {
    const raw = JSON.stringify({ roles: ['FACULTY'] });
    assert.strictEqual(matchesAudience(raw, { schoolId: 'school-1', role: 'STUDENT' }), false);
});

test('matchesAudience: both filters must pass', () => {
    const raw = JSON.stringify({ roles: ['STUDENT'], schoolIds: ['school-1'] });
    assert.strictEqual(matchesAudience(raw, { schoolId: 'school-1', role: 'STUDENT' }), true);
    assert.strictEqual(matchesAudience(raw, { schoolId: 'school-2', role: 'STUDENT' }), false);
    assert.strictEqual(matchesAudience(raw, { schoolId: 'school-1', role: 'FACULTY' }), false);
});

// ---- tenantFilter ----------------------------------------------------------
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
test('requireNoticesManage: 403 FORBIDDEN', () => {
    const err = requireNoticesManage();
    assert.ok(err instanceof ApiError);
    assert.strictEqual(err.statusCode, 403);
    assert.strictEqual(err.code, 'FORBIDDEN');
});

test('requireNoticesView: 403 FORBIDDEN', () => {
    const err = requireNoticesView();
    assert.ok(err instanceof ApiError);
    assert.strictEqual(err.statusCode, 403);
    assert.strictEqual(err.code, 'FORBIDDEN');
});

test('NOTICE_CATEGORIES: frozen categories present', () => {
    assert.strictEqual(NOTICE_CATEGORIES.EXAM, 'EXAM');
    assert.strictEqual(NOTICE_CATEGORIES.FEE, 'FEE');
    assert.strictEqual(NOTICE_CATEGORIES.HOLIDAY, 'HOLIDAY');
    assert.strictEqual(NOTICE_CATEGORIES.EVENT, 'EVENT');
    assert.strictEqual(NOTICE_CATEGORIES.GENERAL, 'GENERAL');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {
    buildTicketNo,
    canTransitionStatus,
    tenantFilter,
    requireGrievanceManage,
    requireGrievanceView,
} from '../grievance-core';
import { ApiError } from '../errors';

// ---- buildTicketNo (spec §6.1) -------------------------------------------
test('buildTicketNo: zero-pads seq to 4 digits and prefixes GRV-year', () => {
    assert.strictEqual(buildTicketNo('SST', 1, 2026), 'GRV-2026-0001');
    assert.strictEqual(buildTicketNo('SST', 42, 2026), 'GRV-2026-0042');
    assert.strictEqual(buildTicketNo('SST', 1234, 2026), 'GRV-2026-1234');
});

test('buildTicketNo: caps seq at 1 when 0/negative/NaN', () => {
    assert.strictEqual(buildTicketNo('SST', 0, 2026), 'GRV-2026-0001');
    assert.strictEqual(buildTicketNo('SST', -5, 2026), 'GRV-2026-0001');
    assert.strictEqual(buildTicketNo('SST', Number.NaN, 2026), 'GRV-2026-0001');
});

test('buildTicketNo: default year is current calendar year', () => {
    const y = new Date().getFullYear();
    assert.ok(buildTicketNo('SST', 7).startsWith(`GRV-${y}-0007`));
});

// ---- canTransitionStatus (spec §6.2) --------------------------------------
test('canTransitionStatus: allowed transitions -> true', () => {
    assert.strictEqual(canTransitionStatus('OPEN', 'IN_PROGRESS'), true);
    assert.strictEqual(canTransitionStatus('IN_PROGRESS', 'RESOLVED'), true);
    assert.strictEqual(canTransitionStatus('RESOLVED', 'CLOSED'), true);
    // admin-only closes (route gates on grievance.manage)
    assert.strictEqual(canTransitionStatus('OPEN', 'CLOSED'), true);
    assert.strictEqual(canTransitionStatus('IN_PROGRESS', 'CLOSED'), true);
});

test('canTransitionStatus: invalid/backwards transitions -> false', () => {
    assert.strictEqual(canTransitionStatus('OPEN', 'RESOLVED'), false);
    assert.strictEqual(canTransitionStatus('CLOSED', 'OPEN'), false);
    assert.strictEqual(canTransitionStatus('RESOLVED', 'IN_PROGRESS'), false);
    assert.strictEqual(canTransitionStatus('OPEN', 'OPEN'), false);
    assert.strictEqual(canTransitionStatus('IN_PROGRESS', 'IN_PROGRESS'), false);
});

// ---- tenantFilter ---------------------------------------------------------
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
test('requireGrievanceManage: 403 FORBIDDEN', () => {
    const err = requireGrievanceManage();
    assert.ok(err instanceof ApiError);
    assert.strictEqual(err.statusCode, 403);
    assert.strictEqual(err.code, 'FORBIDDEN');
});

test('requireGrievanceView: 403 FORBIDDEN', () => {
    const err = requireGrievanceView();
    assert.ok(err instanceof ApiError);
    assert.strictEqual(err.statusCode, 403);
    assert.strictEqual(err.code, 'FORBIDDEN');
});

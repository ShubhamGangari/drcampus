import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeNet,
  deductionsFor,
  designationGross,
  VALID_LEAVE_TYPES,
  isValidLeaveType,
} from '../hr-core';

// ---- computeNet ---------------------------------------------------------------

test('computeNet: gross 50000 minus deductions 5000 -> 45000', () => {
  assert.equal(computeNet(50000, 5000), 45000);
});

test('computeNet: exact to cent (no float drift)', () => {
  assert.equal(computeNet(120000, 12000), 108000);
  assert.equal(computeNet(123456.78, 12345.68), 111111.1);
});

test('computeNet: zero deductions -> gross', () => {
  assert.equal(computeNet(80000, 0), 80000);
});

test('computeNet: throws when net would be negative', () => {
  assert.throws(() => computeNet(10000, 15000), /negative/);
});

test('computeNet: throws on non-numeric input', () => {
  assert.throws(() => computeNet('abc' as unknown as number, 5));
  assert.throws(() => computeNet(5000, NaN));
});

// ---- deductionsFor ------------------------------------------------------------

test('deductionsFor: 10% of gross', () => {
  assert.equal(deductionsFor(50000), 5000);
  assert.equal(deductionsFor(120000), 12000);
  assert.equal(deductionsFor(80000), 8000);
});

test('deductionsFor: rounds to cent', () => {
  assert.equal(deductionsFor(123456.78), 12345.68);
  assert.equal(deductionsFor(1), 0.1);
});

test('deductionsFor: throws on negative gross', () => {
  assert.throws(() => deductionsFor(-1));
});

// ---- designationGross ---------------------------------------------------------

test('designationGross: known designations map to table', () => {
  assert.equal(designationGross('Professor'), 120000);
  assert.equal(designationGross('AssocProf'), 100000);
  assert.equal(designationGross('AsstProf'), 80000);
});

test('designationGross: unknown designation falls back to default 60000', () => {
  assert.equal(designationGross('Lecturer'), 60000);
  assert.equal(designationGross(''), 60000);
});

// ---- leave type validation ----------------------------------------------------

test('isValidLeaveType: accepts known types, rejects others', () => {
  assert.equal(VALID_LEAVE_TYPES.length, 3);
  assert.ok(isValidLeaveType('SICK'));
  assert.ok(isValidLeaveType('CASUAL'));
  assert.ok(isValidLeaveType('EARNED'));
  assert.equal(isValidLeaveType('HOLIDAY'), false);
  assert.equal(isValidLeaveType(''), false);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeMeritRanks } from '../merit';

const C = (id: string, marksPercentage: number, dob: string) => ({ id, marksPercentage, dob });

test('C1: distinct marks -> descending marks order with sequential ranks 1..n', () => {
  const apps = [
    C('a', 88, '2005-01-01'),
    C('b', 95, '2004-05-01'),
    C('c', 70, '2006-03-01'),
    C('d', 81, '2003-07-01'),
  ];
  const result = computeMeritRanks(apps);

  // Order by marks desc: b(95), a(88), d(81), c(70)
  assert.deepEqual(
    result.map((r) => r.id),
    ['b', 'a', 'd', 'c']
  );
  // Sequential ranks 1..n
  assert.deepEqual(
    result.map((r) => r.meritRank),
    [1, 2, 3, 4]
  );
});

test('C2: tie on marks -> older dob (earlier) ranked higher', () => {
  // Same marks: 90. Older dob = earlier date.
  const older = C('older', 90, '2000-02-01');
  const younger = C('younger', 90, '2002-11-01');
  const result = computeMeritRanks([younger, older]);
  assert.equal(result[0].id, 'older');
  assert.equal(result[1].id, 'younger');
  assert.deepEqual(result.map((r) => r.meritRank), [1, 2]);
});

test('C3: empty array -> empty result', () => {
  const result = computeMeritRanks([]);
  assert.deepEqual(result, []);
});

test('C4: full 3-way tie broken by dob; output shape is {id, meritRank} with sequential ranks', () => {
  const apps = [
    C('x', 80, '2001-06-15'),
    C('y', 80, '2001-06-15'),
    C('z', 80, '1999-12-01'),
  ];
  const result = computeMeritRanks(apps);
  // z is oldest -> rank 1; x/y tie on both keys -> stable input order x then y.
  assert.equal(result[0].id, 'z');
  assert.equal(result[0].meritRank, 1);
  assert.equal(result[1].id, 'x');
  assert.equal(result[2].id, 'y');
  assert.deepEqual(result.map((r) => r.meritRank), [1, 2, 3]);
  // Every element has exactly the {id, meritRank} keys, meritRank as number.
  for (const r of result) {
    assert.equal(typeof r.id, 'string');
    assert.equal(typeof r.meritRank, 'number');
  }
});

test('C5: input array is not mutated (pure function)', () => {
  const apps = [C('b', 95, '2004-01-01'), C('a', 70, '2006-01-01')];
  const copy = JSON.parse(JSON.stringify(apps));
  computeMeritRanks(apps);
  assert.deepEqual(apps, copy);
});

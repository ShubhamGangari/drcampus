import { test } from 'node:test';
import assert from 'node:assert/strict';

const BASE = 'http://localhost:3000';

// ---- shared state --------------------------------------------------------
let deanCookie = null;
let registrarCookie = null;
let himsDeanCookie = null;
let studentCookie = null;
let deanUser = null;
let cycleEng = null; // sch_eng cycle
let cycleHims = null; // sch_med cycle
const apps = {}; // apps.a, apps.b, apps.c, apps.d, apps.e, apps.f

// ---- helpers --------------------------------------------------------------
async function login(email, password) {
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const j = await r.json().catch(() => null);
  const setCookie = r.headers.get('set-cookie');
  const token = setCookie ? setCookie.split(';')[0] : null;
  return { status: r.status, json: j, token };
}

async function api(path, { method = 'GET', body, cookie } = {}) {
  const headers = { accept: 'application/json' };
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (cookie) headers.cookie = cookie;
  const r = await fetch(BASE + path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => null);
  return { status: r.status, json: j };
}

const publicApplication = (cycleId, programId, over = {}) => ({
  schoolId: 'sch_eng',
  cycleId,
  programId,
  applicantName: 'QA Applicant',
  email: 'qa+test@sst.srhu.edu.in',
  phone: '9876543210',
  gender: 'MALE',
  dob: '2005-05-10',
  category: 'GENERAL',
  marksPercentage: 85,
  ...over,
});

// ---- 1. login correct ----------------------------------------------------
test('B1: POST /api/auth/login correct creds -> 200 + user shape', async () => {
  const { status, json, token } = await login('director.sst@srhu.edu.in', 'Password@2026');
  assert.equal(status, 200);
  assert.ok(json.user, 'expected .user in body');
  const u = json.user;
  assert.equal(typeof u.id, 'string');
  assert.equal(typeof u.name, 'string');
  assert.equal(typeof u.email, 'string');
  assert.equal(typeof u.role, 'string');
  assert.equal(typeof u.schoolId, 'string');
  assert.equal(u.role, 'DEAN');
  assert.equal(u.schoolId, 'sch_eng');
  assert.ok(token, 'expected auth cookie');
  deanCookie = token;
  deanUser = u;

  const reg = await login('registrar@srhu.edu.in', 'Password@2026');
  assert.equal(reg.status, 200);
  registrarCookie = reg.token;

  const hims = await login('dean.hims@srhu.edu.in', 'Password@2026');
  assert.equal(hims.status, 200);
  himsDeanCookie = hims.token;

  const stu = await login('aarav.sharma@sst.srhu.edu.in', 'Password@2026');
  assert.equal(stu.status, 200);
  studentCookie = stu.token;
});

// ---- 2. wrong password ---------------------------------------------------
test('B2: POST /api/auth/login wrong password -> 401 INVALID_CREDENTIALS', async () => {
  const { status, json } = await login('director.sst@srhu.edu.in', 'WrongPass123');
  assert.equal(status, 401);
  assert.equal(json.error.code, 'INVALID_CREDENTIALS');
});

// ---- 3. /me ---------------------------------------------------------------
test('B3: GET /api/auth/me with cookie -> 200 same shape', async () => {
  const { status, json } = await api('/api/auth/me', { cookie: deanCookie });
  assert.equal(status, 200);
  assert.deepEqual(json.user, {
    id: deanUser.id,
    name: deanUser.name,
    email: deanUser.email,
    role: deanUser.role,
    schoolId: deanUser.schoolId,
  });
});

// ---- 4. create cycle authz ------------------------------------------------
test('B4a: POST /api/admissions/cycles without auth -> 401', async () => {
  const { status, json } = await api('/api/admissions/cycles', {
    method: 'POST',
    body: { title: 'NoAuth Cycle', academicYear: '2026-2027', startDate: '2026-01-01', endDate: '2026-12-31' },
  });
  assert.equal(status, 401);
  assert.equal(json.error.code, 'UNAUTHORIZED');
});

test('B4b: POST /api/admissions/cycles as STUDENT -> 403', async () => {
  const { status, json } = await api('/api/admissions/cycles', {
    method: 'POST',
    cookie: studentCookie,
    body: { title: 'Student Cycle', academicYear: '2026-2027', startDate: '2026-01-01', endDate: '2026-12-31' },
  });
  assert.equal(status, 403);
  assert.equal(json.error.code, 'FORBIDDEN');
});

// ---- 5. create cycle as DEAN ----------------------------------------------
test('B5: POST /api/admissions/cycles as DEAN -> 201 scoped to their school', async () => {
  const { status, json } = await api('/api/admissions/cycles', {
    method: 'POST',
    cookie: deanCookie,
    body: { title: 'SST Test Cycle 2026', academicYear: '2026-2027', startDate: '2026-01-01', endDate: '2026-12-31', active: true },
  });
  assert.equal(status, 201);
  assert.ok(json.cycle.id);
  assert.equal(json.cycle.schoolId, 'sch_eng');
  assert.equal(json.cycle.academicYear, '2026-2027');
  assert.equal(json.cycle.active, true);
  cycleEng = json.cycle;

  // Also create a HIMS cycle (for cross-tenant scoping test).
  const h = await api('/api/admissions/cycles', {
    method: 'POST',
    cookie: himsDeanCookie,
    body: { title: 'HIMS Test Cycle 2026', academicYear: '2026-2027', startDate: '2026-01-01', endDate: '2026-12-31', active: true },
  });
  assert.equal(h.status, 201);
  assert.equal(h.json.cycle.schoolId, 'sch_med');
  cycleHims = h.json.cycle;
});

// ---- 6. tenant scoping on GET cycles ---------------------------------------
test('B6: GET /api/admissions/cycles returns only that school\'s cycles', async () => {
  const eng = await api('/api/admissions/cycles', { cookie: deanCookie });
  assert.equal(eng.status, 200);
  assert.ok(Array.isArray(eng.json.cycles));
  const engIds = eng.json.cycles.map((c) => c.id);
  assert.ok(engIds.includes(cycleEng.id), 'eng dean should see their own cycle');
  assert.ok(!engIds.includes(cycleHims.id), 'eng dean must NOT see HIMS cycle');

  const hims = await api('/api/admissions/cycles', { cookie: himsDeanCookie });
  const himsIds = hims.json.cycles.map((c) => c.id);
  assert.ok(himsIds.includes(cycleHims.id));
  assert.ok(!himsIds.includes(cycleEng.id), 'HIMS dean must NOT see SST cycle');

  // Central registrar sees both (multi-school).
  const reg = await api('/api/admissions/cycles', { cookie: registrarCookie });
  const regIds = reg.json.cycles.map((c) => c.id);
  assert.ok(regIds.includes(cycleEng.id));
  assert.ok(regIds.includes(cycleHims.id));
});

// ---- 7. public application submission --------------------------------------
test('B7: POST /api/admissions/applications (public, no auth) -> 201 SUBMITTED, unique applicationNo', async () => {
  const a = await api('/api/admissions/applications', {
    method: 'POST',
    body: publicApplication(cycleEng.id, 'prog_btech_cse', { applicantName: 'QA A', marksPercentage: 92, email: 'qa.a@sst.srhu.edu.in' }),
  });
  assert.equal(a.status, 201, JSON.stringify(a.json));
  assert.ok(a.json.application.applicationNo, 'expected applicationNo');
  assert.equal(a.json.application.status, 'SUBMITTED');
  apps.a = a.json.application;

  const b = await api('/api/admissions/applications', {
    method: 'POST',
    body: publicApplication(cycleEng.id, 'prog_btech_cse', { applicantName: 'QA B', marksPercentage: 88, email: 'qa.b@sst.srhu.edu.in' }),
  });
  assert.equal(b.status, 201);
  apps.b = b.json.application;

  const c = await api('/api/admissions/applications', {
    method: 'POST',
    body: publicApplication(cycleEng.id, 'prog_btech_cse', { applicantName: 'QA C', marksPercentage: 85, email: 'qa.c@sst.srhu.edu.in' }),
  });
  assert.equal(c.status, 201);
  apps.c = c.json.application;

  const d = await api('/api/admissions/applications', {
    method: 'POST',
    body: publicApplication(cycleEng.id, 'prog_btech_cse', { applicantName: 'QA D', marksPercentage: 90, email: 'qa.d@sst.srhu.edu.in' }),
  });
  assert.equal(d.status, 201);
  apps.d = d.json.application;

  const nos = new Set([apps.a.applicationNo, apps.b.applicationNo, apps.c.applicationNo, apps.d.applicationNo]);
  assert.equal(nos.size, 4, 'applicationNos must be unique');
});

// ---- 8. GET applications requires auth --------------------------------------
test('B8: GET /api/admissions/applications without auth -> 401', async () => {
  const { status, json } = await api('/api/admissions/applications');
  assert.equal(status, 401);
  assert.equal(json.error.code, 'UNAUTHORIZED');
});

// ---- 9. status transitions --------------------------------------------------
test('B9a: PATCH status as STUDENT -> 403', async () => {
  const { status, json } = await api(`/api/admissions/applications/${apps.a.id}/status`, {
    method: 'PATCH',
    cookie: studentCookie,
    body: { status: 'VERIFIED' },
  });
  assert.equal(status, 403);
  assert.equal(json.error.code, 'FORBIDDEN');
});

test('B9b: PATCH as DEAN SUBMITTED->VERIFIED -> 200', async () => {
  const r = await api(`/api/admissions/applications/${apps.a.id}/status`, {
    method: 'PATCH',
    cookie: deanCookie,
    body: { status: 'VERIFIED' },
  });
  assert.equal(r.status, 200);
  assert.equal(r.json.status, 'VERIFIED');

  const rb = await api(`/api/admissions/applications/${apps.b.id}/status`, {
    method: 'PATCH',
    cookie: deanCookie,
    body: { status: 'VERIFIED' },
  });
  assert.equal(rb.status, 200);
  assert.equal(rb.json.status, 'VERIFIED');

  // D: SUBMITTED->REJECTED (also valid).
  const rd = await api(`/api/admissions/applications/${apps.d.id}/status`, {
    method: 'PATCH',
    cookie: deanCookie,
    body: { status: 'REJECTED' },
  });
  assert.equal(rd.status, 200);
  assert.equal(rd.json.status, 'REJECTED');
});

test('B9c: invalid transition REJECTED->ADMITTED -> 409 INVALID_TRANSITION', async () => {
  const { status, json } = await api(`/api/admissions/applications/${apps.d.id}/status`, {
    method: 'PATCH',
    cookie: deanCookie,
    body: { status: 'ADMITTED' },
  });
  assert.equal(status, 409);
  assert.equal(json.error.code, 'INVALID_TRANSITION');
});

// ---- 10. merit list generate ------------------------------------------------
test('B10: POST merit-list/generate -> 200 ranks only eligible (excludes SUBMITTED/REJECTED)', async () => {
  const { status, json } = await api('/api/admissions/merit-list/generate', {
    method: 'POST',
    cookie: deanCookie,
    body: { cycleId: cycleEng.id, programId: 'prog_btech_cse', formula: 'MARKS_PERCENTAGE' },
  });
  assert.equal(status, 200, JSON.stringify(json));
  // Eligible: A (92, VERIFIED), B (88, VERIFIED). C is SUBMITTED, D REJECTED -> excluded.
  assert.equal(json.totalRanked, 2, `expected 2 ranked, got ${json.totalRanked}`);

  // Verify persisted ranks.
  const list = await api(`/api/admissions/applications?cycleId=${cycleEng.id}&programId=prog_btech_cse`, { cookie: deanCookie });
  const rows = list.json.applications;
  const byId = Object.fromEntries(rows.map((x) => [x.id, x]));
  assert.equal(byId[apps.a.id].meritRank, 1, 'A (92) should be rank 1');
  assert.equal(byId[apps.b.id].meritRank, 2, 'B (88) should be rank 2');
  assert.equal(byId[apps.c.id].meritRank, null, 'C (SUBMITTED) must not be ranked');
  assert.equal(byId[apps.d.id].meritRank, null, 'D (REJECTED) must not be ranked');
});

// ---- 11. merit list publish --------------------------------------------------
test('B11: POST merit-list/publish -> 200 {published:true, publishedAt}', async () => {
  const first = await api('/api/admissions/merit-list/publish', {
    method: 'POST',
    cookie: deanCookie,
    body: { cycleId: cycleEng.id, programId: 'prog_btech_cse' },
  });
  assert.equal(first.status, 200, JSON.stringify(first.json));
  assert.equal(first.json.published, true);
  assert.ok(first.json.publishedAt, 'expected publishedAt');

  // Idempotent republish.
  const second = await api('/api/admissions/merit-list/publish', {
    method: 'POST',
    cookie: deanCookie,
    body: { cycleId: cycleEng.id, programId: 'prog_btech_cse' },
  });
  assert.equal(second.status, 200);
  assert.equal(second.json.published, true);
});

// ---- 12. seat allocation ------------------------------------------------------
test('B12a: allocate seat -> 200 provisionalRollNo; second allocation -> 409', async () => {
  // Move A VERIFIED -> SHORTLISTED (eligible for allocation).
  const sl = await api(`/api/admissions/applications/${apps.a.id}/status`, {
    method: 'PATCH',
    cookie: deanCookie,
    body: { status: 'SHORTLISTED' },
  });
  assert.equal(sl.status, 200);

  const alloc = await api('/api/admissions/allocate-seat', {
    method: 'POST',
    cookie: deanCookie,
    body: { applicationId: apps.a.id, programId: 'prog_btech_cse', quotaCategory: 'GENERAL' },
  });
  assert.equal(alloc.status, 200, JSON.stringify(alloc.json));
  assert.equal(alloc.json.seatAllocated, true);
  assert.ok(alloc.json.provisionalRollNo, 'expected provisionalRollNo');
  assert.match(alloc.json.provisionalRollNo, /^PROV-\d{4}-\d{5}$/);

  // Second allocation of the same application -> 409 ALREADY_ALLOCATED.
  const again = await api('/api/admissions/allocate-seat', {
    method: 'POST',
    cookie: deanCookie,
    body: { applicationId: apps.a.id, programId: 'prog_btech_cse' },
  });
  assert.equal(again.status, 409);
  assert.equal(again.json.error.code, 'ALREADY_ALLOCATED');
});

test('B12b: allocation beyond program intake -> 409 QUOTA_FULL', async () => {
  // Use low-intake test program (intake 1). Submit+verify+shortlist two apps.
  const e = await api('/api/admissions/applications', {
    method: 'POST',
    body: publicApplication(cycleEng.id, 'prog_test_quota', { applicantName: 'QA E', marksPercentage: 95, email: 'qa.e@sst.srhu.edu.in' }),
  });
  assert.equal(e.status, 201);
  const eId = e.json.application.id;

  const f = await api('/api/admissions/applications', {
    method: 'POST',
    body: publicApplication(cycleEng.id, 'prog_test_quota', { applicantName: 'QA F', marksPercentage: 94, email: 'qa.f@sst.srhu.edu.in' }),
  });
  assert.equal(f.status, 201);
  const fId = f.json.application.id;

  for (const id of [eId, fId]) {
    const v = await api(`/api/admissions/applications/${id}/status`, { method: 'PATCH', cookie: deanCookie, body: { status: 'VERIFIED' } });
    assert.equal(v.status, 200);
    const s = await api(`/api/admissions/applications/${id}/status`, { method: 'PATCH', cookie: deanCookie, body: { status: 'SHORTLISTED' } });
    assert.equal(s.status, 200);
  }

  const first = await api('/api/admissions/allocate-seat', {
    method: 'POST',
    cookie: deanCookie,
    body: { applicationId: eId, programId: 'prog_test_quota', quotaCategory: 'GENERAL' },
  });
  assert.equal(first.status, 200, `first quota allocation should succeed: ${JSON.stringify(first.json)}`);

  // Intake is 1, so the second allocation must be blocked.
  const second = await api('/api/admissions/allocate-seat', {
    method: 'POST',
    cookie: deanCookie,
    body: { applicationId: fId, programId: 'prog_test_quota', quotaCategory: 'GENERAL' },
  });
  assert.equal(second.status, 409, `expected QUOTA_FULL, got ${second.status} ${JSON.stringify(second.json)}`);
  assert.equal(second.json.error.code, 'QUOTA_FULL');
});

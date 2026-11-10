// ============================================================================
// Smoke tests for the NAAC/NBA/NIRF reports API (Module 6).
// Requires a running server on $BASE (default http://localhost:3200) whose
// database is seeded with the standard seed users.
//
// Run: npx tsx tests/smoke-reports.ts
// ============================================================================

const BASE = process.env.BASE_URL ?? 'http://localhost:3200';
const ACADEMIC_YEAR = '2024-2025';
const PROGRAM_ID = 'prog_btech_cse';

let failures = 0;

function check(name: string, cond: boolean, detail?: unknown): void {
  if (cond) {
    console.log(`PASS  ${name}`);
  } else {
    failures++;
    console.error(`FAIL  ${name} ${detail !== undefined ? JSON.stringify(detail) : ''}`);
  }
}

/** Logs in and returns the raw `auth_token=...` cookie fragment. */
async function login(email: string, password: string): Promise<string> {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (res.status !== 200) {
    throw new Error(`login failed for ${email}: HTTP ${res.status}`);
  }
  let setCookie: string[] = [];
  try {
    setCookie = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
  } catch {
    setCookie = [];
  }
  if (setCookie.length === 0) {
    const raw = res.headers.get('set-cookie');
    if (raw) setCookie = [raw];
  }
  const cookie = setCookie.map((c) => c.split(';')[0]).join('; ');
  if (!cookie.includes('auth_token=')) {
    throw new Error(`no auth_token cookie returned for ${email}`);
  }
  return cookie;
}

async function get(
  path: string,
  cookie: string
): Promise<{ status: number; body: any }> {
  const res = await fetch(`${BASE}${path}`, { headers: { cookie } });
  let body: any = null;
  try {
    body = await res.json();
  } catch {
    /* non-JSON body */
  }
  return { status: res.status, body };
}

async function main(): Promise<void> {
  const dean = await login('director.sst@srhu.edu.in', 'Password@2026'); // DEAN sch_eng
  const student = await login('aarav.sharma@sst.srhu.edu.in', 'Password@2026'); // STUDENT sch_eng
  const registrar = await login('registrar@srhu.edu.in', 'Password@2026'); // REGISTRAR_ADMIN central

  // 1. DEAN -> naac 200
  let r = await get(`/api/reports/naac?academicYear=${ACADEMIC_YEAR}`, dean);
  check('DEAN naac returns 200', r.status === 200, r);
  check('DEAN naac body has academicYear + metrics array', Array.isArray(r.body?.metrics) && !!r.body?.academicYear, r);

  // 2. DEAN -> nba with a real programId 200
  r = await get(`/api/reports/nba?programId=${PROGRAM_ID}&academicYear=${ACADEMIC_YEAR}`, dean);
  check('DEAN nba (real programId) returns 200', r.status === 200, r);
  check('DEAN nba echoes programId', r.body?.programId === PROGRAM_ID, r);

  // 3. DEAN -> nirf 200
  r = await get(`/api/reports/nirf?academicYear=${ACADEMIC_YEAR}`, dean);
  check('DEAN nirf returns 200', r.status === 200, r);

  // 4. STUDENT -> naac 403
  r = await get(`/api/reports/naac?academicYear=${ACADEMIC_YEAR}`, student);
  check('STUDENT naac returns 403', r.status === 403, r);

  // 5. central registrar without schoolId -> 400 SCHOOL_ID_REQUIRED
  r = await get(`/api/reports/naac?academicYear=${ACADEMIC_YEAR}`, registrar);
  check('central registrar naac (no schoolId) returns 400', r.status === 400, r);
  check('central registrar 400 code is SCHOOL_ID_REQUIRED', r.body?.error?.code === 'SCHOOL_ID_REQUIRED', r.body);

  // 6. central registrar WITH schoolId -> 200 (scoped to that school)
  r = await get(`/api/reports/naac?academicYear=${ACADEMIC_YEAR}&schoolId=sch_eng`, registrar);
  check('central registrar naac (schoolId=sch_eng) returns 200', r.status === 200, r);

  console.log(failures === 0 ? '\nALL SMOKE TESTS PASSED' : `\n${failures} SMOKE TEST(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('SMOKE RUNNER ERROR', err);
  process.exit(1);
});

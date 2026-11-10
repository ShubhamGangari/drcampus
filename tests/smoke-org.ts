// Smoke test for Academic Governance & Organizational Structure module.
// Run: npx tsx tests/smoke-org.ts
// Requires: seeded DB + `npx next start -p 3200` (JWT_SECRET=dev-secret-for-testing).
import { PrismaClient } from '@prisma/client';

const BASE = process.env.BASE_URL ?? 'http://localhost:3200';
const prisma = new PrismaClient();
let failures = 0;
let cookie = '';

function check(name: string, cond: boolean, detail?: string) {
  console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${detail ? ` :: ${detail}` : ''}`);
  if (!cond) failures++;
}

async function req(method: string, path: string, body?: unknown, withAuth = true) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (withAuth && cookie) headers['Cookie'] = cookie;
  const res = await fetch(BASE + path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  let json: any = null;
  try { json = await res.json(); } catch { /* no body */ }
  return { status: res.status, json };
}

async function login(email: string) {
  const r = await fetch(BASE + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'Password@2026' }),
  });
  const setCookie = r.headers.get('set-cookie') || '';
  const m = setCookie.match(/auth_token=([^;]+)/);
  check(`login ${email}`, r.status === 200 && !!m, `status=${r.status}`);
  if (m) cookie = `auth_token=${m[1]}`;
}

async function main() {
  await login('registrar@srhu.edu.in');

  // --- 1. Create department + duplicate code → 409 -------------------------
  const deptCode = `TSTORG${Date.now() % 1000}`;
  const create = await req('POST', '/api/departments', { schoolId: 'sch_eng', name: 'Test Org Dept', code: deptCode });
  check('create department 201', create.status === 201, `status=${create.status}`);
  const deptId = create.json?.id;
  const dup = await req('POST', '/api/departments', { schoolId: 'sch_eng', name: 'Again', code: deptCode });
  check('duplicate dept code 409', dup.status === 409, `status=${dup.status}`);

  // --- 2. Set head: HOD ok; non-HOD → 400 NOT_HOD -------------------------
  const hodRes = await req('PUT', `/api/departments/${deptId}/head`, { headUserId: 'x-placeholder' });
  // need real HOD id: look up via staff endpoint
  const staff = await req('GET', '/api/staff?schoolId=sch_eng');
  const hodUser = (staff.json?.items || []).find((u: any) => u.position === 'HOD');
  const reg = (staff.json?.items || []).find((u: any) => u.role === 'REGISTRAR_ADMIN');
  if (hodUser) {
    const setHead = await req('PUT', `/api/departments/${deptId}/head`, { headUserId: hodUser.id });
    check('set head HOD 200', setHead.status === 200, `status=${setHead.status}`);
  } else {
    check('set head HOD 200', false, 'no HOD found');
  }
  if (reg) {
    const badHead = await req('PUT', `/api/departments/${deptId}/head`, { headUserId: reg.id });
    check('set head non-HOD 400 NOT_HOD', badHead.status === 400 && badHead.json?.error?.code === 'NOT_HOD', `status=${badHead.status} code=${badHead.json?.error?.code}`);
  }

  // --- 3. Assign user to new dept; delete dept with staff → 409 -------------
  const target = await prisma.user.findUnique({ where: { email: 'sandeep.cse@srhu.edu.in' } });
  const asgn = await req('PUT', `/api/users/${target!.id}/department`, { departmentId: deptId, position: 'SUBJECT_TEACHER' });
  check('assign user to dept 200', asgn.status === 200, `status=${asgn.status}`);
  const badPos = await req('PUT', `/api/users/${target!.id}/position`, { position: 'HOD' });
  check('invalid position for FACULTY 400', badPos.status === 400 && badPos.json?.error?.code === 'INVALID_POSITION', `status=${badPos.status} code=${badPos.json?.error?.code}`);
  const delWithStaff = await req('DELETE', `/api/departments/${deptId}`);
  check('delete dept with staff 409', delWithStaff.status === 409, `status=${delWithStaff.status}`);

  // --- 4. Class group + allocation + duplicate allocation → 409 -------------
  const batch = await prisma.batch.findFirst({ where: { programId: 'prog_btech_cse' } });
  const course = await prisma.course.findFirst({ where: { code: 'CSE101' } });
  if (batch && course) {
    const cls = await req('POST', '/api/classes', { schoolId: 'sch_eng', programId: 'prog_btech_cse', batchId: batch.id, section: `A${Date.now() % 100}` });
    check('create class group 201', cls.status === 201, `status=${cls.status}`);
    const classId = cls.json?.id;
    const alloc = await req('POST', '/api/allocations', { courseId: course.id, classGroupId: classId, facultyUserId: target!.id, semester: 1, academicYear: '2024-2025', departmentId: deptId });
    check('create allocation 201', alloc.status === 201, `status=${alloc.status}`);
    const allocDup = await req('POST', '/api/allocations', { courseId: course.id, classGroupId: classId, facultyUserId: target!.id, semester: 1, academicYear: '2024-2025', departmentId: deptId });
    check('duplicate allocation 409', allocDup.status === 409, `status=${allocDup.status}`);
    if (alloc.json?.id) {
      const delAlloc = await req('DELETE', `/api/allocations/${alloc.json.id}`);
      check('delete allocation 204', delAlloc.status === 204, `status=${delAlloc.status}`);
    }
  } else {
    check('class/allocation prerequisites', false, 'missing batch or course');
  }

  // --- 5. Tenant scoping: sch_med user sees only sch_med depts --------------
  await login('sanjeev.path@srhu.edu.in');
  const medDepts = await req('GET', '/api/departments');
  const schools = (medDepts.json?.items || []).map((d: any) => d.schoolId);
  check('tenant scoping: med user only sch_med depts', schools.length > 0 && schools.every((s: string) => s === 'sch_med'), `schools=${JSON.stringify(Array.from(new Set(schools)))}`);
  const medClasses = await req('GET', '/api/classes');
  const clsSchools = (medClasses.json?.items || []).map((c: any) => c.schoolId);
  check('tenant scoping: med classes only sch_med', clsSchools.every((s: string) => s === 'sch_med'), `schools=${JSON.stringify(Array.from(new Set(clsSchools)))}`);

  await prisma.$disconnect();
  console.log(`\nORG SMOKE: ${failures === 0 ? 'ALL PASS' : failures + ' FAILURE(S)'}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });

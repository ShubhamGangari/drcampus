// Smoke test for the Attendance module (Module 7) against a running server on
// :3200. Run: npx tsx tests/smoke-attendance.ts
// Requires: seeded DB + `npx next start -p 3200` (JWT_SECRET=dev-secret-for-testing).

import { PrismaClient } from '@prisma/client';

const BASE = process.env.BASE_URL ?? 'http://localhost:3200';
const PASSWORD = 'Password@2026';
const prisma = new PrismaClient();

let failures = 0;
let cookie = ''; // current identity cookie

function check(name: string, cond: boolean, detail?: string) {
  console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${detail ? ` :: ${detail}` : ''}`);
  if (!cond) failures++;
}

async function req(method: string, path: string, body?: unknown, withAuth = true) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (withAuth && cookie) headers['Cookie'] = cookie;
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let json: any = null;
  try { json = await res.json(); } catch { /* no body */ }
  return { status: res.status, json };
}

async function login(email: string) {
  const res = await fetch(BASE + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  const sc = res.headers.get('set-cookie') ?? '';
  return { status: res.status, cookie: sc.split(';')[0] };
}

async function main() {
  // 1. Faculty login
  const faculty = await login('sandeep.cse@srhu.edu.in');
  check('login faculty: 200', faculty.status === 200 && faculty.cookie.startsWith('auth_token='), `status=${faculty.status}`);
  cookie = faculty.cookie;

  // 2. Seed lookups
  const course = await prisma.course.findFirst({ where: { programId: 'prog_btech_cse' } });
  check('seed: course present', !!course);
  if (!course) { console.log('\n=== SMOKE ATTENDANCE: ABORT (no course) ==='); process.exit(1); }

  const students = await prisma.student.findMany({
    where: { programId: course.programId },
    orderBy: { rollNo: 'asc' },
  });
  check('seed: at least 2 students', students.length >= 2, `count=${students.length}`);
  if (students.length < 2) { console.log('\n=== SMOKE ATTENDANCE: ABORT (not enough students) ==='); process.exit(1); }
  const s1 = students[0];
  const s2 = students[1];

  const D1 = '2026-11-05';
  const D2 = '2026-11-06';
  const courseQ = encodeURIComponent(course.id);

  // 3. Mark attendance (2 students, PRESENT)
  const m1 = await req('POST', '/api/attendance/mark', {
    courseId: course.id, date: D1,
    records: [
      { studentId: s1.id, status: 'PRESENT' },
      { studentId: s2.id, status: 'PRESENT' },
    ],
  });
  check('mark day1: 201', m1.status === 201, `status=${m1.status} body=${JSON.stringify(m1.json)}`);
  check('mark day1: marked=2', m1.json?.marked === 2);

  const m2 = await req('POST', '/api/attendance/mark', {
    courseId: course.id, date: D2,
    records: [
      { studentId: s1.id, status: 'PRESENT' },
      { studentId: s2.id, status: 'ABSENT' },
    ],
  });
  check('mark day2: 201', m2.status === 201, `status=${m2.status}`);

  // 4. Re-mark s1 day1 -> ABSENT (upsert)
  const m3 = await req('POST', '/api/attendance/mark', {
    courseId: course.id, date: D1,
    records: [{ studentId: s1.id, status: 'ABSENT' }],
  });
  check('remark s1 day1: 201', m3.status === 201, `status=${m3.status}`);
  check('remark: marked=1 (upsert)', m3.json?.marked === 1);

  // 5. Faculty report
  const rep = await req('GET', `/api/attendance/report?courseId=${courseQ}`);
  check('report: 200', rep.status === 200, `status=${rep.status} body=${JSON.stringify(rep.json)}`);
  const rows = Array.isArray(rep.json) ? rep.json : [];
  const r1 = rows.find((r: any) => r.studentId === s1.id);
  const r2 = rows.find((r: any) => r.studentId === s2.id);
  check('report s1: totalDays=2', r1?.totalDays === 2, `got=${JSON.stringify(r1)}`);
  check('report s1: presentDays=1 (upsert)', r1?.presentDays === 1, `got=${JSON.stringify(r1)}`);
  check('report s1: percentage=50', r1?.percentage === 50, `got=${JSON.stringify(r1)}`);
  check('report s2: totalDays=2', r2?.totalDays === 2, `got=${JSON.stringify(r2)}`);
  check('report s2: presentDays=1', r2?.presentDays === 1, `got=${JSON.stringify(r2)}`);
  check('report s2: percentage=50', r2?.percentage === 50, `got=${JSON.stringify(r2)}`);

  // 6. Student login -> only own row
  const studentLogin = await login('aarav.sharma@sst.srhu.edu.in');
  check('login student: 200', studentLogin.status === 200 && studentLogin.cookie.startsWith('auth_token='), `status=${studentLogin.status}`);
  cookie = studentLogin.cookie;

  const srep = await req('GET', `/api/attendance/report?courseId=${courseQ}`);
  check('report (student): 200', srep.status === 200, `status=${srep.status} body=${JSON.stringify(srep.json)}`);
  const srows = Array.isArray(srep.json) ? srep.json : [];
  check('report (student): exactly own row', srows.length === 1 && srows[0].studentId === s1.id, `rows=${JSON.stringify(srows)}`);
  if (srows.length === 1) {
    check('report (student): totalDays=2', srows[0].totalDays === 2, `got=${JSON.stringify(srows[0])}`);
    check('report (student): percentage=50', srows[0].percentage === 50, `got=${JSON.stringify(srows[0])}`);
  }

  // 7. Student POST mark -> 403
  const smark = await req('POST', '/api/attendance/mark', {
    courseId: course.id, date: '2026-11-07',
    records: [{ studentId: s1.id, status: 'PRESENT' }],
  });
  check('student mark: 403', smark.status === 403, `status=${smark.status}`);

  // 8. Defaulter (faculty)
  cookie = faculty.cookie;
  const def = await req('GET', `/api/attendance/defaulter?courseId=${courseQ}`);
  check('defaulter: 200', def.status === 200, `status=${def.status} body=${JSON.stringify(def.json)}`);
  const defRows = Array.isArray(def.json) ? def.json : [];
  check('defaulter: 2 rows below 75', defRows.length === 2, `rows=${JSON.stringify(defRows)}`);

  // 9. Central registrar: report without schoolId -> 400; with -> 200
  const reg = await login('registrar@srhu.edu.in');
  check('login registrar: 200', reg.status === 200, `status=${reg.status}`);
  cookie = reg.cookie;
  const repNoSchool = await req('GET', `/api/attendance/report?courseId=${courseQ}`);
  check('central report w/o schoolId: 400', repNoSchool.status === 400, `status=${repNoSchool.status}`);
  const repSchool = await req('GET', `/api/attendance/report?courseId=${courseQ}&schoolId=sch_eng`);
  check('central report with schoolId: 200', repSchool.status === 200, `status=${repSchool.status}`);

  console.log(`\n=== SMOKE ATTENDANCE RESULT: ${failures === 0 ? 'ALL PASS' : failures + ' FAILURES'} ===`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

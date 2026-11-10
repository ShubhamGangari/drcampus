// Smoke test for Examination & Result module against a running server on :3200.
// Run: npx tsx tests/smoke-exams.ts
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

async function main() {
  // login as EXAM_CONTROLLER (central 'ALL')
  const login = await fetch(BASE + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'coe@srhu.edu.in', password: 'Password@2026' }),
  });
  const sc = login.headers.get('set-cookie') ?? '';
  cookie = sc.split(';')[0];
  check('login: 200 as coe@srhu.edu.in', login.status === 200 && cookie.startsWith('auth_token='), `status=${login.status}`);

  // discover a program that has courses, a course, and a student (via prisma)
  const course = await prisma.course.findFirst({
    where: { programId: 'prog_btech_cse' },
  });
  const program = course ? await prisma.program.findUnique({ where: { id: course.programId } }) : null;
  const student = await prisma.student.findFirst({ where: { schoolId: 'sch_eng' } });
  check('seed: program+course+student present', !!program && !!course && !!student, `prog=${program?.id} course=${course?.id} stud=${student?.id}`);
  if (!program || !course || !student) { console.log('\n=== SMOKE RESULT: ABORT (seed missing) ==='); process.exit(1); }

  // create exam
  const examRes = await req('POST', '/api/exams', {
    schoolId: 'sch_eng',
    programId: program.id,
    academicYear: '2026-2027',
    semester: 2,
    type: 'END_SEM',
    title: 'End-Semester 2026',
    maxInternal: 30,
    maxExternal: 70,
  });
  const examId = examRes.json?.examId;
  check('create exam: 201', examRes.status === 201 && !!examId, `status=${examRes.status}`);
  if (!examId) { console.log('\n=== SMOKE RESULT: ABORT (exam create fail) ==='); process.exit(1); }

  // create exam without schoolId as central -> 400 SCHOOL_ID_REQUIRED
  const noSchool = await req('POST', '/api/exams', {
    programId: program.id, academicYear: '2026-2027', semester: 2,
    type: 'MID_SEM', title: 'x', maxInternal: 30, maxExternal: 70,
  });
  check('central create exam w/o schoolId -> 400', noSchool.status === 400 && noSchool.json?.error?.code === 'SCHOOL_ID_REQUIRED', `status=${noSchool.status} code=${noSchool.json?.error?.code}`);

  // add schedule
  const future = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
  const sched = await req('POST', `/api/exams/${examId}/schedules`, {
    courseId: course.id, examDate: future, startTime: '10:00', venue: 'Hall A',
  });
  const schedId = sched.json?.scheduleId;
  check('add schedule: 201', sched.status === 201 && !!schedId, `status=${sched.status}`);

  // duplicate schedule -> 409 / 400
  const dup = await req('POST', `/api/exams/${examId}/schedules`, {
    courseId: course.id, examDate: future, startTime: '10:00', venue: 'Hall A',
  });
  check('duplicate schedule rejected', dup.status === 409 || dup.status === 400, `status=${dup.status}`);

  // hall ticket
  const ht = await req('POST', `/api/exams/${examId}/hall-tickets/generate`, { studentId: student.id });
  const htNo = ht.json?.hallTicketNo;
  check('hall ticket: 201 + number', ht.status === 201 && !!htNo && htNo.startsWith('HT-'), `status=${ht.status} no=${htNo}`);

  const ht2 = await req('POST', `/api/exams/${examId}/hall-tickets/generate`, { studentId: student.id });
  check('duplicate hall ticket -> 409', ht2.status === 409, `status=${ht2.status}`);

  // marks: valid entry (85/100 = 85% -> A per spec boundaries)
  const mk = await req('POST', `/api/exams/${examId}/marks`, {
    studentId: student.id, scheduleId: schedId, internalMarks: 25, externalMarks: 60,
  });
  check('marks: 201 + total + grade', mk.status === 201 && mk.json?.totalMarks === 85 && mk.json?.grade === 'A', `status=${mk.status} total=${mk.json?.totalMarks} grade=${mk.json?.grade}`);

  // marks exceeding maxExternal -> 400
  const over = await req('POST', `/api/exams/${examId}/marks`, {
    studentId: student.id, scheduleId: schedId, internalMarks: 25, externalMarks: 95,
  });
  check('marks over max -> 400', over.status === 400, `status=${over.status}`);

  // publish
  const pub = await req('POST', `/api/exams/${examId}/results/publish`, {});
  check('publish: 200', pub.status === 200 && pub.json?.published === true, `status=${pub.status}`);

  // marks locked after publish
  const locked = await req('POST', `/api/exams/${examId}/marks`, {
    studentId: student.id, scheduleId: schedId, internalMarks: 20, externalMarks: 55,
  });
  check('marks locked after publish', locked.status === 403 || locked.status === 409, `status=${locked.status}`);

  // results list
  const res = await req('GET', `/api/exams/${examId}/results`);
  const rows: any[] = Array.isArray(res.json) ? res.json : [];
  check('results list: contains student with grade A', res.status === 200 && rows.some((r: any) => r.studentId === student.id && r.grade === 'A'), `status=${res.status} n=${rows.length}`);

  // unpublish
  const unpub = await req('POST', `/api/exams/${examId}/results/unpublish`, {});
  check('unpublish: 200', unpub.status === 200 && unpub.json?.published === false, `status=${unpub.status}`);

  // publication gates: student cannot view results/schedules after unpublish
  const studentLogin = await fetch(BASE + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'aarav.sharma@sst.srhu.edu.in', password: 'Password@2026' }),
  });
  const ssc = studentLogin.headers.get('set-cookie') ?? '';
  const saved = cookie;
  cookie = ssc.split(';')[0];
  const stuRes = await req('GET', `/api/exams/${examId}/results`);
  check('student blocked from unpublished results', stuRes.status === 403 && stuRes.json?.error?.code === 'RESULTS_NOT_PUBLISHED', `status=${stuRes.status} code=${stuRes.json?.error?.code}`);
  const stuSched = await req('GET', `/api/exams/${examId}/schedules`);
  check('student blocked from unpublished schedules', stuSched.status === 403 && stuSched.json?.error?.code === 'EXAM_NOT_PUBLISHED', `status=${stuSched.status} code=${stuSched.json?.error?.code}`);
  cookie = saved;

  console.log(`\n=== SMOKE RESULT: ${failures === 0 ? 'ALL PASS' : `${failures} FAILURE(S)`} ===`);
  process.exit(failures === 0 ? 0 : 1);
}

main();

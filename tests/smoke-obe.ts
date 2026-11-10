// Smoke test for OBE (CO-PO) module against a running server on :3200.
// Run: npx tsx tests/smoke-obe.ts
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
  // login as FACULTY (school-scoped sch_eng)
  const login = await fetch(BASE + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'sandeep.cse@srhu.edu.in', password: 'Password@2026' }),
  });
  const sc = login.headers.get('set-cookie') ?? '';
  cookie = sc.split(';')[0];
  check('login: 200 as faculty', login.status === 200 && cookie.startsWith('auth_token='), `status=${login.status}`);

  const course = await prisma.course.findFirst({ where: { programId: 'prog_btech_cse' } });
  check('seed: course present', !!course);
  if (!course) { console.log('\n=== SMOKE RESULT: ABORT (seed) ==='); process.exit(1); }

  const tag = String(Date.now()).slice(-6);
  const poCode = `PO-T${tag}`;
  const co1Code = `CO1-T${tag}`;
  const co2Code = `CO2-T${tag}`;
  const academicYear = '2026-2027';

  // create PO
  const po = await req('POST', '/api/obe/programs/prog_btech_cse/pos', { code: poCode, description: 'Engineering knowledge' });
  const poId = po.json?.poId;
  check('create PO: 201', po.status === 201 && !!poId, `status=${po.status}`);

  const poDup = await req('POST', '/api/obe/programs/prog_btech_cse/pos', { code: poCode, description: 'again' });
  check('duplicate PO code -> 409/400', poDup.status === 409 || poDup.status === 400, `status=${poDup.status}`);

  // attach CO set to course
  const co = await req('POST', '/api/obe/courses', { courseId: course.id, cos: [{ code: co1Code, description: 'Solve problems' }, { code: co2Code, description: 'Design systems' }] });
  check('attach course outcomes: 201', co.status === 201, `status=${co.status}`);

  // read course outcomes
  const coList = await req('GET', '/api/obe/courses?programId=prog_btech_cse');
  const coRows: any[] = Array.isArray(coList.json) ? coList.json : [];
  const row = coRows.find((r: any) => r.courseId === course.id);
  const co1 = row?.cos?.find((c: any) => c.code === co1Code);
  const co2 = row?.cos?.find((c: any) => c.code === co2Code);
  check('list course outcomes: contains course with COs', coList.status === 200 && !!row && !!co1 && !!co2, `status=${coList.status} n=${coRows.length}`);

  // save mapping (CO1@1.0, CO2@0.5 to PO1)
  const map = await req('POST', '/api/obe/mappings', {
    courseId: course.id,
    mappings: [
      { coId: co1.id, poId, weight: 1.0 },
      { coId: co2.id, poId, weight: 0.5 },
    ],
  });
  check('save mapping: 201', map.status === 201, `status=${map.status}`);

  const badMap = await req('POST', '/api/obe/mappings', {
    courseId: course.id,
    mappings: [{ coId: co1.id, poId, weight: 1.5 }],
  });
  check('mapping weight >1 -> 400', badMap.status === 400, `status=${badMap.status}`);

  // attainment
  const at = await req('POST', '/api/obe/attainment', { courseId: course.id, coId: co1.id, academicYear, attainment: 80 });
  check('attainment: 201', at.status === 201, `status=${at.status}`);
  const at2 = await req('POST', '/api/obe/attainment', { courseId: course.id, coId: co2.id, academicYear, attainment: 60 });
  check('attainment2: 201', at2.status === 201, `status=${at2.status}`);

  const atDup = await req('POST', '/api/obe/attainment', { courseId: course.id, coId: co1.id, academicYear, attainment: 90 });
  check('duplicate attainment -> 409', atDup.status === 409, `status=${atDup.status}`);

  const atBad = await req('POST', '/api/obe/attainment', { courseId: course.id, coId: co1.id, academicYear, attainment: 120 });
  check('attainment >100 -> 400', atBad.status === 400, `status=${atBad.status}`);

  // course attainment report
  const cr = await req('GET', `/api/obe/reports/course-attainment?courseId=${course.id}&academicYear=${academicYear}`);
  check('course attainment report: contains COs', cr.status === 200 && Array.isArray(cr.json?.cos) && cr.json?.cos?.length >= 2, `status=${cr.status} n=${cr.json?.cos?.length}`);

  // PO attainment report (DEAN/REGISTRAR_ADMIN only): (1.0*80 + 0.5*60)/(1.5) = 73.33
  const dLogin = await fetch(BASE + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'director.sst@srhu.edu.in', password: 'Password@2026' }),
  });
  const dsc = dLogin.headers.get('set-cookie') ?? '';
  const saved = cookie;
  cookie = dsc.split(';')[0];
  const pr = await req('GET', '/api/obe/reports/po-attainment?programId=prog_btech_cse&academicYear=2026-2027');
  const pos: any[] = Array.isArray(pr.json?.pos) ? pr.json.pos : [];
  const poRow = pos.find((p: any) => p.poId === poId);
  check('PO attainment report: weighted avg 73.33', pr.status === 200 && poRow && Math.abs((poRow.attainment as number) - 73.33) < 0.01, `status=${pr.status} po=${poRow?.attainment}`);

  // role gate: student cannot read PO report
  const sLogin = await fetch(BASE + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'aarav.sharma@sst.srhu.edu.in', password: 'Password@2026' }),
  });
  const ssc = sLogin.headers.get('set-cookie') ?? '';
  cookie = ssc.split(';')[0];
  const sPr = await req('GET', '/api/obe/reports/po-attainment?programId=prog_btech_cse&academicYear=2026-2027');
  check('student blocked from PO report -> 403', sPr.status === 403, `status=${sPr.status}`);
  cookie = saved;

  console.log(`\n=== SMOKE RESULT: ${failures === 0 ? 'ALL PASS' : `${failures} FAILURE(S)`} ===`);
  process.exit(failures === 0 ? 0 : 1);
}

main();

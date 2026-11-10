import { PrismaClient } from '@prisma/client';

const BASE = process.env.BASE_URL ?? 'http://localhost:3200';
const SCHOOL = 'sch_eng';
const MONTH = '2026-10';
const PASSWORD = 'Password@2026';

const prisma = new PrismaClient();
let failures = 0;

function check(name: string, cond: boolean, detail?: string) {
  console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${detail ? ` :: ${detail}` : ''}`);
  if (!cond) failures++;
}

interface ReqResult {
  status: number;
  json: any;
}

async function req(method: string, path: string, body?: unknown, cookieValue?: string): Promise<ReqResult> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (cookieValue) headers['Cookie'] = cookieValue;
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let json: any = null;
  try {
    json = await res.json();
  } catch {
    /* no body */
  }
  return { status: res.status, json };
}

async function login(email: string): Promise<{ status: number; cookie: string; user?: any }> {
  const res = await fetch(BASE + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  const sc = res.headers.get('set-cookie') ?? '';
  const cookie = sc.split(';')[0];
  let json: any = null;
  try {
    json = await res.json();
  } catch {
    /* ignore */
  }
  return { status: res.status, cookie, user: json?.user };
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
const today = new Date();
const leaveFrom = iso(new Date(today.getTime() - 1 * 864e5));
const leaveTo = iso(new Date(today.getTime() + 3 * 864e5));
const badFrom = iso(new Date(today.getTime() + 10 * 864e5));
const badTo = iso(new Date(today.getTime() - 10 * 864e5));

async function main() {
  // ---- clean HR data for the school so each run is deterministic ----
  await prisma.payroll.deleteMany({ where: { schoolId: SCHOOL } });
  await prisma.employeeLeave.deleteMany({ where: { schoolId: SCHOOL } });
  await prisma.employee.deleteMany({ where: { schoolId: SCHOOL } });
  console.log('cleanup: removed prior HR test rows for ' + SCHOOL);

  const facUser = await prisma.user.findUnique({
    where: { email: 'sandeep.cse@srhu.edu.in' },
    select: { id: true },
  });
  check('setup: faculty user found', !!facUser?.id);
  if (!facUser?.id) {
    console.log('FAIL abort: faculty user missing');
    process.exit(1);
  }

  const stamp = Date.now();
  const empId1 = `E${stamp}1`;
  const empId2 = `E${stamp}2`;

  // ---- 1. REGISTRAR login (central) ----
  const regLogin = await login('registrar@srhu.edu.in');
  check('login registrar: 200', regLogin.status === 200, `status=${regLogin.status}`);
  const regCookie = regLogin.cookie;
  check('login registrar: cookie captured', regCookie.startsWith('auth_token='), regCookie);

  // central create without schoolId -> 400
  const noSchool = await req('POST', '/api/hr/employees', {
    employeeId: empId1,
    name: 'Dr. Sandeep Kumar',
    designation: 'Professor',
    department: 'CSE',
  }, regCookie);
  check('create employee (central, no schoolId): 400 SCHOOL_ID_REQUIRED',
    noSchool.status === 400 && noSchool.json?.error?.code === 'SCHOOL_ID_REQUIRED',
    `status=${noSchool.status} code=${noSchool.json?.error?.code}`);

  // create employee with schoolId -> 201
  const createRes = await req('POST', '/api/hr/employees', {
    schoolId: SCHOOL,
    employeeId: empId1,
    name: 'Dr. Sandeep Kumar',
    designation: 'Professor',
    department: 'CSE',
    userId: facUser.id,
  }, regCookie);
  check('create employee: 201', createRes.status === 201 && !!createRes.json?.id, `status=${createRes.status}`);
  const empId1Db = createRes.json?.id;

  // duplicate -> 400
  const dupRes = await req('POST', '/api/hr/employees', {
    schoolId: SCHOOL,
    employeeId: empId1,
    name: 'Dr. Sandeep Kumar',
    designation: 'Professor',
    department: 'CSE',
    userId: facUser.id,
  }, regCookie);
  check('create duplicate employee: 400 DUPLICATE_EMPLOYEE',
    dupRes.status === 400 && dupRes.json?.error?.code === 'DUPLICATE_EMPLOYEE',
    `status=${dupRes.status} code=${dupRes.json?.error?.code}`);

  // second employee (no user link)
  const createRes2 = await req('POST', '/api/hr/employees', {
    schoolId: SCHOOL,
    employeeId: empId2,
    name: 'Test Faculty Two',
    designation: 'AsstProf',
    department: 'Mathematics',
  }, regCookie);
  check('create second employee: 201', createRes2.status === 201 && !!createRes2.json?.id, `status=${createRes2.status}`);
  const empId2Db = createRes2.json?.id;

  // registrar list employees for the school
  const empList = await req('GET', `/api/hr/employees?schoolId=${SCHOOL}`, undefined, regCookie);
  check('registrar GET employees: 200 and contains both',
    empList.status === 200 && Array.isArray(empList.json) && empList.json.length === 2,
    `status=${empList.status} count=${Array.isArray(empList.json) ? empList.json.length : 'n/a'}`);

  // ---- 2. FACULTY login ----
  const facLogin = await login('sandeep.cse@srhu.edu.in');
  check('login faculty: 200', facLogin.status === 200, `status=${facLogin.status}`);
  const facCookie = facLogin.cookie;
  check('login faculty: cookie captured', facCookie.startsWith('auth_token='), facCookie);

  // faculty GET /me -> 200
  const me = await req('GET', '/api/hr/employees/me', undefined, facCookie);
  check('faculty GET /me: 200 own record',
    me.status === 200 && me.json?.employeeId === empId1 && me.json?.designation === 'Professor',
    `status=${me.status} employeeId=${me.json?.employeeId} designation=${me.json?.designation}`);

  // faculty GET employees -> only own
  const facEmpList = await req('GET', `/api/hr/employees?schoolId=${SCHOOL}`, undefined, facCookie);
  check('faculty GET employees: sees only own row',
    facEmpList.status === 200 && Array.isArray(facEmpList.json) && facEmpList.json.length === 1 && facEmpList.json[0].id === empId1Db,
    `status=${facEmpList.status} count=${Array.isArray(facEmpList.json) ? facEmpList.json.length : 'n/a'}`);

  // ---- 3. faculty apply leave ----
  const leaveRes = await req('POST', '/api/hr/leave', {
    fromDate: leaveFrom,
    toDate: leaveTo,
    type: 'SICK',
  }, facCookie);
  check('apply leave: 201', leaveRes.status === 201 && !!leaveRes.json?.requestId, `status=${leaveRes.status}`);
  const requestId = leaveRes.json?.requestId;

  // bad date range -> 400
  const badLeave = await req('POST', '/api/hr/leave', {
    fromDate: badFrom,
    toDate: badTo,
    type: 'SICK',
  }, facCookie);
  check('apply leave bad dates: 400 INVALID_DATE_RANGE',
    badLeave.status === 400 && badLeave.json?.error?.code === 'INVALID_DATE_RANGE',
    `status=${badLeave.status} code=${badLeave.json?.error?.code}`);

  // ---- 4. registrar approve leave ----
  const approveLeave = await req('PATCH', `/api/hr/leave/${requestId}`, { status: 'APPROVED' }, regCookie);
  check('registrar approve leave: 200 APPROVED',
    approveLeave.status === 200 && approveLeave.json?.status === 'APPROVED',
    `status=${approveLeave.status} status=${approveLeave.json?.status}`);

  // ---- 5. faculty PATCH -> 403 ----
  const facPatch = await req('PATCH', `/api/hr/leave/${requestId}`, { status: 'REJECTED' }, facCookie);
  check('faculty PATCH leave: 403', facPatch.status === 403, `status=${facPatch.status}`);

  // ---- 6. registrar generate payroll + idempotent re-run ----
  const gen1 = await req('POST', '/api/hr/payroll/generate', { schoolId: SCHOOL, month: MONTH }, regCookie);
  check('generate payroll: 201 created>=1',
    gen1.status === 201 && typeof gen1.json?.created === 'number' && gen1.json.created >= 1,
    `status=${gen1.status} created=${gen1.json?.created}`);

  const gen2 = await req('POST', '/api/hr/payroll/generate', { schoolId: SCHOOL, month: MONTH }, regCookie);
  check('generate payroll re-run: idempotent created=0',
    gen2.status === 201 && gen2.json?.created === 0,
    `status=${gen2.status} created=${gen2.json?.created}`);

  // ---- 7. finance login + approve payroll ----
  const finLogin = await login('fo@srhu.edu.in');
  check('login finance: 200', finLogin.status === 200, `status=${finLogin.status}`);
  const finCookie = finLogin.cookie;

  const payList = await req('GET', `/api/hr/payroll?schoolId=${SCHOOL}&month=${MONTH}`, undefined, finCookie);
  check('finance GET payroll: 200 with rows',
    payList.status === 200 && Array.isArray(payList.json) && payList.json.length >= 2,
    `status=${payList.status} count=${Array.isArray(payList.json) ? payList.json.length : 'n/a'}`);
  const payrollId = payList.json?.[0]?.id;
  check('finance GET payroll: row has gross/deductions/net',
    !!payrollId && typeof payList.json[0].gross === 'number' && typeof payList.json[0].deductions === 'number' && typeof payList.json[0].net === 'number');

  const approvePay = await req('POST', `/api/hr/payroll/${payrollId}/approve`, undefined, finCookie);
  check('finance approve payroll: 200 APPROVED',
    approvePay.status === 200 && approvePay.json?.status === 'APPROVED',
    `status=${approvePay.status} status=${approvePay.json?.status}`);

  // finance GET payroll confirms approved status reflected
  const payListAfter = await req('GET', `/api/hr/payroll?schoolId=${SCHOOL}&month=${MONTH}`, undefined, finCookie);
  const approvedRow = Array.isArray(payListAfter.json) ? payListAfter.json.find((r: any) => r.id === payrollId) : null;
  check('finance GET payroll: approved status persisted',
    !!approvedRow && approvedRow.status === 'APPROVED',
    `status=${approvedRow?.status}`);

  // ---- 8. faculty GET payslip ----
  const payslip = await req('GET', `/api/hr/payslip?month=${MONTH}`, undefined, facCookie);
  check('faculty GET payslip: 200 own row',
    payslip.status === 200 && payslip.json?.employeeId === empId1 && typeof payslip.json?.net === 'number',
    `status=${payslip.status} employeeId=${payslip.json?.employeeId} net=${payslip.json?.net}`);
  check('faculty payslip: net = gross - deductions',
    Number(payslip.json?.gross) - Number(payslip.json?.deductions) === Number(payslip.json?.net),
    `gross=${payslip.json?.gross} deductions=${payslip.json?.deductions} net=${payslip.json?.net}`);

  // faculty payslip missing month -> 400
  const noMonthSlip = await req('GET', '/api/hr/payslip', undefined, facCookie);
  check('faculty payslip no month: 400', noMonthSlip.status === 400, `status=${noMonthSlip.status}`);

  // ---- summary ----
  console.log(`\n==== HR smoke: ${failures === 0 ? 'ALL PASS' : failures + ' FAILURE(S)'} ====`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('HR smoke crashed:', e);
  process.exit(1);
});

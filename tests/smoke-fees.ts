import { PrismaClient } from '@prisma/client';

const BASE = process.env.BASE_URL ?? 'http://localhost:3200';
const SCHOOL = 'sch_eng';
const PROGRAM = 'prog_btech_cse';
const STUDENT_ID = 'cmw96y1sx000xw7nkpx02r3jl'; // Aarav Sharma (sch_eng)

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

const isoDate = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const future = isoDate(Date.now() + 30 * 864e5);
const past = isoDate(Date.now() - 864e5);

async function main() {
  // ---- login (capture cookie) ----
  const loginRes = await fetch(BASE + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'fo@srhu.edu.in', password: 'Password@2026' }),
  });
  const loginJson: any = await loginRes.json().catch(() => null);
  check('login: 200 as fo@srhu.edu.in', loginRes.status === 200, `status=${loginRes.status}`);
  const sc = loginRes.headers.get('set-cookie') ?? '';
  cookie = sc.split(';')[0];
  check('login: auth cookie captured', cookie.startsWith('auth_token='), cookie);

  // ---- GET /api/fees/schools (central) ----
  const schools = await req('GET', '/api/fees/schools');
  const schoolList: any[] = Array.isArray(schools.json) ? schools.json : [];
  check(
    'GET schools: 200 with seeded schools',
    schools.status === 200 && schoolList.some((s) => s.id === 'sch_eng') && schoolList.some((s) => s.id === 'sch_med'),
    `status=${schools.status} count=${schoolList.length}`
  );
  const sst = schoolList.find((s) => s.id === 'sch_eng');
  check('GET schools: sch_eng has a name', !!sst?.name && sst.name.length > 0, sst?.name);

  // ---- GET /api/fees/schools (school-scoped DEAN) ----
  const deanLogin = await fetch(BASE + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'director.sst@srhu.edu.in', password: 'Password@2026' }),
  });
  const deanSc = deanLogin.headers.get('set-cookie') ?? '';
  const deanCookie = deanSc.split(';')[0];
  const deanSchools = await req('GET', '/api/fees/schools', undefined, true);
  // swap cookie
  const saved = cookie;
  cookie = deanCookie;
  const deanRes = await req('GET', '/api/fees/schools');
  cookie = saved;
  const deanList: any[] = Array.isArray(deanRes.json) ? deanRes.json : [];
  check(
    'GET schools: non-central DEAN sees only their own school',
    deanRes.status === 200 && deanList.length === 1 && deanList[0].id === 'sch_eng',
    `status=${deanRes.status} count=${deanList.length}`
  );

  // ---- create structure A ----
  const structA = await req('POST', '/api/fees/structures', {
    schoolId: SCHOOL,
    programId: PROGRAM,
    academicYear: '2026-2027',
    semester: 1,
    components: [
      { name: 'Tuition', amount: 30000 },
      { name: 'Lab', amount: 5000 },
    ],
    totalAmount: 99999, // client-supplied total must be ignored
  });
  const structAId = structA.json?.structureId;
  check('create structure A: 201', structA.status === 201 && !!structAId, `status=${structA.status}`);
  const storedA = structAId ? await prisma.feeStructure.findUnique({ where: { id: structAId } }) : null;
  check('create structure A: totalAmount recomputed from components (35000)', storedA?.totalAmount === 35000, `total=${storedA?.totalAmount}`);

  // ---- generate invoice for student + structure A ----
  const invA = await req('POST', '/api/fees/invoices/generate', {
    schoolId: SCHOOL,
    studentId: STUDENT_ID,
    structureId: structAId,
    dueDate: future,
  });
  const invAId = invA.json?.invoiceId;
  check('generate invoice: 201', invA.status === 201 && !!invAId, `status=${invA.status}`);
  check('generate invoice: amount = 35000', invA.json?.amount === 35000, `amount=${invA.json?.amount}`);

  // ---- payment with idempotencyKey ----
  // Unique key per run so the smoke test is repeatable against a persistent DB
  // (SQLite is not reset between runs).
  const idemKey = `smoke-idem-${Date.now()}`;
  const payBody = {
    invoiceId: invAId,
    amount: 10000,
    mode: 'UPI',
    idempotencyKey: idemKey,
    schoolId: SCHOOL,
  };
  const pay1 = await req('POST', '/api/fees/payments', payBody);
  const pay1Id = pay1.json?.paymentId;
  check('payment: 201 with key', pay1.status === 201 && !!pay1Id, `status=${pay1.status}`);
  const pay2 = await req('POST', '/api/fees/payments', payBody);
  check('payment: repeat same key -> 200 same record', pay2.status === 200 && pay2.json?.paymentId === pay1Id, `status=${pay2.status} id=${pay2.json?.paymentId}`);
  const payCount = await prisma.payment.count({ where: { invoiceId: invAId } });
  check('payment: no duplicate row created', payCount === 1, `count=${payCount}`);

  // ---- over-payment ----
  const over = await req('POST', '/api/fees/payments', {
    invoiceId: invAId,
    amount: 40000,
    mode: 'UPI',
    schoolId: SCHOOL,
  });
  check(
    'over-payment: 400 AMOUNT_EXCEEDS_INVOICE',
    over.status === 400 && over.json?.error?.code === 'AMOUNT_EXCEEDS_INVOICE',
    `status=${over.status} code=${over.json?.error?.code}`
  );

  // ---- invalid mode ----
  const badMode = await req('POST', '/api/fees/payments', {
    invoiceId: invAId,
    amount: 100,
    mode: 'bitcoin',
    schoolId: SCHOOL,
  });
  check('mode: bitcoin rejected -> 400', badMode.status === 400, `status=${badMode.status} code=${badMode.json?.error?.code}`);

  // ---- PUT structure recompute ----
  const put1 = await req('PUT', `/api/fees/structures/${structAId}`, {
    totalAmount: 12345, // only totalAmount, no components
  });
  check('PUT structure: totalAmount-only recomputes from stored components (35000)', put1.status === 200 && put1.json?.totalAmount === 35000, `status=${put1.status} total=${put1.json?.totalAmount}`);
  const put2 = await req('PUT', `/api/fees/structures/${structAId}`, {
    components: [
      { name: 'Tuition', amount: 40000 },
      { name: 'Lab', amount: 5000 },
    ],
    totalAmount: 1, // ignored
  });
  check('PUT structure: components change recomputes total (45000)', put2.status === 200 && put2.json?.totalAmount === 45000, `status=${put2.status} total=${put2.json?.totalAmount}`);

  // ---- backdated dueDate ----
  const structB = await req('POST', '/api/fees/structures', {
    schoolId: SCHOOL,
    programId: PROGRAM,
    academicYear: '2026-2027',
    semester: 2,
    components: [{ name: 'Misc', amount: 1000 }],
  });
  const structBId = structB.json?.structureId;
  check('create structure B: 201', structB.status === 201 && !!structBId, `status=${structB.status}`);
  const pastDue = await req('POST', '/api/fees/invoices/generate', {
    schoolId: SCHOOL,
    studentId: STUDENT_ID,
    structureId: structBId,
    dueDate: past,
  });
  check(
    'past dueDate: 400 DUE_DATE_IN_PAST',
    pastDue.status === 400 && pastDue.json?.error?.code === 'DUE_DATE_IN_PAST',
    `status=${pastDue.status} code=${pastDue.json?.error?.code}`
  );

  console.log(`\n=== SMOKE RESULT: ${failures === 0 ? 'ALL PASS' : `${failures} FAILURE(S)`} ===`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('SMOKE_CRASH', e);
  process.exit(2);
});

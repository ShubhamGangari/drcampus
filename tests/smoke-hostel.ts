/**
 * Smoke test for the Hostel Management backend (Module 8).
 * Requires a running server on :3200 (see tests/smoke-readme guidance):
 *   $env:JWT_SECRET="dev-secret-for-testing"; npx next start -p 3200
 *
 * Covers the frozen contract in docs/specs/hostel.md §4:
 *   rooms GET/POST, allocate, vacate, allocations GET,
 *   mess bill/paid/bills, complaints GET/POST/PATCH, role enforcement.
 */
import { PrismaClient } from '@prisma/client';

const BASE = process.env.BASE_URL ?? 'http://localhost:3200';
const SCHOOL = 'sch_eng';

const STUDENT_A_ID = 'cmw96y1sx000xw7nkpx02r3jl'; // Aarav Sharma (sch_eng)
const STUDENT_B_ID = 'cmw96y1tb0011w7nku045syqa'; // Diya Nair (sch_eng)

const prisma = new PrismaClient();
let failures = 0;

function check(name: string, cond: boolean, detail?: string) {
  console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${detail ? ` :: ${detail}` : ''}`);
  if (!cond) failures++;
}

function setCookieOf(res: Response): string {
  const sc = res.headers.get('set-cookie') ?? '';
  const cookie = sc.split(';')[0];
  return cookie;
}

async function login(email: string, password = 'Password@2026') {
  const res = await fetch(BASE + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const cookie = setCookieOf(res);
  return { status: res.status, cookie };
}

async function req(method: string, path: string, cookie: string, body?: unknown) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (cookie) headers['Cookie'] = cookie;
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

const stamp = Date.now();
const roomA = `SMK-${stamp}-A`; // capacity 1
const roomB = `SMK-${stamp}-B`; // capacity 5
const BILL_MONTH = '2026-11';

async function main() {
  // ---- setup: clean slate for the fixed students -------------------------
  await prisma.hostelAllocation.deleteMany({
    where: { studentId: { in: [STUDENT_A_ID, STUDENT_B_ID] } },
  });
  await prisma.messBill.deleteMany({ where: { studentId: STUDENT_A_ID } });
  await prisma.hostelComplaint.deleteMany({ where: { studentId: STUDENT_A_ID } });

  const studentB = await prisma.student.findUnique({ where: { id: STUDENT_B_ID } });
  check('setup: student B exists in DB', !!studentB, studentB?.email);
  if (!studentB) {
    console.error('STOP: student B missing');
    process.exitCode = 1;
    return;
  }

  // ---- login roles -------------------------------------------------------
  const deanLogin = await login('director.sst@srhu.edu.in');
  check('login: DEAN 200', deanLogin.status === 200, `status=${deanLogin.status}`);
  check('login: DEAN cookie', deanLogin.cookie.startsWith('auth_token='));
  const dean = deanLogin.cookie;

  const finLogin = await login('fo@srhu.edu.in');
  check('login: FINANCE 200', finLogin.status === 200, `status=${finLogin.status}`);
  const fin = finLogin.cookie;

  const stuLogin = await login('aarav.sharma@sst.srhu.edu.in');
  check('login: STUDENT 200', stuLogin.status === 200, `status=${stuLogin.status}`);
  const stu = stuLogin.cookie;

  const facLogin = await login('sandeep.cse@srhu.edu.in');
  check('login: FACULTY 200', facLogin.status === 200, `status=${facLogin.status}`);
  const fac = facLogin.cookie;

  // ---- rooms --------------------------------------------------------------
  const r1 = await req('POST', '/api/hostel/rooms', dean, {
    roomNo: roomA,
    type: 'Single',
    capacity: 1,
  });
  check('rooms POST: create cap-1 room 201', r1.status === 201, `status=${r1.status}`);
  check('rooms POST: returns roomId', typeof r1.json?.roomId === 'string');
  const roomAId = r1.json?.roomId;

  const r2 = await req('POST', '/api/hostel/rooms', dean, {
    roomNo: roomB,
    type: 'Dormitory',
    capacity: 5,
  });
  check('rooms POST: create cap-5 room 201', r2.status === 201, `status=${r2.status}`);
  const roomBId = r2.json?.roomId;

  const dup = await req('POST', '/api/hostel/rooms', dean, {
    roomNo: roomA,
    type: 'Single',
    capacity: 2,
  });
  check('rooms POST: duplicate roomNo 400', dup.status === 400, `status=${dup.status}`);

  const roomList = await req('GET', '/api/hostel/rooms', dean);
  check('rooms GET: 200', roomList.status === 200, `status=${roomList.status}`);
  check(
    'rooms GET: includes rooms with occupied field',
    Array.isArray(roomList.json) && roomList.json.some((r: any) => r.roomNo === roomA && typeof r.occupied === 'number'),
    JSON.stringify(roomList.json)
  );

  // ---- allocate / vacate ---------------------------------------------------
  const alloc1 = await req('POST', '/api/hostel/allocate', dean, {
    studentId: STUDENT_A_ID,
    roomId: roomAId,
  });
  check('allocate: 201 first allocation', alloc1.status === 201, `status=${alloc1.status}`);
  const alloc1Id = alloc1.json?.allocationId;

  // tenant scoping: the created allocation must carry the dean's schoolId.
  const createdAlloc = await prisma.hostelAllocation.findUnique({
    where: { id: alloc1Id },
  });
  check('allocate: row is tenant-scoped to sch_eng', createdAlloc?.schoolId === SCHOOL, createdAlloc?.schoolId);

  const alloc2 = await req('POST', '/api/hostel/allocate', dean, {
    studentId: STUDENT_A_ID,
    roomId: roomBId,
  });
  check('allocate: second allocation same student 409', alloc2.status === 409, `status=${alloc2.status}`);
  check('allocate: 409 code ACTIVE_ALLOCATION_EXISTS', alloc2.json?.error?.code === 'ACTIVE_ALLOCATION_EXISTS');

  const fill = await req('POST', '/api/hostel/allocate', dean, {
    studentId: STUDENT_B_ID,
    roomId: roomAId,
  });
  check('allocate: fill full room 409', fill.status === 409, `status=${fill.status}`);
  check('allocate: 409 code ROOM_FULL', fill.json?.error?.code === 'ROOM_FULL');

  const vac = await req('POST', '/api/hostel/vacate', dean, { allocationId: alloc1Id });
  check('vacate: 200', vac.status === 200, `status=${vac.status}`);
  check('vacate: { vacated: true }', vac.json?.vacated === true, JSON.stringify(vac.json));

  const vacAgain = await req('POST', '/api/hostel/vacate', dean, { allocationId: alloc1Id });
  check('vacate: second vacate 400', vacAgain.status === 400, `status=${vacAgain.status}`);

  const realloc = await req('POST', '/api/hostel/allocate', dean, {
    studentId: STUDENT_A_ID,
    roomId: roomAId,
  });
  check('allocate: re-allocate after vacate 201', realloc.status === 201, `status=${realloc.status}`);

  const allocs = await req('GET', '/api/hostel/allocations', dean);
  check('allocations GET: 200 (dean)', allocs.status === 200, `status=${allocs.status}`);
  check('allocations GET: includes studentName + roomNo', Array.isArray(allocs.json) && allocs.json.some((a: any) => a.studentName && a.roomNo));

  // ---- mess bills ----------------------------------------------------------
  const bill = await req('POST', '/api/hostel/mess/bill', fin, {
    schoolId: SCHOOL,
    studentId: STUDENT_A_ID,
    month: BILL_MONTH,
    amount: 1500.5,
  });
  check('mess bill POST: 201', bill.status === 201, `status=${bill.status} ${JSON.stringify(bill.json)}`);
  const billId = bill.json?.billId;

  const billDup = await req('POST', '/api/hostel/mess/bill', fin, {
    schoolId: SCHOOL,
    studentId: STUDENT_A_ID,
    month: BILL_MONTH,
    amount: 999,
  });
  check('mess bill POST: duplicate student+month 409', billDup.status === 409, `status=${billDup.status}`);
  check('mess bill POST: 409 DUPLICATE_BILL', billDup.json?.error?.code === 'DUPLICATE_BILL');

  const billBadAmount = await req('POST', '/api/hostel/mess/bill', fin, {
    schoolId: SCHOOL,
    studentId: STUDENT_A_ID,
    month: '2026-12',
    amount: 0,
  });
  check('mess bill POST: amount<=0 400', billBadAmount.status === 400, `status=${billBadAmount.status}`);

  const paid = await req('POST', '/api/hostel/mess/paid', fin, { billId });
  check('mess paid POST: 200', paid.status === 200, `status=${paid.status}`);
  check('mess paid POST: { paid: true }', paid.json?.paid === true, JSON.stringify(paid.json));

  // ---- student-scoped reads (bills / complaints) ---------------------------
  const stuBills = await req('GET', '/api/hostel/mess/bills', stu);
  check('mess bills GET: 200 (student)', stuBills.status === 200, `status=${stuBills.status}`);
  const ownBill = Array.isArray(stuBills.json) ? stuBills.json.find((b: any) => b.id === billId) : undefined;
  check('mess bills GET: student sees own bill with paid+name', !!ownBill && ownBill.paid === true && !!ownBill.studentName, JSON.stringify(ownBill));

  const complaint = await req('POST', '/api/hostel/complaints', stu, {
    type: 'Room Light Not Working',
    description: 'The tube light in my room is fused.',
  });
  check('complaints POST: 201 (student)', complaint.status === 201, `status=${complaint.status}`);
  const complaintId = complaint.json?.complaintId;

  const stuComplaints = await req('GET', '/api/hostel/complaints', stu);
  check('complaints GET: 200 (student)', stuComplaints.status === 200, `status=${stuComplaints.status}`);
  check(
    'complaints GET: student sees own complaint',
    Array.isArray(stuComplaints.json) && stuComplaints.json.some((c: any) => c.id === complaintId && c.status === 'OPEN')
  );

  const deanComplaints = await req('GET', '/api/hostel/complaints', dean);
  check('complaints GET: 200 (dean)', deanComplaints.status === 200, `status=${deanComplaints.status}`);

  const patch = await req('PATCH', `/api/hostel/complaints/${complaintId}`, dean, {
    status: 'IN_PROGRESS',
  });
  check('complaints PATCH: 200 (dean)', patch.status === 200, `status=${patch.status}`);
  check('complaints PATCH: status updated', patch.json?.status === 'IN_PROGRESS', JSON.stringify(patch.json));

  const patchBad = await req('PATCH', `/api/hostel/complaints/${complaintId}`, dean, {
    status: 'NOT_A_STATUS',
  });
  check('complaints PATCH: invalid status 400', patchBad.status === 400, `status=${patchBad.status}`);

  // ---- role enforcement -----------------------------------------------------
  const facRoom = await req('POST', '/api/hostel/rooms', fac, {
    roomNo: `SMK-${stamp}-FAC`,
    type: 'Single',
    capacity: 1,
  });
  check('rooms POST: FACULTY gets 403', facRoom.status === 403, `status=${facRoom.status}`);

  const stuRoom = await req('POST', '/api/hostel/rooms', stu, {
    roomNo: `SMK-${stamp}-STU`,
    type: 'Single',
    capacity: 1,
  });
  check('rooms POST: STUDENT gets 403', stuRoom.status === 403, `status=${stuRoom.status}`);

  const facAlloc = await req('POST', '/api/hostel/allocate', fac, {
    studentId: STUDENT_A_ID,
    roomId: roomAId,
  });
  check('allocate POST: FACULTY gets 403', facAlloc.status === 403, `status=${facAlloc.status}`);

  // ---- summary --------------------------------------------------------------
  await prisma.$disconnect();
  if (failures === 0) {
    console.log('ALL PASS');
  } else {
    console.log(`${failures} FAILURE(S)`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('SMOKE ERROR', err);
  process.exitCode = 1;
});

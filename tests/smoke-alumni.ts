/**
 * Smoke test for the Alumni Management backend (Module 10 — final).
 * Requires a running server on :3200 (see tests/smoke-readme guidance):
 *   $env:JWT_SECRET="dev-secret-for-testing"; npx next start -p 3200
 *
 * Covers the frozen contract in docs/specs/alumni.md §4/§7:
 *   alumni GET/POST + duplicate 409, directory search, PATCH own vs other,
 *   events GET/POST, register 201/409 + deregister,
 *   donations GET/POST + totals, role enforcement.
 */
import { PrismaClient } from '@prisma/client';

const BASE = process.env.BASE_URL ?? 'http://localhost:3200';
const SCHOOL = 'sch_eng';

const AARAV_ID = 'cmw96y1sx000xw7nkpx02r3jl'; // Aarav Sharma (sch_eng)
const DIYA_ID = 'cmw96y1tb0011w7nku045syqa'; // Diya Nair (sch_eng)

const prisma = new PrismaClient();
let failures = 0;

function check(name: string, cond: boolean, detail?: string) {
  console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${detail ? ` :: ${detail}` : ''}`);
  if (!cond) failures++;
}

function setCookieOf(res: Response): string {
  const sc = res.headers.get('set-cookie') ?? '';
  return sc.split(';')[0];
}

async function login(email: string, password = 'Password@2026') {
  const res = await fetch(BASE + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return { status: res.status, cookie: setCookieOf(res) };
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

(async () => {
  // Reset module tables so the test is deterministic against the dev DB.
  await prisma.alumniDonation.deleteMany({});
  await prisma.alumniRegistration.deleteMany({});
  await prisma.alumniEvent.deleteMany({});
  await prisma.alumni.deleteMany({});

  // ---- Registrar (central 'ALL') -------------------------------------------
  const reg = await login('registrar@srhu.edu.in');
  check('registrar login 200', reg.status === 200, `status=${reg.status}`);
  const rc = reg.cookie;

  // Create alumni for a real student -> 201
  const r1 = await req('POST', '/api/alumni', rc, {
    schoolId: SCHOOL,
    studentId: AARAV_ID,
    email: 'aarav.sharma@sst.srhu.edu.in',
  });
  check('create alumni 201', r1.status === 201, JSON.stringify(r1.json));
  check('alumniId returned', !!r1.json?.alumniId, JSON.stringify(r1.json));
  const aaravAlumniId = r1.json.alumniId;

  // Duplicate -> 409
  const r2 = await req('POST', '/api/alumni', rc, {
    schoolId: SCHOOL,
    studentId: AARAV_ID,
    email: 'aarav.alt@example.com',
  });
  check('duplicate alumni 409', r2.status === 409, JSON.stringify(r2.json));

  // Second alumni (Diya) so we can test ownership boundaries.
  const rDiya = await req('POST', '/api/alumni', rc, {
    schoolId: SCHOOL,
    studentId: DIYA_ID,
    email: 'diya.nair@sst.srhu.edu.in',
  });
  check('create alumni diya 201', rDiya.status === 201, JSON.stringify(rDiya.json));
  const diyaAlumniId = rDiya.json.alumniId;

  // Directory search -> 200, returns matching rows
  const rDir = await req('GET', `/api/alumni?schoolId=${SCHOOL}&search=aarav`, rc);
  check('directory search 200', rDir.status === 200);
  check(
    'search returns matching row',
    Array.isArray(rDir.json) &&
    rDir.json.some(
      (x: any) =>
        x.studentId === AARAV_ID && x.studentName.toLowerCase().includes('aarav')
    ),
    JSON.stringify(rDir.json)
  );

  // ---- Student (alumni) -----------------------------------------------------
  const stu = await login('aarav.sharma@sst.srhu.edu.in');
  check('student login 200', stu.status === 200);
  const sc = stu.cookie;

  // PATCH own alumni -> 200
  const rp = await req('PATCH', `/api/alumni/${aaravAlumniId}`, sc, {
    currentCompany: 'Acme Corp',
  });
  check('patch own alumni 200', rp.status === 200, JSON.stringify(rp.json));
  check('patch returns id', rp.json?.id === aaravAlumniId, JSON.stringify(rp.json));

  // PATCH other's alumni -> 403
  const rpo = await req('PATCH', `/api/alumni/${diyaAlumniId}`, sc, {
    currentCompany: 'Evil Corp',
  });
  check('patch other alumni 403', rpo.status === 403, JSON.stringify(rpo.json));

  // ---- Events ---------------------------------------------------------------
  // Registrar creates event -> 201
  const ev = await req('POST', '/api/alumni/events', rc, {
    schoolId: SCHOOL,
    title: 'Homecoming 2027',
    date: '2027-06-15T10:00:00.000Z',
    location: 'Main Auditorium',
  });
  check('create event 201', ev.status === 201, JSON.stringify(ev.json));
  const eventId = ev.json.eventId;

  // Student registers -> 201
  const rg = await req('POST', `/api/alumni/events/${eventId}/register`, sc);
  check('register event 201', rg.status === 201, JSON.stringify(rg.json));
  check('registrationId returned', !!rg.json?.registrationId, JSON.stringify(rg.json));

  // Duplicate register -> 409
  const rgd = await req('POST', `/api/alumni/events/${eventId}/register`, sc);
  check('duplicate register 409', rgd.status === 409, JSON.stringify(rgd.json));

  // Events list shows my registration
  const evList = await req('GET', `/api/alumni/events?schoolId=${SCHOOL}`, sc);
  check('events list 200', evList.status === 200);
  const myEvent = Array.isArray(evList.json) ? evList.json.find((e: any) => e.id === eventId) : null;
  check('event registered=true for student', !!myEvent?.registered, JSON.stringify(myEvent));
  check('event registrations count=1', myEvent?.registrations === 1, JSON.stringify(myEvent));

  // Deregister -> 200
  const rgdel = await req('DELETE', `/api/alumni/events/${eventId}/register`, sc);
  check('deregister 200', rgdel.status === 200, JSON.stringify(rgdel.json));
  check('deregistered true', rgdel.json?.deregistered === true, JSON.stringify(rgdel.json));

  // ---- Donations ------------------------------------------------------------
  // Student records donation -> 201
  const dn = await req('POST', '/api/alumni/donations', sc, { amount: 5000, mode: 'UPI' });
  check('donation 201', dn.status === 201, JSON.stringify(dn.json));
  const donationId = dn.json.donationId;

  // Registrar report -> totals match
  const dnt = await req('GET', `/api/alumni/donations?schoolId=${SCHOOL}`, rc);
  check('donations get 200', dnt.status === 200, JSON.stringify(dnt.json));
  check('totals count >=1', dnt.json?.totals?.count >= 1, JSON.stringify(dnt.json?.totals));
  check('totals sum = 5000', dnt.json?.totals?.sum === 5000, `sum=${dnt.json?.totals?.sum}`);
  check(
    'donation listed with alumniName',
    Array.isArray(dnt.json?.donations) &&
    dnt.json.donations.some(
      (d: any) => d.id === donationId && d.alumniName.toLowerCase().includes('aarav')
    ),
    JSON.stringify(dnt.json?.donations)
  );

  // ---- Role enforcement -----------------------------------------------------
  // Student cannot create alumni records -> 403
  const st = await req('POST', '/api/alumni', sc, {
    schoolId: SCHOOL,
    studentId: AARAV_ID,
    email: 'aarav.alt@example.com',
  });
  check('student create alumni 403', st.status === 403, JSON.stringify(st.json));

  // FACULTY cannot view directory -> 403
  const fac = await login('sandeep.cse@srhu.edu.in');
  const fg = await req('GET', `/api/alumni?schoolId=${SCHOOL}`, fac.cookie);
  check('faculty get alumni 403', fg.status === 403, JSON.stringify(fg.json));

  await prisma.$disconnect();
  console.log(
    `\nSmoke results: ${failures === 0 ? 'ALL PASS' : failures + ' FAILURE(S)'}`
  );
  process.exit(failures === 0 ? 0 : 1);
})();

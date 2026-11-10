// ============================================================================
// CampusERP seed — real users with bcrypt password hashes.
// Keep emails/roles/schoolIds in sync with src/data/mockData.ts (DEMO_CREDENTIALS).
// Run with: npm run db:seed  (or npx prisma db seed)
// ============================================================================
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const PASSWORD = 'Password@2026';

const schools = [
  { id: 'sch_eng', name: 'School of Science & Technology (SST)', code: 'SST' },
  { id: 'sch_med', name: 'Himalayan Institute of Medical Sciences (HIMS)', code: 'HIMS' },
  { id: 'ALL', name: 'Swami Rama Himalayan University (Central)', code: 'SRHU' },
];

const users = [
  { email: 'sandeep.cse@srhu.edu.in', name: 'Dr. Sandeep Kumar', role: 'FACULTY', schoolId: 'sch_eng', departmentId: 'dept_sst_cse' },
  { email: 'sanjeev.path@srhu.edu.in', name: 'Dr. Sanjeev Kishore', role: 'FACULTY', schoolId: 'sch_med', departmentId: 'dept_hims_pathology' },
  { email: 'fo@srhu.edu.in', name: 'CA Avnish Shalya', role: 'FINANCE_OFFICER', schoolId: 'ALL' },
  { email: 'coe@srhu.edu.in', name: 'Prof. (Dr.) Archana Prakash', role: 'EXAM_CONTROLLER', schoolId: 'ALL' },
  { email: 'director.sst@srhu.edu.in', name: 'Prof. (Dr.) Pramod Kumar', role: 'DEAN', schoolId: 'sch_eng', position: 'HOD', departmentId: 'dept_sst_cse' },
  { email: 'dean.hims@srhu.edu.in', name: 'Prof. (Dr.) Ahamadulla Shariff', role: 'DEAN', schoolId: 'sch_med', position: 'HOD', departmentId: 'dept_hims_pathology' },
  { email: 'aarav.sharma@sst.srhu.edu.in', name: 'Aarav Sharma', role: 'STUDENT', schoolId: 'sch_eng' },
  { email: 'rohan.mbbs@srhu.edu.in', name: 'Rohan Rawat', role: 'STUDENT', schoolId: 'sch_med' },
  { email: 'registrar@srhu.edu.in', name: 'Cdr. Challa Venkateswar (Retd.)', role: 'REGISTRAR_ADMIN', schoolId: 'ALL' },
  // Org-module positions (Academic Governance)
  { email: 'meena.kapoor@srhu.edu.in', name: 'Dr. Meena Kapoor', role: 'FACULTY', schoolId: 'sch_eng', position: 'PROGRAM_COORDINATOR', departmentId: 'dept_sst_cse' },
  { email: 'dept.secretary@srhu.edu.in', name: 'Shweta Rana', role: 'REGISTRAR_ADMIN', schoolId: 'sch_eng', position: 'DEPARTMENT_SECRETARY', departmentId: 'dept_sst_cse' },
  { email: 'classcoord.cse@srhu.edu.in', name: 'Dr. Neha Verma', role: 'FACULTY', schoolId: 'sch_eng', position: 'CLASS_COORDINATOR', departmentId: 'dept_sst_cse' },
  // Dynamic RBAC: SUPER_ADMIN bootstrap account (central school). Role bypasses
  // all permission checks and is the sole manager of roles/permissions/officers.
  { email: 'admin@srhu.edu.in', name: 'System Administrator', role: 'SUPER_ADMIN', schoolId: 'ALL' },
];

// Programs (seeded for schools that exist here; mirrors src/data/mockData.ts
// PROGRAMS ids/intakes so the frontend program dropdown aligns).
const programs = [
  { id: 'prog_btech_cse', schoolId: 'sch_eng', name: 'B.Tech in Computer Science & Engineering', code: 'BTECH-CSE', durationYears: 4, totalSemesters: 8, degreeType: 'UG', currentIntake: 180 },
  { id: 'prog_btech_aiml', schoolId: 'sch_eng', name: 'B.Tech in Artificial Intelligence & Machine Learning', code: 'BTECH-AIML', durationYears: 4, totalSemesters: 8, degreeType: 'UG', currentIntake: 60 },
  { id: 'prog_mbbs', schoolId: 'sch_med', name: 'Bachelor of Medicine & Bachelor of Surgery', code: 'MBBS', durationYears: 5.5, totalSemesters: 9, degreeType: 'UG', currentIntake: 150 },
  { id: 'prog_bca', schoolId: 'sch_eng', name: 'Bachelor of Computer Applications', code: 'BCA', durationYears: 3, totalSemesters: 6, degreeType: 'UG', currentIntake: 90 },
];

// Courses for the seeded programs (Examination & Result module, Module 4).
// Idempotent: only inserted when a program has no courses yet; existing data is
// never overwritten.
const courses = [
  // B.Tech CSE (sch_eng)
  { programId: 'prog_btech_cse', schoolId: 'sch_eng', code: 'CSE101', title: 'Programming Fundamentals', credits: 4 },
  { programId: 'prog_btech_cse', schoolId: 'sch_eng', code: 'CSE102', title: 'Data Structures & Algorithms', credits: 4 },
  { programId: 'prog_btech_cse', schoolId: 'sch_eng', code: 'CSE201', title: 'Computer Networks', credits: 3 },
  { programId: 'prog_btech_cse', schoolId: 'sch_eng', code: 'CSE202', title: 'Operating Systems', credits: 3 },
  { programId: 'prog_btech_cse', schoolId: 'sch_eng', code: 'CSE301', title: 'Software Engineering', credits: 3 },
  // MBBS (sch_med)
  { programId: 'prog_mbbs', schoolId: 'sch_med', code: 'MBBS101', title: 'Human Anatomy', credits: 5 },
  { programId: 'prog_mbbs', schoolId: 'sch_med', code: 'MBBS102', title: 'Physiology', credits: 5 },
  { programId: 'prog_mbbs', schoolId: 'sch_med', code: 'MBBS201', title: 'Biochemistry', credits: 4 },
  { programId: 'prog_mbbs', schoolId: 'sch_med', code: 'MBBS202', title: 'Pathology', credits: 4 },
  { programId: 'prog_mbbs', schoolId: 'sch_med', code: 'MBBS301', title: 'Pharmacology', credits: 4 },
];

// Departments (Academic Governance & Organizational Structure). Idempotent —
// upserted by natural id.
const departments = [
  { id: 'dept_sst_cse', schoolId: 'sch_eng', name: 'Dept. of Computer Science & Engineering', code: 'CSE' },
  { id: 'dept_sst_me', schoolId: 'sch_eng', name: 'Dept. of Mechanical Engineering', code: 'ME' },
  { id: 'dept_hims_anatomy', schoolId: 'sch_med', name: 'Dept. of Anatomy', code: 'ANATOMY' },
  { id: 'dept_hims_physiology', schoolId: 'sch_med', name: 'Dept. of Physiology', code: 'PHYSIOLOGY' },
  { id: 'dept_hims_pathology', schoolId: 'sch_med', name: 'Dept. of Pathology', code: 'PATHOLOGY' },
];

// HOD assignments (HOD → department head). Must match HOD users in `users`.
const departmentHeads = [
  { departmentId: 'dept_sst_cse', email: 'director.sst@srhu.edu.in' },
  { departmentId: 'dept_hims_pathology', email: 'dean.hims@srhu.edu.in' },
];

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD, 12);

  for (const s of schools) {
    await prisma.school.upsert({
      where: { id: s.id },
      update: { name: s.name, code: s.code },
      create: { id: s.id, name: s.name, code: s.code },
    });
  }

  // Departments must exist before users reference them via departmentId.
  for (const d of departments) {
    await prisma.department.upsert({
      where: { id: d.id },
      update: { name: d.name, code: d.code, schoolId: d.schoolId },
      create: d,
    });
  }

  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {
        name: u.name,
        role: u.role,
        schoolId: u.schoolId,
        password: passwordHash,
        ...(u.position !== undefined ? { position: u.position } : {}),
        ...(u.departmentId ? { departmentId: u.departmentId } : {}),
      },
      create: {
        email: u.email,
        name: u.name,
        role: u.role,
        schoolId: u.schoolId,
        password: passwordHash,
        ...(u.position !== undefined ? { position: u.position } : {}),
        ...(u.departmentId ? { departmentId: u.departmentId } : {}),
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Dynamic RBAC: example custom roles (Module: RBAC expansion).
  // Permissions must be valid catalog strings (see ALL_PERMISSIONS in
  // src/lib/perms.ts). SQLite has no primitive lists, so permissions are stored
  // as a JSON string in `permissionsJson`. One global role + one school-scoped.
  // ---------------------------------------------------------------------------
  const customRoles = [
    {
      schoolId: null, // global role — usable for any user
      name: 'Hostel & Admissions Officer',
      description: 'Global custom role: hostel + admissions management.',
      permissionsJson: JSON.stringify(['hostel.manage', 'admissions.manage']),
    },
    {
      schoolId: 'sch_eng',
      name: 'SST Academic Coordinator',
      description: 'School-scoped role (SST) for academic coordination.',
      permissionsJson: JSON.stringify(['attendance.mark', 'attendance.view_all', 'marks.enter_draft', 'calendar.manage']),
    },
  ];

  let customRoleCount = 0;
  for (const r of customRoles) {
    const existingRole = await prisma.role.findFirst({
      where: { schoolId: r.schoolId, name: r.name },
    });
    if (existingRole) {
      await prisma.role.update({
        where: { id: existingRole.id },
        data: { description: r.description, permissionsJson: r.permissionsJson },
      });
    } else {
      await prisma.role.create({ data: r });
    }
    customRoleCount += 1;
  }

  // HOD heads (set after users exist)
  for (const h of departmentHeads) {
    const hod = await prisma.user.findUnique({ where: { email: h.email } });
    if (hod) {
      await prisma.department.update({
        where: { id: h.departmentId },
        data: { headUserId: hod.id },
      });
    }
  }

  for (const p of programs) {
    await prisma.program.upsert({
      where: { id: p.id },
      update: {
        schoolId: p.schoolId,
        name: p.name,
        code: p.code,
        durationYears: p.durationYears,
        totalSemesters: p.totalSemesters,
        degreeType: p.degreeType,
        currentIntake: p.currentIntake,
      },
      create: p,
    });
  }

  // ---------------------------------------------------------------------------
  // Module 2: Student Lifecycle seed (idempotent) — batches, students, enrollments
  // ---------------------------------------------------------------------------
  const batches = [
    { schoolId: 'sch_eng', name: 'BTECH-CSE-2024', academicYear: '2024-2025', programId: 'prog_btech_cse' },
    { schoolId: 'sch_eng', name: 'BTECH-AIML-2024', academicYear: '2024-2025', programId: 'prog_btech_aiml' },
    { schoolId: 'sch_med', name: 'MBBS-2024', academicYear: '2024-2025', programId: 'prog_mbbs' },
    { schoolId: 'sch_med', name: 'MBBS-2023', academicYear: '2023-2024', programId: 'prog_mbbs' },
  ];

  const batchByKey = {};
  for (const b of batches) {
    await prisma.batch.upsert({
      where: { schoolId_name: { schoolId: b.schoolId, name: b.name } },
      update: { academicYear: b.academicYear, programId: b.programId },
      create: b,
    });
    const rec = await prisma.batch.findFirst({
      where: { schoolId: b.schoolId, name: b.name },
      select: { id: true },
    });
    batchByKey[`${b.schoolId}|${b.name}`] = rec.id;
  }

  const students = [
    { schoolId: 'sch_eng', rollNo: 'BTECH-CSE-0001', firstName: 'Aarav', lastName: 'Sharma', email: 'aarav.sharma@sst.srhu.edu.in', phone: '9876500001', dob: '2005-03-12', gender: 'Male', category: 'GENERAL', programId: 'prog_btech_cse', batchName: 'BTECH-CSE-2024' },
    { schoolId: 'sch_eng', rollNo: 'BTECH-CSE-0002', firstName: 'Diya', lastName: 'Nair', email: 'diya.nair@sst.srhu.edu.in', phone: '9876500002', dob: '2005-07-21', gender: 'Female', category: 'OBC', programId: 'prog_btech_cse', batchName: 'BTECH-CSE-2024' },
    { schoolId: 'sch_eng', rollNo: 'BTECH-AIML-0001', firstName: 'Kabir', lastName: 'Mehta', email: 'kabir.mehta@sst.srhu.edu.in', phone: '9876500003', dob: '2004-11-02', gender: 'Male', category: 'GENERAL', programId: 'prog_btech_aiml', batchName: 'BTECH-AIML-2024' },
    { schoolId: 'sch_med', rollNo: 'MBBS-0001', firstName: 'Rohan', lastName: 'Rawat', email: 'rohan.mbbs@srhu.edu.in', phone: '9876500004', dob: '2004-01-15', gender: 'Male', category: 'GENERAL', programId: 'prog_mbbs', batchName: 'MBBS-2024' },
    { schoolId: 'sch_med', rollNo: 'MBBS-0002', firstName: 'Ananya', lastName: 'Joshi', email: 'ananya.joshi@srhu.edu.in', phone: '9876500005', dob: '2004-09-30', gender: 'Female', category: 'SC', programId: 'prog_mbbs', batchName: 'MBBS-2024' },
  ];

  let studentCount = 0;
  let enrollmentCount = 0;
  for (const s of students) {
    const batchId = batchByKey[`${s.schoolId}|${s.batchName}`];
    const { batchName, ...rest } = s;

    await prisma.student.upsert({
      where: { schoolId_email: { schoolId: s.schoolId, email: s.email } },
      update: { ...rest, batchId },
      create: { ...rest, batchId, status: 'ACTIVE' },
    });

    const rec = await prisma.student.findFirst({
      where: { schoolId: s.schoolId, email: s.email },
      select: { id: true, schoolId: true },
    });

    await prisma.enrollment.upsert({
      where: {
        schoolId_studentId_academicYear_semester: {
          schoolId: s.schoolId,
          studentId: rec.id,
          academicYear: '2024-2025',
          semester: 1,
        },
      },
      update: {},
      create: {
        schoolId: s.schoolId,
        studentId: rec.id,
        academicYear: '2024-2025',
        semester: 1,
      },
    });

    studentCount += 1;
    enrollmentCount += 1;
  }

  // ---------------------------------------------------------------------------
  // Module 3: Fees seed (idempotent) — one FeeStructure + one UNPAID Invoice
  // per program for an existing seeded student (programs without a student are
  // skipped). Source data for the fees tester: dues list will include these
  // unpaid invoices.
  // ---------------------------------------------------------------------------
  const FEES_YEAR = '2024-2025';
  const FEES_SEMESTER = 1;
  const feeComponents = [
    { name: 'Tuition Fee', amount: 45000 },
    { name: 'Examination Fee', amount: 5000 },
  ];
  const FEE_TOTAL = 50000;
  const invoiceYear = new Date().getFullYear();

  // invoiceNo/receiptNo are GLOBALLY unique in the DB, so the sequence is
  // computed across all schools (the seed runs on the base client) to avoid
  // cross-school collisions on the same year+seq.
  async function nextSeqFor(model, field, prefix) {
    const rows = await prisma[model].findMany({
      where: { [field]: { startsWith: prefix } },
      select: { [field]: true },
    });
    let max = 0;
    for (const r of rows) {
      const n = parseInt(String(r[field]).slice(prefix.length), 10);
      if (!Number.isNaN(n) && n > max) max = n;
    }
    return max + 1;
  }

  let feesStructures = 0;
  let feesInvoices = 0;
  for (const p of programs) {
    const firstStudent = await prisma.student.findFirst({
      where: { programId: p.id, schoolId: p.schoolId },
      select: { id: true },
    });
    if (!firstStudent) continue;

    let structure = await prisma.feeStructure.findFirst({
      where: { schoolId: p.schoolId, programId: p.id, academicYear: FEES_YEAR, semester: FEES_SEMESTER },
    });
    if (!structure) {
      structure = await prisma.feeStructure.create({
        data: {
          schoolId: p.schoolId,
          programId: p.id,
          academicYear: FEES_YEAR,
          semester: FEES_SEMESTER,
          componentsJson: JSON.stringify(feeComponents),
          totalAmount: FEE_TOTAL,
        },
      });
      feesStructures += 1;
    }

    const existingInvoice = await prisma.invoice.findFirst({
      where: { studentId: firstStudent.id, structureId: structure.id },
    });
    if (!existingInvoice) {
      const prefix = `INV-${invoiceYear}-`;
      const seq = await nextSeqFor('invoice', 'invoiceNo', prefix);
      await prisma.invoice.create({
        data: {
          schoolId: p.schoolId,
          studentId: firstStudent.id,
          structureId: structure.id,
          invoiceNo: `${prefix}${String(seq).padStart(6, '0')}`,
          amount: FEE_TOTAL,
          dueDate: new Date(`${invoiceYear}-07-31T00:00:00.000Z`),
          status: 'UNPAID',
          paidAmount: 0,
        },
      });
      feesInvoices += 1;
    }
  }

  // Courses (Examination & Result) — insert only when a program has none yet.
  let courseCount = 0;
  for (const c of courses) {
    const existing = await prisma.course.findFirst({
      where: { programId: c.programId, code: c.code },
    });
    if (!existing) {
      await prisma.course.create({ data: c });
      courseCount += 1;
    }
  }

  // ---------------------------------------------------------------------------
  // Academic Calendar & Timetable seed (deep core, idempotent)
  // ---------------------------------------------------------------------------
  const ACAD_YEAR = '2024-2025';
  const ACAD_SEMESTER = 1;
  const SST = 'sch_eng';

  const sandeep = await prisma.user.findUnique({ where: { email: 'sandeep.cse@srhu.edu.in' } });
  const meena = await prisma.user.findUnique({ where: { email: 'meena.kapoor@srhu.edu.in' } });
  const classCoord = await prisma.user.findUnique({ where: { email: 'classcoord.cse@srhu.edu.in' } });

  // Point the B.Tech CSE program at its coordinator (program-coordinator scope).
  if (meena) {
    await prisma.program.update({
      where: { id: 'prog_btech_cse' },
      data: { coordinatorUserId: meena.id },
    });
  }

  // One class group for B.Tech CSE 2024 (batch A) with a class coordinator.
  const batchId = batchByKey[`${SST}|BTECH-CSE-2024`];
  let classGroup = null;
  if (batchId) {
    classGroup = await prisma.classGroup.findUnique({
      where: {
        programId_batchId_section: {
          programId: 'prog_btech_cse',
          batchId,
          section: 'A',
        },
      },
    });
    if (!classGroup) {
      classGroup = await prisma.classGroup.create({
        data: {
          schoolId: SST,
          programId: 'prog_btech_cse',
          batchId,
          section: 'A',
          coordinatorUserId: classCoord ? classCoord.id : null,
        },
      });
    }
  }

  // Course–faculty allocations for that class group (semester 1).
  let allocationsAdded = 0;
  if (classGroup && sandeep) {
    for (const code of ['CSE101', 'CSE102']) {
      const course = await prisma.course.findFirst({
        where: { programId: 'prog_btech_cse', code },
        select: { id: true },
      });
      if (!course) continue;
      const exists = await prisma.facultyAllocation.findUnique({
        where: {
          courseId_classGroupId_semester_academicYear: {
            courseId: course.id,
            classGroupId: classGroup.id,
            semester: ACAD_SEMESTER,
            academicYear: ACAD_YEAR,
          },
        },
      });
      if (!exists) {
        await prisma.facultyAllocation.create({
          data: {
            schoolId: SST,
            departmentId: 'dept_sst_cse',
            courseId: course.id,
            classGroupId: classGroup.id,
            facultyUserId: sandeep.id,
            semester: ACAD_SEMESTER,
            academicYear: ACAD_YEAR,
          },
        });
        allocationsAdded += 1;
      }
    }
  }

  // Academic events (calendar) for sch_eng.
  const events = [
    { title: 'Odd Semester Begins', type: 'EVENT', startDate: new Date('2024-07-22T00:00:00.000Z') },
    { title: 'Independence Day', type: 'HOLIDAY', startDate: new Date('2024-08-15T00:00:00.000Z') },
    {
      title: 'End-Semester Examinations',
      type: 'EXAM',
      startDate: new Date('2024-12-09T00:00:00.000Z'),
      endDate: new Date('2024-12-20T00:00:00.000Z'),
    },
    { title: 'Fee Payment Deadline', type: 'DEADLINE', startDate: new Date('2024-08-31T00:00:00.000Z') },
  ];
  let eventsAdded = 0;
  for (const ev of events) {
    const existsEvent = await prisma.academicEvent.findFirst({
      where: { schoolId: SST, title: ev.title, startDate: ev.startDate },
    });
    if (!existsEvent) {
      await prisma.academicEvent.create({ data: { schoolId: SST, ...ev } });
      eventsAdded += 1;
    }
  }

  // Weekly timetable slots for the B.Tech CSE 2024-A class group (semester 1).
  let slotsAdded = 0;
  if (classGroup && sandeep) {
    const cse101 = await prisma.course.findFirst({
      where: { programId: 'prog_btech_cse', code: 'CSE101' },
      select: { id: true },
    });
    const cse102 = await prisma.course.findFirst({
      where: { programId: 'prog_btech_cse', code: 'CSE102' },
      select: { id: true },
    });
    const slots = [
      { dayOfWeek: 1, startTime: '09:00', endTime: '10:00', course: cse101, room: 'LT-101' },
      { dayOfWeek: 2, startTime: '10:00', endTime: '11:00', course: cse102, room: 'LT-102' },
    ];
    for (const s of slots) {
      if (!s.course) continue;
      const existsSlot = await prisma.timetableSlot.findFirst({
        where: {
          schoolId: SST,
          classGroupId: classGroup.id,
          dayOfWeek: s.dayOfWeek,
          startTime: s.startTime,
        },
      });
      if (!existsSlot) {
        await prisma.timetableSlot.create({
          data: {
            schoolId: SST,
            classGroupId: classGroup.id,
            dayOfWeek: s.dayOfWeek,
            startTime: s.startTime,
            endTime: s.endTime,
            courseId: s.course.id,
            facultyUserId: sandeep.id,
            room: s.room,
            semester: ACAD_SEMESTER,
            academicYear: ACAD_YEAR,
          },
        });
        slotsAdded += 1;
      }
    }
  }

  console.log(
    `Seeded ${schools.length} schools, ${users.length} users (hashed password), ${programs.length} programs, ` +
    `${departments.length} departments, ${batches.length} batches, ${studentCount} students, ${enrollmentCount} enrollments, ` +
    `${feesStructures} fee structures, ${feesInvoices} invoices. ` +
    `${courseCount > 0 ? `${courseCount} courses added (examination module). ` : 'Courses already present (skipped). '}` +
    `Academic: ${eventsAdded} events, ${allocationsAdded} allocations, ${slotsAdded} timetable slots added (if any).`
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

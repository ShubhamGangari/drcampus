// ============================================================================
// CampusERP synthetic 2026-batch seed.
// Generates realistic demo data for testing, roughly 60+ students per program
// with Indian names, per-program subjects (courses), and faculty assignments.
//
// Programs seeded: B.Tech CSE, B.Tech AIML, BCA (SST) and MBBS (HIMS).
// Students are linked to 2026 batches (academic year 2026-2027), enrolled in
// semester 1, and each program has its own subject set mapped to faculty via
// FacultyAllocation + TimetableSlot rows.
//
// Idempotent — re-running merges/updates instead of duplicating.
// Run with: npm run db:seed:2026  (npx prisma db seed -- --2026 also works)
// ============================================================================
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();
const PASSWORD = 'Password@2026';

const ACAD_YEAR = '2026-2027';
const SEMESTER = 1;
const STUDENTS_PER_PROGRAM = 64; // 60+ per program as requested

// ---------------------------------------------------------------------------
// Deterministic name pools (Indian names). Index-based selection keeps the
// seed reproducible between runs. 64+ students per program never exhaust pools.
// ---------------------------------------------------------------------------
const MALE_FIRST = [
    'Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Reyansh', 'Krishna', 'Ishaan', 'Shaurya', 'Atharv',
    'Kabir', 'Darsh', 'Ayaan', 'Aarush', 'Arnav', 'Rudra', 'Yash', 'Rohan', 'Dhruv', 'Reyaan',
    'Parth', 'Ansh', 'Aariz', 'Veer', 'Yug', 'Kartik', 'Advaith', 'Ritvik', 'Neil', 'Angad',
    'Sai', 'Dev', 'Tanish', 'Nakul', 'Raghav', 'Adhrit', 'Anay', 'Mitul', 'Ved', 'Kiaan',
    'Aarav', 'Vedant', 'Aaryan', 'Laksh', 'Rachit', 'Ivaan', 'Pranav', 'Virat', 'Ahaan', 'Aarnav',
    'Shaan', 'Krishiv', 'Zain', 'Aaradhya', 'Jai', 'Nirvaan', 'Harsh', 'Ishaan', 'Manan', 'Ojas',
    'Purav', 'Riaan', 'Sahil', 'Uday', 'Vansh', 'Yuvraj', 'Ishan', 'Kunal', 'Mihir', 'Nikhil',
];
const FEMALE_FIRST = [
    'Aadhya', 'Aarohi', 'Ananya', 'Anika', 'Anvi', 'Aria', 'Avni', 'Bhavya', 'Charvi', 'Diya',
    'Eva', 'Gauri', 'Ira', 'Ishita', 'Jiya', 'Kavya', 'Krishna', 'Lavanya', 'Maahi', 'Myra',
    'Navya', 'Nysa', 'Pari', 'Prisha', 'Riya', 'Ruhi', 'Saanvi', 'Sanvi', 'Sara', 'Shanaya',
    'Shreya', 'Siya', 'Sneha', 'Tara', 'Vanya', 'Veda', 'Yashvi', 'Zara', 'Aanya', 'Akshara',
    'Aneka', 'Arundhati', 'Bhumika', 'Chandni', 'Damini', 'Ekta', 'Gargi', 'Himani', 'Ira', 'Jhanvi',
    'Kajal', 'Lakshita', 'Meera', 'Nandini', 'Ojasvi', 'Pihu', 'Qurat', 'Ritika', 'Sakshi', 'Tanvi',
    'Unnati', 'Vaishnavi', 'Yukti', 'Zoya', 'Anushka', 'Devika', 'Gunjan', 'Hetal', 'Ipsita', 'Jyoti',
];
const LAST_NAMES = [
    'Sharma', 'Verma', 'Gupta', 'Kumar', 'Singh', 'Nair', 'Iyer', 'Patel', 'Mehta', 'Joshi',
    'Rawat', 'Bhatt', 'Joshi', 'Thakur', 'Yadav', 'Chauhan', 'Rana', 'Khanduri', 'Negi', 'Gusain',
    'Bisht', 'Rautela', 'Semwal', 'Purohit', 'Dobhal', 'Kandari', 'Uniyal', 'Panwar', 'Bhandari', 'Tiwari',
    'Pandey', 'Mishra', 'Dubey', 'Shukla', 'Tripathi', 'Saxena', 'Khanna', 'Malhotra', 'Mehra', 'Chopra',
    'Kapoor', 'Ahuja', 'Sethi', 'Batra', 'Arora', 'Bajaj', 'Juneja', 'Kohli', 'Sachdeva', 'Tandon',
    'Oberoi', 'Sodhi', 'Gill', 'Mann', 'Dhillon', 'Brar', 'Saini', 'Grewal', 'Toor', 'Sidhu',
    'Anand', 'Chawla', 'Grover', 'Sehgal', 'Wadhwa', 'Goswami', 'Rastogi', 'Srivastava', 'Vaish', 'Narang',
];

// Gender assignment is deterministic by index (alternating, mostly male/female mix).
function genderFor(i) {
    return i % 2 === 0 ? 'Male' : 'Female';
}
function firstNameFor(i) {
    return genderFor(i) === 'Male' ? MALE_FIRST[i % MALE_FIRST.length] : FEMALE_FIRST[i % FEMALE_FIRST.length];
}
function lastNameFor(i) {
    return LAST_NAMES[(i * 7 + 3) % LAST_NAMES.length];
}
function slugBase(s) {
    return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '');
}
// Globally-unique, realistic-looking email.
function emailFor(program, i) {
    const fn = slugBase(firstNameFor(i));
    const ln = slugBase(lastNameFor(i));
    const seq = String(i + 1).padStart(3, '0');
    if (program.schoolId === 'sch_med') {
        return `${fn}.${ln}${seq}@srhu.edu.in`;
    }
    return `${fn}.${ln}${seq}@sst.srhu.edu.in`;
}
function dobFor(i) {
    const month = String(((i * 5) % 12) + 1).padStart(2, '0');
    const day = String(((i * 13) % 28) + 1).padStart(2, '0');
    return `2008-${month}-${day}`;
}
function rollFor(program, i) {
    const seq = String(i + 1).padStart(4, '0');
    return `${program.rollPrefix}-${seq}`;
}

// ---------------------------------------------------------------------------
// Program metadata mirrors the seed in prisma/seed.js; rollPrefix is local.
// ---------------------------------------------------------------------------
const PROGRAMS = [
    { id: 'prog_btech_cse', schoolId: 'sch_eng', batchName: 'BTECH-CSE-2026', rollPrefix: '26BTECH-CSE', deptId: 'dept_sst_cse' },
    { id: 'prog_btech_aiml', schoolId: 'sch_eng', batchName: 'BTECH-AIML-2026', rollPrefix: '26AIML', deptId: 'dept_sst_cse' },
    { id: 'prog_bca', schoolId: 'sch_eng', batchName: 'BCA-2026', rollPrefix: '26BCA', deptId: 'dept_sst_cse' },
    { id: 'prog_mbbs', schoolId: 'sch_med', batchName: 'MBBS-2026', rollPrefix: '26MBBS', deptId: 'dept_hims_pathology' },
];

// Subjects (courses) per program for semester 1 — code, title, credits.
const PROGRAM_COURSES = {
    prog_btech_cse: [
        { code: 'CSE101', title: 'Programming Fundamentals', credits: 4 },
        { code: 'CSE102', title: 'Data Structures & Algorithms', credits: 4 },
        { code: 'MA101', title: 'Engineering Mathematics-I', credits: 4 },
        { code: 'PH101', title: 'Engineering Physics', credits: 3 },
        { code: 'EN101', title: 'English Communication', credits: 2 },
    ],
    prog_btech_aiml: [
        { code: 'AIML101', title: 'Introduction to Artificial Intelligence', credits: 4 },
        { code: 'AIML102', title: 'Python for Machine Learning', credits: 4 },
        { code: 'MA101', title: 'Engineering Mathematics-I', credits: 4 },
        { code: 'STAT101', title: 'Probability & Statistics', credits: 3 },
        { code: 'AIML103', title: 'Foundations of Data Science', credits: 3 },
    ],
    prog_bca: [
        { code: 'BCA101', title: 'Computer Fundamentals', credits: 3 },
        { code: 'BCA102', title: 'Programming in C', credits: 4 },
        { code: 'BCA103', title: 'Business Mathematics', credits: 3 },
        { code: 'BCA104', title: 'Professional Communication', credits: 2 },
    ],
    prog_mbbs: [
        { code: 'MBBS101', title: 'Human Anatomy', credits: 5 },
        { code: 'MBBS102', title: 'Physiology', credits: 5 },
        { code: 'MBBS103', title: 'Biochemistry', credits: 4 },
        { code: 'MBBS104', title: 'Community Medicine', credits: 3 },
    ],
};

// Faculty per school (created as FACULTY users). course -> faculty mapping keys
// by course code so a course is assigned to a realistic subject-specific teacher.
const SST_FACULTY = [
    { email: 'rajesh.tiwari@srhu.edu.in', name: 'Dr. Rajesh Tiwari', position: 'SUBJECT_TEACHER' },
    { email: 'priya.sharma@srhu.edu.in', name: 'Dr. Priya Sharma', position: 'SUBJECT_TEACHER' },
    { email: 'amit.verma@srhu.edu.in', name: 'Dr. Amit Verma', position: 'SUBJECT_TEACHER' },
    { email: 'sneha.patel@srhu.edu.in', name: 'Dr. Sneha Patel', position: 'SUBJECT_TEACHER' },
    { email: 'vikram.singh@srhu.edu.in', name: 'Prof. Vikram Singh', position: 'SUBJECT_TEACHER' },
    { email: 'kavita.nair@srhu.edu.in', name: 'Ms. Kavita Nair', position: 'SUBJECT_TEACHER' },
];
const HIMS_FACULTY = [
    { email: 'preeti.rana@srhu.edu.in', name: 'Dr. Preeti Rana', position: 'SUBJECT_TEACHER' },
    { email: 'manoj.bhatt@srhu.edu.in', name: 'Dr. Manoj Bhatt', position: 'SUBJECT_TEACHER' },
    { email: 'sunita.joshi@srhu.edu.in', name: 'Dr. Sunita Joshi', position: 'SUBJECT_TEACHER' },
    { email: 'karan.negi@srhu.edu.in', name: 'Dr. Karan Negi', position: 'SUBJECT_TEACHER' },
];

// Course code -> faculty index within the school's faculty pool.
const COURSE_FACULTY = {
    CSE101: 0, CSE102: 1, MA101: 3, PH101: 4, EN101: 5,
    AIML101: 2, AIML102: 2, STAT101: 3, AIML103: 2,
    BCA101: 5, BCA102: 0, BCA103: 3, BCA104: 5,
    MBBS101: 0, MBBS102: 1, MBBS103: 2, MBBS104: 3,
};

async function main() {
    const passwordHash = await bcrypt.hash(PASSWORD, 12);

    let facultyCount = 0;
    let batchCount = 0;
    let studentCount = 0;
    let enrollmentCount = 0;
    let courseCount = 0;
    let allocationCount = 0;
    let slotCount = 0;

    // -- Faculty users (upsert by email, idempotent) ---------------------------
    const facultyBySchool = { sch_eng: [], sch_med: [] };
    async function ensureFaculty(pool, schoolId, deptId) {
        for (const f of pool) {
            await prisma.user.upsert({
                where: { email: f.email },
                update: { name: f.name, role: 'FACULTY', schoolId, position: f.position, departmentId: deptId, password: passwordHash },
                create: { email: f.email, name: f.name, role: 'FACULTY', schoolId, position: f.position, departmentId: deptId, password: passwordHash, active: true },
            });
            const rec = await prisma.user.findUnique({ where: { email: f.email }, select: { id: true } });
            facultyBySchool[schoolId].push({ id: rec.id, email: f.email });
            facultyCount += 1;
        }
    }
    await ensureFaculty(SST_FACULTY, 'sch_eng', 'dept_sst_cse');
    await ensureFaculty(HIMS_FACULTY, 'sch_med', 'dept_hims_pathology');

    // -- Per program: batch, class group, students, courses, allocations --------
    for (const prog of PROGRAMS) {
        const program = await prisma.program.findUnique({ where: { id: prog.id } });
        if (!program) {
            console.warn(`  skip: program ${prog.id} not found — run db:seed first`);
            continue;
        }

        // Batch (2026)
        await prisma.batch.upsert({
            where: { schoolId_name: { schoolId: prog.schoolId, name: prog.batchName } },
            update: { academicYear: ACAD_YEAR, programId: prog.id },
            create: { schoolId: prog.schoolId, name: prog.batchName, academicYear: ACAD_YEAR, programId: prog.id },
        });
        const batch = await prisma.batch.findFirst({
            where: { schoolId: prog.schoolId, name: prog.batchName },
            select: { id: true },
        });
        batchCount += 1;

        // Class group section A (coordinator = first faculty in the school pool)
        const coordinator = facultyBySchool[prog.schoolId][0];
        await prisma.classGroup.upsert({
            where: {
                programId_batchId_section: { programId: prog.id, batchId: batch.id, section: 'A' },
            },
            update: { coordinatorUserId: coordinator ? coordinator.id : null },
            create: {
                schoolId: prog.schoolId,
                programId: prog.id,
                batchId: batch.id,
                section: 'A',
                coordinatorUserId: coordinator ? coordinator.id : null,
            },
        });
        const classGroup = await prisma.classGroup.findUnique({
            where: {
                programId_batchId_section: { programId: prog.id, batchId: batch.id, section: 'A' },
            },
            select: { id: true },
        });

        // Courses / subjects (skip if program already has courses)
        const existingCourse = await prisma.course.findFirst({ where: { programId: prog.id } });
        const courseIds = {};
        if (!existingCourse) {
            for (const c of PROGRAM_COURSES[prog.id]) {
                const created = await prisma.course.create({
                    data: { schoolId: prog.schoolId, programId: prog.id, code: c.code, title: c.title, credits: c.credits, semester: SEMESTER, type: 'CORE' },
                });
                courseIds[c.code] = created.id;
                courseCount += 1;
            }
        } else {
            for (const c of PROGRAM_COURSES[prog.id]) {
                const row = await prisma.course.findFirst({ where: { programId: prog.id, code: c.code }, select: { id: true } });
                if (row) courseIds[c.code] = row.id;
            }
        }

        // Students (+ enrollment semester 1)
        for (let i = 0; i < STUDENTS_PER_PROGRAM; i += 1) {
            const firstName = firstNameFor(i);
            const lastName = lastNameFor(i);
            const email = emailFor(prog, i);
            const dob = dobFor(i);
            const rollNo = rollFor(prog, i);

            await prisma.student.upsert({
                where: { schoolId_email: { schoolId: prog.schoolId, email } },
                update: {
                    rollNo, programId: prog.id, batchId: batch.id,
                    firstName, lastName, phone: `9${String(7600000000 + ((i * 1234567) % 2000000000)).slice(0, 9)}`,
                    dob, gender: genderFor(i), category: i % 5 === 0 ? 'SC' : i % 7 === 0 ? 'OBC' : 'GENERAL',
                    status: 'ACTIVE', admissionDate: new Date('2026-07-15T00:00:00.000Z'),
                },
                create: {
                    schoolId: prog.schoolId, rollNo, programId: prog.id, batchId: batch.id,
                    firstName, lastName, email, phone: `9${String(7600000000 + ((i * 1234567) % 2000000000)).slice(0, 9)}`,
                    dob, gender: genderFor(i), category: i % 5 === 0 ? 'SC' : i % 7 === 0 ? 'OBC' : 'GENERAL',
                    status: 'ACTIVE', admissionDate: new Date('2026-07-15T00:00:00.000Z'),
                },
            });

            const student = await prisma.student.findFirst({
                where: { schoolId: prog.schoolId, email },
                select: { id: true },
            });

            await prisma.enrollment.upsert({
                where: {
                    schoolId_studentId_academicYear_semester: {
                        schoolId: prog.schoolId, studentId: student.id, academicYear: ACAD_YEAR, semester: SEMESTER,
                    },
                },
                update: {},
                create: { schoolId: prog.schoolId, studentId: student.id, academicYear: ACAD_YEAR, semester: SEMESTER },
            });

            studentCount += 1;
            enrollmentCount += 1;

            // Login account for the first B.Tech CSE 2026 student (demo credential).
            if (prog.id === 'prog_btech_cse' && i === 0) {
                await prisma.user.upsert({
                    where: { email },
                    update: {
                        name: `${firstName} ${lastName}`, role: 'STUDENT',
                        schoolId: prog.schoolId, password: passwordHash,
                    },
                    create: {
                        email, name: `${firstName} ${lastName}`, role: 'STUDENT',
                        schoolId: prog.schoolId, password: passwordHash, active: true,
                    },
                });

                // Parent account linked to this student (demo credential).
                const parentEmail = 'parent.kumar001@srhu.edu.in';
                await prisma.user.upsert({
                    where: { email: parentEmail },
                    update: { name: 'Mr. Rakesh Kumar', role: 'PARENT', schoolId: prog.schoolId, password: passwordHash },
                    create: { email: parentEmail, name: 'Mr. Rakesh Kumar', role: 'PARENT', schoolId: prog.schoolId, password: passwordHash, active: true },
                });
                const parent = await prisma.user.findUnique({ where: { email: parentEmail }, select: { id: true } });
                if (parent) {
                    await prisma.parentStudentLink.upsert({
                        where: {
                            schoolId_parentUserId_studentId: {
                                schoolId: prog.schoolId, parentUserId: parent.id, studentId: student.id,
                            },
                        },
                        update: {},
                        create: { schoolId: prog.schoolId, parentUserId: parent.id, studentId: student.id },
                    });
                }
            }
        }

        // Faculty allocations + timetable slots for each course in the program
        const facultyPool = facultyBySchool[prog.schoolId];
        for (const c of PROGRAM_COURSES[prog.id]) {
            const courseId = courseIds[c.code];
            if (!courseId) continue;
            const facIndex = COURSE_FACULTY[c.code] ?? 0;
            const faculty = facultyPool[facIndex % facultyPool.length];
            if (!faculty) continue;

            const allocKey = { courseId, classGroupId: classGroup.id, semester: SEMESTER, academicYear: ACAD_YEAR };
            const existsAlloc = await prisma.facultyAllocation.findUnique({ where: { courseId_classGroupId_semester_academicYear: allocKey } });
            if (!existsAlloc) {
                await prisma.facultyAllocation.create({
                    data: {
                        schoolId: prog.schoolId, departmentId: prog.deptId, courseId,
                        classGroupId: classGroup.id, facultyUserId: faculty.id,
                        semester: SEMESTER, academicYear: ACAD_YEAR,
                    },
                });
                allocationCount += 1;
            }

            const dayOfWeek = (Object.keys(PROGRAM_COURSES[prog.id]).indexOf(c.code) % 5) + 1;
            const startTime = `09:${String(0 + ((c.credits % 3) * 15)).padStart(2, '0')}`;
            const existsSlot = await prisma.timetableSlot.findFirst({
                where: { schoolId: prog.schoolId, classGroupId: classGroup.id, dayOfWeek, startTime },
            });
            if (!existsSlot) {
                await prisma.timetableSlot.create({
                    data: {
                        schoolId: prog.schoolId, classGroupId: classGroup.id, dayOfWeek,
                        startTime, endTime: '10:00', courseId, facultyUserId: faculty.id,
                        room: `LT-${10 + dayOfWeek}`, semester: SEMESTER, academicYear: ACAD_YEAR,
                    },
                });
                slotCount += 1;
            }
        }
    }

    console.log(
        `2026-batch seed done: ${facultyCount} faculty, ${batchCount} batches, ${studentCount} students, ` +
        `${enrollmentCount} enrollments, ${courseCount} subjects, ${allocationCount} faculty allocations, ${slotCount} timetable slots.`
    );
}

main()
    .then(() => prisma.$disconnect())
    .catch(async (e) => {
        console.error(e);
        await prisma.$disconnect();
        process.exit(1);
    });

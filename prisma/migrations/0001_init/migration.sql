-- CreateTable
CREATE TABLE "School" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "position" TEXT,
    "departmentId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "User_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "User_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AdmissionCycle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Program" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "durationYears" REAL NOT NULL,
    "totalSemesters" INTEGER NOT NULL,
    "degreeType" TEXT NOT NULL,
    "currentIntake" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "coordinatorUserId" TEXT,
    CONSTRAINT "Program_coordinatorUserId_fkey" FOREIGN KEY ("coordinatorUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MeritList" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "totalRanked" INTEGER NOT NULL,
    "publishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Application" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "applicationNo" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "applicantName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "gender" TEXT NOT NULL,
    "dob" DATETIME NOT NULL,
    "category" TEXT NOT NULL,
    "marksPercentage" REAL NOT NULL,
    "documentsJson" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "meritRank" INTEGER,
    "remarks" TEXT,
    "seatAllocated" BOOLEAN NOT NULL DEFAULT false,
    "provisionalRollNo" TEXT,
    "quotaCategory" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Application_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "AdmissionCycle" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Batch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Batch_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Student" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "rollNo" TEXT NOT NULL,
    "admissionId" TEXT,
    "programId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "dob" TEXT NOT NULL,
    "gender" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "admissionDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "graduationDate" DATETIME,
    "degreeAwarded" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Student_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Student_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Enrollment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "semester" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ENROLLED',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Enrollment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AttendanceRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "LeaveRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "fromDate" TEXT NOT NULL,
    "toDate" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "remarks" TEXT,
    "requestedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LeaveRequest_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TransferRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "fromProgramId" TEXT NOT NULL,
    "toProgramId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "remarks" TEXT,
    "requestedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TransferRequest_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FeeStructure" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "semester" INTEGER NOT NULL,
    "componentsJson" TEXT NOT NULL,
    "totalAmount" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "structureId" TEXT NOT NULL,
    "invoiceNo" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "dueDate" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'UNPAID',
    "paidAmount" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "mode" TEXT NOT NULL,
    "transactionRef" TEXT,
    "receiptNo" TEXT NOT NULL,
    "idempotencyKey" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Course" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "credits" REAL NOT NULL
);

-- CreateTable
CREATE TABLE "Exam" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "semester" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "maxInternal" REAL NOT NULL,
    "maxExternal" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "publishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ExamSchedule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "examDate" DATETIME NOT NULL,
    "startTime" TEXT NOT NULL,
    "venue" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "HallTicket" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "hallTicketNo" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "MarksEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "internalMarks" REAL NOT NULL,
    "externalMarks" REAL NOT NULL,
    "totalMarks" REAL NOT NULL,
    "grade" TEXT,
    "enteredBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ProgramOutcome" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "CourseOutcome" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "COPOMapping" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "coId" TEXT NOT NULL,
    "poId" TEXT NOT NULL,
    "weight" REAL NOT NULL
);

-- CreateTable
CREATE TABLE "COAttainment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "coId" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "attainment" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "HostelRoom" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "roomNo" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "HostelAllocation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "allocatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vacatedAt" DATETIME
);

-- CreateTable
CREATE TABLE "MessBill" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "paid" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "HostelComplaint" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "designation" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "EmployeeLeave" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "fromDate" DATETIME NOT NULL,
    "toDate" DATETIME NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Payroll" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "gross" REAL NOT NULL,
    "deductions" REAL NOT NULL,
    "net" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'GENERATED',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Alumni" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "currentCompany" TEXT,
    "batch" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AlumniEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "location" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AlumniRegistration" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "alumniId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AlumniDonation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "alumniId" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "mode" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "headUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Department_headUserId_fkey" FOREIGN KEY ("headUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ClassGroup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "coordinatorUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ClassGroup_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ClassGroup_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ClassGroup_coordinatorUserId_fkey" FOREIGN KEY ("coordinatorUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FacultyAllocation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "departmentId" TEXT,
    "courseId" TEXT NOT NULL,
    "classGroupId" TEXT NOT NULL,
    "facultyUserId" TEXT NOT NULL,
    "semester" INTEGER NOT NULL,
    "academicYear" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FacultyAllocation_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "FacultyAllocation_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FacultyAllocation_classGroupId_fkey" FOREIGN KEY ("classGroupId") REFERENCES "ClassGroup" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FacultyAllocation_facultyUserId_fkey" FOREIGN KEY ("facultyUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AcademicEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "programId" TEXT,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AcademicEvent_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TimetableSlot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "classGroupId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "facultyUserId" TEXT NOT NULL,
    "room" TEXT,
    "semester" INTEGER NOT NULL,
    "academicYear" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TimetableSlot_classGroupId_fkey" FOREIGN KEY ("classGroupId") REFERENCES "ClassGroup" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TimetableSlot_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TimetableSlot_facultyUserId_fkey" FOREIGN KEY ("facultyUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "School_code_key" ON "School"("code");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_schoolId_idx" ON "User"("schoolId");

-- CreateIndex
CREATE INDEX "AdmissionCycle_schoolId_idx" ON "AdmissionCycle"("schoolId");

-- CreateIndex
CREATE INDEX "Program_schoolId_idx" ON "Program"("schoolId");

-- CreateIndex
CREATE INDEX "Program_schoolId_code_idx" ON "Program"("schoolId", "code");

-- CreateIndex
CREATE INDEX "MeritList_schoolId_idx" ON "MeritList"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "MeritList_cycleId_programId_key" ON "MeritList"("cycleId", "programId");

-- CreateIndex
CREATE UNIQUE INDEX "Application_applicationNo_key" ON "Application"("applicationNo");

-- CreateIndex
CREATE INDEX "Application_schoolId_cycleId_idx" ON "Application"("schoolId", "cycleId");

-- CreateIndex
CREATE INDEX "Application_schoolId_programId_idx" ON "Application"("schoolId", "programId");

-- CreateIndex
CREATE INDEX "Application_status_idx" ON "Application"("status");

-- CreateIndex
CREATE INDEX "Batch_schoolId_idx" ON "Batch"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "Batch_schoolId_name_key" ON "Batch"("schoolId", "name");

-- CreateIndex
CREATE INDEX "Student_schoolId_idx" ON "Student"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "Student_schoolId_rollNo_key" ON "Student"("schoolId", "rollNo");

-- CreateIndex
CREATE UNIQUE INDEX "Student_schoolId_email_key" ON "Student"("schoolId", "email");

-- CreateIndex
CREATE INDEX "Enrollment_schoolId_idx" ON "Enrollment"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "Enrollment_schoolId_studentId_academicYear_semester_key" ON "Enrollment"("schoolId", "studentId", "academicYear", "semester");

-- CreateIndex
CREATE INDEX "AttendanceRecord_schoolId_courseId_idx" ON "AttendanceRecord"("schoolId", "courseId");

-- CreateIndex
CREATE INDEX "AttendanceRecord_schoolId_studentId_idx" ON "AttendanceRecord"("schoolId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceRecord_schoolId_courseId_studentId_date_key" ON "AttendanceRecord"("schoolId", "courseId", "studentId", "date");

-- CreateIndex
CREATE INDEX "LeaveRequest_schoolId_idx" ON "LeaveRequest"("schoolId");

-- CreateIndex
CREATE INDEX "TransferRequest_schoolId_idx" ON "TransferRequest"("schoolId");

-- CreateIndex
CREATE INDEX "FeeStructure_schoolId_idx" ON "FeeStructure"("schoolId");

-- CreateIndex
CREATE INDEX "FeeStructure_schoolId_programId_idx" ON "FeeStructure"("schoolId", "programId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_invoiceNo_key" ON "Invoice"("invoiceNo");

-- CreateIndex
CREATE INDEX "Invoice_schoolId_studentId_idx" ON "Invoice"("schoolId", "studentId");

-- CreateIndex
CREATE INDEX "Invoice_schoolId_status_idx" ON "Invoice"("schoolId", "status");

-- CreateIndex
CREATE INDEX "Invoice_schoolId_structureId_idx" ON "Invoice"("schoolId", "structureId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_receiptNo_key" ON "Payment"("receiptNo");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_idempotencyKey_key" ON "Payment"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Payment_schoolId_invoiceId_idx" ON "Payment"("schoolId", "invoiceId");

-- CreateIndex
CREATE INDEX "Course_schoolId_programId_idx" ON "Course"("schoolId", "programId");

-- CreateIndex
CREATE INDEX "Exam_schoolId_programId_idx" ON "Exam"("schoolId", "programId");

-- CreateIndex
CREATE INDEX "Exam_schoolId_status_idx" ON "Exam"("schoolId", "status");

-- CreateIndex
CREATE INDEX "ExamSchedule_schoolId_examId_idx" ON "ExamSchedule"("schoolId", "examId");

-- CreateIndex
CREATE UNIQUE INDEX "ExamSchedule_schoolId_examId_courseId_key" ON "ExamSchedule"("schoolId", "examId", "courseId");

-- CreateIndex
CREATE UNIQUE INDEX "HallTicket_hallTicketNo_key" ON "HallTicket"("hallTicketNo");

-- CreateIndex
CREATE INDEX "HallTicket_schoolId_studentId_idx" ON "HallTicket"("schoolId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "HallTicket_schoolId_examId_studentId_key" ON "HallTicket"("schoolId", "examId", "studentId");

-- CreateIndex
CREATE INDEX "MarksEntry_schoolId_examId_idx" ON "MarksEntry"("schoolId", "examId");

-- CreateIndex
CREATE UNIQUE INDEX "MarksEntry_schoolId_examId_scheduleId_studentId_key" ON "MarksEntry"("schoolId", "examId", "scheduleId", "studentId");

-- CreateIndex
CREATE INDEX "ProgramOutcome_schoolId_programId_idx" ON "ProgramOutcome"("schoolId", "programId");

-- CreateIndex
CREATE UNIQUE INDEX "ProgramOutcome_schoolId_programId_code_key" ON "ProgramOutcome"("schoolId", "programId", "code");

-- CreateIndex
CREATE INDEX "CourseOutcome_schoolId_courseId_idx" ON "CourseOutcome"("schoolId", "courseId");

-- CreateIndex
CREATE UNIQUE INDEX "CourseOutcome_schoolId_courseId_code_key" ON "CourseOutcome"("schoolId", "courseId", "code");

-- CreateIndex
CREATE INDEX "COPOMapping_schoolId_courseId_idx" ON "COPOMapping"("schoolId", "courseId");

-- CreateIndex
CREATE UNIQUE INDEX "COPOMapping_schoolId_courseId_coId_poId_key" ON "COPOMapping"("schoolId", "courseId", "coId", "poId");

-- CreateIndex
CREATE INDEX "COAttainment_schoolId_courseId_idx" ON "COAttainment"("schoolId", "courseId");

-- CreateIndex
CREATE UNIQUE INDEX "COAttainment_schoolId_courseId_coId_academicYear_key" ON "COAttainment"("schoolId", "courseId", "coId", "academicYear");

-- CreateIndex
CREATE INDEX "HostelRoom_schoolId_idx" ON "HostelRoom"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "HostelRoom_schoolId_roomNo_key" ON "HostelRoom"("schoolId", "roomNo");

-- CreateIndex
CREATE INDEX "HostelAllocation_schoolId_studentId_idx" ON "HostelAllocation"("schoolId", "studentId");

-- CreateIndex
CREATE INDEX "HostelAllocation_schoolId_roomId_idx" ON "HostelAllocation"("schoolId", "roomId");

-- CreateIndex
CREATE INDEX "MessBill_schoolId_studentId_idx" ON "MessBill"("schoolId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "MessBill_schoolId_studentId_month_key" ON "MessBill"("schoolId", "studentId", "month");

-- CreateIndex
CREATE INDEX "HostelComplaint_schoolId_studentId_idx" ON "HostelComplaint"("schoolId", "studentId");

-- CreateIndex
CREATE INDEX "Employee_schoolId_userId_idx" ON "Employee"("schoolId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_schoolId_employeeId_key" ON "Employee"("schoolId", "employeeId");

-- CreateIndex
CREATE INDEX "EmployeeLeave_schoolId_employeeId_idx" ON "EmployeeLeave"("schoolId", "employeeId");

-- CreateIndex
CREATE INDEX "Payroll_schoolId_month_idx" ON "Payroll"("schoolId", "month");

-- CreateIndex
CREATE UNIQUE INDEX "Payroll_schoolId_employeeId_month_key" ON "Payroll"("schoolId", "employeeId", "month");

-- CreateIndex
CREATE UNIQUE INDEX "Alumni_studentId_key" ON "Alumni"("studentId");

-- CreateIndex
CREATE INDEX "Alumni_schoolId_idx" ON "Alumni"("schoolId");

-- CreateIndex
CREATE INDEX "AlumniEvent_schoolId_idx" ON "AlumniEvent"("schoolId");

-- CreateIndex
CREATE INDEX "AlumniRegistration_schoolId_eventId_idx" ON "AlumniRegistration"("schoolId", "eventId");

-- CreateIndex
CREATE INDEX "AlumniRegistration_schoolId_alumniId_idx" ON "AlumniRegistration"("schoolId", "alumniId");

-- CreateIndex
CREATE UNIQUE INDEX "AlumniRegistration_schoolId_alumniId_eventId_key" ON "AlumniRegistration"("schoolId", "alumniId", "eventId");

-- CreateIndex
CREATE INDEX "AlumniDonation_schoolId_alumniId_idx" ON "AlumniDonation"("schoolId", "alumniId");

-- CreateIndex
CREATE INDEX "Department_schoolId_idx" ON "Department"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "Department_schoolId_code_key" ON "Department"("schoolId", "code");

-- CreateIndex
CREATE INDEX "ClassGroup_schoolId_idx" ON "ClassGroup"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "ClassGroup_programId_batchId_section_key" ON "ClassGroup"("programId", "batchId", "section");

-- CreateIndex
CREATE INDEX "FacultyAllocation_schoolId_idx" ON "FacultyAllocation"("schoolId");

-- CreateIndex
CREATE INDEX "FacultyAllocation_departmentId_idx" ON "FacultyAllocation"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "FacultyAllocation_courseId_classGroupId_semester_academicYear_key" ON "FacultyAllocation"("courseId", "classGroupId", "semester", "academicYear");

-- CreateIndex
CREATE INDEX "AcademicEvent_schoolId_startDate_idx" ON "AcademicEvent"("schoolId", "startDate");

-- CreateIndex
CREATE INDEX "AcademicEvent_programId_idx" ON "AcademicEvent"("programId");

-- CreateIndex
CREATE INDEX "TimetableSlot_schoolId_classGroupId_idx" ON "TimetableSlot"("schoolId", "classGroupId");

-- CreateIndex
CREATE INDEX "TimetableSlot_schoolId_facultyUserId_idx" ON "TimetableSlot"("schoolId", "facultyUserId");

-- CreateIndex
CREATE INDEX "TimetableSlot_schoolId_room_idx" ON "TimetableSlot"("schoolId", "room");


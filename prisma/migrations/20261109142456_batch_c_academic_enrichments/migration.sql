-- CreateTable
CREATE TABLE "CourseRegistrationWindow" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "semester" INTEGER NOT NULL,
    "academicYear" TEXT NOT NULL,
    "opensAt" DATETIME NOT NULL,
    "closesAt" DATETIME NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CourseRegistration" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "semester" INTEGER NOT NULL,
    "academicYear" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'REGISTERED',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Transcript" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "transcriptNo" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'FULL',
    "semester" INTEGER,
    "academicYear" TEXT,
    "cgpa" REAL,
    "sgpa" REAL,
    "issuedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "BacklogEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "semester" INTEGER NOT NULL,
    "academicYear" TEXT NOT NULL,
    "marks" REAL NOT NULL,
    "grade" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'BACKLOG',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "RevaluationRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "backlogId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "remark" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SupplementaryExam" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "scheduleDate" DATETIME NOT NULL,
    "venue" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "SupplementaryRegistration" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SupplementaryRegistration_examId_fkey" FOREIGN KEY ("examId") REFERENCES "SupplementaryExam" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "unit" TEXT,
    "type" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL DEFAULT 'MEDIUM',
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "authorId" TEXT NOT NULL,
    "remark" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ExamDuty" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "facultyUserId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "venue" TEXT,
    "role" TEXT NOT NULL DEFAULT 'INVIGILATOR',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "CourseRegistrationWindow_schoolId_idx" ON "CourseRegistrationWindow"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "CourseRegistrationWindow_schoolId_semester_academicYear_key" ON "CourseRegistrationWindow"("schoolId", "semester", "academicYear");

-- CreateIndex
CREATE INDEX "CourseRegistration_schoolId_studentId_idx" ON "CourseRegistration"("schoolId", "studentId");

-- CreateIndex
CREATE INDEX "CourseRegistration_schoolId_courseId_idx" ON "CourseRegistration"("schoolId", "courseId");

-- CreateIndex
CREATE UNIQUE INDEX "CourseRegistration_schoolId_courseId_studentId_semester_academicYear_key" ON "CourseRegistration"("schoolId", "courseId", "studentId", "semester", "academicYear");

-- CreateIndex
CREATE UNIQUE INDEX "Transcript_transcriptNo_key" ON "Transcript"("transcriptNo");

-- CreateIndex
CREATE INDEX "Transcript_schoolId_studentId_idx" ON "Transcript"("schoolId", "studentId");

-- CreateIndex
CREATE INDEX "BacklogEntry_schoolId_studentId_idx" ON "BacklogEntry"("schoolId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "BacklogEntry_schoolId_studentId_courseId_semester_academicYear_key" ON "BacklogEntry"("schoolId", "studentId", "courseId", "semester", "academicYear");

-- CreateIndex
CREATE INDEX "RevaluationRequest_schoolId_studentId_idx" ON "RevaluationRequest"("schoolId", "studentId");

-- CreateIndex
CREATE INDEX "SupplementaryExam_schoolId_idx" ON "SupplementaryExam"("schoolId");

-- CreateIndex
CREATE INDEX "SupplementaryRegistration_schoolId_studentId_idx" ON "SupplementaryRegistration"("schoolId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "SupplementaryRegistration_schoolId_examId_studentId_key" ON "SupplementaryRegistration"("schoolId", "examId", "studentId");

-- CreateIndex
CREATE INDEX "Question_schoolId_courseId_idx" ON "Question"("schoolId", "courseId");

-- CreateIndex
CREATE INDEX "ExamDuty_schoolId_facultyUserId_idx" ON "ExamDuty"("schoolId", "facultyUserId");

-- CreateIndex
CREATE UNIQUE INDEX "ExamDuty_schoolId_examId_facultyUserId_key" ON "ExamDuty"("schoolId", "examId", "facultyUserId");

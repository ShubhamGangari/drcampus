-- CreateTable
CREATE TABLE "Grievance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "ticketNo" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "assigneeUserId" TEXT,
    "resolution" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "GrievanceMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "grievanceId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GrievanceMessage_grievanceId_fkey" FOREIGN KEY ("grievanceId") REFERENCES "Grievance" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ScholarshipScheme" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "value" REAL NOT NULL,
    "valueKind" TEXT NOT NULL DEFAULT 'AMOUNT',
    "criteriaJson" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ScholarshipApplication" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "schemeId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "eligible" BOOLEAN NOT NULL,
    "awardedAmount" REAL NOT NULL DEFAULT 0,
    "remark" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ScholarshipApplication_schemeId_fkey" FOREIGN KEY ("schemeId") REFERENCES "ScholarshipScheme" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StudentHealthRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "bloodGroup" TEXT,
    "allergies" TEXT,
    "chronicConditions" TEXT,
    "emergencyContact" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "HealthVisit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" TEXT NOT NULL DEFAULT 'OPD',
    "symptoms" TEXT NOT NULL,
    "diagnosis" TEXT,
    "prescription" TEXT,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "followUpDate" DATETIME
);

-- CreateTable
CREATE TABLE "Club" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "coordinatorUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ClubMembership" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clubId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    CONSTRAINT "ClubMembership_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ClubEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "date" DATETIME NOT NULL,
    "venue" TEXT,
    "status" TEXT NOT NULL DEFAULT 'UPCOMING',
    "rsvpCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ClubEvent_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Grievance_ticketNo_key" ON "Grievance"("ticketNo");

-- CreateIndex
CREATE INDEX "Grievance_schoolId_status_idx" ON "Grievance"("schoolId", "status");

-- CreateIndex
CREATE INDEX "Grievance_schoolId_requesterId_idx" ON "Grievance"("schoolId", "requesterId");

-- CreateIndex
CREATE INDEX "Grievance_schoolId_assigneeUserId_idx" ON "Grievance"("schoolId", "assigneeUserId");

-- CreateIndex
CREATE INDEX "GrievanceMessage_grievanceId_idx" ON "GrievanceMessage"("grievanceId");

-- CreateIndex
CREATE INDEX "ScholarshipScheme_schoolId_idx" ON "ScholarshipScheme"("schoolId");

-- CreateIndex
CREATE INDEX "ScholarshipApplication_schoolId_status_idx" ON "ScholarshipApplication"("schoolId", "status");

-- CreateIndex
CREATE INDEX "ScholarshipApplication_schoolId_studentId_idx" ON "ScholarshipApplication"("schoolId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentHealthRecord_studentId_key" ON "StudentHealthRecord"("studentId");

-- CreateIndex
CREATE INDEX "StudentHealthRecord_schoolId_idx" ON "StudentHealthRecord"("schoolId");

-- CreateIndex
CREATE INDEX "HealthVisit_schoolId_studentId_idx" ON "HealthVisit"("schoolId", "studentId");

-- CreateIndex
CREATE INDEX "HealthVisit_schoolId_date_idx" ON "HealthVisit"("schoolId", "date");

-- CreateIndex
CREATE INDEX "Club_schoolId_idx" ON "Club"("schoolId");

-- CreateIndex
CREATE INDEX "ClubMembership_studentId_idx" ON "ClubMembership"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "ClubMembership_clubId_studentId_key" ON "ClubMembership"("clubId", "studentId");

-- CreateIndex
CREATE INDEX "ClubEvent_schoolId_status_idx" ON "ClubEvent"("schoolId", "status");

-- CreateIndex
CREATE INDEX "ClubEvent_clubId_idx" ON "ClubEvent"("clubId");

-- CreateTable
CREATE TABLE "PlacementCompany" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sector" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PlacementDrive" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "mode" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "package" TEXT,
    "location" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "PlacementPost" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "driveId" TEXT,
    "title" TEXT NOT NULL,
    "package" TEXT,
    "deadline" DATETIME,
    "eligibility" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PlacementApplication" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'APPLIED',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "InternshipListing" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "duration" TEXT NOT NULL,
    "stipend" TEXT,
    "deadline" DATETIME,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Internship" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'APPLIED',
    "startDate" DATETIME,
    "endDate" DATETIME,
    "certificateNo" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AlumniJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "location" TEXT,
    "type" TEXT NOT NULL DEFAULT 'FULL_TIME',
    "description" TEXT NOT NULL,
    "contact" TEXT NOT NULL,
    "postedBy" TEXT NOT NULL,
    "postedByName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AlumniJobApplication" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'APPLIED',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "MentorProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "company" TEXT,
    "experience" INTEGER NOT NULL,
    "about" TEXT,
    "available" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "MentorshipRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "mentorId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "MentorshipPairing" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "mentorId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "MentorshipMeeting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "pairingId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "PlacementCompany_schoolId_idx" ON "PlacementCompany"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "PlacementCompany_schoolId_name_key" ON "PlacementCompany"("schoolId", "name");

-- CreateIndex
CREATE INDEX "PlacementDrive_schoolId_companyId_idx" ON "PlacementDrive"("schoolId", "companyId");

-- CreateIndex
CREATE INDEX "PlacementPost_schoolId_companyId_idx" ON "PlacementPost"("schoolId", "companyId");

-- CreateIndex
CREATE INDEX "PlacementApplication_schoolId_studentId_idx" ON "PlacementApplication"("schoolId", "studentId");

-- CreateIndex
CREATE INDEX "PlacementApplication_schoolId_postId_idx" ON "PlacementApplication"("schoolId", "postId");

-- CreateIndex
CREATE UNIQUE INDEX "PlacementApplication_schoolId_postId_studentId_key" ON "PlacementApplication"("schoolId", "postId", "studentId");

-- CreateIndex
CREATE INDEX "InternshipListing_schoolId_idx" ON "InternshipListing"("schoolId");

-- CreateIndex
CREATE INDEX "Internship_schoolId_studentId_idx" ON "Internship"("schoolId", "studentId");

-- CreateIndex
CREATE INDEX "Internship_schoolId_listingId_idx" ON "Internship"("schoolId", "listingId");

-- CreateIndex
CREATE UNIQUE INDEX "Internship_schoolId_listingId_studentId_key" ON "Internship"("schoolId", "listingId", "studentId");

-- CreateIndex
CREATE INDEX "AlumniJob_schoolId_idx" ON "AlumniJob"("schoolId");

-- CreateIndex
CREATE INDEX "AlumniJob_schoolId_status_idx" ON "AlumniJob"("schoolId", "status");

-- CreateIndex
CREATE INDEX "AlumniJobApplication_schoolId_studentId_idx" ON "AlumniJobApplication"("schoolId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "AlumniJobApplication_schoolId_jobId_studentId_key" ON "AlumniJobApplication"("schoolId", "jobId", "studentId");

-- CreateIndex
CREATE INDEX "MentorProfile_schoolId_idx" ON "MentorProfile"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "MentorProfile_schoolId_userId_key" ON "MentorProfile"("schoolId", "userId");

-- CreateIndex
CREATE INDEX "MentorshipRequest_schoolId_studentId_idx" ON "MentorshipRequest"("schoolId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "MentorshipRequest_schoolId_mentorId_studentId_key" ON "MentorshipRequest"("schoolId", "mentorId", "studentId");

-- CreateIndex
CREATE INDEX "MentorshipPairing_schoolId_studentId_idx" ON "MentorshipPairing"("schoolId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "MentorshipPairing_schoolId_mentorId_studentId_key" ON "MentorshipPairing"("schoolId", "mentorId", "studentId");

-- CreateIndex
CREATE INDEX "MentorshipMeeting_schoolId_pairingId_idx" ON "MentorshipMeeting"("schoolId", "pairingId");

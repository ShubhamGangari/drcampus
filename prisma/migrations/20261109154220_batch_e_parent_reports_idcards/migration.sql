-- CreateTable
CREATE TABLE "ParentStudentLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "parentUserId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "SavedReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "filters" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "IdentityCard" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "holderType" TEXT NOT NULL,
    "holderId" TEXT NOT NULL,
    "cardNumber" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "issuedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" DATETIME
);

-- CreateIndex
CREATE INDEX "ParentStudentLink_schoolId_parentUserId_idx" ON "ParentStudentLink"("schoolId", "parentUserId");

-- CreateIndex
CREATE INDEX "ParentStudentLink_schoolId_studentId_idx" ON "ParentStudentLink"("schoolId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "ParentStudentLink_schoolId_parentUserId_studentId_key" ON "ParentStudentLink"("schoolId", "parentUserId", "studentId");

-- CreateIndex
CREATE INDEX "SavedReport_schoolId_ownerId_idx" ON "SavedReport"("schoolId", "ownerId");

-- CreateIndex
CREATE INDEX "IdentityCard_schoolId_holderType_idx" ON "IdentityCard"("schoolId", "holderType");

-- CreateIndex
CREATE UNIQUE INDEX "IdentityCard_schoolId_cardNumber_key" ON "IdentityCard"("schoolId", "cardNumber");

-- CreateIndex
CREATE UNIQUE INDEX "IdentityCard_schoolId_holderType_holderId_key" ON "IdentityCard"("schoolId", "holderType", "holderId");

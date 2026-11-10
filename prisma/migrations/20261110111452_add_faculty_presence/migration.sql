-- CreateTable
CREATE TABLE "FacultyPresence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "status" TEXT NOT NULL,
    "markedBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "FacultyPresence_schoolId_date_idx" ON "FacultyPresence"("schoolId", "date");

-- CreateIndex
CREATE INDEX "FacultyPresence_schoolId_userId_idx" ON "FacultyPresence"("schoolId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "FacultyPresence_schoolId_userId_date_key" ON "FacultyPresence"("schoolId", "userId", "date");

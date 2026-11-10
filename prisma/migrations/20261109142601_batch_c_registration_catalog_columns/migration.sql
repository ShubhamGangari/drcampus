-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Course" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "credits" REAL NOT NULL,
    "semester" INTEGER,
    "type" TEXT NOT NULL DEFAULT 'CORE',
    "seatsTotal" INTEGER NOT NULL DEFAULT 60,
    "instructorName" TEXT
);
INSERT INTO "new_Course" ("code", "credits", "id", "programId", "schoolId", "title") SELECT "code", "credits", "id", "programId", "schoolId", "title" FROM "Course";
DROP TABLE "Course";
ALTER TABLE "new_Course" RENAME TO "Course";
CREATE INDEX "Course_schoolId_programId_idx" ON "Course"("schoolId", "programId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

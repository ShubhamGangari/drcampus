-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_LibraryLoan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "copyId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "issueDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" DATETIME NOT NULL,
    "returnDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'ISSUED',
    "fine" REAL NOT NULL DEFAULT 0,
    "fineStatus" TEXT NOT NULL DEFAULT 'UNPAID',
    CONSTRAINT "LibraryLoan_copyId_fkey" FOREIGN KEY ("copyId") REFERENCES "LibraryCopy" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LibraryLoan_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "LibraryMembership" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_LibraryLoan" ("copyId", "dueDate", "fine", "id", "issueDate", "memberId", "returnDate", "schoolId", "status") SELECT "copyId", "dueDate", "fine", "id", "issueDate", "memberId", "returnDate", "schoolId", "status" FROM "LibraryLoan";
DROP TABLE "LibraryLoan";
ALTER TABLE "new_LibraryLoan" RENAME TO "LibraryLoan";
CREATE INDEX "LibraryLoan_schoolId_memberId_idx" ON "LibraryLoan"("schoolId", "memberId");
CREATE INDEX "LibraryLoan_schoolId_status_idx" ON "LibraryLoan"("schoolId", "status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

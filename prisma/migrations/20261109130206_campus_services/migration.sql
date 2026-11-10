-- CreateTable
CREATE TABLE "LibraryBook" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "isbn" TEXT,
    "category" TEXT,
    "shelf" TEXT,
    "totalCopies" INTEGER NOT NULL DEFAULT 1
);

-- CreateTable
CREATE TABLE "LibraryCopy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "accessionNo" TEXT NOT NULL,
    "available" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "LibraryCopy_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "LibraryBook" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LibraryMembership" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'STUDENT',
    "active" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "LibraryLoan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "copyId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "issueDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" DATETIME NOT NULL,
    "returnDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'ISSUED',
    "fine" REAL NOT NULL DEFAULT 0,
    CONSTRAINT "LibraryLoan_copyId_fkey" FOREIGN KEY ("copyId") REFERENCES "LibraryCopy" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LibraryLoan_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "LibraryMembership" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TransportRoute" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "stopsJson" TEXT NOT NULL,
    "distanceKm" REAL,
    "active" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "TransportVehicle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "registrationNo" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'BUS',
    "capacity" INTEGER NOT NULL,
    "routeId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    CONSTRAINT "TransportVehicle_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "TransportRoute" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TransportPass" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "stop" TEXT NOT NULL,
    "validFrom" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validTo" DATETIME NOT NULL,
    "fee" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    CONSTRAINT "TransportPass_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "TransportRoute" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Certificate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "purpose" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "remark" TEXT,
    "requestNo" TEXT NOT NULL,
    "referenceNo" TEXT,
    "issuedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Notice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "audienceJson" TEXT NOT NULL,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "NoticeRead" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "noticeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "readAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NoticeRead_noticeId_fkey" FOREIGN KEY ("noticeId") REFERENCES "Notice" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "LibraryBook_schoolId_idx" ON "LibraryBook"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "LibraryCopy_accessionNo_key" ON "LibraryCopy"("accessionNo");

-- CreateIndex
CREATE INDEX "LibraryCopy_schoolId_bookId_idx" ON "LibraryCopy"("schoolId", "bookId");

-- CreateIndex
CREATE UNIQUE INDEX "LibraryMembership_schoolId_userId_key" ON "LibraryMembership"("schoolId", "userId");

-- CreateIndex
CREATE INDEX "LibraryLoan_schoolId_memberId_idx" ON "LibraryLoan"("schoolId", "memberId");

-- CreateIndex
CREATE INDEX "LibraryLoan_schoolId_status_idx" ON "LibraryLoan"("schoolId", "status");

-- CreateIndex
CREATE INDEX "TransportRoute_schoolId_idx" ON "TransportRoute"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "TransportVehicle_registrationNo_key" ON "TransportVehicle"("registrationNo");

-- CreateIndex
CREATE INDEX "TransportVehicle_schoolId_idx" ON "TransportVehicle"("schoolId");

-- CreateIndex
CREATE INDEX "TransportPass_schoolId_studentId_idx" ON "TransportPass"("schoolId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "Certificate_requestNo_key" ON "Certificate"("requestNo");

-- CreateIndex
CREATE UNIQUE INDEX "Certificate_referenceNo_key" ON "Certificate"("referenceNo");

-- CreateIndex
CREATE INDEX "Certificate_schoolId_studentId_idx" ON "Certificate"("schoolId", "studentId");

-- CreateIndex
CREATE INDEX "Notice_schoolId_idx" ON "Notice"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "NoticeRead_noticeId_userId_key" ON "NoticeRead"("noticeId", "userId");

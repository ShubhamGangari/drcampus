-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "recipientUserId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "link" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "AuditLog_schoolId_createdAt_idx" ON "AuditLog"("schoolId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_schoolId_entityType_entityId_idx" ON "AuditLog"("schoolId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_schoolId_actorId_idx" ON "AuditLog"("schoolId", "actorId");

-- CreateIndex
CREATE INDEX "Notification_schoolId_recipientUserId_read_idx" ON "Notification"("schoolId", "recipientUserId", "read");

-- CreateIndex
CREATE INDEX "Notification_schoolId_recipientUserId_createdAt_idx" ON "Notification"("schoolId", "recipientUserId", "createdAt");

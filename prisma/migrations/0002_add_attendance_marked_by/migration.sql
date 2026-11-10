-- Add markedById (user who last marked/updated attendance) + day-wise index.
ALTER TABLE "AttendanceRecord" ADD COLUMN "markedById" TEXT;
CREATE INDEX "AttendanceRecord_schoolId_courseId_date_idx" ON "AttendanceRecord"("schoolId", "courseId", "date");

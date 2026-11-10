import { AttendanceShell } from "@/components/attendance/AttendanceShell";
import { UniversityProvider } from "@/context/UniversityContext";

export const metadata = {
  title: "Attendance — CampusERP",
  description: "Attendance — course-wise roll-call, reports and defaulter tracking.",
};

export default function AttendanceLayout({ children }: { children: React.ReactNode }) {
  return (
    <UniversityProvider>
      <AttendanceShell>{children}</AttendanceShell>
    </UniversityProvider>
  );
}

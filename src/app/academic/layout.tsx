import { AcademicShell } from "@/components/academic/AcademicShell";
import { UniversityProvider } from "@/context/UniversityContext";

export const metadata = {
  title: "Academic Scheduling — CampusERP",
  description:
    "Academic Calendar & Timetable — school-wide events and conflict-free weekly class schedules.",
};

export default function AcademicLayout({ children }: { children: React.ReactNode }) {
  return (
    <UniversityProvider>
      <AcademicShell>{children}</AcademicShell>
    </UniversityProvider>
  );
}

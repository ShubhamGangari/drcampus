import { StudentsShell } from "@/components/students/StudentsShell";
import { UniversityProvider } from "@/context/UniversityContext";

export const metadata = {
  title: "Students — CampusERP",
  description: "Student lifecycle — records, enrollments, leaves, transfers and graduations.",
};

export default function StudentsLayout({ children }: { children: React.ReactNode }) {
  return (
    <UniversityProvider>
      <StudentsShell>{children}</StudentsShell>
    </UniversityProvider>
  );
}

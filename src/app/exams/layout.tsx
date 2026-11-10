import { ExamsShell } from "@/components/exams/ExamsShell";
import { UniversityProvider } from "@/context/UniversityContext";

export const metadata = {
  title: "Examinations — CampusERP",
  description: "Examination & result management — exams, schedules, hall tickets, marks entry and results.",
};

export default function ExamsLayout({ children }: { children: React.ReactNode }) {
  return (
    <UniversityProvider>
      <ExamsShell>{children}</ExamsShell>
    </UniversityProvider>
  );
}

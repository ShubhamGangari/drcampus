import { ReportsShell } from "@/components/reports/ReportsShell";
import { UniversityProvider } from "@/context/UniversityContext";

export const metadata = {
  title: "Accreditation Reports · CampusERP",
};

export default function ReportsLayout({ children }: { children: React.ReactNode }) {
  return (
    <UniversityProvider>
      <ReportsShell>{children}</ReportsShell>
    </UniversityProvider>
  );
}

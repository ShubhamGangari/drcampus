import { HrShell } from "@/components/hr/HrShell";
import { UniversityProvider } from "@/context/UniversityContext";

export const metadata = {
  title: "HR & Payroll — CampusERP",
  description: "HR & Payroll — employees, leave, payroll generation and payslips.",
};

export default function HrLayout({ children }: { children: React.ReactNode }) {
  return (
    <UniversityProvider>
      <HrShell>{children}</HrShell>
    </UniversityProvider>
  );
}

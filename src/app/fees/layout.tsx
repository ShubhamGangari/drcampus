import { FeesShell } from "@/components/fees/FeesShell";
import { UniversityProvider } from "@/context/UniversityContext";

export const metadata = {
  title: "Fees — CampusERP",
  description: "Fees management — structures, invoices, payments and dues.",
};

export default function FeesLayout({ children }: { children: React.ReactNode }) {
  return (
    <UniversityProvider>
      <FeesShell>{children}</FeesShell>
    </UniversityProvider>
  );
}

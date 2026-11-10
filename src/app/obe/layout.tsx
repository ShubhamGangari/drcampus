import { ObEShell } from "@/components/obe/ObEShell";
import { UniversityProvider } from "@/context/UniversityContext";

export const metadata = {
  title: "OBE — CampusERP",
  description: "OBE — course outcomes, CO–PO mapping, attainment and accreditation reports.",
};

export default function ObeLayout({ children }: { children: React.ReactNode }) {
  return (
    <UniversityProvider>
      <ObEShell>{children}</ObEShell>
    </UniversityProvider>
  );
}

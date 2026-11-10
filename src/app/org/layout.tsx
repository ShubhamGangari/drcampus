import { OrgShell } from "@/components/org/OrgShell";
import { UniversityProvider } from "@/context/UniversityContext";

export const metadata = {
  title: "Organization — CampusERP",
  description:
    "Organization — departments, staff directory, class groups and course–faculty allocations.",
};

export default function OrgLayout({ children }: { children: React.ReactNode }) {
  return (
    <UniversityProvider>
      <OrgShell>{children}</OrgShell>
    </UniversityProvider>
  );
}

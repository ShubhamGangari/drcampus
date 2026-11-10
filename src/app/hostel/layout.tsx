import { HostelShell } from "@/components/hostel/HostelShell";
import { UniversityProvider } from "@/context/UniversityContext";

export const metadata = {
  title: "Hostel — CampusERP",
  description: "Hostel — rooms, allocations, mess billing and complaints.",
};

export default function HostelLayout({ children }: { children: React.ReactNode }) {
  return (
    <UniversityProvider>
      <HostelShell>{children}</HostelShell>
    </UniversityProvider>
  );
}

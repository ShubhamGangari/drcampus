import { AlumniShell } from "@/components/alumni/AlumniShell";
import { UniversityProvider } from "@/context/UniversityContext";

export const metadata = {
  title: "Alumni — CampusERP",
  description: "Alumni — directory, profiles, events and donations.",
};

export default function AlumniLayout({ children }: { children: React.ReactNode }) {
  return (
    <UniversityProvider>
      <AlumniShell>{children}</AlumniShell>
    </UniversityProvider>
  );
}

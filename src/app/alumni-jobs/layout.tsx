import { AlumniJobsShell } from "@/components/alumni-jobs/AlumniJobsShell";
import { UniversityProvider } from "@/context/UniversityContext";

export const metadata = {
    title: "Alumni Jobs — CampusERP",
    description: "Alumni job board, applications and moderation.",
};

export default function AlumniJobsLayout({ children }: { children: React.ReactNode }) {
    return (
        <UniversityProvider>
            <AlumniJobsShell>{children}</AlumniJobsShell>
        </UniversityProvider>
    );
}

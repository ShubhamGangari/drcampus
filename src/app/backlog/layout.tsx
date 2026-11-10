import { BacklogShell } from "@/components/backlog/BacklogShell";
import { UniversityProvider } from "@/context/UniversityContext";

export const metadata = {
    title: "Backlog — CampusERP",
    description: "Backlogs, revaluation and supplementary examinations.",
};

export default function BacklogLayout({ children }: { children: React.ReactNode }) {
    return (
        <UniversityProvider>
            <BacklogShell>{children}</BacklogShell>
        </UniversityProvider>
    );
}

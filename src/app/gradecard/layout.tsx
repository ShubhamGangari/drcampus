import { GradecardShell } from "@/components/gradecard/GradecardShell";
import { UniversityProvider } from "@/context/UniversityContext";

export const metadata = {
    title: "Grade Card — CampusERP",
    description: "Semester grade cards, transcripts and verification.",
};

export default function GradecardLayout({ children }: { children: React.ReactNode }) {
    return (
        <UniversityProvider>
            <GradecardShell>{children}</GradecardShell>
        </UniversityProvider>
    );
}

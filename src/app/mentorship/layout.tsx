import { MentorshipShell } from "@/components/mentorship/MentorshipShell";
import { UniversityProvider } from "@/context/UniversityContext";

export const metadata = {
    title: "Mentorship — CampusERP",
    description: "Mentorship & career networking — pair alumni mentors with students.",
};

export default function MentorshipLayout({ children }: { children: React.ReactNode }) {
    return (
        <UniversityProvider>
            <MentorshipShell>{children}</MentorshipShell>
        </UniversityProvider>
    );
}

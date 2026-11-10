import { InternshipsShell } from "@/components/internships/InternshipsShell";
import { UniversityProvider } from "@/context/UniversityContext";

export const metadata = {
    title: "Internships — CampusERP",
    description: "Internship listings, applications and completion records.",
};

export default function InternshipsLayout({ children }: { children: React.ReactNode }) {
    return (
        <UniversityProvider>
            <InternshipsShell>{children}</InternshipsShell>
        </UniversityProvider>
    );
}

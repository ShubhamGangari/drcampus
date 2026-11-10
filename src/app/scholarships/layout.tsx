import type { Metadata } from "next";
import { ScholarshipsShell } from "@/components/scholarships/ScholarshipsShell";
import { UniversityProvider } from "@/context/UniversityContext";

export const metadata: Metadata = {
    title: "Scholarships & Concessions | CampusERP",
    description: "Browse scholarship schemes and track applications.",
};

export default function ScholarshipsLayout({ children }: { children: React.ReactNode }) {
    return (
        <UniversityProvider>
            <ScholarshipsShell>{children}</ScholarshipsShell>
        </UniversityProvider>
    );
}

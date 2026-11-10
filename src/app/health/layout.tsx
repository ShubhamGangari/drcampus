import type { Metadata } from "next";
import { HealthShell } from "@/components/health/HealthShell";
import { UniversityProvider } from "@/context/UniversityContext";

export const metadata: Metadata = {
    title: "Health & Medical Centre | CampusERP",
    description: "Student health records, visits and follow-ups.",
};

export default function HealthLayout({ children }: { children: React.ReactNode }) {
    return (
        <UniversityProvider>
            <HealthShell>{children}</HealthShell>
        </UniversityProvider>
    );
}

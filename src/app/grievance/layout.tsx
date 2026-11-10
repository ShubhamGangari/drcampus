import type { Metadata } from "next";
import { GrievanceShell } from "@/components/grievance/GrievanceShell";
import { UniversityProvider } from "@/context/UniversityContext";

export const metadata: Metadata = {
    title: "Grievance & Helpdesk | CampusERP",
    description: "Raise and track grievance tickets across the university.",
};

export default function GrievanceLayout({ children }: { children: React.ReactNode }) {
    return (
        <UniversityProvider>
            <GrievanceShell>{children}</GrievanceShell>
        </UniversityProvider>
    );
}

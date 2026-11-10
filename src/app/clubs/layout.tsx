import type { Metadata } from "next";
import { ClubsShell } from "@/components/clubs/ClubsShell";
import { UniversityProvider } from "@/context/UniversityContext";

export const metadata: Metadata = {
    title: "Clubs, Societies & Events | CampusERP",
    description: "Student clubs, memberships and event board.",
};

export default function ClubsLayout({ children }: { children: React.ReactNode }) {
    return (
        <UniversityProvider>
            <ClubsShell>{children}</ClubsShell>
        </UniversityProvider>
    );
}

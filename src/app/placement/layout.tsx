import { PlacementShell } from "@/components/placement/PlacementShell";
import { UniversityProvider } from "@/context/UniversityContext";

export const metadata = {
    title: "Placement — CampusERP",
    description: "Placement cell — companies, drives, posts and applications.",
};

export default function PlacementLayout({ children }: { children: React.ReactNode }) {
    return (
        <UniversityProvider>
            <PlacementShell>{children}</PlacementShell>
        </UniversityProvider>
    );
}

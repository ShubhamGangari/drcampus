import { LibraryShell } from "@/components/library/LibraryShell";
import { UniversityProvider } from "@/context/UniversityContext";

export const metadata = {
    title: "Library — CampusERP",
    description: "Library — catalogue, circulation, memberships and fines.",
};

export default function LibraryLayout({ children }: { children: React.ReactNode }) {
    return (
        <UniversityProvider>
            <LibraryShell>{children}</LibraryShell>
        </UniversityProvider>
    );
}

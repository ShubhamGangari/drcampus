import { ParentShell } from "@/components/parent/ParentShell";
import { UniversityProvider } from "@/context/UniversityContext";

export default function ParentLayout({ children }: { children: React.ReactNode }) {
    return (
        <UniversityProvider>
            <ParentShell>{children}</ParentShell>
        </UniversityProvider>
    );
}

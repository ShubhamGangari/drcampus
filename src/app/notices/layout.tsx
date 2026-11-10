"use client";

import { UniversityProvider } from "@/context/UniversityContext";
import { NoticesShell } from "@/components/notices/NoticesShell";

export default function NoticesLayout({ children }: { children: React.ReactNode }) {
    return (
        <UniversityProvider>
            <NoticesShell>{children}</NoticesShell>
        </UniversityProvider>
    );
}

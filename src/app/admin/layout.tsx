import { Suspense } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { UniversityProvider } from "@/context/UniversityContext";

export const metadata = {
    title: "Admin Console — CampusERP",
    description: "Dynamic roles, permissions and officer provisioning.",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    return (
        <UniversityProvider>
            {/* Suspense: AdminShell reads useSearchParams for the active tab. */}
            <Suspense fallback={<div className="min-h-screen bg-slate-50/70" />}>
                <AdminShell>{children}</AdminShell>
            </Suspense>
        </UniversityProvider>
    );
}

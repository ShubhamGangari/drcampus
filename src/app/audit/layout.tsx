import { UniversityProvider } from "@/context/UniversityContext";

export const metadata = {
    title: "Audit Log — CampusERP",
    description: "Immutable, tenant-scoped trail of administrative actions across the university.",
};

export default function AuditLayout({ children }: { children: React.ReactNode }) {
    return <UniversityProvider>{children}</UniversityProvider>;
}

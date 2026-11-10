import { CertificatesShell } from "@/components/certificates/CertificatesShell";
import { UniversityProvider } from "@/context/UniversityContext";

export const metadata = {
    title: "Certificates — CampusERP",
    description: "Certificates — request, approve, issue and verify official documents.",
};

export default function CertificatesPortalLayout({ children }: { children: React.ReactNode }) {
    return (
        <UniversityProvider>
            <CertificatesShell>{children}</CertificatesShell>
        </UniversityProvider>
    );
}

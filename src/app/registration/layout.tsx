import { RegistrationShell } from "@/components/registration/RegistrationShell";
import { UniversityProvider } from "@/context/UniversityContext";

export const metadata = {
    title: "Registration — CampusERP",
    description: "Course & semester registration — catalog, windows and registrations.",
};

export default function RegistrationLayout({ children }: { children: React.ReactNode }) {
    return (
        <UniversityProvider>
            <RegistrationShell>{children}</RegistrationShell>
        </UniversityProvider>
    );
}

import { TransportShell } from "@/components/transport/TransportShell";
import { UniversityProvider } from "@/context/UniversityContext";

export const metadata = {
    title: "Transport — CampusERP",
    description: "Transport — vehicles, routes and bus passes.",
};

export default function TransportLayout({ children }: { children: React.ReactNode }) {
    return (
        <UniversityProvider>
            <TransportShell>{children}</TransportShell>
        </UniversityProvider>
    );
}

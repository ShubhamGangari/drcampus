import { AdmissionsShell } from "@/components/admissions/AdmissionsShell";

export const metadata = {
  title: "Admissions — CampusERP",
  description: "Admissions lifecycle — cycles, applications, merit list and seat allocation.",
};

export default function AdmissionsLayout({ children }: { children: React.ReactNode }) {
  return <AdmissionsShell>{children}</AdmissionsShell>;
}

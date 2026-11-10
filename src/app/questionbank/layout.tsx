import { QuestionbankShell } from "@/components/questionbank/QuestionbankShell";
import { UniversityProvider } from "@/context/UniversityContext";

export const metadata = {
    title: "Question Bank — CampusERP",
    description: "Question bank, approval and faculty exam duty.",
};

export default function QuestionbankLayout({ children }: { children: React.ReactNode }) {
    return (
        <UniversityProvider>
            <QuestionbankShell>{children}</QuestionbankShell>
        </UniversityProvider>
    );
}

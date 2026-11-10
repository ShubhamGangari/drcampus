import { IdCardsShell } from "@/components/idcards/IdCardsShell";

export default function IdCardsLayout({ children }: { children: React.ReactNode }) {
    return <IdCardsShell>{children}</IdCardsShell>;
}

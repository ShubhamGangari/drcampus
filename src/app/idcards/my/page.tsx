"use client";

import { useCallback, useEffect, useState } from "react";
import { Printer, Download } from "lucide-react";
import { PageTitle } from "@/components/idcards/IdCardsShell";
import { Spinner, EmptyState, ErrorState } from "@/components/admissions/States";
import { Button } from "@/components/ui/Button";
import { IdCardFront } from "@/components/idcards/IdCard";
import { fetchMyCard, type IdentityCardShape } from "@/lib/idcards";

function formatDate(value: string): string {
    try {
        return new Date(value).toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
        });
    } catch {
        return value;
    }
}

export default function MyCardPage() {
    const [card, setCard] = useState<IdentityCardShape | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await fetchMyCard();
            setCard(data.card);
        } catch (e) {
            if (e instanceof Error && "status" in e && (e as { status: number }).status === 404) {
                setCard(null);
            } else {
                setError(e instanceof Error ? e.message : "Failed to load your card");
            }
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    return (
        <div>
            {/* Print isolation: only the card is captured when printing. */}
            <style>{`
                @media print {
                    body * { visibility: hidden; }
                    #printable-card, #printable-card * { visibility: visible; }
                    #printable-card {
                        position: absolute;
                        left: 0;
                        top: 0;
                    }
                }
            `}</style>

            <PageTitle
                title="My Card"
                subtitle="Your identity card — print it or keep it handy."
                action={
                    card && (
                        <Button size="sm" onClick={() => window.print()}>
                            <Printer className="h-3.5 w-3.5" /> Print
                        </Button>
                    )
                }
            />

            {loading ? (
                <Spinner label="Loading your card…" />
            ) : error ? (
                <ErrorState message={error} onRetry={() => void load()} />
            ) : !card ? (
                <EmptyState
                    title="No identity card issued"
                    description="Your institution has not issued an ID card for you yet. Contact the administration to have one generated."
                />
            ) : (
                <div className="flex flex-col items-center gap-6 py-4">
                    <div id="printable-card">
                        <IdCardFront card={card} />
                    </div>

                    <div className="w-[min(100%,340px)] rounded-2xl bg-white border border-slate-200 shadow-sm p-4">
                        <dl className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <dt className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                                    Card number
                                </dt>
                                <dd className="mt-0.5 font-black text-slate-800 font-mono">
                                    {card.cardNumber}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                                    Status
                                </dt>
                                <dd className="mt-0.5 font-bold text-slate-800">{card.status}</dd>
                            </div>
                            <div className="col-span-2">
                                <dt className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                                    Issued on
                                </dt>
                                <dd className="mt-0.5 font-semibold text-slate-700">
                                    {formatDate(card.issuedAt)}
                                </dd>
                            </div>
                        </dl>

                        <Button className="w-full mt-4" onClick={() => window.print()}>
                            <Download className="h-3.5 w-3.5" /> Print / save as PDF
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}

"use client";

import { UserRound, GraduationCap } from "lucide-react";
import { cn } from "@/lib/cn";
import type { IdentityCardShape } from "@/lib/idcards";

/**
 * Small deterministic hash (djb2) so the printed QR pattern is stable for the
 * same card — a visual stand-in for the server-side sha256 verification payload
 * (`cardQrPayload` in idcards-core). The real verification hash lives on the
 * backend; this is the print-facing glyph.
 */
function seedFromCard(card: IdentityCardShape): string {
    let h = 5381;
    const raw = `${card.cardNumber}|${card.holderId}|${card.issuedAt}`;
    for (let i = 0; i < raw.length; i++) {
        h = (h * 33) ^ raw.charCodeAt(i);
    }
    return (h >>> 0).toString(16);
}

function QrBlock({ value, className }: { value: string; className?: string }) {
    const N = 21; // standard QR module count
    const bits: boolean[] = [];
    for (let c = 0; c < value.length; c++) {
        const code = value.charCodeAt(c);
        for (let b = 7; b >= 0; b--) bits.push(((code >> b) & 1) === 1);
    }
    const isDark = (r: number, c: number): boolean => {
        // Three finder patterns.
        const finder = (tr: number, tc: number): boolean => {
            const lr = r - tr;
            const lc = c - tc;
            if (lr < 0 || lr > 6 || lc < 0 || lc > 6) return false;
            const ring = lr === 0 || lr === 6 || lc === 0 || lc === 6;
            const core = lr >= 2 && lr <= 4 && lc >= 2 && lc <= 4;
            return ring || core;
        };
        if (finder(0, 0) || finder(0, N - 7) || finder(N - 7, 0)) return true;
        const idx = r * N + c;
        return bits[idx % bits.length] ?? false;
    };

    return (
        <div
            className={cn("grid", className)}
            style={{
                gridTemplateColumns: `repeat(${N}, 1fr)`,
                gap: 0,
            }}
            aria-hidden="true"
        >
            {Array.from({ length: N * N }).map((_, i) => {
                const r = Math.floor(i / N);
                const c = i % N;
                return (
                    <div
                        key={i}
                        className={isDark(r, c) ? "bg-slate-900" : "bg-transparent"}
                    />
                );
            })}
        </div>
    );
}

interface IdCardFrontProps {
    card: IdentityCardShape;
    schoolName?: string;
    className?: string;
}

/**
 * Printable ID card front. Sized to a standard credit-card aspect ratio and
 * isolated from the surrounding app chrome so `window.print()` only captures
 * this card when printed via the "My card" screen.
 */
export function IdCardFront({ card, schoolName = "CampusERP", className }: IdCardFrontProps) {
    const isStudent = card.holderType === "STUDENT";
    return (
        <div
            className={cn(
                "w-[min(100%,340px)] aspect-[1.586] rounded-2xl overflow-hidden border border-slate-200 shadow-xl bg-white relative select-none print:shadow-none",
                className
            )}
        >
            {/* top band */}
            <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-br from-indigo-700 via-indigo-600 to-violet-600" />
            <div className="absolute inset-x-0 top-0 h-24 bg-[radial-gradient(circle_at_20%_-20%,rgba(255,255,255,0.35),transparent_60%)]" />

            <div className="relative p-5 flex flex-col h-full">
                {/* header */}
                <div className="flex items-start justify-between">
                    <div>
                        <p className="text-white text-base font-black tracking-tight leading-none">{schoolName}</p>
                        <p className="text-white/75 text-[9px] font-semibold tracking-[0.14em] uppercase mt-1">
                            Drivion Solutions · Identity Card
                        </p>
                    </div>
                    <div className="h-8 w-8 rounded-lg bg-white/15 backdrop-blur border border-white/25 flex items-center justify-center text-white">
                        <GraduationCap className="h-4 w-4" />
                    </div>
                </div>

                {/* holder */}
                <div className="flex items-center gap-3.5 mt-7">
                    <div className="h-14 w-14 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-300 shrink-0">
                        <UserRound className="h-7 w-7" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-slate-900 text-sm font-black truncate">{card.holderName}</p>
                        <p className="text-xs font-bold text-indigo-600 mt-0.5">
                            {isStudent ? "Student" : "Staff"}
                        </p>
                        <p className="text-[10px] text-slate-400 font-medium mt-0.5 truncate">
                            {isStudent ? "Student ID" : "Employee ID"} · {card.holderId.slice(0, 8)}
                        </p>
                    </div>
                </div>

                {/* footer */}
                <div className="mt-auto flex items-end justify-between gap-3">
                    <div>
                        <p className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Card No.</p>
                        <p className="text-slate-900 text-sm font-black tracking-tight mt-0.5">{card.cardNumber}</p>
                        <p
                            className={cn(
                                "text-[9px] font-bold mt-1.5 px-2 py-0.5 rounded-full w-fit",
                                card.status === "ACTIVE"
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                    : "bg-rose-50 text-rose-700 border border-rose-200"
                            )}
                        >
                            {card.status}
                        </p>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                        <QrBlock value={seedFromCard(card)} className="h-16 w-16" />
                        <p className="text-[8px] text-slate-400 font-semibold tracking-wider uppercase">
                            Verify
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

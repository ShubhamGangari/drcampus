"use client";

import React, { useState } from "react";
import { HelpCircle, ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

// ==============================================================================
// ModuleHelp — small collapsible "How it works" touch (UX polish spec §3.4).
//
// Each module shell can render this to give first-run users a 3-step guide to
// the module's core task plus a link to the module spec. Purely presentational.
// ==============================================================================

export function ModuleHelp({
    title = "How it works",
    steps,
    specHref,
}: {
    title?: string;
    steps: string[];
    specHref?: string;
}) {
    const [open, setOpen] = useState(false);

    return (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                className="w-full flex items-center justify-between px-4 py-2.5 text-left cursor-pointer hover:bg-slate-50 transition-colors"
                aria-expanded={open}
            >
                <span className="flex items-center gap-2 text-xs font-bold text-slate-700">
                    <HelpCircle className="h-3.5 w-3.5 text-indigo-500" />
                    {title}
                </span>
                <ChevronDown
                    className={cn("h-4 w-4 text-slate-400 transition-transform", open && "rotate-180")}
                />
            </button>

            {open && (
                <div className="px-4 pb-4">
                    <ol className="space-y-1.5 list-decimal list-inside text-xs text-slate-600">
                        {steps.map((step, i) => (
                            <li key={i}>{step}</li>
                        ))}
                    </ol>
                    {specHref && (
                        <a
                            href={specHref}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-3 inline-block text-[11px] font-bold text-indigo-600 hover:underline"
                        >
                            Read the full spec →
                        </a>
                    )}
                </div>
            )}
        </div>
    );
}

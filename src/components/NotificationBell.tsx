"use client";

import React, { useEffect, useRef, useState } from "react";
import { Bell, CheckCheck, Clock, X } from "lucide-react";
import {
    fetchNotifications,
    fetchUnreadCount,
    markAllNotificationsRead,
    markNotificationRead,
    NotificationRow,
} from "@/lib/cross";
import { cn } from "@/lib/cn";

function timeAgo(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(iso).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
    });
}

export const NotificationBell: React.FC = () => {
    const [open, setOpen] = useState(false);
    const [unread, setUnread] = useState(0);
    const [items, setItems] = useState<NotificationRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const panelRef = useRef<HTMLDivElement>(null);

    const refreshCount = async () => {
        try {
            const { count } = await fetchUnreadCount();
            setUnread(count);
        } catch {
            /* silent – badge is best-effort */
        }
    };

    const load = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetchNotifications({ limit: 8 });
            setItems(res.notifications);
        } catch {
            setError("Could not load notifications.");
        } finally {
            setLoading(false);
        }
    };

    const toggle = () => {
        const next = !open;
        setOpen(next);
        if (next) {
            load();
            refreshCount();
        }
    };

    const handleRead = async (id: string) => {
        setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
        setUnread((u) => Math.max(0, u - 1));
        try {
            await markNotificationRead(id);
        } catch {
            /* best-effort */
        }
    };

    const handleReadAll = async () => {
        setItems((prev) => prev.map((n) => ({ ...n, read: true })));
        setUnread(0);
        try {
            await markAllNotificationsRead();
        } catch {
            /* best-effort */
        }
    };

    // Close on outside click
    useEffect(() => {
        if (!open) return;
        const onDown = (e: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", onDown);
        return () => document.removeEventListener("mousedown", onDown);
    }, [open]);

    // Initial count on mount
    useEffect(() => {
        refreshCount();
        const id = setInterval(refreshCount, 60_000);
        return () => clearInterval(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div className="relative" ref={panelRef}>
            <button
                type="button"
                onClick={toggle}
                aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
                aria-expanded={open}
                className="relative p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
            >
                <Bell className="h-4 w-4" />
                {unread > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center border-2 border-white">
                        {unread > 99 ? "99+" : unread}
                    </span>
                )}
            </button>

            {open && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden z-50 animate-in fade-in zoom-in-95">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
                        <div>
                            <h3 className="text-sm font-bold text-slate-900 tracking-tight">Notifications</h3>
                            {unread > 0 && (
                                <p className="text-[11px] text-slate-500">{unread} unread</p>
                            )}
                        </div>
                        {unread > 0 && (
                            <button
                                type="button"
                                onClick={handleReadAll}
                                className="flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                            >
                                <CheckCheck className="h-3.5 w-3.5" />
                                Mark all read
                            </button>
                        )}
                    </div>

                    <div className="max-h-[22rem] overflow-y-auto divide-y divide-slate-100">
                        {loading && (
                            <div className="px-4 py-10 text-center text-xs text-slate-400">Loading…</div>
                        )}
                        {!loading && error && (
                            <div className="px-4 py-10 text-center text-xs text-rose-600">{error}</div>
                        )}
                        {!loading && !error && items.length === 0 && (
                            <div className="px-4 py-12 text-center">
                                <div className="mx-auto h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center mb-2">
                                    <Clock className="h-5 w-5 text-slate-400" />
                                </div>
                                <p className="text-xs text-slate-500 font-medium">You’re all caught up</p>
                                <p className="text-[11px] text-slate-400 mt-0.5">No notifications yet.</p>
                            </div>
                        )}
                        {!loading &&
                            !error &&
                            items.map((n) => (
                                <button
                                    key={n.id}
                                    type="button"
                                    onClick={() => (!n.read ? handleRead(n.id) : undefined)}
                                    className={cn(
                                        "w-full text-left px-4 py-3 transition-colors cursor-pointer hover:bg-slate-50",
                                        !n.read && "bg-indigo-50/40",
                                    )}
                                >
                                    <div className="flex items-start gap-2.5">
                                        <span
                                            className={cn(
                                                "mt-0.5 h-2 w-2 rounded-full shrink-0 border",
                                                n.read ? "bg-transparent border-slate-300" : "bg-indigo-600 border-indigo-600",
                                            )}
                                        />
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="text-xs font-bold text-slate-900 truncate">
                                                    {n.title}
                                                </span>
                                                <span className="text-[10px] text-slate-400 shrink-0">
                                                    {timeAgo(n.createdAt)}
                                                </span>
                                            </div>
                                            {n.body && (
                                                <p className="text-[11px] text-slate-600 mt-0.5 line-clamp-2">
                                                    {n.body}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </button>
                            ))}
                    </div>

                    <div className="border-t border-slate-200 px-4 py-2.5 flex items-center justify-between">
                        <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                            Live · UMS
                        </span>
                        <button
                            type="button"
                            onClick={() => setOpen(false)}
                            className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-700 cursor-pointer"
                        >
                            <X className="h-3 w-3" />
                            Close
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

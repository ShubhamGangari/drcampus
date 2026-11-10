"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, Pencil, X } from "lucide-react";
import { PageTitle } from "@/components/attendance/AttendanceShell";
import { Toast } from "@/components/admissions/Toast";
import { EmptyState, ErrorState, InlineLoader } from "@/components/admissions/States";
import { TextInput } from "@/components/admissions/FormControls";
import { Button, Badge } from "@/components/ui";
import { useUniversity } from "@/context/UniversityContext";
import {
  AcademicEvent,
  AcademicEventType,
  fetchEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  formatEventDate,
  canManageEvents,
} from "@/lib/academic";

const TYPE_LABELS: Record<AcademicEventType, string> = {
  HOLIDAY: "Holiday",
  EXAM: "Exam",
  EVENT: "Event",
  DEADLINE: "Deadline",
};

const EVENT_BADGE_VARIANTS: Record<
  AcademicEventType,
  "primary" | "success" | "danger" | "warning" | "outline" | "default"
> = {
  HOLIDAY: "warning",
  EXAM: "danger",
  EVENT: "primary",
  DEADLINE: "default",
};

export default function AcademicCalendarPage() {
  const { currentUser } = useUniversity();
  const canManage = canManageEvents(currentUser?.role);

  const [events, setEvents] = useState<AcademicEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filterType, setFilterType] = useState("");

  const [toast, setToast] = useState<{ message: string; type?: "success" | "error" } | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AcademicEvent | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [type, setType] = useState<AcademicEventType>("EVENT");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [programId, setProgramId] = useState("");

  // Backend returns events from the seeded school by default; central users can
  // filter by school. We keep school wildcard (no query) for simplicity.
  const loadEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchEvents(filterType ? { type: filterType as AcademicEventType } : {});
      setEvents(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load events.");
    } finally {
      setLoading(false);
    }
  }, [filterType]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const openCreate = () => {
    setEditing(null);
    setTitle("");
    setType("EVENT");
    setStartDate("");
    setEndDate("");
    setProgramId("");
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (ev: AcademicEvent) => {
    setEditing(ev);
    setTitle(ev.title);
    setType(ev.type);
    setStartDate(ev.startDate.slice(0, 10));
    setEndDate(ev.endDate ? ev.endDate.slice(0, 10) : "");
    setProgramId(ev.programId ?? "");
    setFormError(null);
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setFormError("Title is required.");
      return;
    }
    if (!startDate) {
      setFormError("Start date is required.");
      return;
    }
    if (endDate && endDate < startDate) {
      setFormError("End date cannot be before start date.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const payload = {
        title: title.trim(),
        type,
        startDate,
        ...(endDate ? { endDate } : {}),
        ...(programId ? { programId } : {}),
      };
      if (editing) {
        await updateEvent(editing.id, payload);
      } else {
        await createEvent(payload);
      }
      setModalOpen(false);
      await loadEvents();
      setToast({ message: editing ? "Event updated." : "Event created.", type: "success" });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (ev: AcademicEvent) => {
    if (!window.confirm(`Delete event "${ev.title}"?`)) return;
    try {
      await deleteEvent(ev.id);
      setEvents((prev) => prev.filter((x) => x.id !== ev.id));
      setToast({ message: "Event deleted.", type: "success" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete event.");
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <PageTitle
        title="Academic Calendar"
        subtitle="School-wide and program-scoped academic events"
        action={
          canManage ? (
            <Button onClick={openCreate} size="sm">
              <Plus className="h-4 w-4" /> Add Event
            </Button>
          ) : undefined
        }
      />

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label className="text-sm text-slate-600">Type</label>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
        >
          <option value="">All types</option>
          {(Object.keys(TYPE_LABELS) as AcademicEventType[]).map((t) => (
            <option key={t} value={t}>
              {TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-6">
        {loading ? (
          <InlineLoader label="Loading events…" />
        ) : error ? (
          <ErrorState message={error} onRetry={loadEvents} />
        ) : events.length === 0 ? (
          <EmptyState title="No events" description="No academic events are scheduled for this filter." />
        ) : (
          <ul className="space-y-3">
            {events.map((ev) => (
              <li
                key={ev.id}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={EVENT_BADGE_VARIANTS[ev.type]}>
                        {TYPE_LABELS[ev.type]}
                      </Badge>
                      <h3 className="font-semibold text-slate-800">{ev.title}</h3>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                      {formatEventDate(ev.startDate)}
                      {ev.endDate ? ` – ${formatEventDate(ev.endDate)}` : ""}
                      {ev.programId ? " · Program-scoped" : " · School-wide"}
                    </p>
                  </div>
                  {canManage && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEdit(ev)}
                        className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                        aria-label="Edit event"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(ev)}
                        className="rounded-lg p-2 text-slate-500 transition hover:bg-rose-50 hover:text-rose-600"
                        aria-label="Delete event"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-800">
                {editing ? "Edit Event" : "New Event"}
              </h2>
              <button
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">Title</label>
                <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Mid-Semester Exams" required />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">Type</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as AcademicEventType)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {(Object.keys(TYPE_LABELS) as AcademicEventType[]).map((t) => (
                    <option key={t} value={t}>
                      {TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">Start date</label>
                  <TextInput type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">End date (optional)</label>
                  <TextInput type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </div>
              </div>

              {formError && (
                <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">{formError}</p>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" loading={saving} disabled={saving}>
                  {saving ? "Saving…" : editing ? "Save changes" : "Create event"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

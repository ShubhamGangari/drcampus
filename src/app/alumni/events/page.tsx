"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, CalendarDays, MapPin, Users, Check, X } from "lucide-react";
import { PageTitle } from "@/components/alumni/AlumniShell";
import { CreateEventModal } from "@/components/alumni/CreateEventModal";
import { Toast } from "@/components/admissions/Toast";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/admissions/States";
import { SchoolSelect } from "@/components/fees/SchoolSelect";
import { useUniversity } from "@/context/UniversityContext";
import {
  AlumniApiError,
  AlumniEvent,
  canManageAlumni,
  createEvent,
  CreateEventInput,
  deregisterFromEvent,
  fetchEvents,
  formatDate,
  isAlumniStudent,
  registerForEvent,
} from "@/lib/alumni";

export default function AlumniEventsPage() {
  const { currentUser } = useUniversity();
  const isCentral = currentUser?.schoolId === "ALL";
  const isStudent = isAlumniStudent(currentUser?.role);
  const canCreate = canManageAlumni(currentUser?.role);

  const [schoolId, setSchoolId] = useState("");
  const [rows, setRows] = useState<AlumniEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [actionBusy, setActionBusy] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const list = await fetchEvents({
        schoolId: isCentral && schoolId ? schoolId : undefined,
      });
      setRows(list);
    } catch (e) {
      setLoadError(e instanceof AlumniApiError ? e.message : "Unable to load events.");
    } finally {
      setLoading(false);
    }
  }, [isCentral, schoolId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async (input: CreateEventInput) => {
    setBusy(true);
    setSubmitError(null);
    try {
      await createEvent(input);
      setCreateOpen(false);
      setToast({ message: "Event created successfully.", type: "success" });
      await load();
    } catch (e) {
      setSubmitError(e instanceof AlumniApiError ? e.message : "Could not create event.");
    } finally {
      setBusy(false);
    }
  };

  const handleToggleRegistration = async (event: AlumniEvent) => {
    setActionBusy((prev) => ({ ...prev, [event.id]: true }));
    try {
      if (event.registered) {
        await deregisterFromEvent(event.id);
        setToast({ message: "You have deregistered from the event.", type: "success" });
      } else {
        await registerForEvent(event.id);
        setToast({ message: "You are registered for the event.", type: "success" });
      }
      await load();
    } catch (e) {
      setToast({
        message: e instanceof AlumniApiError ? e.message : "Could not update registration.",
        type: "error",
      });
    } finally {
      setActionBusy((prev) => ({ ...prev, [event.id]: false }));
    }
  };

  return (
    <div>
      <PageTitle
        title="Alumni Events"
        subtitle="Campus and alumni gatherings"
        action={
          canCreate ? (
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-indigo-600 transition-colors cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" /> Create Event
            </button>
          ) : undefined
        }
      />

      {isCentral && (
        <div className="sm:max-w-xs mb-6">
          <SchoolSelect value={schoolId} onChange={setSchoolId} />
        </div>
      )}

      <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-6">
            <LoadingSkeleton rows={3} />
          </div>
        ) : loadError ? (
          <ErrorState message={loadError} onRetry={load} />
        ) : rows.length === 0 ? (
          <EmptyState
            title="No events yet"
            description={
              canCreate
                ? "Create your first alumni event."
                : "Events will appear here once the registrar creates them."
            }
          />
        ) : (
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4 p-5">
            {rows.map((event) => {
              const busyOnEvent = actionBusy[event.id];
              return (
                <div
                  key={event.id}
                  className="rounded-2xl border border-slate-200 bg-white p-5 flex flex-col hover:shadow-md hover:border-slate-300 transition-all"
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="h-10 w-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                      <CalendarDays className="h-5 w-5" />
                    </div>
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-slate-100 rounded-lg px-2.5 py-1">
                      <Users className="h-3.5 w-3.5 text-slate-400" />
                      {event.registrations}
                    </span>
                  </div>

                  <h3 className="text-sm font-black text-slate-900 tracking-tight">
                    {event.title}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 font-medium">
                    {formatDate(event.date)}
                  </p>
                  {event.location && (
                    <p className="flex items-center gap-1.5 text-xs text-slate-500 mt-1.5">
                      <MapPin className="h-3.5 w-3.5 text-slate-400" />
                      {event.location}
                    </p>
                  )}

                  <div className="mt-4 pt-4 border-t border-slate-100">
                    {isStudent ? (
                      <button
                        type="button"
                        onClick={() => handleToggleRegistration(event)}
                        disabled={busyOnEvent}
                        className={`inline-flex items-center justify-center gap-1.5 w-full px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                          event.registered
                            ? "bg-rose-50 text-rose-600 border border-rose-100 hover:bg-rose-100"
                            : "bg-slate-900 text-white hover:bg-indigo-600"
                        }`}
                      >
                        {busyOnEvent
                          ? "Working…"
                          : event.registered
                            ? (
                                <>
                                  <X className="h-3.5 w-3.5" /> Deregister
                                </>
                              )
                            : (
                                <>
                                  <Check className="h-3.5 w-3.5" /> Register
                                </>
                              )}
                      </button>
                    ) : (
                      <p className="text-[11px] text-slate-400 font-medium text-center">
                        {event.registrations} registered
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {canCreate && (
        <CreateEventModal
          open={createOpen}
          busy={busy}
          error={submitError}
          schoolRequired={isCentral}
          onClose={() => setCreateOpen(false)}
          onSubmit={handleCreate}
        />
      )}

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  );
}

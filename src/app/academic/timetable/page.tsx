"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { PageTitle } from "@/components/attendance/AttendanceShell";
import { Toast } from "@/components/admissions/Toast";
import { EmptyState, ErrorState, InlineLoader } from "@/components/admissions/States";
import { TextInput } from "@/components/admissions/FormControls";
import { Button } from "@/components/ui";
import { useUniversity } from "@/context/UniversityContext";
import {
  TimetableSlot,
  TimetableConflict,
  fetchSlots,
  createSlot,
  deleteSlot,
  dayOfWeekLabel,
  canManageSlots,
  TimetableConflictError,
} from "@/lib/academic";

// Times grid: 08:00 → 17:00 hour slots for Mon–Sat (1–6).
const HOURS = ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00"];
const DAYS = [1, 2, 3, 4, 5, 6];

export default function AcademicTimetablePage() {
  const { currentUser } = useUniversity();
  const canManage = canManageSlots(currentUser?.role);

  const [slots, setSlots] = useState<TimetableSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [classGroupId, setClassGroupId] = useState("");
  const [semester, setSemester] = useState("1");
  const [academicYear, setAcademicYear] = useState("2024-2025");

  const [toast, setToast] = useState<{ message: string; type?: "success" | "error" } | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<TimetableConflict[]>([]);

  // Form state
  const [day, setDay] = useState("1");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [courseId, setCourseId] = useState("");
  const [facultyUserId, setFacultyUserId] = useState("");
  const [room, setRoom] = useState("");

  const loadSlots = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchSlots({
        ...(classGroupId ? { classGroupId } : {}),
        semester: Number(semester),
        academicYear,
      });
      setSlots(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load timetable.");
    } finally {
      setLoading(false);
    }
  }, [classGroupId, semester, academicYear]);

  useEffect(() => {
    loadSlots();
  }, [loadSlots]);

  const openCreate = () => {
    setDay("1");
    setStartTime("09:00");
    setEndTime("10:00");
    setCourseId("");
    setFacultyUserId("");
    setRoom("");
    setFormError(null);
    setConflicts([]);
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!classGroupId) {
      setFormError("Select a class group first.");
      return;
    }
    if (!courseId || !facultyUserId) {
      setFormError("Select both a course and a faculty member.");
      return;
    }
    if (endTime <= startTime) {
      setFormError("End time must be after start time.");
      return;
    }
    setSaving(true);
    setFormError(null);
    setConflicts([]);
    try {
      const slot = await createSlot({
        classGroupId,
        dayOfWeek: Number(day),
        startTime,
        endTime,
        courseId,
        facultyUserId,
        room: room || undefined,
        semester: Number(semester),
        academicYear,
      });
      setSlots((prev) => [...prev, slot]);
      setModalOpen(false);
      await loadSlots();
      setToast({ message: "Timetable slot created.", type: "success" });
    } catch (err) {
      if (err instanceof TimetableConflictError) {
        setConflicts(err.conflicts);
        setFormError("A scheduling conflict was found.");
      } else {
        setFormError(err instanceof Error ? err.message : "Something went wrong.");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (slot: TimetableSlot) => {
    if (!window.confirm("Delete this timetable slot?")) return;
    try {
      await deleteSlot(slot.id);
      setSlots((prev) => prev.filter((x) => x.id !== slot.id));
      setToast({ message: "Timetable slot deleted.", type: "success" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete slot.");
    }
  };

  // Build grid: indexed by `${day}-${startTime}`.
  const grid = new Map<string, TimetableSlot>();
  for (const s of slots) {
    grid.set(`${s.dayOfWeek}-${s.startTime}`, s);
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <PageTitle
        title="Weekly Timetable"
        subtitle="Conflict-free class schedule per class group"
        action={
          canManage ? (
            <Button onClick={openCreate} size="sm">
              <Plus className="h-4 w-4" /> Add Slot
            </Button>
          ) : undefined
        }
      />

      <div className="mt-4 grid grid-cols-1 auto-rows-min gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-slate-700">Class Group ID</label>
          <TextInput value={classGroupId} onChange={(e) => setClassGroupId(e.target.value)} placeholder="e.g. <classGroup id>" />
        </div>
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-slate-700">Semester</label>
          <TextInput value={semester} onChange={(e) => setSemester(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-slate-700">Academic Year</label>
          <TextInput value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} />
        </div>
      </div>

      <div className="mt-6">
        {loading ? (
          <InlineLoader label="Loading timetable…" />
        ) : error ? (
          <ErrorState message={error} onRetry={loadSlots} />
        ) : slots.length === 0 ? (
          <EmptyState
            title="No timetable slots"
            description="No slots found for the selected filters. Use the class group id from the Org module."
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-3 py-3 text-left font-medium text-slate-500">Time</th>
                  {DAYS.map((d) => (
                    <th key={d} className="px-3 py-3 text-left font-medium text-slate-500">
                      {dayOfWeekLabel(d)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {HOURS.map((hour) => (
                  <tr key={hour} className="border-b border-slate-100 last:border-0">
                    <td className="whitespace-nowrap px-3 py-2 font-medium text-slate-500">{hour}</td>
                    {DAYS.map((d) => {
                      const s = grid.get(`${d}-${hour}`);
                      return (
                        <td key={d} className="px-2 py-1.5">
                          {s ? (
                            <div className="rounded-lg bg-indigo-50 px-2 py-1.5">
                              <div className="text-xs font-semibold text-indigo-700">
                                {s.course?.code ?? s.courseId.slice(0, 6)}
                              </div>
                              <div className="text-[11px] text-slate-500">
                                {s.faculty?.name ?? s.facultyUserId.slice(0, 6)}
                                {s.room ? ` · ${s.room}` : ""}
                              </div>
                              {canManage && (
                                <button
                                  onClick={() => handleDelete(s)}
                                  className="mt-1 inline-flex items-center gap-1 text-[11px] text-rose-500 hover:text-rose-600"
                                >
                                  <Trash2 className="h-3 w-3" /> remove
                                </button>
                              )}
                            </div>
                          ) : (
                            <span className="block h-10 rounded-lg border border-dashed border-slate-200" />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-800">New Timetable Slot</h2>
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
                <label className="block text-xs font-bold text-slate-700">Day</label>
                <select
                  value={day}
                  onChange={(e) => setDay(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {DAYS.map((d) => (
                    <option key={d} value={d}>
                      {dayOfWeekLabel(d)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">Start time</label>
                  <TextInput value={startTime} onChange={(e) => setStartTime(e.target.value)} placeholder="HH:mm" />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">End time</label>
                  <TextInput value={endTime} onChange={(e) => setEndTime(e.target.value)} placeholder="HH:mm" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">Course ID</label>
                <TextInput value={courseId} onChange={(e) => setCourseId(e.target.value)} placeholder="e.g. CSE101" />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">Faculty User ID</label>
                <TextInput value={facultyUserId} onChange={(e) => setFacultyUserId(e.target.value)} placeholder="User id of faculty member" />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">Room (optional)</label>
                <TextInput value={room} onChange={(e) => setRoom(e.target.value)} />
              </div>

              {conflicts.length > 0 && (
                <div className="rounded-lg bg-rose-50 p-3">
                  <p className="text-sm font-semibold text-rose-700">Conflicts detected:</p>
                  <ul className="mt-1 space-y-1 text-xs text-rose-600">
                    {conflicts.map((c, i) => (
                      <li key={i}>
                        <span className="font-medium">{c.type}</span>: {c.detail}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {formError && !conflicts.length && (
                <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">{formError}</p>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" loading={saving} disabled={saving}>
                  {saving ? "Saving…" : "Create slot"}
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

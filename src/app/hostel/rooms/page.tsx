"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { PageTitle } from "@/components/hostel/HostelShell";
import { AddRoomModal } from "@/components/hostel/AddRoomModal";
import { Toast } from "@/components/admissions/Toast";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/admissions/States";
import { SchoolSelect } from "@/components/fees/SchoolSelect";
import { useUniversity } from "@/context/UniversityContext";
import {
  canManageHostelRooms,
  createRoom,
  CreateRoomInput,
  fetchRooms,
  HostelApiError,
  HostelRoom,
} from "@/lib/hostel";

function roomTypeLabel(type: string): string {
  if (!type) return "—";
  return type.charAt(0) + type.slice(1).toLowerCase().replace(/_/g, " ");
}

export default function HostelRoomsPage() {
  const { currentUser } = useUniversity();
  const isCentral = currentUser?.schoolId === "ALL";
  const canAdd = canManageHostelRooms(currentUser?.role);

  const [schoolId, setSchoolId] = useState("");
  const [rows, setRows] = useState<HostelRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const list = await fetchRooms({ schoolId: isCentral && schoolId ? schoolId : undefined });
      setRows(list);
    } catch (e) {
      setLoadError(e instanceof HostelApiError ? e.message : "Unable to load rooms.");
    } finally {
      setLoading(false);
    }
  }, [isCentral, schoolId]);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async (input: CreateRoomInput) => {
    setBusy(true);
    setSubmitError(null);
    try {
      await createRoom(input);
      setToast({ message: "Room created.", type: "success" });
      setModalOpen(false);
      load();
    } catch (e) {
      setSubmitError(e instanceof HostelApiError ? e.message : "Unable to create room.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageTitle
        title="Hostel Rooms"
        subtitle="Rooms and current occupancy across the hostel."
        action={
          canAdd ? (
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-colors cursor-pointer"
            >
              <Plus className="h-4 w-4" /> Add Room
            </button>
          ) : undefined
        }
      />

      {isCentral && (
        <div className="mb-5 max-w-xs">
          <SchoolSelect value={schoolId} onChange={setSchoolId} label="School" htmlFor="rooms-school" />
        </div>
      )}

      {loading ? (
        <LoadingSkeleton rows={5} />
      ) : loadError ? (
        <ErrorState message={loadError} onRetry={load} />
      ) : rows.length === 0 ? (
        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm">
          <EmptyState
            title="No rooms yet"
            description={
              canAdd
                ? "Add your first hostel room to get started."
                : "No rooms are available for your school."
            }
          />
        </div>
      ) : (
        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="px-5 py-3 font-bold">Room No</th>
                  <th className="px-5 py-3 font-bold">Type</th>
                  <th className="px-5 py-3 font-bold text-right">Capacity</th>
                  <th className="px-5 py-3 font-bold text-right">Occupied</th>
                  <th className="px-5 py-3 font-bold text-right">Available</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((room) => {
                  const available = room.capacity - room.occupied;
                  const full = available <= 0;
                  return (
                    <tr
                      key={room.id}
                      className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/60 transition-colors"
                    >
                      <td className="px-5 py-3.5 font-bold text-slate-900">{room.roomNo}</td>
                      <td className="px-5 py-3.5 text-slate-600">{roomTypeLabel(room.type)}</td>
                      <td className="px-5 py-3.5 text-right text-slate-600">{room.capacity}</td>
                      <td className="px-5 py-3.5 text-right text-slate-600">{room.occupied}</td>
                      <td className="px-5 py-3.5 text-right">
                        <span
                          className={`inline-flex text-xs font-bold px-2.5 py-1 rounded-full border ${
                            full
                              ? "bg-rose-50 text-rose-700 border-rose-200"
                              : "bg-emerald-50 text-emerald-700 border-emerald-200"
                          }`}
                        >
                          {full ? "Full" : available}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <AddRoomModal
        open={modalOpen}
        busy={busy}
        error={submitError}
        schoolRequired={isCentral}
        onClose={() => setModalOpen(false)}
        onSubmit={submit}
      />

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  );
}

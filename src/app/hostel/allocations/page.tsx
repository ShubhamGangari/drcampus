"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { PageTitle } from "@/components/hostel/HostelShell";
import { AllocateModal } from "@/components/hostel/AllocateModal";
import { Toast } from "@/components/admissions/Toast";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/admissions/States";
import { SchoolSelect } from "@/components/fees/SchoolSelect";
import { useUniversity } from "@/context/UniversityContext";
import {
  AllocateInput,
  allocateRoom,
  canManageHostelRooms,
  fetchAllocations,
  fetchRooms,
  HostelAllocation,
  HostelApiError,
  HostelRoom,
  vacateAllocation,
} from "@/lib/hostel";

function allocationStatusBadge(status: HostelAllocation["status"]) {
  if (status === "ACTIVE") {
    return (
      <span className="inline-flex text-xs font-bold px-2.5 py-1 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200">
        Active
      </span>
    );
  }
  return (
    <span className="inline-flex text-xs font-bold px-2.5 py-1 rounded-full border bg-slate-100 text-slate-600 border-slate-200">
      Vacated
    </span>
  );
}

function formatDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export default function HostelAllocationsPage() {
  const { currentUser } = useUniversity();
  const isCentral = currentUser?.schoolId === "ALL";
  const isStudent = currentUser?.role === "STUDENT";
  const canManage = canManageHostelRooms(currentUser?.role);

  const [schoolId, setSchoolId] = useState("");
  const [rows, setRows] = useState<HostelAllocation[]>([]);
  const [rooms, setRooms] = useState<HostelRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const schoolParam = isCentral && schoolId ? schoolId : undefined;

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [allocations, roomList] = await Promise.all([
        fetchAllocations({ schoolId: schoolParam }),
        fetchRooms({ schoolId: schoolParam }),
      ]);
      setRows(allocations);
      setRooms(roomList);
    } catch (e) {
      setLoadError(e instanceof HostelApiError ? e.message : "Unable to load allocations.");
    } finally {
      setLoading(false);
    }
  }, [schoolParam]);

  useEffect(() => {
    load();
  }, [load]);

  const submitAllocate = async (input: AllocateInput) => {
    setBusy(true);
    setSubmitError(null);
    try {
      await allocateRoom(input);
      setToast({ message: "Room allocated.", type: "success" });
      setModalOpen(false);
      load();
    } catch (e) {
      setSubmitError(e instanceof HostelApiError ? e.message : "Unable to allocate room.");
    } finally {
      setBusy(false);
    }
  };

  const handleVacate = async (allocation: HostelAllocation) => {
    if (!window.confirm(`Vacate room ${allocation.roomNo} for ${allocation.studentName}?`)) {
      return;
    }
    setBusy(true);
    setSubmitError(null);
    try {
      await vacateAllocation({ schoolId: schoolParam, allocationId: allocation.id });
      setToast({ message: "Allocation vacated.", type: "success" });
      load();
    } catch (e) {
      setToast({
        message: e instanceof HostelApiError ? e.message : "Unable to vacate allocation.",
        type: "error",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageTitle
        title="Room Allocations"
        subtitle={isStudent ? "Your current room allocation." : "Student room allocations across the hostel."}
        action={
          canManage ? (
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-colors cursor-pointer"
            >
              <Plus className="h-4 w-4" /> Allocate
            </button>
          ) : undefined
        }
      />

      {isCentral && (
        <div className="mb-5 max-w-xs">
          <SchoolSelect
            value={schoolId}
            onChange={setSchoolId}
            label="School"
            htmlFor="allocations-school"
          />
        </div>
      )}

      {loading ? (
        <LoadingSkeleton rows={5} />
      ) : loadError ? (
        <ErrorState message={loadError} onRetry={load} />
      ) : rows.length === 0 ? (
        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm">
          <EmptyState
            title={isStudent ? "No allocation yet" : "No allocations yet"}
            description={
              isStudent
                ? "You have not been allocated a hostel room."
                : "Allocate students to rooms to manage hostel occupancy."
            }
          />
        </div>
      ) : (
        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="px-5 py-3 font-bold">Student</th>
                  <th className="px-5 py-3 font-bold">Room</th>
                  <th className="px-5 py-3 font-bold">Allocated On</th>
                  <th className="px-5 py-3 font-bold">Status</th>
                  {canManage && <th className="px-5 py-3 font-bold text-right">Action</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/60 transition-colors"
                  >
                    <td className="px-5 py-3.5 font-semibold text-slate-800">{row.studentName}</td>
                    <td className="px-5 py-3.5 font-bold text-slate-900">{row.roomNo}</td>
                    <td className="px-5 py-3.5 text-slate-600">{formatDate(row.allocationDate)}</td>
                    <td className="px-5 py-3.5">{allocationStatusBadge(row.status)}</td>
                    {canManage && (
                      <td className="px-5 py-3.5 text-right">
                        {row.status === "ACTIVE" ? (
                          <button
                            type="button"
                            onClick={() => handleVacate(row)}
                            disabled={busy}
                            className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50"
                          >
                            Vacate
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <AllocateModal
        open={modalOpen}
        rooms={rooms}
        busy={busy}
        error={submitError}
        schoolRequired={isCentral}
        onClose={() => setModalOpen(false)}
        onSubmit={submitAllocate}
      />

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  );
}

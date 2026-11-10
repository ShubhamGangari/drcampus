"use client";

import { useCallback, useEffect, useState } from "react";
import { HandCoins, HeartHandshake, CalendarDays, PiggyBank } from "lucide-react";
import { PageTitle } from "@/components/alumni/AlumniShell";
import { RecordDonationModal } from "@/components/alumni/RecordDonationModal";
import { Toast } from "@/components/admissions/Toast";
import { ErrorState, LoadingSkeleton } from "@/components/admissions/States";
import { SchoolSelect } from "@/components/fees/SchoolSelect";
import { useUniversity } from "@/context/UniversityContext";
import {
  AlumniApiError,
  AlumniDonationsResponse,
  canViewAlumni,
  fetchDonations,
  formatCurrency,
  formatDate,
  isAlumniStudent,
  recordDonation,
  RecordDonationInput,
} from "@/lib/alumni";

export default function AlumniDonationsPage() {
  const { currentUser } = useUniversity();
  const isCentral = currentUser?.schoolId === "ALL";
  const isStudent = isAlumniStudent(currentUser?.role);
  const canView = canViewAlumni(currentUser?.role);

  const [schoolId, setSchoolId] = useState("");
  const [data, setData] = useState<AlumniDonationsResponse | null>(null);
  const [loading, setLoading] = useState(isStudent ? false : true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetchDonations({
        schoolId: isCentral && schoolId ? schoolId : undefined,
      });
      setData(res);
    } catch (e) {
      setLoadError(e instanceof AlumniApiError ? e.message : "Unable to load donations.");
    } finally {
      setLoading(false);
    }
  }, [isCentral, schoolId]);

  useEffect(() => {
    if (canView) load();
  }, [load, canView]);

  const handleRecord = async (input: RecordDonationInput) => {
    setBusy(true);
    setSubmitError(null);
    try {
      await recordDonation(input);
      setModalOpen(false);
      setToast({ message: "Donation recorded. Thank you!", type: "success" });
      if (canView) await load();
    } catch (e) {
      setSubmitError(e instanceof AlumniApiError ? e.message : "Could not record donation.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageTitle
        title="Donations"
        subtitle={isStudent ? "Support the alumni fund" : "Alumni fund contributions"}
        action={
          isStudent ? (
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-indigo-600 transition-colors cursor-pointer"
            >
              <HandCoins className="h-3.5 w-3.5" /> Record Donation
            </button>
          ) : undefined
        }
      />

      {isCentral && canView && (
        <div className="sm:max-w-xs mb-6">
          <SchoolSelect value={schoolId} onChange={setSchoolId} />
        </div>
      )}

      {isStudent ? (
        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-8 flex flex-col items-center text-center">
          <div className="h-14 w-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mb-4">
            <HeartHandshake className="h-7 w-7" />
          </div>
          <h3 className="text-base font-black text-slate-900">Contribute to the alumni fund</h3>
          <p className="text-sm text-slate-500 mt-1.5 max-w-md">
            Record a donation to support current and future students. Your contribution is
            visible to the registrar and dean.
          </p>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-indigo-600 transition-colors cursor-pointer"
          >
            <HandCoins className="h-3.5 w-3.5" /> Record Donation
          </button>
        </div>
      ) : (
        <>
          {!loading && !loadError && data && (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              <StatCard
                icon={PiggyBank}
                label="Total raised"
                value={formatCurrency(data.totals.sum)}
              />
              <StatCard icon={HandCoins} label="Donations" value={String(data.totals.count)} />
              <StatCard
                icon={CalendarDays}
                label="Average donation"
                value={
                  data.totals.count > 0
                    ? formatCurrency(data.totals.sum / data.totals.count)
                    : "—"
                }
              />
            </div>
          )}

          <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
            {loading ? (
              <div className="p-6">
                <LoadingSkeleton rows={4} />
              </div>
            ) : loadError ? (
              <ErrorState message={loadError} onRetry={load} />
            ) : !data || data.donations.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-14 px-6">
                <div className="h-12 w-12 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                  <HeartHandshake className="h-6 w-6 text-slate-400" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">No donations recorded</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm">
                  Donations will appear here once alumni contribute.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/70">
                      <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        Alumni
                      </th>
                      <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        Amount
                      </th>
                      <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        Mode
                      </th>
                      <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        Date
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.donations.map((d) => (
                      <tr key={d.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-5 py-3.5 font-bold text-slate-900">
                          {d.alumniName}
                        </td>
                        <td className="px-5 py-3.5 font-black text-emerald-600">
                          {formatCurrency(d.amount)}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="inline-flex rounded-lg bg-slate-100 text-slate-600 text-xs font-bold px-2.5 py-1">
                            {d.mode}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-slate-600">
                          {formatDate(d.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {isStudent && (
        <RecordDonationModal
          open={modalOpen}
          busy={busy}
          error={submitError}
          schoolRequired={isCentral}
          onClose={() => setModalOpen(false)}
          onSubmit={handleRecord}
        />
      )}

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5 flex items-center gap-4">
      <div className="h-11 w-11 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
        <p className="text-lg font-black text-slate-900 tracking-tight">{value}</p>
      </div>
    </div>
  );
}

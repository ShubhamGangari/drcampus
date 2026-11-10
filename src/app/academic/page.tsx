import Link from "next/link";
import { CalendarDays, CalendarClock, ArrowRight } from "lucide-react";

export default function AcademicPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-2xl font-black text-slate-900">Academic Scheduling</h1>
        <p className="mx-auto mt-2 max-w-lg text-sm text-slate-500">
          Publish the university academic calendar and conflict-free weekly timetables
          for every class group.
        </p>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Link
          href="/academic/calendar"
          className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-indigo-300 hover:shadow-md"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
            <CalendarDays className="h-5 w-5" />
          </div>
          <h2 className="mt-4 flex items-center gap-1 text-lg font-bold text-slate-900">
            Academic Calendar
            <ArrowRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-indigo-500" />
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            School-wide and program-scoped events, holidays, exams, and deadlines.
          </p>
        </Link>

        <Link
          href="/academic/timetable"
          className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-indigo-300 hover:shadow-md"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
            <CalendarClock className="h-5 w-5" />
          </div>
          <h2 className="mt-4 flex items-center gap-1 text-lg font-bold text-slate-900">
            Weekly Timetable
            <ArrowRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-indigo-500" />
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Conflict-free weekly class schedule per class group, with automatic clash detection.
          </p>
        </Link>
      </div>
    </div>
  );
}

import Link from "next/link";
import { SearchX } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-50 font-sans antialiased text-slate-800 flex items-center justify-center p-6">
      <div className="text-center">
        <div className="h-14 w-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-5">
          <SearchX className="h-7 w-7 text-slate-400" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Page not found</h1>
        <p className="text-sm text-slate-500 mt-2 max-w-sm mx-auto">
          The page you are looking for doesn’t exist or has been moved.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center gap-2 text-xs font-bold px-4 py-2.5 rounded-xl bg-slate-900 text-white hover:bg-slate-800 transition-colors"
        >
          Back to portal
        </Link>
      </div>
    </div>
  );
}

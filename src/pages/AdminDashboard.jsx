import { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import LocationsManager from "../components/LocationsManager";
import VacantRoomsManager from "../components/VacantRoomsManager";
import VisitRequestsManager from "../components/VisitRequestsManager";

const TABS = [
  { key: "vacant", label: "Vacant rooms" },
  { key: "locations", label: "Locations" },
  { key: "requests", label: "Visit requests" },
];

export default function AdminDashboard() {
  const { session } = useAuth();
  const [tab, setTab] = useState("vacant");

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:py-10">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Manager dashboard
          </h1>
          <p className="mt-1 text-sm text-slate-500">{session.user.email}</p>
        </div>
        <button
          type="button"
          onClick={() => supabase.auth.signOut()}
          className="shrink-0 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50"
        >
          Sign out
        </button>
      </div>

      <div className="mb-6 flex gap-6 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`-mb-px border-b-2 px-1 pb-3 text-sm font-medium transition-colors ${
              tab === t.key
                ? "border-slate-900 text-slate-900"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "vacant" && <VacantRoomsManager userId={session.user.id} />}
      {tab === "locations" && <LocationsManager userId={session.user.id} />}
      {tab === "requests" && (
        <VisitRequestsManager userId={session.user.id} />
      )}
    </div>
  );
}

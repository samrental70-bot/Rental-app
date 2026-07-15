import { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import RoomsManager from "../components/RoomsManager";
import VisitRequestsManager from "../components/VisitRequestsManager";

const TABS = [
  { key: "rooms", label: "Rooms" },
  { key: "requests", label: "Visit requests" },
];

export default function AdminDashboard() {
  const { session } = useAuth();
  const [tab, setTab] = useState("rooms");

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Manager dashboard</h1>
          <p className="text-sm text-slate-500">{session.user.email}</p>
        </div>
        <button
          type="button"
          onClick={() => supabase.auth.signOut()}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Sign out
        </button>
      </div>

      <div className="mb-6 flex gap-2 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`px-3 py-2 text-sm font-medium ${
              tab === t.key
                ? "border-b-2 border-slate-900 text-slate-900"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "rooms" ? (
        <RoomsManager userId={session.user.id} />
      ) : (
        <VisitRequestsManager userId={session.user.id} />
      )}
    </div>
  );
}

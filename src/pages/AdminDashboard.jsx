import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import LocationsManager from "../components/LocationsManager";
import VacantRoomsManager from "../components/VacantRoomsManager";
import VisitRequestsManager from "../components/VisitRequestsManager";
import TenantsManager from "../components/TenantsManager";
import CleaningDutyManager from "../components/CleaningDutyManager";
import PapaAccountsManager from "../components/papa/PapaAccountsManager";

const TABS = [
  { key: "vacant", label: "Vacant rooms" },
  { key: "locations", label: "Locations" },
  { key: "tenants", label: "Tenant rents" },
  { key: "cleaning", label: "Cleaning duty" },
  { key: "requests", label: "Visit requests" },
  { key: "papa", label: "18 Papa Accounts" },
];

export default function AdminDashboard() {
  const { session } = useAuth();
  const [tab, setTab] = useState("vacant");
  // Set when this login is a "18 Papa Accounts" team member of another
  // manager's workspace — they only see that tab.
  const [papaOwnerId, setPapaOwnerId] = useState(null);

  const userId = session.user.id;
  const userEmail = session.user.email;

  useEffect(() => {
    let isMounted = true;
    supabase
      .from("papa_members")
      .select("manager_id, email")
      .neq("manager_id", userId)
      .then(({ data }) => {
        if (!isMounted) return;
        const membership = (data || []).find(
          (m) => m.email && m.email.toLowerCase() === userEmail?.toLowerCase()
        );
        if (membership) {
          setPapaOwnerId(membership.manager_id);
          setTab("papa");
        }
      });
    return () => {
      isMounted = false;
    };
  }, [userId, userEmail]);

  const visibleTabs = papaOwnerId ? TABS.filter((t) => t.key === "papa") : TABS;

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

      <div className="mb-6 flex gap-6 overflow-x-auto border-b border-slate-200">
        {visibleTabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`-mb-px whitespace-nowrap border-b-2 px-1 pb-3 text-sm font-medium transition-colors ${
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
      {tab === "tenants" && <TenantsManager userId={session.user.id} />}
      {tab === "cleaning" && <CleaningDutyManager userId={session.user.id} />}
      {tab === "papa" && (
        <PapaAccountsManager
          ownerId={papaOwnerId || userId}
          isOwner={!papaOwnerId}
          userEmail={userEmail}
        />
      )}
      {tab === "requests" && (
        <VisitRequestsManager userId={session.user.id} />
      )}
    </div>
  );
}

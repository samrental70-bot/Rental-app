import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";

function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function dayDiff(dateStr) {
  const start = new Date(`${dateStr}T00:00:00`);
  const now = new Date(`${today()}T00:00:00`);
  return Math.round((now - start) / 86400000);
}

function turnStatus(turn) {
  if (turn.completed) return { label: "Completed", tone: "done" };
  if (turn.proof_submitted_at)
    return { label: "Proof submitted — awaiting approval", tone: "review" };
  const diff = dayDiff(turn.start_date);
  if (diff < -1) return { label: "Upcoming", tone: "upcoming" };
  if (diff === -1) return { label: "Starts tomorrow", tone: "upcoming" };
  if (diff === 0) return { label: "In progress (day 0)", tone: "active" };
  if (diff === 1) return { label: "In progress — 2nd reminder due", tone: "active" };
  if (diff === 2) return { label: "In progress — 3rd reminder due", tone: "active" };
  return { label: "Overdue — manager alerted", tone: "overdue" };
}

const STATUS_STYLES = {
  done: "bg-slate-100 text-slate-600",
  review: "bg-amber-100 text-amber-800",
  upcoming: "bg-slate-100 text-slate-600",
  active: "bg-emerald-100 text-emerald-800",
  overdue: "bg-red-100 text-red-700",
};

function rotationSort(a, b) {
  if (a.cleaning_order != null && b.cleaning_order != null) {
    return a.cleaning_order - b.cleaning_order;
  }
  if (a.cleaning_order != null) return -1;
  if (b.cleaning_order != null) return 1;
  return new Date(a.created_at) - new Date(b.created_at);
}

export default function CleaningDutyManager({ userId }) {
  const [locations, setLocations] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [activeTurns, setActiveTurns] = useState({}); // location_id -> turn
  const [photos, setPhotos] = useState({}); // turn_id -> [{path, url}]
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [cycleForms, setCycleForms] = useState({}); // location_id -> {cycle_days, start_date}

  function reload() {
    setReloadToken((t) => t + 1);
  }

  useEffect(() => {
    let isMounted = true;

    async function load() {
      setLoading(true);
      const [locRes, tenantRes] = await Promise.all([
        supabase
          .from("locations")
          .select("id, name, cleaning_cycle_days, cleaning_start_date")
          .eq("manager_id", userId)
          .order("name"),
        supabase
          .from("tenants")
          .select(
            "id, name, location_id, whatsapp_number, cleaning_order, created_at"
          )
          .eq("manager_id", userId)
          .order("created_at", { ascending: true }),
      ]);

      if (!isMounted) return;
      if (locRes.error) {
        setError(locRes.error.message);
        setLoading(false);
        return;
      }
      if (tenantRes.error) {
        setError(tenantRes.error.message);
        setLoading(false);
        return;
      }

      const locationIds = (locRes.data || []).map((l) => l.id);
      let turnRows = [];
      if (locationIds.length > 0) {
        const { data: turnData, error: turnError } = await supabase
          .from("cleaning_turns")
          .select("*")
          .in("location_id", locationIds)
          .eq("completed", false);
        if (!isMounted) return;
        if (turnError) {
          setError(turnError.message);
          setLoading(false);
          return;
        }
        turnRows = turnData || [];
      }

      const turnsByLocation = {};
      for (const t of turnRows) turnsByLocation[t.location_id] = t;

      let photoMap = {};
      const turnIds = turnRows.map((t) => t.id);
      if (turnIds.length > 0) {
        const { data: photoRows, error: photoError } = await supabase
          .from("cleaning_turn_photos")
          .select("*")
          .in("turn_id", turnIds);
        if (!isMounted) return;
        if (!photoError && photoRows) {
          for (const p of photoRows) {
            const { data: signed } = await supabase.storage
              .from("cleaning-photos")
              .createSignedUrl(p.storage_path, 3600);
            if (!photoMap[p.turn_id]) photoMap[p.turn_id] = [];
            photoMap[p.turn_id].push({
              id: p.id,
              url: signed?.signedUrl,
            });
          }
        }
      }

      if (!isMounted) return;
      setLocations(locRes.data || []);
      setTenants(tenantRes.data || []);
      setActiveTurns(turnsByLocation);
      setPhotos(photoMap);
      setLoading(false);
    }

    load();
    return () => {
      isMounted = false;
    };
  }, [userId, reloadToken]);

  const tenantsByLocation = useMemo(() => {
    const map = new Map();
    for (const t of tenants) {
      if (!t.location_id) continue;
      if (!map.has(t.location_id)) map.set(t.location_id, []);
      map.get(t.location_id).push(t);
    }
    for (const list of map.values()) list.sort(rotationSort);
    return map;
  }, [tenants]);

  async function setUpRotation(location) {
    const form = cycleForms[location.id];
    if (!form?.cycle_days || !form?.start_date) return;
    const roster = tenantsByLocation.get(location.id) || [];
    if (roster.length === 0) {
      setError("Add tenants to this property before setting up a rotation.");
      return;
    }

    const { error: locError } = await supabase
      .from("locations")
      .update({
        cleaning_cycle_days: Number(form.cycle_days),
        cleaning_start_date: form.start_date,
      })
      .eq("id", location.id);
    if (locError) {
      setError(locError.message);
      return;
    }

    const firstTenant = roster[0];
    const { error: turnError } = await supabase.from("cleaning_turns").insert({
      location_id: location.id,
      tenant_id: firstTenant.id,
      start_date: form.start_date,
      due_date: addDays(form.start_date, 3),
    });
    if (turnError) {
      setError(turnError.message);
      return;
    }
    reload();
  }

  async function approveTurn(location, turn) {
    if (
      !window.confirm(
        "Approve this cleaning turn and move rotation to the next tenant?"
      )
    ) {
      return;
    }
    const { error: updateError } = await supabase
      .from("cleaning_turns")
      .update({ completed: true, completed_at: new Date().toISOString() })
      .eq("id", turn.id);
    if (updateError) {
      setError(updateError.message);
      return;
    }

    const roster = tenantsByLocation.get(location.id) || [];
    const currentIndex = roster.findIndex((t) => t.id === turn.tenant_id);
    const nextTenant =
      roster[(currentIndex + 1) % roster.length] || roster[0];
    // Next turn is anchored to the approval date, not a fixed calendar —
    // the rotation doesn't advance until the manager approves, so a late
    // approval simply shifts the next tenant's start date forward.
    const nextStart = addDays(today(), 1);

    const { error: insertError } = await supabase
      .from("cleaning_turns")
      .insert({
        location_id: location.id,
        tenant_id: nextTenant.id,
        start_date: nextStart,
        due_date: addDays(nextStart, 3),
      });
    if (insertError) {
      setError(insertError.message);
    }
    reload();
  }

  async function updateWhatsapp(tenant, rawValue) {
    const value = rawValue.trim() || null;
    const { error: updateError } = await supabase
      .from("tenants")
      .update({ whatsapp_number: value })
      .eq("id", tenant.id);
    if (updateError) {
      setError(updateError.message);
    }
    reload();
  }

  async function updateCleaningOrder(tenant, rawValue) {
    const value = rawValue === "" ? null : Number(rawValue);
    const { error: updateError } = await supabase
      .from("tenants")
      .update({ cleaning_order: value })
      .eq("id", tenant.id);
    if (updateError) {
      setError(updateError.message);
    }
    reload();
  }

  const locationsWithTenants = locations.filter(
    (loc) => (tenantsByLocation.get(loc.id) || []).length > 0
  );

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold tracking-tight text-slate-900">
        Cleaning duty
      </h2>

      {loading && <p className="text-slate-500">Loading…</p>}
      {error && <p className="mb-4 text-red-600">{error}</p>}
      {!loading && locationsWithTenants.length === 0 && (
        <p className="rounded-xl border border-dashed border-slate-200 bg-white p-6 text-center text-slate-500">
          Add tenants to a property (Tenant rents tab) to set up a cleaning
          rotation.
        </p>
      )}

      <div className="space-y-6">
        {locationsWithTenants.map((location) => {
          const roster = tenantsByLocation.get(location.id) || [];
          const turn = activeTurns[location.id];
          const isConfigured = Boolean(
            location.cleaning_cycle_days && location.cleaning_start_date
          );

          return (
            <div
              key={location.id}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <h3 className="text-base font-semibold text-slate-900">
                {location.name}
              </h3>

              {!isConfigured && (
                <div className="mt-4 flex flex-wrap items-end gap-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4">
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Cycle (days between turns)
                    </span>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      placeholder="e.g. 7"
                      className="input !w-28"
                      value={cycleForms[location.id]?.cycle_days || ""}
                      onChange={(e) =>
                        setCycleForms((prev) => ({
                          ...prev,
                          [location.id]: {
                            ...prev[location.id],
                            cycle_days: e.target.value,
                          },
                        }))
                      }
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      First cleaning date
                    </span>
                    <input
                      type="date"
                      className="input !w-40"
                      value={cycleForms[location.id]?.start_date || ""}
                      onChange={(e) =>
                        setCycleForms((prev) => ({
                          ...prev,
                          [location.id]: {
                            ...prev[location.id],
                            start_date: e.target.value,
                          },
                        }))
                      }
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => setUpRotation(location)}
                    className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700"
                  >
                    Start rotation
                  </button>
                </div>
              )}

              {isConfigured && (
                <p className="mt-1 text-sm text-slate-500">
                  Every {location.cleaning_cycle_days} day
                  {location.cleaning_cycle_days === 1 ? "" : "s"} · started{" "}
                  {formatDate(location.cleaning_start_date)}
                </p>
              )}

              {isConfigured && turn && (
                <div className="mt-4 rounded-xl border border-slate-200 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-900">
                        {roster.find((t) => t.id === turn.tenant_id)?.name ||
                          "Tenant"}
                      </p>
                      <p className="text-sm text-slate-500">
                        {formatDate(turn.start_date)} &rarr;{" "}
                        {formatDate(turn.due_date)}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        STATUS_STYLES[turnStatus(turn).tone]
                      }`}
                    >
                      {turnStatus(turn).label}
                    </span>
                  </div>

                  {photos[turn.id]?.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {photos[turn.id].map((p) =>
                        p.url ? (
                          <a
                            key={p.id}
                            href={p.url}
                            target="_blank"
                            rel="noreferrer"
                            className="block h-20 w-20 overflow-hidden rounded-lg border border-slate-200"
                          >
                            <img
                              src={p.url}
                              alt="Cleaning proof"
                              className="h-full w-full object-cover"
                            />
                          </a>
                        ) : null
                      )}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => approveTurn(location, turn)}
                    className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700"
                  >
                    Approve &amp; move to next tenant
                  </button>
                </div>
              )}

              <div className="mt-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Rotation order
                </p>
                <div className="space-y-2">
                  {roster.map((tenant, index) => (
                    <div
                      key={tenant.id}
                      className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm"
                    >
                      <span className="w-6 text-center font-semibold text-slate-400">
                        {index + 1}
                      </span>
                      <span className="min-w-[8rem] font-medium text-slate-900">
                        {tenant.name}
                      </span>
                      <input
                        type="tel"
                        placeholder="WhatsApp number (+1…)"
                        defaultValue={tenant.whatsapp_number || ""}
                        key={`wa-${tenant.id}-${tenant.whatsapp_number || ""}`}
                        className="input !w-44"
                        onBlur={(e) => {
                          if (e.target.value !== (tenant.whatsapp_number || "")) {
                            updateWhatsapp(tenant, e.target.value);
                          }
                        }}
                      />
                      <input
                        type="number"
                        placeholder="Order"
                        defaultValue={tenant.cleaning_order ?? ""}
                        key={`order-${tenant.id}-${tenant.cleaning_order ?? ""}`}
                        className="input !w-20"
                        onBlur={(e) => {
                          if (
                            e.target.value !==
                            String(tenant.cleaning_order ?? "")
                          ) {
                            updateCleaningOrder(tenant, e.target.value);
                          }
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

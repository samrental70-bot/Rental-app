import { Fragment, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
}

function monthLabel(monthStr) {
  return new Date(`${monthStr}T00:00:00`).toLocaleDateString("en-CA", {
    year: "numeric",
    month: "short",
  });
}

const UNIT_LEVELS = [
  { value: "basement", label: "Basement" },
  { value: "main_floor", label: "Main floor" },
  { value: "upper_floor", label: "Upper floor" },
];
const UNIT_LEVEL_ORDER = [...UNIT_LEVELS.map((u) => u.value), "unspecified"];

function unitLevelLabel(value) {
  return UNIT_LEVELS.find((u) => u.value === value)?.label || "Other unit";
}

export default function TenantsManager({ userId }) {
  const [tenants, setTenants] = useState([]);
  const [locations, setLocations] = useState([]);
  const [payments, setPayments] = useState({}); // tenantId -> { monthStr: paymentRow }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [addingTenant, setAddingTenant] = useState(false);
  const [newTenant, setNewTenant] = useState({
    name: "",
    monthly_rent: "",
    location_id: "",
    unit_level: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      setLoading(true);
      const { data: locationRows, error: locationsError } = await supabase
        .from("locations")
        .select("id, name")
        .eq("manager_id", userId)
        .order("name");

      if (!isMounted) return;
      if (locationsError) {
        setError(locationsError.message);
        setLoading(false);
        return;
      }
      setLocations(locationRows || []);

      const { data: tenantRows, error: tenantsError } = await supabase
        .from("tenants")
        .select("*, locations(id, name)")
        .eq("manager_id", userId)
        .order("created_at", { ascending: true });

      if (!isMounted) return;
      if (tenantsError) {
        setError(tenantsError.message);
        setLoading(false);
        return;
      }

      const ids = (tenantRows || []).map((t) => t.id);
      let paymentRows = [];
      if (ids.length > 0) {
        const { data: pData, error: pError } = await supabase
          .from("tenant_rent_payments")
          .select("*")
          .in("tenant_id", ids);
        if (!isMounted) return;
        if (pError) {
          setError(pError.message);
          setLoading(false);
          return;
        }
        paymentRows = pData || [];
      }

      const map = {};
      for (const p of paymentRows) {
        if (!map[p.tenant_id]) map[p.tenant_id] = {};
        map[p.tenant_id][p.month] = p;
      }

      setTenants(tenantRows || []);
      setPayments(map);
      setLoading(false);
    }

    load();
    return () => {
      isMounted = false;
    };
  }, [userId, reloadToken]);

  function reload() {
    setReloadToken((t) => t + 1);
  }

  const months = useMemo(() => {
    if (tenants.length === 0) return [];
    const currentMonth = monthKey(new Date());
    const earliest = tenants.reduce(
      (min, t) => (t.start_month < min ? t.start_month : min),
      tenants[0].start_month
    );
    const result = [];
    let cursor = new Date(`${earliest}T00:00:00`);
    const end = new Date(`${currentMonth}T00:00:00`);
    while (cursor <= end) {
      result.push(monthKey(cursor));
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    }
    return result;
  }, [tenants]);

  const groupedTenants = useMemo(() => {
    const byLocation = new Map();
    for (const tenant of tenants) {
      const locKey = tenant.location_id || "unassigned";
      const locName = tenant.locations?.name || "Unassigned property";
      if (!byLocation.has(locKey)) {
        byLocation.set(locKey, { name: locName, units: new Map() });
      }
      const group = byLocation.get(locKey);
      const unitKey = tenant.unit_level || "unspecified";
      if (!group.units.has(unitKey)) group.units.set(unitKey, []);
      group.units.get(unitKey).push(tenant);
    }

    const locationEntries = Array.from(byLocation.entries()).sort((a, b) => {
      if (a[0] === "unassigned") return 1;
      if (b[0] === "unassigned") return -1;
      return a[1].name.localeCompare(b[1].name);
    });

    return locationEntries.map(([locKey, group]) => ({
      locKey,
      name: group.name,
      units: UNIT_LEVEL_ORDER.filter((u) => group.units.has(u)).map((u) => ({
        key: u,
        label: unitLevelLabel(u),
        tenants: group.units.get(u),
      })),
    }));
  }, [tenants]);

  const totalColumns = 5 + months.length;

  async function addTenant(event) {
    event.preventDefault();
    if (
      !newTenant.name.trim() ||
      newTenant.monthly_rent === "" ||
      !newTenant.location_id ||
      !newTenant.unit_level
    ) {
      return;
    }
    setSaving(true);
    const { error: insertError } = await supabase.from("tenants").insert({
      manager_id: userId,
      name: newTenant.name.trim(),
      monthly_rent: Number(newTenant.monthly_rent),
      location_id: newTenant.location_id,
      unit_level: newTenant.unit_level,
    });
    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setNewTenant({ name: "", monthly_rent: "", location_id: "", unit_level: "" });
    setAddingTenant(false);
    reload();
  }

  async function deleteTenant(tenant) {
    if (
      !window.confirm(
        `Delete tenant "${tenant.name}"? This removes their entire rent history and cannot be undone.`
      )
    ) {
      return;
    }
    const { error: deleteError } = await supabase
      .from("tenants")
      .delete()
      .eq("id", tenant.id);
    if (!deleteError) reload();
  }

  async function updateTenantField(tenant, field, rawValue) {
    const value = rawValue === "" ? null : Number(rawValue);
    const { error: updateError } = await supabase
      .from("tenants")
      .update({ [field]: value })
      .eq("id", tenant.id);
    if (updateError) {
      setError(updateError.message);
    }
    reload();
  }

  async function updatePayment(tenant, month, patch) {
    const existing = payments[tenant.id]?.[month];
    const nextReceived = patch.received ?? existing?.received ?? false;
    const nextAmount =
      patch.amount_received !== undefined
        ? patch.amount_received
        : existing?.amount_received ?? null;

    setPayments((prev) => ({
      ...prev,
      [tenant.id]: {
        ...prev[tenant.id],
        [month]: {
          ...existing,
          month,
          tenant_id: tenant.id,
          received: nextReceived,
          amount_received: nextAmount,
        },
      },
    }));

    const { error: upsertError } = await supabase
      .from("tenant_rent_payments")
      .upsert(
        {
          tenant_id: tenant.id,
          month,
          received: nextReceived,
          amount_received: nextAmount,
        },
        { onConflict: "tenant_id,month" }
      );
    if (upsertError) {
      setError(upsertError.message);
      reload();
    }
  }

  function handleToggleReceived(tenant, month) {
    const existing = payments[tenant.id]?.[month];
    const nextReceived = !existing?.received;
    const patch = { received: nextReceived };
    if (nextReceived && existing?.amount_received == null) {
      patch.amount_received = tenant.monthly_rent;
    }
    updatePayment(tenant, month, patch);
  }

  function handleAmountChange(tenant, month, rawValue) {
    updatePayment(tenant, month, {
      amount_received: rawValue === "" ? null : Number(rawValue),
    });
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight text-slate-900">
          Tenant rents
        </h2>
        <button
          type="button"
          onClick={() => setAddingTenant((v) => !v)}
          className="rounded-xl bg-slate-900 px-3.5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-700"
        >
          + Add tenant
        </button>
      </div>

      {addingTenant && locations.length === 0 && (
        <p className="mb-6 rounded-xl border border-dashed border-slate-200 bg-white p-6 text-center text-slate-500">
          Add a location first (Locations tab) before adding tenants — tenants
          are grouped under their property.
        </p>
      )}

      {addingTenant && locations.length > 0 && (
        <form
          onSubmit={addTenant}
          className="mb-6 flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
        >
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Tenant name
            </span>
            <input
              required
              type="text"
              className="input"
              value={newTenant.name}
              onChange={(e) =>
                setNewTenant((f) => ({ ...f, name: e.target.value }))
              }
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Property
            </span>
            <select
              required
              className="input"
              value={newTenant.location_id}
              onChange={(e) =>
                setNewTenant((f) => ({ ...f, location_id: e.target.value }))
              }
            >
              <option value="" disabled>
                Select…
              </option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Unit level
            </span>
            <select
              required
              className="input"
              value={newTenant.unit_level}
              onChange={(e) =>
                setNewTenant((f) => ({ ...f, unit_level: e.target.value }))
              }
            >
              <option value="" disabled>
                Select…
              </option>
              {UNIT_LEVELS.map((u) => (
                <option key={u.value} value={u.value}>
                  {u.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Monthly rent (CAD)
            </span>
            <input
              required
              type="number"
              min="0"
              step="1"
              className="input"
              value={newTenant.monthly_rent}
              onChange={(e) =>
                setNewTenant((f) => ({ ...f, monthly_rent: e.target.value }))
              }
            />
          </label>
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700 disabled:opacity-60"
          >
            {saving ? "Saving…" : "Add tenant"}
          </button>
          <button
            type="button"
            onClick={() => setAddingTenant(false)}
            className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Cancel
          </button>
        </form>
      )}

      {loading && <p className="text-slate-500">Loading…</p>}
      {error && <p className="text-red-600">{error}</p>}
      {!loading && tenants.length === 0 && (
        <p className="rounded-xl border border-dashed border-slate-200 bg-white p-6 text-center text-slate-500">
          No tenants yet. Add one to start tracking rent.
        </p>
      )}

      {tenants.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="sticky left-0 z-10 bg-slate-50 px-4 py-3">
                  Tenant
                </th>
                <th className="px-4 py-3">Monthly rent</th>
                <th className="px-4 py-3">Last month rent</th>
                <th className="px-4 py-3">Security</th>
                {months.map((m) => (
                  <th key={m} className="whitespace-nowrap px-4 py-3">
                    {monthLabel(m)}
                  </th>
                ))}
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {groupedTenants.map((locGroup) => (
                <Fragment key={`loc-${locGroup.locKey}`}>
                  <tr>
                    <td
                      colSpan={totalColumns}
                      className="sticky left-0 z-10 border-b border-slate-200 bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-900"
                    >
                      {locGroup.name}
                    </td>
                  </tr>
                  {locGroup.units.map((unitGroup) => (
                    <Fragment key={`unit-${locGroup.locKey}-${unitGroup.key}`}>
                      <tr>
                        <td
                          colSpan={totalColumns}
                          className="sticky left-0 z-10 border-b border-slate-100 bg-slate-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500"
                        >
                          {unitGroup.label}
                        </td>
                      </tr>
                      {unitGroup.tenants.map((tenant) => (
                        <tr
                          key={tenant.id}
                          className="border-b border-slate-100 last:border-0"
                        >
                          <td className="sticky left-0 z-10 whitespace-nowrap bg-white px-4 py-3 pl-8 font-medium text-slate-900">
                            {tenant.name}
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              min="0"
                              step="1"
                              defaultValue={tenant.monthly_rent}
                              key={`rent-${tenant.id}-${tenant.monthly_rent}`}
                              className="input !w-28"
                              onBlur={(e) => {
                                if (
                                  e.target.value !== String(tenant.monthly_rent)
                                ) {
                                  updateTenantField(
                                    tenant,
                                    "monthly_rent",
                                    e.target.value
                                  );
                                }
                              }}
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              min="0"
                              step="1"
                              placeholder="—"
                              defaultValue={tenant.last_month_rent_received ?? ""}
                              key={`lmr-${tenant.id}-${tenant.last_month_rent_received ?? ""}`}
                              className="input !w-28"
                              onBlur={(e) => {
                                if (
                                  e.target.value !==
                                  String(tenant.last_month_rent_received ?? "")
                                ) {
                                  updateTenantField(
                                    tenant,
                                    "last_month_rent_received",
                                    e.target.value
                                  );
                                }
                              }}
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              min="0"
                              step="1"
                              placeholder="—"
                              defaultValue={tenant.security_deposit_received ?? ""}
                              key={`sec-${tenant.id}-${tenant.security_deposit_received ?? ""}`}
                              className="input !w-28"
                              onBlur={(e) => {
                                if (
                                  e.target.value !==
                                  String(tenant.security_deposit_received ?? "")
                                ) {
                                  updateTenantField(
                                    tenant,
                                    "security_deposit_received",
                                    e.target.value
                                  );
                                }
                              }}
                            />
                          </td>
                          {months.map((m) => {
                            if (m < tenant.start_month) {
                              return (
                                <td
                                  key={m}
                                  className="px-4 py-3 text-center text-slate-300"
                                >
                                  &mdash;
                                </td>
                              );
                            }
                            const payment = payments[tenant.id]?.[m];
                            return (
                              <td key={m} className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={Boolean(payment?.received)}
                                    onChange={() =>
                                      handleToggleReceived(tenant, m)
                                    }
                                    className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                    aria-label={`Rent received for ${monthLabel(m)}`}
                                  />
                                  <input
                                    type="number"
                                    min="0"
                                    step="1"
                                    placeholder="Amount"
                                    defaultValue={payment?.amount_received ?? ""}
                                    key={`${tenant.id}-${m}-${payment?.amount_received ?? ""}`}
                                    className="input !w-24"
                                    onBlur={(e) => {
                                      if (
                                        e.target.value !==
                                        String(payment?.amount_received ?? "")
                                      ) {
                                        handleAmountChange(
                                          tenant,
                                          m,
                                          e.target.value
                                        );
                                      }
                                    }}
                                  />
                                </div>
                              </td>
                            );
                          })}
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => deleteTenant(tenant)}
                              className="rounded-xl border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 shadow-sm transition hover:bg-red-50"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

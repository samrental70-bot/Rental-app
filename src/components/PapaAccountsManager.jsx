import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatMoney(value) {
  return Number(value).toLocaleString("en-CA", {
    style: "currency",
    currency: "CAD",
  });
}

function dateLabel(dateStr) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const EMPTY_ENTRY = {
  entry_date: todayStr(),
  description: "",
  category: "",
  direction: "in",
  amount: "",
  notes: "",
};

export default function PapaAccountsManager({ userId }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [adding, setAdding] = useState(false);
  const [newEntry, setNewEntry] = useState(EMPTY_ENTRY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      setLoading(true);
      const { data, error: loadError } = await supabase
        .from("papa_account_entries")
        .select("*")
        .eq("manager_id", userId)
        .order("entry_date", { ascending: true })
        .order("created_at", { ascending: true });

      if (!isMounted) return;
      if (loadError) {
        setError(loadError.message);
      } else {
        setEntries(data || []);
      }
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

  // Running balance is computed oldest-first, then shown newest-first.
  const rows = useMemo(() => {
    const withBalance = [];
    let balance = 0;
    for (const e of entries) {
      balance += e.direction === "in" ? Number(e.amount) : -Number(e.amount);
      withBalance.push({ ...e, balance });
    }
    return withBalance.reverse();
  }, [entries]);

  const totals = useMemo(() => {
    let moneyIn = 0;
    let moneyOut = 0;
    for (const e of entries) {
      if (e.direction === "in") moneyIn += Number(e.amount);
      else moneyOut += Number(e.amount);
    }
    return { moneyIn, moneyOut, balance: moneyIn - moneyOut };
  }, [entries]);

  async function addEntry(event) {
    event.preventDefault();
    if (!newEntry.description.trim() || newEntry.amount === "") return;
    setSaving(true);
    const { error: insertError } = await supabase
      .from("papa_account_entries")
      .insert({
        manager_id: userId,
        entry_date: newEntry.entry_date,
        description: newEntry.description.trim(),
        category: newEntry.category.trim() || null,
        direction: newEntry.direction,
        amount: Number(newEntry.amount),
        notes: newEntry.notes.trim() || null,
      });
    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setNewEntry({ ...EMPTY_ENTRY, entry_date: todayStr() });
    setAdding(false);
    reload();
  }

  async function updateEntry(entry, patch) {
    const { error: updateError } = await supabase
      .from("papa_account_entries")
      .update(patch)
      .eq("id", entry.id);
    if (updateError) setError(updateError.message);
    reload();
  }

  async function deleteEntry(entry) {
    if (!window.confirm(`Delete "${entry.description}"? This cannot be undone.`)) {
      return;
    }
    const { error: deleteError } = await supabase
      .from("papa_account_entries")
      .delete()
      .eq("id", entry.id);
    if (deleteError) setError(deleteError.message);
    else reload();
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight text-slate-900">
          18 Papa Accounts
        </h2>
        <button
          type="button"
          onClick={() => setAdding((v) => !v)}
          className="rounded-xl bg-slate-900 px-3.5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-700"
        >
          + Add entry
        </button>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Money in
          </p>
          <p className="mt-1 text-xl font-semibold text-emerald-700">
            {formatMoney(totals.moneyIn)}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Money out
          </p>
          <p className="mt-1 text-xl font-semibold text-red-700">
            {formatMoney(totals.moneyOut)}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Balance
          </p>
          <p
            className={`mt-1 text-xl font-semibold ${
              totals.balance < 0 ? "text-red-700" : "text-slate-900"
            }`}
          >
            {formatMoney(totals.balance)}
          </p>
        </div>
      </div>

      {adding && (
        <form
          onSubmit={addEntry}
          className="mb-6 flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
        >
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Date
            </span>
            <input
              required
              type="date"
              className="input"
              value={newEntry.entry_date}
              onChange={(e) =>
                setNewEntry((f) => ({ ...f, entry_date: e.target.value }))
              }
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Description
            </span>
            <input
              required
              type="text"
              className="input"
              value={newEntry.description}
              onChange={(e) =>
                setNewEntry((f) => ({ ...f, description: e.target.value }))
              }
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Category
            </span>
            <input
              type="text"
              placeholder="e.g. Rent, Tax, Repairs"
              className="input"
              value={newEntry.category}
              onChange={(e) =>
                setNewEntry((f) => ({ ...f, category: e.target.value }))
              }
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Type
            </span>
            <select
              className="input"
              value={newEntry.direction}
              onChange={(e) =>
                setNewEntry((f) => ({ ...f, direction: e.target.value }))
              }
            >
              <option value="in">Money in</option>
              <option value="out">Money out</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Amount (CAD)
            </span>
            <input
              required
              type="number"
              min="0"
              step="0.01"
              className="input"
              value={newEntry.amount}
              onChange={(e) =>
                setNewEntry((f) => ({ ...f, amount: e.target.value }))
              }
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Notes
            </span>
            <input
              type="text"
              className="input"
              value={newEntry.notes}
              onChange={(e) =>
                setNewEntry((f) => ({ ...f, notes: e.target.value }))
              }
            />
          </label>
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700 disabled:opacity-60"
          >
            {saving ? "Saving…" : "Add entry"}
          </button>
          <button
            type="button"
            onClick={() => setAdding(false)}
            className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Cancel
          </button>
        </form>
      )}

      {loading && <p className="text-slate-500">Loading…</p>}
      {error && <p className="text-red-600">{error}</p>}
      {!loading && entries.length === 0 && (
        <p className="rounded-xl border border-dashed border-slate-200 bg-white p-6 text-center text-slate-500">
          No entries yet. Add one to start tracking Papa's accounts.
        </p>
      )}

      {entries.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3 text-right">In</th>
                <th className="px-4 py-3 text-right">Out</th>
                <th className="px-4 py-3 text-right">Balance</th>
                <th className="px-4 py-3">Notes</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((entry) => (
                <tr
                  key={entry.id}
                  className="border-b border-slate-100 last:border-0"
                >
                  <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                    {dateLabel(entry.entry_date)}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {entry.description}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {entry.category || "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-emerald-700">
                    {entry.direction === "in" ? formatMoney(entry.amount) : ""}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-red-700">
                    {entry.direction === "out" ? formatMoney(entry.amount) : ""}
                  </td>
                  <td
                    className={`whitespace-nowrap px-4 py-3 text-right font-medium ${
                      entry.balance < 0 ? "text-red-700" : "text-slate-900"
                    }`}
                  >
                    {formatMoney(entry.balance)}
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="text"
                      placeholder="—"
                      defaultValue={entry.notes ?? ""}
                      key={`notes-${entry.id}-${entry.notes ?? ""}`}
                      className="input !w-40"
                      onBlur={(e) => {
                        if (e.target.value !== (entry.notes ?? "")) {
                          updateEntry(entry, {
                            notes: e.target.value.trim() || null,
                          });
                        }
                      }}
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => deleteEntry(entry)}
                      className="text-xs font-medium text-red-600 hover:text-red-800"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

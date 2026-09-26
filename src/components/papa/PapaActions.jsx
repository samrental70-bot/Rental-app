import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import {
  LABEL_CLASS,
  PRIMARY_BTN,
  SECONDARY_BTN,
  dateLabel,
  itemLabel,
  todayStr,
} from "./papaUtils";

const EMPTY_ACTION = {
  title: "",
  item_id: "",
  assignee: "",
  due_date: "",
  notes: "",
};

export default function PapaActions({ ownerId, items, assignees }) {
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(EMPTY_ACTION);
  const [saving, setSaving] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const [assigneeFilter, setAssigneeFilter] = useState("");

  useEffect(() => {
    let isMounted = true;
    async function load() {
      setLoading(true);
      const { data, error: loadError } = await supabase
        .from("papa_actions")
        .select("*")
        .eq("manager_id", ownerId)
        .order("created_at", { ascending: true });
      if (!isMounted) return;
      if (loadError) setError(loadError.message);
      else setActions(data || []);
      setLoading(false);
    }
    load();
    return () => {
      isMounted = false;
    };
  }, [ownerId, reloadToken]);

  function reload() {
    setReloadToken((t) => t + 1);
  }

  const itemsById = useMemo(
    () => Object.fromEntries(items.map((i) => [i.id, i])),
    [items]
  );

  // Open first, overdue/soonest due first, undated last.
  const visible = useMemo(() => {
    return actions
      .filter((a) => showDone || !a.done)
      .filter((a) => !assigneeFilter || a.assignee === assigneeFilter)
      .sort((a, b) => {
        if (a.done !== b.done) return a.done ? 1 : -1;
        if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
        if (a.due_date) return -1;
        if (b.due_date) return 1;
        return 0;
      });
  }, [actions, showDone, assigneeFilter]);

  const today = todayStr();

  async function addAction(event) {
    event.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    const { error: insertError } = await supabase.from("papa_actions").insert({
      manager_id: ownerId,
      title: form.title.trim(),
      item_id: form.item_id || null,
      assignee: form.assignee || null,
      due_date: form.due_date || null,
      notes: form.notes.trim() || null,
    });
    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setForm(EMPTY_ACTION);
    setAdding(false);
    reload();
  }

  async function updateAction(action, patch) {
    setActions((prev) =>
      prev.map((a) => (a.id === action.id ? { ...a, ...patch } : a))
    );
    const { error: updateError } = await supabase
      .from("papa_actions")
      .update(patch)
      .eq("id", action.id);
    if (updateError) {
      setError(updateError.message);
      reload();
    }
  }

  async function deleteAction(action) {
    if (!window.confirm(`Delete "${action.title}"?`)) return;
    const { error: deleteError } = await supabase
      .from("papa_actions")
      .delete()
      .eq("id", action.id);
    if (deleteError) setError(deleteError.message);
    else reload();
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4">
          <select
            className="input !w-auto"
            value={assigneeFilter}
            onChange={(e) => setAssigneeFilter(e.target.value)}
          >
            <option value="">Everyone</option>
            {assignees.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={showDone}
              onChange={(e) => setShowDone(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            Show done
          </label>
        </div>
        <button
          type="button"
          onClick={() => setAdding((v) => !v)}
          className="rounded-xl bg-slate-900 px-3.5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-700"
        >
          + Add action
        </button>
      </div>

      {adding && (
        <form
          onSubmit={addAction}
          className="mb-6 grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2"
        >
          <label className="block sm:col-span-2">
            <span className={LABEL_CLASS}>What needs to be done</span>
            <input
              required
              type="text"
              placeholder="e.g. Update KYC, add nominee, redeem units"
              className="input"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
          </label>
          <label className="block">
            <span className={LABEL_CLASS}>Holding</span>
            <select
              className="input"
              value={form.item_id}
              onChange={(e) => setForm((f) => ({ ...f, item_id: e.target.value }))}
            >
              <option value="">General</option>
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {itemLabel(item)}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={LABEL_CLASS}>Who</span>
            <select
              className="input"
              value={form.assignee}
              onChange={(e) =>
                setForm((f) => ({ ...f, assignee: e.target.value }))
              }
            >
              <option value="">Unassigned</option>
              {assignees.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={LABEL_CLASS}>Due date</span>
            <input
              type="date"
              className="input"
              value={form.due_date}
              onChange={(e) =>
                setForm((f) => ({ ...f, due_date: e.target.value }))
              }
            />
          </label>
          <label className="block">
            <span className={LABEL_CLASS}>Notes</span>
            <input
              type="text"
              className="input"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </label>
          <div className="flex gap-3 sm:col-span-2">
            <button type="submit" disabled={saving} className={PRIMARY_BTN}>
              {saving ? "Saving…" : "Add action"}
            </button>
            <button
              type="button"
              onClick={() => setAdding(false)}
              className={SECONDARY_BTN}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading && <p className="text-slate-500">Loading…</p>}
      {error && <p className="mb-4 text-red-600">{error}</p>}
      {!loading && visible.length === 0 && (
        <p className="rounded-xl border border-dashed border-slate-200 bg-white p-6 text-center text-slate-500">
          No open actions.
        </p>
      )}

      {visible.length > 0 && (
        <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white shadow-sm">
          {visible.map((action) => {
            const overdue =
              !action.done && action.due_date && action.due_date < today;
            const item = itemsById[action.item_id];
            return (
              <li key={action.id} className="flex items-start gap-3 px-4 py-3">
                <input
                  type="checkbox"
                  checked={action.done}
                  onChange={() =>
                    updateAction(action, {
                      done: !action.done,
                      done_at: action.done ? null : new Date().toISOString(),
                    })
                  }
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  aria-label={`Mark "${action.title}" done`}
                />
                <div className="min-w-0 flex-1">
                  <p
                    className={`font-medium ${
                      action.done ? "text-slate-400 line-through" : "text-slate-900"
                    }`}
                  >
                    {action.title}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {[
                      item ? itemLabel(item) : "General",
                      action.assignee || "Unassigned",
                      action.notes,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <input
                    type="date"
                    value={action.due_date || ""}
                    onChange={(e) =>
                      updateAction(action, { due_date: e.target.value || null })
                    }
                    className={`input !w-36 !py-1 ${overdue ? "!border-red-400 !text-red-700" : ""}`}
                    aria-label="Due date"
                  />
                  {overdue && (
                    <span className="text-xs font-medium text-red-600">
                      Overdue since {dateLabel(action.due_date)}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => deleteAction(action)}
                    className="text-xs font-medium text-red-600 hover:text-red-800"
                  >
                    Delete
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import {
  EMPTY_ITEM,
  ITEM_KINDS,
  ITEM_STATUSES,
  LABEL_CLASS,
  PRIMARY_BTN,
  SECONDARY_BTN,
  SMALL_BTN,
  dateLabel,
  formatMoney,
  isImagePath,
  kindLabel,
  signedUrls,
} from "./papaUtils";

function toRow(form) {
  const text = (v) => (v || "").trim() || null;
  return {
    kind: form.kind,
    institution: text(form.institution),
    name: form.name.trim(),
    account_ref: text(form.account_ref),
    holder: text(form.holder),
    nominee: text(form.nominee),
    current_value: form.current_value === "" ? null : Number(form.current_value),
    value_as_of: form.value_as_of || null,
    status: form.status,
    notes: text(form.notes),
  };
}

function toForm(item) {
  const form = {};
  for (const key of Object.keys(EMPTY_ITEM)) {
    form[key] = item[key] ?? "";
  }
  return form;
}

const STATUS_BADGE = {
  to_review: "bg-amber-50 text-amber-700 ring-amber-200",
  active: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  closed: "bg-slate-100 text-slate-500 ring-slate-200",
};

export function ItemForm({ initial, onSubmit, onCancel, submitLabel }) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);

  function field(key) {
    return {
      value: form[key],
      onChange: (e) => setForm((f) => ({ ...f, [key]: e.target.value })),
    };
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    await onSubmit(toRow(form));
    setSaving(false);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-3"
    >
      <label className="block">
        <span className={LABEL_CLASS}>Type</span>
        <select className="input" {...field("kind")}>
          {ITEM_KINDS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className={LABEL_CLASS}>Bank / company</span>
        <input
          type="text"
          placeholder="e.g. SBI, HDFC, Zerodha"
          className="input"
          {...field("institution")}
        />
      </label>
      <label className="block">
        <span className={LABEL_CLASS}>Name</span>
        <input
          required
          type="text"
          placeholder="e.g. Savings account, Axis Bluechip"
          className="input"
          {...field("name")}
        />
      </label>
      <label className="block">
        <span className={LABEL_CLASS}>Account / folio (last 4 only)</span>
        <input
          type="text"
          placeholder="e.g. …4821"
          className="input"
          {...field("account_ref")}
        />
      </label>
      <label className="block">
        <span className={LABEL_CLASS}>Holder</span>
        <input type="text" className="input" {...field("holder")} />
      </label>
      <label className="block">
        <span className={LABEL_CLASS}>Nominee</span>
        <input type="text" className="input" {...field("nominee")} />
      </label>
      <label className="block">
        <span className={LABEL_CLASS}>Current value</span>
        <input
          type="number"
          min="0"
          step="0.01"
          className="input"
          {...field("current_value")}
        />
      </label>
      <label className="block">
        <span className={LABEL_CLASS}>Value as of</span>
        <input type="date" className="input" {...field("value_as_of")} />
      </label>
      <label className="block">
        <span className={LABEL_CLASS}>Status</span>
        <select className="input" {...field("status")}>
          {ITEM_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block sm:col-span-3">
        <span className={LABEL_CLASS}>Notes</span>
        <input type="text" className="input" {...field("notes")} />
      </label>
      <div className="flex gap-3 sm:col-span-3">
        <button type="submit" disabled={saving} className={PRIMARY_BTN}>
          {saving ? "Saving…" : submitLabel}
        </button>
        <button type="button" onClick={onCancel} className={SECONDARY_BTN}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function PapaHoldings({ ownerId, items, reloadItems }) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [docs, setDocs] = useState([]);
  const [actions, setActions] = useState([]);
  const [urls, setUrls] = useState({});
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      const [docRes, actionRes] = await Promise.all([
        supabase
          .from("papa_documents")
          .select("*")
          .eq("manager_id", ownerId)
          .not("item_id", "is", null)
          .order("received_at", { ascending: false }),
        supabase
          .from("papa_actions")
          .select("id, item_id, title, done, due_date, assignee")
          .eq("manager_id", ownerId)
          .not("item_id", "is", null),
      ]);
      if (!isMounted) return;
      if (docRes.error || actionRes.error) {
        setError((docRes.error || actionRes.error).message);
        return;
      }
      setDocs(docRes.data || []);
      setActions(actionRes.data || []);
      const signed = await signedUrls(supabase, docRes.data || []);
      if (isMounted) setUrls(signed);
    }
    load();
    return () => {
      isMounted = false;
    };
  }, [ownerId, items]);

  const groups = useMemo(
    () =>
      ITEM_KINDS.map((k) => {
        const list = items.filter((i) => i.kind === k.value);
        const total = list
          .filter((i) => i.status !== "closed")
          .reduce((sum, i) => sum + Number(i.current_value || 0), 0);
        return { ...k, items: list, total };
      }).filter((g) => g.items.length > 0),
    [items]
  );

  const grandTotal = groups.reduce((sum, g) => sum + g.total, 0);

  async function addItem(row) {
    const { error: insertError } = await supabase
      .from("papa_items")
      .insert({ ...row, manager_id: ownerId });
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setAdding(false);
    reloadItems();
  }

  async function saveItem(item, row) {
    const { error: updateError } = await supabase
      .from("papa_items")
      .update(row)
      .eq("id", item.id);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setEditingId(null);
    reloadItems();
  }

  async function deleteItem(item) {
    if (
      !window.confirm(
        `Delete "${item.name}"? Its photos and actions stay, but are unlinked.`
      )
    ) {
      return;
    }
    const { error: deleteError } = await supabase
      .from("papa_items")
      .delete()
      .eq("id", item.id);
    if (deleteError) setError(deleteError.message);
    else reloadItems();
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          Open holdings total{" "}
          <span className="font-semibold text-slate-900">
            {formatMoney(grandTotal)}
          </span>
        </p>
        <button
          type="button"
          onClick={() => setAdding((v) => !v)}
          className="rounded-xl bg-slate-900 px-3.5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-700"
        >
          + Add holding
        </button>
      </div>

      {error && <p className="mb-4 text-red-600">{error}</p>}

      {adding && (
        <div className="mb-6">
          <ItemForm
            initial={EMPTY_ITEM}
            onSubmit={addItem}
            onCancel={() => setAdding(false)}
            submitLabel="Add holding"
          />
        </div>
      )}

      {items.length === 0 && !adding && (
        <p className="rounded-xl border border-dashed border-slate-200 bg-white p-6 text-center text-slate-500">
          No holdings yet. Add bank accounts, stocks, mutual funds and more —
          or file them straight from photos in the Inbox.
        </p>
      )}

      <div className="space-y-6">
        {groups.map((group) => (
          <section key={group.value}>
            <div className="mb-2 flex items-baseline justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                {group.label}
              </h3>
              <span className="text-sm font-medium text-slate-700">
                {formatMoney(group.total)}
              </span>
            </div>
            <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white shadow-sm">
              {group.items.map((item) => {
                const itemDocs = docs.filter((d) => d.item_id === item.id);
                const itemActions = actions.filter((a) => a.item_id === item.id);
                const openActions = itemActions.filter((a) => !a.done);
                const expanded = expandedId === item.id;

                if (editingId === item.id) {
                  return (
                    <li key={item.id} className="p-3">
                      <ItemForm
                        initial={toForm(item)}
                        onSubmit={(row) => saveItem(item, row)}
                        onCancel={() => setEditingId(null)}
                        submitLabel="Save"
                      />
                    </li>
                  );
                }

                return (
                  <li key={item.id} className="px-4 py-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => setExpandedId(expanded ? null : item.id)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-slate-900">
                            {item.institution ? `${item.institution} · ` : ""}
                            {item.name}
                          </span>
                          {item.account_ref && (
                            <span className="text-xs text-slate-500">
                              {item.account_ref}
                            </span>
                          )}
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${STATUS_BADGE[item.status]}`}
                          >
                            {ITEM_STATUSES.find((s) => s.value === item.status)?.label}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {[
                            item.holder && `Holder: ${item.holder}`,
                            item.nominee && `Nominee: ${item.nominee}`,
                            `${itemDocs.length} file${itemDocs.length === 1 ? "" : "s"}`,
                            openActions.length > 0 &&
                              `${openActions.length} open action${openActions.length === 1 ? "" : "s"}`,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </button>
                      <div className="text-right">
                        <p className="font-medium text-slate-900">
                          {item.current_value != null
                            ? formatMoney(item.current_value)
                            : "—"}
                        </p>
                        {item.value_as_of && (
                          <p className="text-xs text-slate-500">
                            as of {dateLabel(item.value_as_of)}
                          </p>
                        )}
                      </div>
                    </div>

                    {expanded && (
                      <div className="mt-3 space-y-3 border-t border-slate-100 pt-3 text-sm">
                        <p className="text-xs text-slate-500">
                          {kindLabel(item.kind)}
                        </p>
                        {item.notes && (
                          <p className="text-slate-700">{item.notes}</p>
                        )}
                        {itemDocs.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {itemDocs.map((d) =>
                              d.storage_path ? (
                                <a
                                  key={d.id}
                                  href={urls[d.storage_path]}
                                  target="_blank"
                                  rel="noreferrer"
                                  title={d.body || ""}
                                >
                                  {isImagePath(d.storage_path) ? (
                                    <img
                                      src={urls[d.storage_path]}
                                      alt={d.body || "Document"}
                                      className="h-20 w-20 rounded-lg object-cover ring-1 ring-slate-200"
                                    />
                                  ) : (
                                    <span className="flex h-20 w-20 items-center justify-center rounded-lg bg-slate-100 text-xs text-slate-600 ring-1 ring-slate-200">
                                      File
                                    </span>
                                  )}
                                </a>
                              ) : (
                                <p
                                  key={d.id}
                                  className="w-full rounded-lg bg-slate-50 px-3 py-2 text-slate-700"
                                >
                                  {d.body}
                                </p>
                              )
                            )}
                          </div>
                        )}
                        {itemActions.length > 0 && (
                          <ul className="space-y-1">
                            {itemActions.map((a) => (
                              <li
                                key={a.id}
                                className={a.done ? "text-slate-400 line-through" : "text-slate-700"}
                              >
                                • {a.title}
                                {a.assignee ? ` — ${a.assignee}` : ""}
                                {a.due_date ? ` (due ${dateLabel(a.due_date)})` : ""}
                              </li>
                            ))}
                          </ul>
                        )}
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingId(item.id)}
                            className={SMALL_BTN}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteItem(item)}
                            className="text-xs font-medium text-red-600 hover:text-red-800"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

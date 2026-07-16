import { useState } from "react";
import { supabase } from "../lib/supabaseClient";

const blankForm = { name: "", address: "", description: "" };

export default function LocationForm({ userId, location, onSaved, onCancel }) {
  const isEditing = Boolean(location);
  const [form, setForm] = useState(() =>
    location
      ? {
          name: location.name,
          address: location.address || "",
          description: location.description || "",
        }
      : blankForm
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      name: form.name.trim(),
      address: form.address.trim() || null,
      description: form.description.trim() || null,
    };

    const { error: saveError } = isEditing
      ? await supabase.from("locations").update(payload).eq("id", location.id)
      : await supabase
          .from("locations")
          .insert({ ...payload, manager_id: userId });

    setSaving(false);

    if (saveError) {
      setError(saveError.message);
      return;
    }

    onSaved();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <h2 className="font-semibold text-slate-900">
        {isEditing ? "Edit location" : "Add a location"}
      </h2>

      <Field label="Name">
        <input
          required
          type="text"
          className="input"
          value={form.name}
          onChange={(e) => updateField("name", e.target.value)}
        />
      </Field>
      <Field label="Address (optional, shown to public)">
        <input
          type="text"
          className="input"
          value={form.address}
          onChange={(e) => updateField("address", e.target.value)}
        />
      </Field>
      <Field label="Description">
        <textarea
          rows={3}
          className="input"
          value={form.description}
          onChange={(e) => updateField("description", e.target.value)}
        />
      </Field>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-slate-900 px-4 py-2 font-medium text-white transition hover:bg-slate-700 disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save location"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-slate-300 px-4 py-2 font-medium text-slate-700 hover:bg-slate-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">
        {label}
      </span>
      {children}
    </label>
  );
}

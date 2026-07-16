import { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { getPhotoUrl } from "../lib/rooms";
import { GENDER_PREFERENCES, RENT_PERIODS } from "../lib/constants";

const blankForm = {
  title: "",
  description: "",
  address: "",
  rent_amount: "",
  rent_period: "month",
  gender_preference: "any",
  available_from: new Date().toISOString().slice(0, 10),
  status: "occupied",
};

export default function RoomForm({ userId, locationId, room, onSaved, onCancel }) {
  const isEditing = Boolean(room);
  const [form, setForm] = useState(() =>
    room
      ? {
          title: room.title,
          description: room.description || "",
          address: room.address || "",
          rent_amount: String(room.rent_amount),
          rent_period: room.rent_period,
          gender_preference: room.gender_preference,
          available_from: room.available_from,
          status: room.status,
        }
      : blankForm
  );
  const [photos, setPhotos] = useState(room?.room_photos || []);
  const [newFiles, setNewFiles] = useState([]);
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
      title: form.title.trim(),
      description: form.description.trim() || null,
      address: form.address.trim() || null,
      rent_amount: Number(form.rent_amount),
      rent_period: form.rent_period,
      gender_preference: form.gender_preference,
      available_from: form.available_from,
      status: form.status,
    };

    let roomId = room?.id;

    if (isEditing) {
      const { error: updateError } = await supabase
        .from("rooms")
        .update(payload)
        .eq("id", roomId);
      if (updateError) {
        setError(updateError.message);
        setSaving(false);
        return;
      }
    } else {
      const { data: inserted, error: insertError } = await supabase
        .from("rooms")
        .insert({ ...payload, manager_id: userId, location_id: locationId })
        .select()
        .single();
      if (insertError) {
        setError(insertError.message);
        setSaving(false);
        return;
      }
      roomId = inserted.id;
    }

    if (newFiles.length > 0) {
      const uploadError = await uploadPhotos(userId, roomId, newFiles, photos.length);
      if (uploadError) {
        setError(uploadError);
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    onSaved();
  }

  async function handleRemovePhoto(photo) {
    const { error: deleteError } = await supabase
      .from("room_photos")
      .delete()
      .eq("id", photo.id);
    if (!deleteError) {
      await supabase.storage.from("room-photos").remove([photo.storage_path]);
      setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7"
    >
      <h2 className="border-b border-slate-100 pb-4 text-lg font-semibold text-slate-900">
        {isEditing ? "Edit room" : "Add a room"}
      </h2>

      <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
        <Field label="Title">
          <input
            required
            type="text"
            className="input"
            value={form.title}
            onChange={(e) => updateField("title", e.target.value)}
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
        <Field label="Rent amount (CAD)">
          <input
            required
            type="number"
            min="0"
            step="1"
            className="input"
            value={form.rent_amount}
            onChange={(e) => updateField("rent_amount", e.target.value)}
          />
        </Field>
        <Field label="Rent period">
          <select
            className="input"
            value={form.rent_period}
            onChange={(e) => updateField("rent_period", e.target.value)}
          >
            {RENT_PERIODS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Room required for">
          <select
            className="input"
            value={form.gender_preference}
            onChange={(e) => updateField("gender_preference", e.target.value)}
          >
            {GENDER_PREFERENCES.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Available from">
          <input
            required
            type="date"
            className="input"
            value={form.available_from}
            onChange={(e) => updateField("available_from", e.target.value)}
          />
        </Field>
        <Field label="Status">
          <select
            className="input"
            value={form.status}
            onChange={(e) => updateField("status", e.target.value)}
          >
            <option value="empty">Empty (visible to public)</option>
            <option value="occupied">Occupied (hidden from public)</option>
          </select>
        </Field>
      </div>

      <Field label="Description">
        <textarea
          rows={4}
          className="input"
          value={form.description}
          onChange={(e) => updateField("description", e.target.value)}
        />
      </Field>

      <Field label="Photos">
        {photos.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-3">
            {photos.map((photo) => (
              <div key={photo.id} className="relative h-20 w-24">
                <img
                  src={getPhotoUrl(photo.storage_path)}
                  alt=""
                  className="h-full w-full rounded-lg object-cover shadow-sm"
                />
                <button
                  type="button"
                  onClick={() => handleRemovePhoto(photo)}
                  className="absolute -right-2 -top-2 rounded-full bg-slate-900 px-1.5 py-0.5 text-xs text-white shadow-sm"
                  aria-label="Remove photo"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => setNewFiles(Array.from(e.target.files || []))}
          className="text-sm text-slate-600 file:mr-3 file:rounded-lg file:border file:border-slate-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-50"
        />
      </Field>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3 border-t border-slate-100 pt-6">
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700 disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save room"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

async function uploadPhotos(userId, roomId, files, startingSortOrder) {
  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
    const path = `${userId}/${roomId}/${Date.now()}-${index}-${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from("room-photos")
      .upload(path, file, { cacheControl: "3600", upsert: false });
    if (uploadError) {
      return uploadError.message;
    }

    const { error: insertError } = await supabase.from("room_photos").insert({
      room_id: roomId,
      storage_path: path,
      sort_order: startingSortOrder + index,
    });
    if (insertError) {
      return insertError.message;
    }
  }
  return null;
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}

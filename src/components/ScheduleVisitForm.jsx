import { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { APPLICANT_GENDERS, VISA_STATUSES } from "../lib/constants";

const emptyForm = {
  full_name: "",
  email: "",
  phone: "",
  visa_status: "",
  applicant_gender: "",
  room_required_from: "",
  notes: "",
};

export default function ScheduleVisitForm({ roomId }) {
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const { error: insertError } = await supabase.from("visit_requests").insert({
      room_id: roomId,
      full_name: form.full_name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      visa_status: form.visa_status,
      applicant_gender: form.applicant_gender,
      room_required_from: form.room_required_from,
      notes: form.notes.trim() || null,
    });

    setSubmitting(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setSubmitted(true);
    setForm(emptyForm);
  }

  if (submitted) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-relaxed text-emerald-800">
        Thanks! Your visit request has been sent. The manager will contact you
        by email or phone to confirm a time.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2">
        <Field label="Full name">
          <input
            required
            type="text"
            value={form.full_name}
            onChange={(e) => updateField("full_name", e.target.value)}
            className="input"
          />
        </Field>
        <Field label="Email">
          <input
            required
            type="email"
            value={form.email}
            onChange={(e) => updateField("email", e.target.value)}
            className="input"
          />
        </Field>
        <Field label="Phone number">
          <input
            required
            type="tel"
            value={form.phone}
            onChange={(e) => updateField("phone", e.target.value)}
            className="input"
          />
        </Field>
        <Field label="Gender the room is required for">
          <select
            required
            value={form.applicant_gender}
            onChange={(e) => updateField("applicant_gender", e.target.value)}
            className="input"
          >
            <option value="" disabled>
              Select…
            </option>
            {APPLICANT_GENDERS.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Visa status in Canada">
          <select
            required
            value={form.visa_status}
            onChange={(e) => updateField("visa_status", e.target.value)}
            className="input"
          >
            <option value="" disabled>
              Select…
            </option>
            {VISA_STATUSES.map((v) => (
              <option key={v.value} value={v.value}>
                {v.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Room required from">
          <input
            required
            type="date"
            value={form.room_required_from}
            onChange={(e) => updateField("room_required_from", e.target.value)}
            className="input"
          />
        </Field>
      </div>

      <Field label="Anything else the manager should know? (optional)">
        <textarea
          rows={3}
          value={form.notes}
          onChange={(e) => updateField("notes", e.target.value)}
          className="input"
        />
      </Field>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-xl bg-slate-900 px-4 py-3 font-semibold text-white shadow-sm transition hover:bg-slate-700 hover:shadow disabled:opacity-60"
      >
        {submitting ? "Sending…" : "Request a visit"}
      </button>
    </form>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-600">
        {label}
      </span>
      {children}
    </label>
  );
}

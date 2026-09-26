import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { LABEL_CLASS, PRIMARY_BTN, SECONDARY_BTN, SMALL_BTN } from "./papaUtils";

const EMPTY_MEMBER = { name: "", whatsapp_number: "", email: "" };

function digits(number) {
  return (number || "").replace(/\D/g, "");
}

function welcomeMessage(member, appNumber) {
  const lines = [
    `Hi ${member.name}! I've set up a new "18 Papa Accounts" section in our app to track Papa's bank accounts, stocks, mutual funds and anything else, plus the follow-ups we need to do.`,
    "",
    appNumber
      ? `Just send photos of statements, passbooks, share certificates, MF statements or any other papers on WhatsApp to ${appNumber} — add a short caption if it helps. Each one lands in our inbox and we'll file it and track the next steps.`
      : "Just send photos of statements, passbooks, share certificates, MF statements or any other papers on WhatsApp — add a short caption if it helps. Each one lands in our inbox and we'll file it and track the next steps.",
  ];
  if (member.email) {
    lines.push(
      "",
      `You can also log in at ${window.location.origin}/admin with ${member.email} to see everything.`
    );
  }
  return lines.join("\n");
}

export default function PapaTeam({ ownerId, isOwner, members, reloadMembers }) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(EMPTY_MEMBER);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [appNumber, setAppNumber] = useState("");

  useEffect(() => {
    if (!isOwner) return;
    let isMounted = true;
    supabase
      .from("manager_settings")
      .select("app_whatsapp_number")
      .eq("manager_id", ownerId)
      .maybeSingle()
      .then(({ data }) => {
        if (isMounted) setAppNumber(data?.app_whatsapp_number || "");
      });
    return () => {
      isMounted = false;
    };
  }, [ownerId, isOwner]);

  async function saveAppNumber(value) {
    const { error: upsertError } = await supabase
      .from("manager_settings")
      .upsert(
        { manager_id: ownerId, app_whatsapp_number: value.trim() || null },
        { onConflict: "manager_id" }
      );
    if (upsertError) setError(upsertError.message);
    else setAppNumber(value.trim());
  }

  async function addMember(event) {
    event.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    const { error: insertError } = await supabase.from("papa_members").insert({
      manager_id: ownerId,
      name: form.name.trim(),
      whatsapp_number: form.whatsapp_number.trim() || null,
      email: form.email.trim().toLowerCase() || null,
    });
    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setForm(EMPTY_MEMBER);
    setAdding(false);
    reloadMembers();
  }

  async function updateMember(member, field, value) {
    const cleaned = value.trim() || null;
    const { error: updateError } = await supabase
      .from("papa_members")
      .update({
        [field]: field === "email" && cleaned ? cleaned.toLowerCase() : cleaned,
      })
      .eq("id", member.id);
    if (updateError) setError(updateError.message);
    reloadMembers();
  }

  async function deleteMember(member) {
    if (
      !window.confirm(
        `Remove ${member.name}? They'll lose access and their WhatsApp photos will stop arriving.`
      )
    ) {
      return;
    }
    const { error: deleteError } = await supabase
      .from("papa_members")
      .delete()
      .eq("id", member.id);
    if (deleteError) setError(deleteError.message);
    else reloadMembers();
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-600">
        Team members can send photos and notes on WhatsApp to the app's
        WhatsApp number — they land in the Inbox. Add their email too if they
        should log in and work on this tab (create their login in Supabase →
        Authentication → Users with the same email).
      </p>

      {error && <p className="text-red-600">{error}</p>}

      {isOwner && (
        <label className="block max-w-sm">
          <span className={LABEL_CLASS}>App's WhatsApp number (Twilio)</span>
          <input
            type="tel"
            placeholder="+1 555 123 4567"
            className="input"
            defaultValue={appNumber}
            key={`app-${appNumber}`}
            onBlur={(e) => {
              if (e.target.value.trim() !== appNumber) {
                saveAppNumber(e.target.value);
              }
            }}
          />
          <span className="mt-1 block text-xs text-slate-500">
            Included in the welcome message so people know where to send photos.
          </span>
        </label>
      )}

      <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white shadow-sm">
        {members.length === 0 && (
          <li className="p-6 text-center text-slate-500">
            No team members yet.
          </li>
        )}
        {members.map((member) => {
          const waDigits = digits(member.whatsapp_number);
          const waLink = waDigits
            ? `https://wa.me/${waDigits}?text=${encodeURIComponent(
                welcomeMessage(member, appNumber)
              )}`
            : null;
          return (
            <li
              key={member.id}
              className="grid grid-cols-1 items-end gap-3 px-4 py-3 sm:grid-cols-[1fr_1fr_1fr_auto]"
            >
              <label className="block">
                <span className={LABEL_CLASS}>Name</span>
                <input
                  type="text"
                  disabled={!isOwner}
                  className="input"
                  defaultValue={member.name}
                  key={`n-${member.id}-${member.name}`}
                  onBlur={(e) => {
                    if (e.target.value.trim() && e.target.value !== member.name) {
                      updateMember(member, "name", e.target.value);
                    }
                  }}
                />
              </label>
              <label className="block">
                <span className={LABEL_CLASS}>WhatsApp (with country code)</span>
                <input
                  type="tel"
                  disabled={!isOwner}
                  placeholder="+91 98765 43210"
                  className="input"
                  defaultValue={member.whatsapp_number || ""}
                  key={`w-${member.id}-${member.whatsapp_number || ""}`}
                  onBlur={(e) => {
                    if (e.target.value !== (member.whatsapp_number || "")) {
                      updateMember(member, "whatsapp_number", e.target.value);
                    }
                  }}
                />
              </label>
              <label className="block">
                <span className={LABEL_CLASS}>Login email</span>
                <input
                  type="email"
                  disabled={!isOwner}
                  placeholder="Optional"
                  className="input"
                  defaultValue={member.email || ""}
                  key={`e-${member.id}-${member.email || ""}`}
                  onBlur={(e) => {
                    if (e.target.value !== (member.email || "")) {
                      updateMember(member, "email", e.target.value);
                    }
                  }}
                />
              </label>
              <div className="flex items-center gap-2 pb-1">
                {waLink && (
                  <a
                    href={waLink}
                    target="_blank"
                    rel="noreferrer"
                    className={`${SMALL_BTN} whitespace-nowrap !border-emerald-300 !text-emerald-700`}
                  >
                    WhatsApp welcome
                  </a>
                )}
                {isOwner && (
                  <button
                    type="button"
                    onClick={() => deleteMember(member)}
                    className="text-xs font-medium text-red-600 hover:text-red-800"
                  >
                    Remove
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {isOwner && !adding && (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="rounded-xl bg-slate-900 px-3.5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-700"
        >
          + Add team member
        </button>
      )}

      {isOwner && adding && (
        <form
          onSubmit={addMember}
          className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-3"
        >
          <label className="block">
            <span className={LABEL_CLASS}>Name</span>
            <input
              required
              type="text"
              className="input"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </label>
          <label className="block">
            <span className={LABEL_CLASS}>WhatsApp (with country code)</span>
            <input
              type="tel"
              placeholder="+91 98765 43210"
              className="input"
              value={form.whatsapp_number}
              onChange={(e) =>
                setForm((f) => ({ ...f, whatsapp_number: e.target.value }))
              }
            />
          </label>
          <label className="block">
            <span className={LABEL_CLASS}>Login email</span>
            <input
              type="email"
              placeholder="Optional"
              className="input"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
          </label>
          <div className="flex gap-3 sm:col-span-3">
            <button type="submit" disabled={saving} className={PRIMARY_BTN}>
              {saving ? "Saving…" : "Add member"}
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
    </div>
  );
}

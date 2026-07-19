import { getSupabaseAdmin } from "./_supabaseAdmin.js";
import { sendWhatsApp } from "./_twilio.js";

function todayUTC() {
  return new Date().toISOString().slice(0, 10);
}

function dayDiff(dateStr) {
  const start = new Date(`${dateStr}T00:00:00Z`);
  const now = new Date(`${todayUTC()}T00:00:00Z`);
  return Math.round((now - start) / 86400000);
}

function formatDate(dateStr) {
  return new Date(`${dateStr}T00:00:00Z`).toLocaleDateString("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export default async function handler(req, res) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.authorization || "";
    if (auth !== `Bearer ${cronSecret}`) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
  }

  const supabase = getSupabaseAdmin();
  const results = [];

  const { data: turns, error: turnsError } = await supabase
    .from("cleaning_turns")
    .select(
      "*, tenants(id, name, whatsapp_number), locations(id, name, manager_id)"
    )
    .eq("completed", false)
    .is("proof_submitted_at", null);

  if (turnsError) {
    res.status(500).json({ error: turnsError.message });
    return;
  }

  for (const turn of turns || []) {
    const diff = dayDiff(turn.start_date);
    const tenant = turn.tenants;
    const location = turn.locations;
    const patch = {};

    async function tellTenant(body, label) {
      if (!tenant?.whatsapp_number) {
        results.push({ turn: turn.id, skipped: `no tenant whatsapp number (${label})` });
        return;
      }
      try {
        await sendWhatsApp(tenant.whatsapp_number, body);
        results.push({ turn: turn.id, sent: label, to: "tenant" });
      } catch (err) {
        results.push({ turn: turn.id, error: `${label}: ${err.message}` });
      }
    }

    if (diff === -1 && !turn.advance_reminder_sent_at) {
      await tellTenant(
        `Hi ${tenant?.name || "there"}, reminder: your cleaning duty at ${location?.name} starts tomorrow (${formatDate(turn.start_date)}). Please reply here with photos once it's done.`,
        "advance"
      );
      patch.advance_reminder_sent_at = new Date().toISOString();
    }

    if (diff >= 1 && !turn.reminder1_sent_at) {
      await tellTenant(
        `Hi ${tenant?.name || "there"}, your cleaning duty at ${location?.name} started on ${formatDate(turn.start_date)}. Please reply with photos to confirm it's done.`,
        "reminder1"
      );
      patch.reminder1_sent_at = new Date().toISOString();
    }

    if (diff >= 2 && !turn.reminder2_sent_at) {
      await tellTenant(
        `Hi ${tenant?.name || "there"}, we still haven't received your cleaning photos for ${location?.name} (due ${formatDate(turn.due_date)}). Please reply with photos as soon as possible.`,
        "reminder2"
      );
      patch.reminder2_sent_at = new Date().toISOString();
    }

    if (diff >= 3 && !turn.manager_alert_sent_at) {
      const { data: settings } = await supabase
        .from("manager_settings")
        .select("whatsapp_number")
        .eq("manager_id", location?.manager_id)
        .maybeSingle();
      if (settings?.whatsapp_number) {
        try {
          await sendWhatsApp(
            settings.whatsapp_number,
            `Heads up: ${tenant?.name || "A tenant"} at ${location?.name} has not submitted cleaning photos since ${formatDate(turn.start_date)}. You may want to follow up.`
          );
          results.push({ turn: turn.id, sent: "manager_alert", to: "manager" });
        } catch (err) {
          results.push({ turn: turn.id, error: `manager_alert: ${err.message}` });
        }
      } else {
        results.push({ turn: turn.id, skipped: "no manager whatsapp number set" });
      }
      patch.manager_alert_sent_at = new Date().toISOString();
    }

    if (Object.keys(patch).length > 0) {
      await supabase.from("cleaning_turns").update(patch).eq("id", turn.id);
    }
  }

  res.status(200).json({ checked: (turns || []).length, results });
}

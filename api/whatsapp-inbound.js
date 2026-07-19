import { getSupabaseAdmin } from "./_supabaseAdmin.js";
import { downloadTwilioMedia } from "./_twilio.js";

function normalizeDigits(number) {
  return (number || "").replace(/\D/g, "");
}

function extensionForContentType(contentType) {
  if (contentType?.includes("png")) return "png";
  if (contentType?.includes("webp")) return "webp";
  if (contentType?.includes("heic")) return "heic";
  return "jpg";
}

function emptyTwiml(res) {
  res.setHeader("Content-Type", "text/xml");
  res.status(200).send("<Response></Response>");
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).end();
    return;
  }

  const body = req.body || {};
  const from = normalizeDigits(body.From);
  const numMedia = parseInt(body.NumMedia || "0", 10);

  if (!from) {
    emptyTwiml(res);
    return;
  }

  const supabase = getSupabaseAdmin();

  const { data: tenants, error: tenantsError } = await supabase
    .from("tenants")
    .select("id, whatsapp_number, manager_id")
    .not("whatsapp_number", "is", null);

  if (tenantsError) {
    console.error("whatsapp-inbound: tenants lookup failed", tenantsError);
    emptyTwiml(res);
    return;
  }

  const tenant = (tenants || []).find(
    (t) => normalizeDigits(t.whatsapp_number) === from
  );
  if (!tenant) {
    emptyTwiml(res);
    return;
  }

  const { data: turn, error: turnError } = await supabase
    .from("cleaning_turns")
    .select("id, location_id, proof_submitted_at")
    .eq("tenant_id", tenant.id)
    .eq("completed", false)
    .maybeSingle();

  if (turnError || !turn) {
    emptyTwiml(res);
    return;
  }

  if (numMedia > 0) {
    for (let i = 0; i < numMedia; i += 1) {
      const mediaUrl = body[`MediaUrl${i}`];
      const contentType = body[`MediaContentType${i}`];
      if (!mediaUrl) continue;
      try {
        const { buffer, contentType: actualType } = await downloadTwilioMedia(
          mediaUrl
        );
        const ext = extensionForContentType(contentType || actualType);
        const path = `${tenant.manager_id}/${turn.id}/${Date.now()}-${i}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("cleaning-photos")
          .upload(path, buffer, {
            contentType: contentType || actualType,
            upsert: false,
          });
        if (uploadError) {
          console.error("whatsapp-inbound: upload failed", uploadError);
          continue;
        }
        await supabase
          .from("cleaning_turn_photos")
          .insert({ turn_id: turn.id, storage_path: path });
      } catch (err) {
        console.error("whatsapp-inbound: media processing failed", err);
      }
    }

    if (!turn.proof_submitted_at) {
      await supabase
        .from("cleaning_turns")
        .update({ proof_submitted_at: new Date().toISOString() })
        .eq("id", turn.id);
    }
  }

  emptyTwiml(res);
}

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

function escapeXml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function replyTwiml(res, message) {
  res.setHeader("Content-Type", "text/xml");
  res
    .status(200)
    .send(`<Response><Message>${escapeXml(message)}</Message></Response>`);
}

// Messages from "18 Papa Accounts" team members: every photo/document and
// any text goes into the owner's Papa inbox to be filed from the dashboard.
async function handlePapaMessage(supabase, member, body, numMedia, res) {
  const text = (body.Body || "").trim() || null;
  const received_at = new Date().toISOString();
  const base = {
    manager_id: member.manager_id,
    sender_name: member.name,
    sender_number: member.whatsapp_number,
    source: "whatsapp",
    received_at,
  };

  let saved = 0;
  for (let i = 0; i < numMedia; i += 1) {
    const mediaUrl = body[`MediaUrl${i}`];
    const contentType = body[`MediaContentType${i}`];
    if (!mediaUrl) continue;
    try {
      const { buffer, contentType: actualType } = await downloadTwilioMedia(
        mediaUrl
      );
      const type = contentType || actualType;
      const ext = type?.includes("pdf") ? "pdf" : extensionForContentType(type);
      const path = `${member.manager_id}/inbox/${Date.now()}-${i}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("papa-docs")
        .upload(path, buffer, { contentType: type, upsert: false });
      if (uploadError) {
        console.error("whatsapp-inbound: papa upload failed", uploadError);
        continue;
      }
      // The caption rides along on the first attachment.
      const { error: insertError } = await supabase
        .from("papa_documents")
        .insert({ ...base, storage_path: path, body: saved === 0 ? text : null });
      if (insertError) {
        console.error("whatsapp-inbound: papa insert failed", insertError);
        continue;
      }
      saved += 1;
    } catch (err) {
      console.error("whatsapp-inbound: papa media processing failed", err);
    }
  }

  if (numMedia === 0 && text) {
    const { error: insertError } = await supabase
      .from("papa_documents")
      .insert({ ...base, body: text });
    if (!insertError) saved = 1;
  }

  if (saved === 0) {
    replyTwiml(
      res,
      "Sorry, that didn't save to 18 Papa Accounts. Please try sending it again."
    );
    return;
  }
  replyTwiml(
    res,
    numMedia > 0
      ? `Got it — saved ${saved} file${saved === 1 ? "" : "s"} to 18 Papa Accounts.`
      : "Got it — note saved to 18 Papa Accounts."
  );
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

  const { data: members, error: membersError } = await supabase
    .from("papa_members")
    .select("id, name, whatsapp_number, manager_id")
    .not("whatsapp_number", "is", null);

  if (membersError) {
    console.error("whatsapp-inbound: papa members lookup failed", membersError);
  } else {
    const member = (members || []).find(
      (m) => normalizeDigits(m.whatsapp_number) === from
    );
    if (member) {
      await handlePapaMessage(supabase, member, body, numMedia, res);
      return;
    }
  }

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

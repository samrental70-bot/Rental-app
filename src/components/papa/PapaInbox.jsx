import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { ItemForm } from "./PapaHoldings";
import {
  EMPTY_ITEM,
  LABEL_CLASS,
  SMALL_BTN,
  dateTimeLabel,
  isImagePath,
  itemLabel,
  signedUrls,
} from "./papaUtils";

export default function PapaInbox({ ownerId, userName, items, reloadItems }) {
  const [docs, setDocs] = useState([]);
  const [urls, setUrls] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showFiled, setShowFiled] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [creatingFor, setCreatingFor] = useState(null); // doc id
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      setLoading(true);
      let query = supabase
        .from("papa_documents")
        .select("*")
        .eq("manager_id", ownerId)
        .order("received_at", { ascending: false })
        .limit(200);
      if (!showFiled) query = query.eq("filed", false);
      const { data, error: loadError } = await query;
      if (!isMounted) return;
      if (loadError) {
        setError(loadError.message);
        setLoading(false);
        return;
      }
      setDocs(data || []);
      const signed = await signedUrls(supabase, data || []);
      if (!isMounted) return;
      setUrls(signed);
      setLoading(false);
    }
    load();
    return () => {
      isMounted = false;
    };
  }, [ownerId, showFiled, reloadToken]);

  function reload() {
    setReloadToken((t) => t + 1);
  }

  async function updateDoc(doc, patch) {
    const { error: updateError } = await supabase
      .from("papa_documents")
      .update(patch)
      .eq("id", doc.id);
    if (updateError) setError(updateError.message);
    reload();
  }

  async function createItemFromDoc(doc, row) {
    const { data, error: insertError } = await supabase
      .from("papa_items")
      .insert({ ...row, manager_id: ownerId })
      .select("id")
      .single();
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setCreatingFor(null);
    await updateDoc(doc, { item_id: data.id, filed: true });
    reloadItems();
  }

  async function addActionFromDoc(doc) {
    const title = window.prompt(
      "What needs to be done?",
      doc.body ? doc.body.slice(0, 120) : ""
    );
    if (!title?.trim()) return;
    const { error: insertError } = await supabase.from("papa_actions").insert({
      manager_id: ownerId,
      item_id: doc.item_id,
      title: title.trim(),
      assignee: userName || null,
    });
    if (insertError) setError(insertError.message);
    else window.alert("Action added — see the Actions tab.");
  }

  async function deleteDoc(doc) {
    if (!window.confirm("Delete this from the inbox? This cannot be undone.")) {
      return;
    }
    if (doc.storage_path) {
      await supabase.storage.from("papa-docs").remove([doc.storage_path]);
    }
    const { error: deleteError } = await supabase
      .from("papa_documents")
      .delete()
      .eq("id", doc.id);
    if (deleteError) setError(deleteError.message);
    reload();
  }

  async function handleUpload(event) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (files.length === 0) return;
    setUploading(true);
    for (const [i, file] of files.entries()) {
      const ext = file.name.includes(".") ? file.name.split(".").pop() : "jpg";
      const path = `${ownerId}/inbox/${Date.now()}-${i}.${ext.toLowerCase()}`;
      const { error: uploadError } = await supabase.storage
        .from("papa-docs")
        .upload(path, file, { contentType: file.type || undefined });
      if (uploadError) {
        setError(uploadError.message);
        continue;
      }
      await supabase.from("papa_documents").insert({
        manager_id: ownerId,
        storage_path: path,
        body: file.name,
        sender_name: userName || null,
        source: "upload",
      });
    }
    setUploading(false);
    reload();
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={showFiled}
            onChange={(e) => setShowFiled(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300"
          />
          Show filed items too
        </label>
        <label className="cursor-pointer rounded-xl bg-slate-900 px-3.5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-700">
          {uploading ? "Uploading…" : "+ Upload photos"}
          <input
            type="file"
            accept="image/*,application/pdf"
            multiple
            className="hidden"
            disabled={uploading}
            onChange={handleUpload}
          />
        </label>
      </div>

      {loading && <p className="text-slate-500">Loading…</p>}
      {error && <p className="mb-4 text-red-600">{error}</p>}
      {!loading && docs.length === 0 && (
        <p className="rounded-xl border border-dashed border-slate-200 bg-white p-6 text-center text-slate-500">
          Inbox is empty. Photos and messages sent on WhatsApp by team members
          (see the Team tab) show up here.
        </p>
      )}

      <ul className="space-y-3">
        {docs.map((doc) => {
          const url = doc.storage_path ? urls[doc.storage_path] : null;
          return (
            <li
              key={doc.id}
              className={`rounded-2xl border bg-white p-4 shadow-sm ${
                doc.filed ? "border-slate-100 opacity-70" : "border-slate-200"
              }`}
            >
              <div className="flex flex-col gap-4 sm:flex-row">
                {doc.storage_path && (
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0"
                  >
                    {isImagePath(doc.storage_path) ? (
                      <img
                        src={url}
                        alt={doc.body || "Photo"}
                        className="h-40 w-full rounded-xl object-cover ring-1 ring-slate-200 sm:w-40"
                      />
                    ) : (
                      <span className="flex h-40 w-full items-center justify-center rounded-xl bg-slate-100 text-sm text-slate-600 ring-1 ring-slate-200 sm:w-40">
                        Open file
                      </span>
                    )}
                  </a>
                )}
                <div className="min-w-0 flex-1 space-y-3">
                  <p className="text-xs text-slate-500">
                    {doc.sender_name || "Unknown"} ·{" "}
                    {doc.source === "whatsapp" ? "WhatsApp" : "Upload"} ·{" "}
                    {dateTimeLabel(doc.received_at)}
                    {doc.filed && " · Filed"}
                  </p>
                  {doc.body && (
                    <p className="whitespace-pre-wrap text-sm text-slate-800">
                      {doc.body}
                    </p>
                  )}

                  <label className="block max-w-sm">
                    <span className={LABEL_CLASS}>Holding</span>
                    <select
                      className="input"
                      value={doc.item_id || ""}
                      onChange={(e) =>
                        updateDoc(doc, {
                          item_id: e.target.value || null,
                          filed: Boolean(e.target.value),
                        })
                      }
                    >
                      <option value="">Not linked</option>
                      {items.map((item) => (
                        <option key={item.id} value={item.id}>
                          {itemLabel(item)}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setCreatingFor(creatingFor === doc.id ? null : doc.id)
                      }
                      className={SMALL_BTN}
                    >
                      New holding from this
                    </button>
                    <button
                      type="button"
                      onClick={() => addActionFromDoc(doc)}
                      className={SMALL_BTN}
                    >
                      Add action
                    </button>
                    <button
                      type="button"
                      onClick={() => updateDoc(doc, { filed: !doc.filed })}
                      className={SMALL_BTN}
                    >
                      {doc.filed ? "Move back to inbox" : "Mark done"}
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteDoc(doc)}
                      className="text-xs font-medium text-red-600 hover:text-red-800"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>

              {creatingFor === doc.id && (
                <div className="mt-4">
                  <ItemForm
                    initial={{ ...EMPTY_ITEM, notes: doc.body || "" }}
                    onSubmit={(row) => createItemFromDoc(doc, row)}
                    onCancel={() => setCreatingFor(null)}
                    submitLabel="Create holding"
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

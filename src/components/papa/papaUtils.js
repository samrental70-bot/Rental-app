export const ITEM_KINDS = [
  { value: "bank", label: "Bank accounts" },
  { value: "fixed_deposit", label: "Fixed deposits" },
  { value: "stock", label: "Stocks / demat" },
  { value: "mutual_fund", label: "Mutual funds" },
  { value: "insurance", label: "Insurance" },
  { value: "property", label: "Property" },
  { value: "other", label: "Other" },
];

export const ITEM_STATUSES = [
  { value: "to_review", label: "To review" },
  { value: "active", label: "Active" },
  { value: "closed", label: "Closed" },
];

export function kindLabel(value) {
  return ITEM_KINDS.find((k) => k.value === value)?.label || "Other";
}

export function itemLabel(item) {
  if (!item) return "";
  return [item.institution, item.name].filter(Boolean).join(" · ");
}

export function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function formatMoney(value) {
  return Number(value).toLocaleString("en-CA", {
    style: "currency",
    currency: "CAD",
  });
}

export function dateLabel(dateStr) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function dateTimeLabel(isoStr) {
  return new Date(isoStr).toLocaleString("en-CA", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export async function signedUrls(supabase, docs) {
  const withPaths = docs.filter((d) => d.storage_path);
  if (withPaths.length === 0) return {};
  const { data } = await supabase.storage
    .from("papa-docs")
    .createSignedUrls(
      withPaths.map((d) => d.storage_path),
      3600
    );
  const map = {};
  for (const row of data || []) {
    if (row.signedUrl) map[row.path] = row.signedUrl;
  }
  return map;
}

export function isImagePath(path) {
  return /\.(jpe?g|png|webp|heic)$/i.test(path || "");
}

export const LABEL_CLASS =
  "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500";
export const PRIMARY_BTN =
  "rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700 disabled:opacity-60";
export const SECONDARY_BTN =
  "rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50";
export const SMALL_BTN =
  "rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-50";

export const EMPTY_ITEM = {
  kind: "bank",
  institution: "",
  name: "",
  account_ref: "",
  holder: "",
  nominee: "",
  current_value: "",
  value_as_of: "",
  status: "to_review",
  notes: "",
};

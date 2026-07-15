import { supabase } from "./supabaseClient";

export function getPhotoUrl(storagePath) {
  const { data } = supabase.storage.from("room-photos").getPublicUrl(storagePath);
  return data.publicUrl;
}

export function formatRent(rentAmount, rentPeriod) {
  const amount = new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(rentAmount);
  return `${amount} / ${rentPeriod}`;
}

export function formatDate(dateString) {
  if (!dateString) return "";
  return new Date(`${dateString}T00:00:00`).toLocaleDateString("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

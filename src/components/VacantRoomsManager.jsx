import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { getPhotoUrl, formatRent, formatDate } from "../lib/rooms";

export default function VacantRoomsManager({ userId }) {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let isMounted = true;

    supabase
      .from("rooms")
      .select(
        "*, room_photos(id, storage_path, sort_order), locations(id, name)"
      )
      .eq("manager_id", userId)
      .eq("status", "empty")
      .order("created_at", { ascending: false })
      .then(({ data, error: fetchError }) => {
        if (!isMounted) return;
        if (fetchError) {
          setError(fetchError.message);
        } else {
          setRooms(
            (data || []).map((room) => ({
              ...room,
              room_photos: [...(room.room_photos || [])].sort(
                (a, b) => a.sort_order - b.sort_order
              ),
            }))
          );
        }
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [userId, reloadToken]);

  async function markOccupied(room) {
    const { error: updateError } = await supabase
      .from("rooms")
      .update({ status: "occupied" })
      .eq("id", room.id);
    if (!updateError) {
      setReloadToken((token) => token + 1);
    }
  }

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold tracking-tight text-slate-900">
        Vacant rooms (all locations)
      </h2>

      {loading && <p className="text-slate-500">Loading…</p>}
      {error && <p className="text-red-600">{error}</p>}
      {!loading && rooms.length === 0 && (
        <p className="rounded-xl border border-dashed border-slate-200 bg-white p-6 text-center text-slate-500">
          No vacant rooms right now.
        </p>
      )}

      <div className="space-y-3">
        {rooms.map((room) => (
          <div
            key={room.id}
            className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md sm:flex-row sm:items-center sm:justify-between sm:p-5"
          >
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-slate-100 sm:h-20 sm:w-20">
                {room.room_photos[0] && (
                  <img
                    src={getPhotoUrl(room.room_photos[0].storage_path)}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                )}
              </div>
              <div>
                <p className="font-semibold text-slate-900">{room.title}</p>
                <p className="text-sm font-medium text-slate-500">
                  {room.locations?.name || "Unassigned location"}
                </p>
                <p className="text-sm text-slate-500">
                  {formatRent(room.rent_amount, room.rent_period)} · Available{" "}
                  {formatDate(room.available_from)}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => markOccupied(room)}
              className="shrink-0 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 sm:self-center"
            >
              Mark occupied
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

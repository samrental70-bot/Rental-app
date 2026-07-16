import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { getPhotoUrl, formatRent, formatDate } from "../lib/rooms";
import RoomForm from "./RoomForm";

export default function RoomsManager({ userId, locationId, locationName, onBack }) {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingRoom, setEditingRoom] = useState(undefined); // undefined = hidden, null = new, object = editing
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let isMounted = true;

    supabase
      .from("rooms")
      .select("*, room_photos(id, storage_path, sort_order)")
      .eq("manager_id", userId)
      .eq("location_id", locationId)
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
  }, [userId, locationId, reloadToken]);

  function reload() {
    setReloadToken((token) => token + 1);
  }

  async function toggleStatus(room) {
    const nextStatus = room.status === "empty" ? "occupied" : "empty";
    const { error: updateError } = await supabase
      .from("rooms")
      .update({ status: nextStatus })
      .eq("id", room.id);
    if (!updateError) {
      reload();
    }
  }

  async function deleteRoom(room) {
    if (!window.confirm(`Delete "${room.title}"? This cannot be undone.`)) {
      return;
    }
    const paths = room.room_photos.map((p) => p.storage_path);
    if (paths.length > 0) {
      await supabase.storage.from("room-photos").remove(paths);
    }
    const { error: deleteError } = await supabase
      .from("rooms")
      .delete()
      .eq("id", room.id);
    if (!deleteError) {
      reload();
    }
  }

  if (editingRoom !== undefined) {
    return (
      <RoomForm
        userId={userId}
        locationId={locationId}
        room={editingRoom}
        onSaved={() => {
          setEditingRoom(undefined);
          reload();
        }}
        onCancel={() => setEditingRoom(undefined)}
      />
    );
  }

  return (
    <div>
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="mb-4 text-sm text-slate-500 hover:text-slate-800"
        >
          &larr; Back to locations
        </button>
      )}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-semibold text-slate-900">
          Rooms {locationName ? `in ${locationName}` : ""}
        </h2>
        <button
          type="button"
          onClick={() => setEditingRoom(null)}
          className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
        >
          + Add room
        </button>
      </div>

      {loading && <p className="text-slate-500">Loading…</p>}
      {error && <p className="text-red-600">{error}</p>}
      {!loading && rooms.length === 0 && (
        <p className="text-slate-500">
          You haven&apos;t added any rooms yet.
        </p>
      )}

      <div className="space-y-3">
        {rooms.map((room) => (
          <div
            key={room.id}
            className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="h-16 w-20 shrink-0 overflow-hidden rounded-md bg-slate-100">
                {room.room_photos[0] && (
                  <img
                    src={getPhotoUrl(room.room_photos[0].storage_path)}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                )}
              </div>
              <div>
                <p className="font-medium text-slate-900">{room.title}</p>
                <p className="text-sm text-slate-500">
                  {formatRent(room.rent_amount, room.rent_period)} · Available{" "}
                  {formatDate(room.available_from)}
                </p>
                <span
                  className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                    room.status === "empty"
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-slate-200 text-slate-700"
                  }`}
                >
                  {room.status === "empty" ? "Empty · Public" : "Occupied · Hidden"}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => toggleStatus(room)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Mark {room.status === "empty" ? "occupied" : "empty"}
              </button>
              <button
                type="button"
                onClick={() => setEditingRoom(room)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => deleteRoom(room)}
                className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import RoomCard from "../components/RoomCard";

export default function PublicListing() {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function loadRooms() {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from("rooms")
        .select("*, room_photos(id, storage_path, sort_order)")
        .eq("status", "empty")
        .order("created_at", { ascending: false });

      if (!isMounted) return;

      if (fetchError) {
        setError(fetchError.message);
      } else {
        const sorted = (data || []).map((room) => ({
          ...room,
          room_photos: [...(room.room_photos || [])].sort(
            (a, b) => a.sort_order - b.sort_order
          ),
        }));
        setRooms(sorted);
      }
      setLoading(false);
    }

    loadRooms();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-bold text-slate-900">Available Rooms</h1>
      <p className="mt-1 text-slate-500">
        Only rooms currently marked as empty are shown here.
      </p>

      {loading && (
        <p className="mt-8 text-slate-500">Loading available rooms…</p>
      )}
      {error && <p className="mt-8 text-red-600">{error}</p>}
      {!loading && !error && rooms.length === 0 && (
        <p className="mt-8 text-slate-500">
          No rooms are available right now. Please check back later.
        </p>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {rooms.map((room) => (
          <RoomCard key={room.id} room={room} />
        ))}
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import RoomCard from "../components/RoomCard";

export default function LocationRooms() {
  const { locationId } = useParams();
  const [location, setLocation] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      setLoading(true);

      const [locationResult, roomsResult] = await Promise.all([
        supabase.from("locations").select("*").eq("id", locationId).maybeSingle(),
        supabase
          .from("rooms")
          .select("*, room_photos(id, storage_path, sort_order)")
          .eq("location_id", locationId)
          .eq("status", "empty")
          .order("created_at", { ascending: false }),
      ]);

      if (!isMounted) return;

      if (!locationResult.data) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setLocation(locationResult.data);
      setRooms(
        (roomsResult.data || []).map((room) => ({
          ...room,
          room_photos: [...(room.room_photos || [])].sort(
            (a, b) => a.sort_order - b.sort_order
          ),
        }))
      );
      setLoading(false);
    }

    load();
    return () => {
      isMounted = false;
    };
  }, [locationId]);

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-16 text-center text-slate-500">
        Loading…
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
        <p className="text-slate-700">This location is no longer available.</p>
        <Link
          to="/"
          className="mt-4 inline-block font-medium text-slate-900 underline underline-offset-2"
        >
          Back to locations
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
      <Link
        to="/"
        className="-ml-2 inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
      >
        <span aria-hidden="true">&larr;</span>
        Back to locations
      </Link>

      <div className="mt-4 max-w-2xl">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          {location.name}
        </h1>
        {location.address && (
          <p className="mt-2 text-slate-500">{location.address}</p>
        )}
        {location.description && (
          <p className="mt-3 whitespace-pre-line leading-relaxed text-slate-600">
            {location.description}
          </p>
        )}
      </div>

      {rooms.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-slate-500">
          No rooms are available at this location right now.
        </div>
      ) : (
        <>
          <div className="mt-8 flex items-baseline justify-between border-b border-slate-200 pb-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              {rooms.length} {rooms.length === 1 ? "room" : "rooms"} available
            </h2>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {rooms.map((room) => (
              <RoomCard key={room.id} room={room} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

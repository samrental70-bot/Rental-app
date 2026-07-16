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
      <div className="mx-auto max-w-6xl px-4 py-8 text-slate-500">
        Loading…
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
        <p className="text-slate-700">This location is no longer available.</p>
        <Link to="/" className="mt-4 inline-block text-slate-900 underline">
          Back to locations
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Link to="/" className="text-sm text-slate-500 hover:text-slate-800">
        &larr; Back to locations
      </Link>

      <h1 className="mt-4 text-2xl font-bold text-slate-900">
        {location.name}
      </h1>
      {location.address && (
        <p className="mt-1 text-slate-500">{location.address}</p>
      )}
      {location.description && (
        <p className="mt-2 whitespace-pre-line text-slate-700">
          {location.description}
        </p>
      )}

      {rooms.length === 0 && (
        <p className="mt-8 text-slate-500">
          No rooms are available at this location right now.
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

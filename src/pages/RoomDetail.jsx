import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { getPhotoUrl, formatRent, formatDate } from "../lib/rooms";
import { GENDER_PREFERENCES } from "../lib/constants";
import ScheduleVisitForm from "../components/ScheduleVisitForm";

export default function RoomDetail() {
  const { roomId } = useParams();
  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [activePhoto, setActivePhoto] = useState(0);

  useEffect(() => {
    let isMounted = true;

    async function loadRoom() {
      setLoading(true);
      const { data, error } = await supabase
        .from("rooms")
        .select(
          "*, room_photos(id, storage_path, sort_order), locations(id, name)"
        )
        .eq("id", roomId)
        .eq("status", "empty")
        .maybeSingle();

      if (!isMounted) return;

      if (error || !data) {
        setNotFound(true);
      } else {
        data.room_photos = [...(data.room_photos || [])].sort(
          (a, b) => a.sort_order - b.sort_order
        );
        setRoom(data);
      }
      setLoading(false);
    }

    loadRoom();
    return () => {
      isMounted = false;
    };
  }, [roomId]);

  if (loading) {
    return <div className="mx-auto max-w-4xl px-4 py-8 text-slate-500">Loading…</div>;
  }

  if (notFound) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <p className="text-slate-700">
          This room is no longer available.
        </p>
        <Link to="/" className="mt-4 inline-block text-slate-900 underline">
          Back to locations
        </Link>
      </div>
    );
  }

  const backHref = room.locations ? `/locations/${room.locations.id}` : "/";
  const backLabel = room.locations
    ? `Back to ${room.locations.name}`
    : "Back to locations";

  const genderLabel = GENDER_PREFERENCES.find(
    (g) => g.value === room.gender_preference
  )?.label;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link to={backHref} className="text-sm text-slate-500 hover:text-slate-800">
        &larr; {backLabel}
      </Link>

      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="aspect-video w-full bg-slate-100">
          {room.room_photos.length > 0 ? (
            <img
              src={getPhotoUrl(room.room_photos[activePhoto].storage_path)}
              alt={room.title}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-slate-400">
              No photos yet
            </div>
          )}
        </div>
        {room.room_photos.length > 1 && (
          <div className="flex gap-2 overflow-x-auto p-3">
            {room.room_photos.map((photo, index) => (
              <button
                key={photo.id}
                type="button"
                onClick={() => setActivePhoto(index)}
                className={`h-16 w-20 shrink-0 overflow-hidden rounded-md border-2 ${
                  index === activePhoto ? "border-slate-900" : "border-transparent"
                }`}
              >
                <img
                  src={getPhotoUrl(photo.storage_path)}
                  alt=""
                  className="h-full w-full object-cover"
                />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-8 md:grid-cols-3">
        <div className="md:col-span-2">
          <h1 className="text-2xl font-bold text-slate-900">{room.title}</h1>
          {room.address && <p className="mt-1 text-slate-500">{room.address}</p>}

          <div className="mt-4 flex flex-wrap gap-3 text-sm">
            <span className="rounded-full bg-emerald-100 px-3 py-1 font-semibold text-emerald-800">
              {formatRent(room.rent_amount, room.rent_period)}
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
              {genderLabel}
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
              Available from {formatDate(room.available_from)}
            </span>
          </div>

          {room.description && (
            <p className="mt-6 whitespace-pre-line text-slate-700">
              {room.description}
            </p>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:col-span-1 h-fit">
          <h2 className="mb-4 font-semibold text-slate-900">
            Schedule a visit
          </h2>
          <ScheduleVisitForm roomId={room.id} />
        </div>
      </div>
    </div>
  );
}

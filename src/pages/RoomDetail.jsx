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
    <div className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
      <Link
        to={backHref}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-slate-900"
      >
        &larr; {backLabel}
      </Link>

      <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="aspect-video w-full bg-slate-50">
          {room.room_photos.length > 0 ? (
            <img
              src={getPhotoUrl(room.room_photos[activePhoto].storage_path)}
              alt={room.title}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center font-medium text-slate-400">
              No photos yet
            </div>
          )}
        </div>
        {room.room_photos.length > 1 && (
          <div className="flex gap-2 overflow-x-auto border-t border-slate-100 p-3">
            {room.room_photos.map((photo, index) => (
              <button
                key={photo.id}
                type="button"
                onClick={() => setActivePhoto(index)}
                className={`h-16 w-20 shrink-0 overflow-hidden rounded-lg border-2 transition ${
                  index === activePhoto ? "border-slate-900" : "border-transparent opacity-80 hover:opacity-100"
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

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-3 lg:gap-10">
        <div className="lg:col-span-2">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            {room.title}
          </h1>
          {room.address && <p className="mt-1.5 text-slate-500">{room.address}</p>}

          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <span className="rounded-full bg-emerald-50 px-3.5 py-1.5 font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-100">
              {formatRent(room.rent_amount, room.rent_period)}
            </span>
            <span className="rounded-full bg-slate-100 px-3.5 py-1.5 font-medium text-slate-700">
              {genderLabel}
            </span>
            <span className="font-medium text-slate-500">
              Available from {formatDate(room.available_from)}
            </span>
          </div>

          {room.description && (
            <p className="mt-8 whitespace-pre-line border-t border-slate-100 pt-6 leading-relaxed text-slate-600">
              {room.description}
            </p>
          )}
        </div>

        <div className="h-fit rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:sticky lg:top-8 lg:col-span-1">
          <h2 className="mb-5 border-b border-slate-100 pb-4 text-lg font-semibold text-slate-900">
            Schedule a visit
          </h2>
          <ScheduleVisitForm roomId={room.id} />
        </div>
      </div>
    </div>
  );
}

import { Link } from "react-router-dom";
import { getPhotoUrl, formatRent, formatDate } from "../lib/rooms";
import { GENDER_PREFERENCES } from "../lib/constants";

export default function RoomCard({ room }) {
  const coverPhoto = room.room_photos?.[0];
  const genderLabel = GENDER_PREFERENCES.find(
    (g) => g.value === room.gender_preference
  )?.label;

  return (
    <Link
      to={`/rooms/${room.id}`}
      className="group block overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg"
    >
      <div className="aspect-[4/3] w-full overflow-hidden bg-slate-100">
        {coverPhoto ? (
          <img
            src={getPhotoUrl(coverPhoto.storage_path)}
            alt={room.title}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">
            No photo yet
          </div>
        )}
      </div>
      <div className="space-y-1.5 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-slate-900">{room.title}</h3>
          <span className="whitespace-nowrap text-sm font-bold text-emerald-700">
            {formatRent(room.rent_amount, room.rent_period)}
          </span>
        </div>
        {room.address && (
          <p className="text-sm text-slate-500">{room.address}</p>
        )}
        <div className="flex flex-wrap gap-2 pt-2 text-xs font-medium text-slate-600">
          <span className="rounded-full bg-slate-100 px-2.5 py-1">
            {genderLabel}
          </span>
          <span className="rounded-full bg-slate-100 px-2.5 py-1">
            Available {formatDate(room.available_from)}
          </span>
        </div>
      </div>
    </Link>
  );
}

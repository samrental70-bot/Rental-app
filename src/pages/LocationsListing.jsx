import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

export default function LocationsListing() {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function loadLocations() {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from("locations")
        .select("*, rooms(id)")
        .order("name");

      if (!isMounted) return;

      if (fetchError) {
        setError(fetchError.message);
      } else {
        setLocations(data || []);
      }
      setLoading(false);
    }

    loadLocations();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          Locations
        </h1>
        <p className="mt-1.5 text-slate-500">
          Choose a location to see its available rooms.
        </p>

        {loading && (
          <p className="mt-8 text-slate-500">Loading locations…</p>
        )}
        {error && <p className="mt-8 text-red-600">{error}</p>}
        {!loading && !error && locations.length === 0 && (
          <p className="mt-8 text-slate-500">
            No rooms are available right now. Please check back later.
          </p>
        )}

        <div className="mt-6 flex flex-col gap-3">
          {locations.map((location) => (
            <Link
              key={location.id}
              to={`/locations/${location.id}`}
              className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
            >
              <div className="min-w-0">
                <h2 className="truncate text-lg font-semibold text-slate-900">
                  {location.name}
                </h2>
                {location.address && (
                  <p className="mt-1 truncate text-sm text-slate-500">
                    {location.address}
                  </p>
                )}
              </div>
              <span className="shrink-0 whitespace-nowrap rounded-full bg-emerald-50 px-4 py-1.5 text-sm font-medium text-emerald-700">
                {location.rooms?.length || 0} room
                {location.rooms?.length === 1 ? "" : "s"} available
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

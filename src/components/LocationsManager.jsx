import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import LocationForm from "./LocationForm";
import RoomsManager from "./RoomsManager";

export default function LocationsManager({ userId }) {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingLocation, setEditingLocation] = useState(undefined); // undefined = hidden, null = new, object = editing
  const [openLocation, setOpenLocation] = useState(null); // location whose rooms are being managed
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let isMounted = true;

    supabase
      .from("locations")
      .select("*, rooms(id, status)")
      .eq("manager_id", userId)
      .order("created_at", { ascending: false })
      .then(({ data, error: fetchError }) => {
        if (!isMounted) return;
        if (fetchError) {
          setError(fetchError.message);
        } else {
          setLocations(data || []);
        }
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [userId, reloadToken]);

  function reload() {
    setReloadToken((token) => token + 1);
  }

  async function deleteLocation(location) {
    const roomCount = location.rooms?.length || 0;
    const warning =
      roomCount > 0
        ? `Delete "${location.name}"? This will also delete its ${roomCount} room(s) and cannot be undone.`
        : `Delete "${location.name}"? This cannot be undone.`;
    if (!window.confirm(warning)) return;

    const { error: deleteError } = await supabase
      .from("locations")
      .delete()
      .eq("id", location.id);
    if (!deleteError) {
      reload();
    }
  }

  if (openLocation) {
    return (
      <RoomsManager
        userId={userId}
        locationId={openLocation.id}
        locationName={openLocation.name}
        onBack={() => {
          setOpenLocation(null);
          reload();
        }}
      />
    );
  }

  if (editingLocation !== undefined) {
    return (
      <LocationForm
        userId={userId}
        location={editingLocation}
        onSaved={() => {
          setEditingLocation(undefined);
          reload();
        }}
        onCancel={() => setEditingLocation(undefined)}
      />
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-semibold text-slate-900">Your locations</h2>
        <button
          type="button"
          onClick={() => setEditingLocation(null)}
          className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
        >
          + Add location
        </button>
      </div>

      {loading && <p className="text-slate-500">Loading…</p>}
      {error && <p className="text-red-600">{error}</p>}
      {!loading && locations.length === 0 && (
        <p className="text-slate-500">
          You haven&apos;t added any locations yet. Add one to start listing
          rooms.
        </p>
      )}

      <div className="space-y-3">
        {locations.map((location) => {
          const total = location.rooms?.length || 0;
          const vacant =
            location.rooms?.filter((r) => r.status === "empty").length || 0;
          return (
            <div
              key={location.id}
              className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-medium text-slate-900">{location.name}</p>
                {location.address && (
                  <p className="text-sm text-slate-500">{location.address}</p>
                )}
                <p className="mt-1 text-sm text-slate-500">
                  {total} room{total === 1 ? "" : "s"} · {vacant} vacant
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setOpenLocation(location)}
                  className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
                >
                  Manage rooms
                </button>
                <button
                  type="button"
                  onClick={() => setEditingLocation(location)}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => deleteLocation(location)}
                  className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
                >
                  Delete
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

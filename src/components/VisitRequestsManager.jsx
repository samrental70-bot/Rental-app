import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import {
  APPLICANT_GENDERS,
  VISA_STATUSES,
  VISIT_REQUEST_STATUSES,
} from "../lib/constants";
import { formatDate } from "../lib/rooms";

// Scoped to this screen only (not the shared .input class) so status pills
// can read as colored badges while staying a real, functional <select>.
const STATUS_BADGE_STYLES = {
  new: "border-emerald-200 bg-emerald-100 text-emerald-800",
  contacted: "border-slate-200 bg-slate-100 text-slate-700",
  scheduled: "border-slate-300 bg-slate-200 text-slate-800",
  closed: "border-slate-200 bg-slate-50 text-slate-500",
};

export default function VisitRequestsManager({ userId }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let isMounted = true;

    supabase
      .from("visit_requests")
      .select("*, rooms!inner(id, title, manager_id)")
      .eq("rooms.manager_id", userId)
      .order("created_at", { ascending: false })
      .then(({ data, error: fetchError }) => {
        if (!isMounted) return;
        if (fetchError) {
          setError(fetchError.message);
        } else {
          setRequests(data || []);
        }
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [userId, reloadToken]);

  async function updateStatus(requestId, status) {
    const { error: updateError } = await supabase
      .from("visit_requests")
      .update({ status })
      .eq("id", requestId);
    if (!updateError) {
      setReloadToken((token) => token + 1);
    }
  }

  function label(options, value) {
    return options.find((o) => o.value === value)?.label || value;
  }

  return (
    <div>
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="font-semibold text-slate-900">Visit requests</h2>
        {!loading && requests.length > 0 && (
          <span className="text-sm text-slate-400">
            {requests.length} total
          </span>
        )}
      </div>

      {loading && <p className="text-slate-500">Loading…</p>}
      {error && <p className="text-red-600">{error}</p>}
      {!loading && requests.length === 0 && (
        <p className="text-slate-500">No visit requests yet.</p>
      )}

      <div className="space-y-4">
        {requests.map((request) => (
          <div
            key={request.id}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-900">
                  {request.full_name}{" "}
                  <span className="font-normal text-slate-500">
                    &middot; {request.rooms?.title}
                  </span>
                </p>
                <p className="mt-0.5 text-sm text-slate-500">
                  {request.email} · {request.phone}
                </p>
              </div>
              <select
                value={request.status}
                onChange={(e) => updateStatus(request.id, e.target.value)}
                className={`w-auto cursor-pointer rounded-full border px-3 py-1.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-slate-400 ${
                  STATUS_BADGE_STYLES[request.status] ||
                  STATUS_BADGE_STYLES.contacted
                }`}
              >
                {VISIT_REQUEST_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl border border-slate-100 bg-slate-50 p-3 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Room needed for
                </dt>
                <dd className="mt-0.5 font-medium text-slate-700">
                  {label(APPLICANT_GENDERS, request.applicant_gender)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Visa status
                </dt>
                <dd className="mt-0.5 font-medium text-slate-700">
                  {label(VISA_STATUSES, request.visa_status)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Room required from
                </dt>
                <dd className="mt-0.5 font-medium text-slate-700">
                  {formatDate(request.room_required_from)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Submitted
                </dt>
                <dd className="mt-0.5 font-medium text-slate-700">
                  {formatDate(request.created_at?.slice(0, 10))}
                </dd>
              </div>
            </dl>

            {request.notes && (
              <p className="mt-3 whitespace-pre-line border-t border-slate-100 pt-3 text-sm text-slate-600">
                {request.notes}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

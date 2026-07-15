import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import {
  APPLICANT_GENDERS,
  VISA_STATUSES,
  VISIT_REQUEST_STATUSES,
} from "../lib/constants";
import { formatDate } from "../lib/rooms";

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
      <h2 className="mb-4 font-semibold text-slate-900">Visit requests</h2>

      {loading && <p className="text-slate-500">Loading…</p>}
      {error && <p className="text-red-600">{error}</p>}
      {!loading && requests.length === 0 && (
        <p className="text-slate-500">No visit requests yet.</p>
      )}

      <div className="space-y-3">
        {requests.map((request) => (
          <div
            key={request.id}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-medium text-slate-900">
                  {request.full_name}{" "}
                  <span className="font-normal text-slate-500">
                    &middot; {request.rooms?.title}
                  </span>
                </p>
                <p className="text-sm text-slate-600">
                  {request.email} · {request.phone}
                </p>
              </div>
              <select
                value={request.status}
                onChange={(e) => updateStatus(request.id, e.target.value)}
                className="input w-auto"
              >
                {VISIT_REQUEST_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-slate-600 sm:grid-cols-4">
              <div>
                <dt className="text-slate-400">Room needed for</dt>
                <dd>{label(APPLICANT_GENDERS, request.applicant_gender)}</dd>
              </div>
              <div>
                <dt className="text-slate-400">Visa status</dt>
                <dd>{label(VISA_STATUSES, request.visa_status)}</dd>
              </div>
              <div>
                <dt className="text-slate-400">Room required from</dt>
                <dd>{formatDate(request.room_required_from)}</dd>
              </div>
              <div>
                <dt className="text-slate-400">Submitted</dt>
                <dd>{formatDate(request.created_at?.slice(0, 10))}</dd>
              </div>
            </dl>

            {request.notes && (
              <p className="mt-2 whitespace-pre-line text-sm text-slate-700">
                {request.notes}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

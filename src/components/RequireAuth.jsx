import { Navigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";

export default function RequireAuth({ children }) {
  const { session, loading } = useAuth();

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Loading…</div>;
  }

  if (!session) {
    return <Navigate to="/admin/login" replace />;
  }

  return children;
}

import { Routes, Route, Link } from "react-router-dom";
import { AuthProvider } from "./lib/AuthContext";
import PublicListing from "./pages/PublicListing";
import RoomDetail from "./pages/RoomDetail";
import AdminLogin from "./pages/AdminLogin";
import AdminDashboard from "./pages/AdminDashboard";
import RequireAuth from "./components/RequireAuth";

export default function App() {
  return (
    <AuthProvider>
      <div className="min-h-screen flex flex-col">
        <SiteHeader />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<PublicListing />} />
            <Route path="/rooms/:roomId" element={<RoomDetail />} />
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route
              path="/admin"
              element={
                <RequireAuth>
                  <AdminDashboard />
                </RequireAuth>
              }
            />
          </Routes>
        </main>
        <SiteFooter />
      </div>
    </AuthProvider>
  );
}

function SiteHeader() {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between">
        <Link to="/" className="text-lg font-semibold text-slate-900">
          Available Rooms
        </Link>
        <Link
          to="/admin"
          className="text-sm text-slate-500 hover:text-slate-800"
        >
          Manager login
        </Link>
      </div>
    </header>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-400">
      &copy; {new Date().getFullYear()} Room Rentals
    </footer>
  );
}

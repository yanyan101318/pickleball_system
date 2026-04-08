// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import ProtectedRoute   from "./auth/ProtectedRoute";

// Auth
import LoginPage    from "./auth/LoginPage";
import RegisterPage from "./auth/RegisterPage";

// Admin
import AdminLayout          from "./admin/AdminLayout";
import AdminDashboard       from "./admin/AdminDashboard";
import CourtManager         from "./admin/CourtManager";
import BookingManager       from "./admin/BookingManager";
import PaymentReview        from "./admin/PaymentReview";
import Analytics            from "./admin/Analytics";
import AnnouncementManager  from "./admin/AnnouncementManager";
import AdminTournament      from "./admin/AdminTournament";

// Tournament public pages (scorer / viewer)
import ScorerPage from "./pages/ScorerPage";
import ViewerPage from "./pages/ViewerPage";

import "./App.css";
import "./admin/admin.css";
import "./auth/auth.css";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>

          {/* ── PUBLIC ── */}
          <Route path="/login"    element={<LoginPage/>}/>
          <Route path="/register" element={<RegisterPage/>}/>

          {/* ── PUBLIC TOURNAMENT VIEWS ── */}
          <Route path="/bracket/:tournamentId"           element={<ViewerPage/>}/>
          <Route path="/score/:tournamentId/:matchId"    element={<ScorerPage/>}/>

          {/* ── ADMIN PANEL ── */}
          <Route path="/admin" element={
            <ProtectedRoute requiredRole="admin">
              <AdminLayout/>
            </ProtectedRoute>
          }>
            <Route index                element={<Navigate to="/admin/dashboard" replace/>}/>
            <Route path="dashboard"     element={<AdminDashboard/>}/>
            <Route path="courts"        element={<CourtManager/>}/>
            <Route path="bookings"      element={<BookingManager/>}/>
            <Route path="payments"      element={<PaymentReview/>}/>
            <Route path="tournament"    element={<AdminTournament/>}/>
            <Route path="analytics"     element={<Analytics/>}/>
            <Route path="announcements" element={<AnnouncementManager/>}/>
          </Route>

          {/* ── CUSTOMER PANEL (placeholder for Phase 2) ── */}
          <Route path="/user/*" element={
            <ProtectedRoute requiredRole="customer">
              <div style={{padding:"2rem",color:"#fff"}}>
                Customer panel coming soon. Phase 2! 🚀
              </div>
            </ProtectedRoute>
          }/>

          {/* ── FALLBACK ── */}
          <Route path="/" element={<Navigate to="/login" replace/>}/>
          <Route path="*" element={<Navigate to="/login" replace/>}/>

        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
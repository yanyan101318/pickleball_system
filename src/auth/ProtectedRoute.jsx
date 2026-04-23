// src/auth/ProtectedRoute.jsx
import { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import { useAuth } from "./AuthContext";

export default function ProtectedRoute({ children, requiredRole }) {
  const { user, role, loading } = useAuth();

  useEffect(() => {
    if (!user || user.emailVerified) return;
    signOut(auth).catch(() => {});
  }, [user]);

  if (loading) {
    return (
      <div className="pr-loading">
        <div className="pr-spinner" />
        <span>Verifying access...</span>
      </div>
    );
  }

  if (user && !user.emailVerified) {
    return (
      <div className="pr-loading">
        <div className="pr-spinner" />
        <span>Verifying access...</span>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (requiredRole && role !== requiredRole) {
    if (role === "admin") return <Navigate to="/admin/dashboard" replace />;
    if (role === "customer") return <Navigate to="/user/home" replace />;
    return <Navigate to="/login" replace />;
  }

  return children;
}

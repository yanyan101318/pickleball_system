// src/auth/LoginPage.jsx
import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useNavigate, Link } from "react-router-dom";
import { auth, db } from "../firebase";

export default function LoginPage() {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [showPass, setShowPass] = useState(false);
  const navigate = useNavigate();

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const snap = await getDoc(doc(db, "users", cred.user.uid));
      if (snap.exists()) {
        const role = snap.data().role;
        if (role === "admin")    navigate("/admin/dashboard", { replace: true });
        else                     navigate("/user/home",       { replace: true });
      } else {
        setError("User profile not found. Contact admin.");
      }
    } catch (err) {
      setError(friendlyError(err.code));
    }
    setLoading(false);
  }

  function friendlyError(code) {
    switch (code) {
      case "auth/user-not-found":    return "No account found with this email.";
      case "auth/wrong-password":    return "Incorrect password.";
      case "auth/invalid-email":     return "Invalid email address.";
      case "auth/too-many-requests": return "Too many attempts. Try again later.";
      default:                       return "Login failed. Please try again.";
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-left">
        <div className="auth-brand">
          <div className="auth-brand-icon">🏓</div>
          <h1 className="auth-brand-name">PicklePro</h1>
          <p className="auth-brand-tagline">PickleBall Management System</p>
        </div>
        <div className="auth-left-features">
          <div className="alf-item"><span className="alf-icon"></span><span>Tournament Management</span></div>
          <div className="alf-item"><span className="alf-icon"></span><span>Court Booking</span></div>
          <div className="alf-item"><span className="alf-icon"></span><span>Payment Processing</span></div>
          <div className="alf-item"><span className="alf-icon"></span><span>Analytics Dashboard</span></div>
        </div>
      </div>

      <div className="auth-right">
        <div className="auth-card">
          <div className="auth-card-header">
            <h2 className="auth-card-title">Welcome back</h2>
            <p className="auth-card-sub">Sign in to your account</p>
          </div>

          <form className="auth-form" onSubmit={handleLogin}>
            <div className="af-group">
              <label className="af-label">Email address</label>
              <input
                className="af-input"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoComplete="email"
              />
            </div>

            <div className="af-group">
              <label className="af-label">Password</label>
              <div className="af-input-wrap">
                <input
                  className="af-input"
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                />
                <button type="button" className="af-eye" onClick={() => setShowPass(p => !p)}>
                  {showPass ? "🙈" : "👁️"}
                </button>
              </div>
            </div>

            {error && <div className="af-error"><span>⚠</span>{error}</div>}

            <button className="af-submit" type="submit" disabled={loading}>
              {loading ? <span className="af-spinner"/> : "Sign In"}
            </button>
          </form>

          <div className="auth-card-footer">
            Don't have an account?{" "}
            <Link to="/register" className="auth-link">Register here</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
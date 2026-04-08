// src/admin/AdminLayout.jsx
import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

const NAV_ITEMS = [
  { to: "/admin/dashboard",   label: "Dashboard"    },
  { to: "/admin/courts",      label: "Courts"        },
  { to: "/admin/bookings",    label: "Bookings"      },
  { to: "/admin/payments",    label: "Payments"      },
  { to: "/admin/tournament",  label: "Tournament"    },
  { to: "/admin/announcements", label: "Announcements" },
  { to: "/admin/analytics",   label: "Analytics"     },
];

export default function AdminLayout() {
  const { profile, logout } = useAuth();
  const [showLogout, setShowLogout] = useState(false);
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <div className="min-h-screen bg-[#0a0f18]">
      {/* TOP NAVIGATION */}
      <nav className="sticky top-0 z-50 bg-[#0a0f18]/90 backdrop-blur-xl border-b border-slate-800 px-4 py-3">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 group cursor-pointer">
              <div className="w-8 h-8 bg-gradient-to-br from-[#00f2ff] to-[#0088ff] rounded-lg flex items-center justify-center shadow-lg cyan-glow">
                <span className="material-symbols-outlined text-slate-900 font-bold text-sm">sports_tennis</span>
              </div>
              <div className="flex flex-col">
                <span className="text-lg font-black text-white tracking-tight">PICKLEPRO</span>
                <span className="text-[9px] text-cyan-400 font-bold tracking-[0.2em] uppercase">Volt Facility</span>
              </div>
            </div>
            <div className="hidden lg:flex items-center gap-6 ml-6">
              {NAV_ITEMS.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `text-xs font-medium transition-colors ${
                      isActive
                        ? "nav-link-active text-cyan-400"
                        : "nav-link text-slate-400 hover:text-cyan-400"
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="hidden md:flex flex-col items-end border-r border-slate-800 pr-6">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Current Date</span>
              <span className="text-sm font-semibold text-slate-300">{currentDate}</span>
            </div>
            <div className="flex items-center gap-4">
              <button className="p-2 text-slate-400 hover:text-cyan-400 transition-colors">
                <span className="material-symbols-outlined">notifications</span>
              </button>
              <div className="flex items-center gap-3 pl-4 border-l border-slate-800 relative">
                <div className="flex flex-col items-end cursor-pointer" onClick={() => setShowLogout(p => !p)}>
                  <span className="text-xs font-bold text-white">{profile?.name ?? "Administrator"}</span>
                  <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Administrator</span>
                </div>
                <div className="w-8 h-8 rounded-full border-2 border-slate-800 overflow-hidden">
                  <img
                    alt="Admin Avatar"
                    className="w-full h-full object-cover"
                    src={profile?.avatar || "https://lh3.googleusercontent.com/aida-public/AB6AXuCN2G52zKcQynqcDn68fQ0l2-2R_sUyjlQmzSidfD1KEUB5swEGfwLzkKOhJP0mC1tzXR0Q57ZOkSgT_e1p3tDFFFZsXgBqsH4EwxfR4F9FNKK_rBUJpYot5FbVS4pZ2FuLqMjGGvEMVOABhj0FGFzZo0v8g1cPPe2qmc9bkGd_od-WQD_OFNhw_3OIxnlcDQht8cuEyYEKPT1tSon0qRPzTiGEMegm0S1-eUm1r0P3w3-wLo0lnv4f9z0itnBiUGdB9HebRcIrMwg"}
                  />
                </div>
                {showLogout && (
                  <div className="absolute top-full right-0 mt-2 bg-[#151e2d] border border-slate-800 rounded-xl p-2 shadow-lg">
                    <button
                      className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                      onClick={handleLogout}
                    >
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* MAIN CONTENT */}
      <main className="max-w-[1600px] mx-auto p-6 lg:p-10">
        <Outlet />
      </main>

      {/* FOOTER */}
      <footer className="max-w-[1600px] mx-auto p-6 mt-12 border-t border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4 text-slate-500 text-xs font-medium">
        <div>© 2026 PicklePro Volt Management Systems. All rights reserved.</div>
        <div className="flex items-center gap-6">
          <a className="hover:text-white transition-colors" href="#">Privacy Policy</a>
          <a className="hover:text-white transition-colors" href="#">Terms of Service</a>
          <a className="hover:text-white transition-colors" href="#">Support Center</a>
        </div>
      </footer>
    </div>
  );
}
// src/admin/AdminDashboard.jsx
import { useState, useEffect } from "react";
import { collection, query, where, getDocs, orderBy, limit, Timestamp } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../auth/AuthContext";

function StatCard({ icon, label, value, sub, color, status }) {
  const getStatusColor = (status) => {
    switch (status) {
      case 'on-track': return 'emerald';
      case 'action-required': return 'orange';
      case 'live-status': return 'emerald';
      default: return 'slate';
    }
  };

  const statusColor = getStatusColor(status);

  return (
    <div className="bg-[#151e2d] border border-slate-800 rounded-xl p-4 hover:border-cyan-500/50 transition-all cursor-pointer group">
      <div className="flex justify-between items-start mb-3">
        <div className={`p-2 bg-${color}-500/10 rounded-lg group-hover:bg-${color}-500/20 transition-colors`}>
          <span className={`material-symbols-outlined text-${color}-400 text-xl`}>{icon}</span>
        </div>
        {status && (
          <div className={`flex items-center gap-1 px-1.5 py-0.5 bg-${statusColor}-500/10 text-${statusColor}-400 rounded-full text-[9px] font-bold uppercase tracking-tighter`}>
            <span className={`w-1 h-1 bg-${statusColor}-400 rounded-full ${status === 'live-status' ? 'animate-pulse' : ''}`}></span>
            {status === 'on-track' ? 'On Track' :
             status === 'action-required' ? 'Action Required' :
             status === 'live-status' ? 'Live Status' : 'Daily Total'}
          </div>
        )}
      </div>
      <div className="space-y-0.5">
        <h3 className="text-2xl font-black text-white tracking-tighter">{value}</h3>
        <p className="text-slate-400 font-semibold uppercase text-[10px] tracking-wider">{label}</p>
      </div>
      <div className="mt-3 pt-3 border-t border-slate-800/50">
        <span className="text-[10px] text-slate-500 font-medium">{sub}</span>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const { profile } = useAuth();
  const [stats, setStats] = useState({
    bookingsToday: 0,
    pendingPayments: 0,
    totalPlayers: 0,
    activeCourts: 12
  });
  const [recentBookings, setRecentBookings] = useState([]);
  const [recentPayments, setRecentPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const today = new Date();
        today.setHours(0,0,0,0);
        const todayTs = Timestamp.fromDate(today);

        // Bookings today
        const bSnap = await getDocs(query(
          collection(db,"bookings"),
          where("createdAt",">=",todayTs)
        ));

        // Pending payments
        const pSnap = await getDocs(query(
          collection(db,"payments"),
          where("paymentStatus","==","Pending")
        ));

        // Total players
        const uSnap = await getDocs(query(
          collection(db,"users"),
          where("role","==","customer")
        ));

        setStats({
          bookingsToday: bSnap.size,
          pendingPayments: pSnap.size,
          totalPlayers: uSnap.size,
          activeCourts: 12, // Static for now
        });

        // Recent bookings (last 5)
        const rbSnap = await getDocs(query(
          collection(db,"bookings"),
          orderBy("createdAt","desc"),
          limit(5)
        ));
        setRecentBookings(rbSnap.docs.map(d=>({id:d.id,...d.data()})));

        // Recent payments (last 5)
        const rpSnap = await getDocs(query(
          collection(db,"payments"),
          orderBy("createdAt","desc"),
          limit(5)
        ));
        setRecentPayments(rpSnap.docs.map(d=>({id:d.id,...d.data()})));

      } catch(err) {
        console.error("Dashboard fetch error:", err);
      }
      setLoading(false);
    }
    fetchData();
  }, []);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  if (loading) return (
    <div className="flex items-center justify-center min-h-[200px]">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400 mx-auto mb-2"></div>
        <span className="text-slate-400 text-sm">Loading dashboard...</span>
      </div>
    </div>
  );

  return (
    <div>
      {/* HEADER SECTION */}
      <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
            {greeting}, {profile?.name?.split(" ")[0] ?? "Ian"} 👋
          </h1>
          <p className="text-sm text-slate-400">Here's a comprehensive look at your facility's heartbeat today.</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-lg transition-all flex items-center gap-1.5 text-sm">
            <span className="material-symbols-outlined text-base">calendar_today</span>
            Schedule
          </button>
          <button className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-lg transition-all shadow-lg cyan-glow flex items-center gap-1.5 text-sm">
            <span className="material-symbols-outlined text-base">add_circle</span>
            New Booking
          </button>
        </div>
      </div>

      {/* STATS CARDS */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          icon="book_online"
          label="Bookings Today"
          value={stats.bookingsToday}
          sub="0% vs yesterday"
          color="cyan"
          status="on-track"
        />
        <StatCard
          icon="payments"
          label="Pending Payments"
          value={stats.pendingPayments}
          sub="Needs urgent review"
          color="orange"
          status="action-required"
        />
        <StatCard
          icon="groups"
          label="Total Players"
          value={stats.totalPlayers}
          sub="Registered members"
          color="slate"
          status="daily-total"
        />
        <StatCard
          icon="sports_tennis"
          label="Active Courts"
          value={stats.activeCourts}
          sub="12/12 Available"
          color="emerald"
          status="live-status"
        />
      </section>

      {/* MAIN CONTENT GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ACTIVITY FEED */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
              Today's Activity Feed
              <span className="px-1.5 py-0.5 bg-slate-800 text-[9px] font-bold rounded text-slate-400 uppercase">Live</span>
            </h2>
            <button className="text-xs font-bold text-cyan-400 hover:underline">View Historical Data</button>
          </div>
          <div className="bg-[#151e2d] border border-slate-800 rounded-2xl overflow-hidden">
            <div className="max-h-[400px] overflow-y-auto custom-scrollbar p-4 space-y-3">
              <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed border-slate-800/50 rounded-xl bg-slate-900/20">
                <div className="w-12 h-12 bg-slate-800/50 rounded-full flex items-center justify-center mb-3">
                  <span className="material-symbols-outlined text-slate-600 text-2xl">history_toggle_off</span>
                </div>
                <h3 className="text-sm font-bold text-white mb-1">No activities recorded yet</h3>
                <p className="text-slate-500 text-xs max-w-xs mb-4">When bookings, payments, or court changes occur, they will appear here in chronological order.</p>
                <div className="flex gap-3">
                  <button className="px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white transition-colors">Refresh Feed</button>
                  <button className="px-4 py-1.5 bg-slate-800 text-white rounded-lg text-xs font-semibold hover:bg-slate-700 transition-colors">Simulation Mode</button>
                </div>
              </div>
            </div>
          </div>
        </div>

          {/* RECENT PAYMENTS */}
          <div className="bg-[#151e2d] border border-slate-800 rounded-2xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white tracking-tight uppercase">Recent Payments</h3>
              <a className="text-[10px] font-bold text-cyan-400" href="/admin/payments">View All</a>
            </div>
            {recentPayments.length === 0 ? (
              <div className="text-center py-6 border border-dashed border-slate-800 rounded-lg">
                <span className="material-symbols-outlined text-slate-700 text-lg mb-1">receipt_long</span>
                <p className="text-[10px] text-slate-500 font-medium">No recent transactions</p>
              </div>
            ) : (
              <div className="space-y-2">
                {recentPayments.slice(0, 3).map(payment => (
                  <div key={payment.id} className="flex items-center justify-between p-2 bg-slate-900/50 rounded-lg">
                    <div>
                      <div className="text-xs font-bold text-white">{payment.name || "Unknown"}</div>
                      <div className="text-[9px] text-slate-500">{payment.method || "N/A"}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-bold text-white">₱{payment.amount || "0"}</div>
                      <div className={`text-[9px] px-1.5 py-0.5 rounded-full ${
                        payment.paymentStatus === 'Completed' ? 'bg-emerald-500/20 text-emerald-400' :
                        payment.paymentStatus === 'Pending' ? 'bg-orange-500/20 text-orange-400' :
                        'bg-slate-500/20 text-slate-400'
                      }`}>
                        {payment.paymentStatus || "Pending"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
      </div>
    </div>
  );
}
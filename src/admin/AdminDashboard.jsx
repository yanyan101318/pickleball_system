// src/admin/AdminDashboard.jsx
import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  Timestamp,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../auth/AuthContext";
import ActivityFeedTimeline, { buildActivityEvents } from "./ActivityFeedTimeline";

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

function productStockDash(p) {
  const n = p?.stock ?? p?.quantity ?? p?.qty;
  const v = Number(n);
  return Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0;
}

function PosStatTile({ icon, label, value, sub, accent }) {
  const ring =
    accent === "emerald"
      ? "border-emerald-500/35 shadow-[0_0_24px_rgba(16,185,129,0.12)]"
      : accent === "amber"
        ? "border-amber-500/35 shadow-[0_0_24px_rgba(245,158,11,0.12)]"
        : accent === "violet"
          ? "border-violet-500/35 shadow-[0_0_24px_rgba(139,92,246,0.12)]"
          : "border-cyan-500/40 shadow-[0_0_28px_rgba(34,211,238,0.15)]";
  const iconWrap =
    accent === "emerald"
      ? "bg-emerald-500/15 text-emerald-400"
      : accent === "amber"
        ? "bg-amber-500/15 text-amber-400"
        : accent === "violet"
          ? "bg-violet-500/15 text-violet-300"
          : "bg-cyan-500/15 text-cyan-400";
  return (
    <div
      className={`bg-[#151e2d] border rounded-xl p-4 transition-all hover:border-cyan-500/45 group ${ring}`}
    >
      <div className="flex justify-between items-start mb-3">
        <div className={`p-2 rounded-lg ${iconWrap}`}>
          <span className="material-symbols-outlined text-xl">{icon}</span>
        </div>
        <span className="text-[9px] font-bold uppercase tracking-tight text-cyan-500/80">POS</span>
      </div>
      <div className="space-y-0.5">
        <h3 className="text-2xl font-black text-white tracking-tighter tabular-nums">{value}</h3>
        <p className="text-slate-400 font-semibold uppercase text-[10px] tracking-wider">{label}</p>
      </div>
      <div className="mt-3 pt-3 border-t border-slate-800/50">
        <span className="text-[10px] text-slate-500 font-medium leading-snug">{sub}</span>
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
  const [recentPayments, setRecentPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  const [feedBookings, setFeedBookings] = useState([]);
  const [feedPayments, setFeedPayments] = useState([]);
  const [feedLogs, setFeedLogs] = useState([]);

  const [posRetail, setPosRetail] = useState({
    dailySales: 0,
    transactionsToday: 0,
    bestSellerName: "—",
    bestSellerUnits: 0,
    lowStockSummary: "No product data",
    lowStockCount: 0,
  });

  const activityEvents = useMemo(
    () => buildActivityEvents({ bookings: feedBookings, payments: feedPayments, logs: feedLogs }).slice(0, 50),
    [feedBookings, feedPayments, feedLogs]
  );

  useEffect(() => {
    async function fetchData() {
      try {
        const today = new Date();
        today.setHours(0,0,0,0);
        const todayTs = Timestamp.fromDate(today);

        const bSnap = await getDocs(query(
          collection(db,"bookings"),
          where("createdAt",">=",todayTs)
        ));

        const pSnap = await getDocs(query(
          collection(db,"payments"),
          where("paymentStatus","==","Pending")
        ));

        const uSnap = await getDocs(query(
          collection(db,"users"),
          where("role","==","customer")
        ));

        const courtsSnap = await getDocs(collection(db, "courts"));
        const activeCourts = courtsSnap.docs.filter((d) => d.data().isActive !== false).length;

        setStats({
          bookingsToday: bSnap.size,
          pendingPayments: pSnap.size,
          totalPlayers: uSnap.size,
          activeCourts: activeCourts || courtsSnap.size,
        });

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

  useEffect(() => {
    const qB = query(collection(db, "bookings"), orderBy("createdAt", "desc"), limit(40));
    const qP = query(collection(db, "payments"), orderBy("createdAt", "desc"), limit(40));
    const qL = query(collection(db, "activityLogs"), orderBy("createdAt", "desc"), limit(40));

    const unsubB = onSnapshot(
      qB,
      (snap) => setFeedBookings(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (err) => console.error("Activity feed (bookings):", err)
    );
    const unsubP = onSnapshot(
      qP,
      (snap) => setFeedPayments(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (err) => console.error("Activity feed (payments):", err)
    );
    const unsubL = onSnapshot(
      qL,
      (snap) => setFeedLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (err) => console.error("Activity feed (logs):", err)
    );

    return () => {
      unsubB();
      unsubP();
      unsubL();
    };
  }, []);

  useEffect(() => {
    let txs = [];
    let products = [];

    function recompute() {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const todayTxs = txs.filter((t) => {
        const d = t.createdAt?.toDate?.();
        return d && d >= start && t.type === "pos";
      });
      const dailySales = todayTxs.reduce((s, t) => s + (Number(t.total) || 0), 0);
      const transactionsToday = todayTxs.length;

      const qtyByName = {};
      for (const t of todayTxs) {
        for (const line of t.items || []) {
          const nm = line.name || "Item";
          qtyByName[nm] = (qtyByName[nm] || 0) + (Number(line.quantity) || 0);
        }
      }
      let bestName = null;
      let bestQty = 0;
      for (const [name, q] of Object.entries(qtyByName)) {
        if (q > bestQty) {
          bestQty = q;
          bestName = name;
        }
      }
      const bestSellerName = bestName && bestQty > 0 ? bestName : "—";

      const low = products
        .map((p) => ({ name: p.name || "Product", stock: productStockDash(p) }))
        .filter((p) => p.stock <= 5)
        .sort((a, b) => a.stock - b.stock)
        .slice(0, 4);
      let lowStockSummary =
        low.length === 0
          ? products.length === 0
            ? "Add items to the products collection"
            : "All SKUs above threshold"
          : low.map((p) => `${p.name} (${p.stock})`).join(" · ");

      setPosRetail({
        dailySales,
        transactionsToday,
        bestSellerName,
        bestSellerUnits: bestQty,
        lowStockSummary,
        lowStockCount: low.length,
      });
    }

    const qTx = query(collection(db, "salesTransactions"), orderBy("createdAt", "desc"), limit(400));
    const qProd = query(collection(db, "products"), orderBy("name"));

    const unsubTx = onSnapshot(
      qTx,
      (snap) => {
        txs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        recompute();
      },
      (err) => console.error("Dashboard POS (transactions):", err)
    );
    const unsubProd = onSnapshot(
      qProd,
      (snap) => {
        products = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        recompute();
      },
      (err) => console.error("Dashboard POS (products):", err)
    );

    return () => {
      unsubTx();
      unsubProd();
    };
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
          <Link
            to="/admin/schedule"
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-lg transition-all flex items-center gap-1.5 text-sm"
          >
            <span className="material-symbols-outlined text-base">calendar_today</span>
            Schedule
          </Link>
          <Link
            to="/admin/new-booking"
            className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-lg transition-all shadow-lg cyan-glow flex items-center gap-1.5 text-sm"
          >
            <span className="material-symbols-outlined text-base">add_circle</span>
            New Booking
          </Link>
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
          sub="From Court Management"
          color="emerald"
          status="live-status"
        />
      </section>

      <section className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-black text-white tracking-tight flex flex-wrap items-center gap-2">
              Retail / POS
              <span className="text-xs font-semibold text-slate-500 normal-case tracking-normal">
                Walk-in product sales (not booking payments)
              </span>
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Pulled live from <span className="text-cyan-400/90">salesTransactions</span> and{" "}
              <span className="text-cyan-400/90">products</span>.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              to="/admin/sales-history"
              className="px-3 py-1.5 rounded-lg border border-slate-700 text-xs font-bold text-slate-300 hover:border-cyan-500/50 hover:text-cyan-400 transition-colors"
            >
              Sales history
            </Link>
            <Link
              to="/admin/pos"
              className="px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-black shadow-[0_0_20px_rgba(34,211,238,0.25)] transition-colors"
            >
              Open POS
            </Link>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <PosStatTile
            icon="payments"
            label="Daily sales"
            value={`₱${posRetail.dailySales.toFixed(2)}`}
            sub="POS totals completed today"
            accent="cyan"
          />
          <PosStatTile
            icon="receipt_long"
            label="Transactions today"
            value={posRetail.transactionsToday}
            sub="Completed POS checkouts"
            accent="emerald"
          />
          <PosStatTile
            icon="trending_up"
            label="Best seller"
            value={
              posRetail.bestSellerName === "—"
                ? "—"
                : posRetail.bestSellerName.length > 22
                  ? `${posRetail.bestSellerName.slice(0, 20)}…`
                  : posRetail.bestSellerName
            }
            sub={
              posRetail.bestSellerUnits > 0
                ? `${posRetail.bestSellerUnits} units sold today · top SKU`
                : "Based on POS volume today"
            }
            accent="violet"
          />
          <PosStatTile
            icon="inventory"
            label="Low stock"
            value={posRetail.lowStockCount > 0 ? String(posRetail.lowStockCount) : "—"}
            sub={posRetail.lowStockSummary}
            accent="amber"
          />
        </div>
      </section>

      {/* MAIN CONTENT GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ACTIVITY FEED */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
              Today&apos;s Activity Feed
              <span className="px-1.5 py-0.5 bg-slate-800 text-[9px] font-bold rounded text-slate-400 uppercase">Live</span>
            </h2>
            <Link to="/admin/schedule" className="text-xs font-bold text-cyan-400 hover:underline shrink-0">
              View schedule
            </Link>
          </div>
          <div className="bg-[#151e2d] border border-slate-800 rounded-2xl overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-800/80">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-500/20">
                  <span className="material-symbols-outlined text-sky-400 text-xl">schedule</span>
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-black text-white tracking-tight">Activity History</h3>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                    All bookings, payments, and court changes appear here in chronological order (newest first).
                  </p>
                </div>
              </div>
            </div>
            <div className="max-h-[420px] overflow-y-auto custom-scrollbar p-4 sm:p-5">
              <ActivityFeedTimeline events={activityEvents} />
            </div>
          </div>
        </div>

          {/* RECENT PAYMENTS */}
          <div className="bg-[#151e2d] border border-slate-800 rounded-2xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white tracking-tight uppercase">Recent Payments</h3>
              <Link className="text-[10px] font-bold text-cyan-400" to="/admin/payments">View All</Link>
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
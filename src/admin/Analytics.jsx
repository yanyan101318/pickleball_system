// src/admin/Analytics.jsx
import { useState, useEffect, useMemo } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { format } from "date-fns";
import { db } from "../firebase";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const BAR_ACCENT = [
  "linear-gradient(90deg, #3b82f6, #60a5fa)",
  "linear-gradient(90deg, #6366f1, #818cf8)",
  "linear-gradient(90deg, #8b5cf6, #a78bfa)",
  "linear-gradient(90deg, #06b6d4, #22d3ee)",
  "linear-gradient(90deg, #14b8a6, #2dd4bf)",
];
const METHOD_COLORS = [
  "linear-gradient(90deg, #22c55e, #4ade80)",
  "linear-gradient(90deg, #3b82f6, #60a5fa)",
  "linear-gradient(90deg, #a855f7, #c084fc)",
  "linear-gradient(90deg, #f59e0b, #fbbf24)",
  "linear-gradient(90deg, #ec4899, #f472b6)",
];

function MiniBar({ label, value, max, styleFill }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  const share = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="an-bar-row">
      <span className="an-bar-label" title={label}>
        {label}
      </span>
      <div className="an-bar-track">
        <div className="an-bar-fill" style={{ width: `${pct}%`, background: styleFill }} />
      </div>
      <div className="an-bar-meta">
        <span className="an-bar-val">{value}</span>
        <span className="an-bar-pct">{share.toFixed(0)}%</span>
      </div>
    </div>
  );
}

function StatusIcon({ status }) {
  const key = status.toLowerCase();
  let icon = "help";
  if (key === "pending") icon = "schedule";
  if (key === "approved") icon = "check_circle";
  if (key === "cancelled") icon = "cancel";
  return (
    <div className="an-status-icon">
      <span className="material-symbols-outlined" aria-hidden>
        {icon}
      </span>
    </div>
  );
}

export default function Analytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetchedAt, setFetchedAt] = useState(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const [bookSnap, paySnap, userSnap, courtSnap] = await Promise.all([
          getDocs(collection(db, "bookings")),
          getDocs(collection(db, "payments")),
          getDocs(query(collection(db, "users"), where("role", "==", "customer"))),
          getDocs(collection(db, "courts")),
        ]);

        const bookings = bookSnap.docs.map((d) => d.data());
        const payments = paySnap.docs.map((d) => d.data());
        const courts = courtSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

        const bPerCourt = {};
        courts.forEach((c) => {
          bPerCourt[c.name ?? c.id] = 0;
        });
        bookings.forEach((b) => {
          const k = b.courtName ?? b.courtId;
          if (k) bPerCourt[k] = (bPerCourt[k] ?? 0) + 1;
        });

        const bPerStatus = { Pending: 0, Approved: 0, Cancelled: 0 };
        bookings.forEach((b) => {
          if (b.status) bPerStatus[b.status] = (bPerStatus[b.status] ?? 0) + 1;
        });

        const revenue = payments
          .filter((p) => p.paymentStatus === "Approved")
          .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

        const methods = {};
        payments.forEach((p) => {
          if (p.method) methods[p.method] = (methods[p.method] ?? 0) + 1;
        });

        const bPerDay = { Sun: 0, Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0 };
        bookings.forEach((b) => {
          if (b.date) {
            const d = new Date(b.date);
            if (!Number.isNaN(d.getTime())) {
              const day = DAYS[d.getDay()];
              bPerDay[day] = (bPerDay[day] || 0) + 1;
            }
          }
        });

        setData({
          bookings,
          payments,
          userCount: userSnap.size,
          courtCount: courtSnap.size,
          bPerCourt,
          bPerStatus,
          revenue,
          methods,
          bPerDay,
        });
        setFetchedAt(new Date());
      } catch (err) {
        console.error(err);
      }
      setLoading(false);
    }
    fetchData();
  }, []);

  const maxBPerCourt = useMemo(
    () => Math.max(...Object.values(data?.bPerCourt ?? {}), 1),
    [data]
  );
  const maxBPerDay = useMemo(() => Math.max(...Object.values(data?.bPerDay ?? {}), 1), [data]);

  const courtEntries = useMemo(
    () => Object.entries(data?.bPerCourt ?? {}).sort((a, b) => b[1] - a[1]),
    [data]
  );

  const methodEntries = useMemo(() => {
    const entries = Object.entries(data?.methods ?? {}).sort((a, b) => b[1] - a[1]);
    const total = entries.reduce((s, [, v]) => s + v, 0);
    return { entries, total };
  }, [data]);

  const busiestDayKeys = useMemo(() => {
    const vals = data?.bPerDay;
    if (!vals) return new Set();
    const m = Math.max(...Object.values(vals), 0);
    if (m <= 0) return new Set();
    return new Set(Object.entries(vals).filter(([, v]) => v === m).map(([k]) => k));
  }, [data]);

  if (loading) {
    return (
      <div className="ad-loading">
        <div className="ad-spinner" />
        <span>Loading analytics…</span>
      </div>
    );
  }
  if (!data) {
    return <div className="ad-empty">Could not load analytics.</div>;
  }

  return (
    <div className="ad-page">
      <section className="an-hero" aria-label="Analytics overview">
        <div className="an-hero-inner">
          <div>
            <div className="an-hero-title-row">
              <div className="an-hero-icon" aria-hidden>
                <span className="material-symbols-outlined">analytics</span>
              </div>
              <div>
                <h1 className="ad-page-title" style={{ margin: 0 }}>
                  Analytics
                </h1>
                <p className="ad-page-sub">Bookings, revenue, and usage patterns across your facility.</p>
              </div>
            </div>
            <div className="an-hero-meta">
              <span className="an-hero-chip">Facility snapshot</span>
              <span className="an-hero-chip an-hero-chip-muted">
                {data.courtCount} court{data.courtCount !== 1 ? "s" : ""} configured
              </span>
              {fetchedAt && (
                <span className="an-hero-chip an-hero-chip-muted">
                  Updated {format(fetchedAt, "MMM d, yyyy · h:mm a")}
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="ad-stats-grid">
        <div className="an-stat-tile an-stat-tile--blue">
          <div className="an-stat-tile-icon">
            <span className="material-symbols-outlined">calendar_month</span>
          </div>
          <div className="an-stat-tile-body">
            <div className="an-stat-tile-value">{data.bookings.length}</div>
            <div className="an-stat-tile-label">Total bookings</div>
            <div className="an-stat-tile-sub">All-time reservation records</div>
          </div>
        </div>
        <div className="an-stat-tile an-stat-tile--green">
          <div className="an-stat-tile-icon">
            <span className="material-symbols-outlined">payments</span>
          </div>
          <div className="an-stat-tile-body">
            <div className="an-stat-tile-value">₱{data.revenue.toLocaleString()}</div>
            <div className="an-stat-tile-label">Total revenue</div>
            <div className="an-stat-tile-sub">From approved payments</div>
          </div>
        </div>
        <div className="an-stat-tile an-stat-tile--purple">
          <div className="an-stat-tile-icon">
            <span className="material-symbols-outlined">group</span>
          </div>
          <div className="an-stat-tile-body">
            <div className="an-stat-tile-value">{data.userCount}</div>
            <div className="an-stat-tile-label">Registered players</div>
            <div className="an-stat-tile-sub">Customer accounts</div>
          </div>
        </div>
        <div className="an-stat-tile an-stat-tile--amber">
          <div className="an-stat-tile-icon">
            <span className="material-symbols-outlined">receipt_long</span>
          </div>
          <div className="an-stat-tile-body">
            <div className="an-stat-tile-value">{data.payments.length}</div>
            <div className="an-stat-tile-label">Payment records</div>
            <div className="an-stat-tile-sub">All submission attempts</div>
          </div>
        </div>
      </div>

      <div className="ad-two-col">
        <div className="ad-card">
          <div className="an-card-head">
            <div className="an-card-head-text">
              <h3 className="an-card-title">
                <span className="material-symbols-outlined" aria-hidden>
                  sports_tennis
                </span>
                Bookings per court
              </h3>
              <p className="an-card-desc">Relative volume by court name (bars scale to the busiest court).</p>
            </div>
          </div>
          <div className="an-bars">
            {courtEntries.length === 0 && <div className="an-empty-soft">No court data yet.</div>}
            {courtEntries.map(([k, v], i) => (
              <MiniBar
                key={k}
                label={k}
                value={v}
                max={maxBPerCourt}
                styleFill={BAR_ACCENT[i % BAR_ACCENT.length]}
              />
            ))}
          </div>
        </div>

        <div className="ad-card">
          <div className="an-card-head">
            <div className="an-card-head-text">
              <h3 className="an-card-title">
                <span className="material-symbols-outlined" aria-hidden>
                  pie_chart
                </span>
                Booking status
              </h3>
              <p className="an-card-desc">Pipeline mix for every booking in the system.</p>
            </div>
          </div>
          <div className="an-status-grid">
            {Object.entries(data.bPerStatus).map(([k, v]) => (
              <div key={k} className={`an-status-card an-status-${k.toLowerCase()}`}>
                <StatusIcon status={k} />
                <div className="an-status-val">{v}</div>
                <div className="an-status-lbl">{k}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="ad-card">
          <div className="an-card-head">
            <div className="an-card-head-text">
              <h3 className="an-card-title">
                <span className="material-symbols-outlined" aria-hidden>
                  today
                </span>
                Bookings by day of week
              </h3>
              <p className="an-card-desc">When players tend to book, based on each booking&apos;s date field.</p>
            </div>
          </div>
          <div className="an-day-strip" role="list" aria-label="Bookings per weekday">
            {DAYS.map((day) => {
              const v = data.bPerDay[day] ?? 0;
              const hot = busiestDayKeys.has(day) && v > 0;
              return (
                <div
                  key={day}
                  className={`an-day-pill ${hot ? "an-day-pill--hot" : ""}`}
                  role="listitem"
                  title={hot ? "Tied for busiest day" : `${v} booking(s)`}
                >
                  <div className="an-day-pill-lbl">{day}</div>
                  <div className="an-day-pill-val">{v}</div>
                </div>
              );
            })}
          </div>
          <div className="an-bars" style={{ paddingTop: 0 }}>
            {DAYS.map((day, i) => (
              <MiniBar
                key={day}
                label={day}
                value={data.bPerDay[day] ?? 0}
                max={maxBPerDay}
                styleFill={BAR_ACCENT[(i + 2) % BAR_ACCENT.length]}
              />
            ))}
          </div>
        </div>

        <div className="ad-card">
          <div className="an-card-head">
            <div className="an-card-head-text">
              <h3 className="an-card-title">
                <span className="material-symbols-outlined" aria-hidden>
                  account_balance_wallet
                </span>
                Payment methods
              </h3>
              <p className="an-card-desc">Share of recorded payments by method (all statuses).</p>
            </div>
          </div>
          <div className="an-methods">
            {methodEntries.entries.length === 0 && (
              <div className="an-empty-soft">No payment method data yet.</div>
            )}
            {methodEntries.entries.map(([name, count], i) => {
              const pct =
                methodEntries.total > 0 ? (count / methodEntries.total) * 100 : 0;
              return (
                <div key={name} className="an-method-block">
                  <div className="an-method-top">
                    <span className="an-method-name">{name}</span>
                    <span className="an-method-count">
                      {count} payment{count !== 1 ? "s" : ""} · {pct.toFixed(0)}%
                    </span>
                  </div>
                  <div className="an-method-track">
                    <div
                      className="an-method-fill"
                      style={{
                        width: `${pct}%`,
                        background: METHOD_COLORS[i % METHOD_COLORS.length],
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

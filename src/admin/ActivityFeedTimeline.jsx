// src/admin/ActivityFeedTimeline.jsx
import { format } from "date-fns";

function toDate(ts) {
  if (!ts) return null;
  if (typeof ts.toDate === "function") return ts.toDate();
  return new Date(ts);
}

export function formatActivityWhen(ts) {
  const d = toDate(ts);
  if (!d || Number.isNaN(d.getTime())) return "—";
  return format(d, "MMM d, yyyy h:mm a");
}

const VARIANT = {
  blue: {
    ring: "bg-sky-500",
    title: "text-sky-400",
    icon: "calendar_month",
  },
  green: {
    ring: "bg-emerald-500",
    title: "text-emerald-400",
    icon: "payments",
  },
  orange: {
    ring: "bg-amber-500",
    title: "text-amber-400",
    icon: "balance",
  },
  red: {
    ring: "bg-rose-500",
    title: "text-rose-400",
    icon: "block",
  },
};

export function buildActivityEvents({ bookings = [], payments = [], logs = [] }) {
  const out = [];

  for (const b of bookings) {
    const ts = b.createdAt;
    const desc = [b.playerName, b.courtName || b.courtId, b.date, b.timeSlot].filter(Boolean).join(" • ");
    out.push({
      id: `booking-${b.id}`,
      sortKey: ts?.toMillis?.() ?? 0,
      at: ts,
      title: "Booking Created",
      description: desc || "New court booking",
      variant: "blue",
    });
  }

  for (const p of payments) {
    const ts = p.createdAt;
    const status = p.paymentStatus || "Pending";
    let title = "Payment";
    let variant = "green";
    if (status === "Pending") {
      title = "Payment Pending";
      variant = "orange";
    } else if (status === "Approved" || status === "Completed") {
      title = "Payment Completed";
      variant = "green";
    } else if (status === "Rejected") {
      title = "Payment Rejected";
      variant = "red";
    }
    const method = p.method || "—";
    const amount = p.amount != null ? `₱${Number(p.amount).toLocaleString()}` : "—";
    out.push({
      id: `payment-${p.id}`,
      sortKey: ts?.toMillis?.() ?? 0,
      at: ts,
      title,
      description: `${amount} · ${method}`,
      variant,
    });
  }

  for (const log of logs) {
    const ts = log.createdAt;
    out.push({
      id: `log-${log.id}`,
      sortKey: ts?.toMillis?.() ?? 0,
      at: ts,
      title: log.title || "Court activity",
      description: log.description || "",
      variant: "orange",
    });
  }

  out.sort((a, b) => b.sortKey - a.sortKey);
  return out;
}

export default function ActivityFeedTimeline({ events }) {
  if (!events.length) {
    return (
      <div className="flex flex-col items-center justify-center py-14 text-center px-4">
        <div className="w-12 h-12 bg-slate-800/60 rounded-full flex items-center justify-center mb-3">
          <span className="material-symbols-outlined text-slate-500 text-2xl">history</span>
        </div>
        <h3 className="text-sm font-bold text-white mb-1">No activity yet</h3>
        <p className="text-slate-500 text-xs max-w-sm">
          When bookings, payments, or court changes occur, they will appear here in chronological order
          (newest first).
        </p>
      </div>
    );
  }

  return (
    <div className="relative pl-2">
      <div
        className="absolute left-[15px] top-2 bottom-2 w-px bg-slate-700/90"
        aria-hidden
      />
      <ul className="space-y-0">
        {events.map((ev) => {
          const cfg = VARIANT[ev.variant] || VARIANT.blue;
          return (
            <li key={ev.id} className="relative flex gap-3 pb-6 last:pb-0">
              <div
                className={`relative z-[1] flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${cfg.ring} shadow-lg`}
              >
                <span className="material-symbols-outlined text-white text-[16px] leading-none">
                  {cfg.icon}
                </span>
              </div>
              <div className="min-w-0 flex-1 pt-0.5">
                <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1">
                  <span className={`text-sm font-bold ${cfg.title}`}>{ev.title}</span>
                  <time
                    className="text-[10px] text-slate-500 font-medium tabular-nums shrink-0"
                    dateTime={formatActivityWhen(ev.at)}
                  >
                    {formatActivityWhen(ev.at)}
                  </time>
                </div>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed break-words">
                  {ev.description}
                </p>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-4 flex gap-2 rounded-xl border border-sky-500/25 bg-sky-500/5 px-3 py-2.5">
        <span className="material-symbols-outlined text-sky-400 text-lg shrink-0">info</span>
        <p className="text-[11px] text-slate-400 leading-snug">
          Events are shown in chronological order, with the most recent first.
        </p>
      </div>
    </div>
  );
}

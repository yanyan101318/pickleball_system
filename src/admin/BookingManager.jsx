// src/admin/BookingManager.jsx
import { useState, useEffect } from "react";
import {
  collection, query, orderBy, onSnapshot, where, getDocs, writeBatch,
  doc, updateDoc, getDoc, Timestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { canExtendBooking, EXTEND_OPTIONS } from "../lib/bookingSlots";
import { roundMoney } from "../lib/bookingMoney";
import { resolveCustomerPayStatus, PLAN_FULL } from "../lib/bookingPayment";
import toast from "react-hot-toast";

const STATUS_COLORS = { Pending:"pending", Approved:"approved", Cancelled:"rejected" };
const PAY_STATUS_BADGE = { paid: "approved", partial: "pending", unpaid: "rejected" };

export default function BookingManager() {
  const [bookings, setBookings] = useState([]);
  const [filter, setFilter]     = useState("All");
  const [search, setSearch]     = useState("");
  const [loading, setLoading]   = useState(true);
  const [acting, setActing]     = useState(null);
  const [selected, setSelected] = useState(null);
  const [extendHours, setExtendHours] = useState(1);
  const [extending, setExtending] = useState(false);

  useEffect(() => {
    const q = query(collection(db,"bookings"), orderBy("createdAt","desc"));
    const unsub = onSnapshot(q, snap => {
      setBookings(snap.docs.map(d=>({id:d.id,...d.data()})));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  async function setStatus(id, status) {
    setActing(id);
    try {
      await updateDoc(doc(db,"bookings",id), {
        status,
        reviewedAt: Timestamp.now(),
      });
    } catch(err) { console.error(err); }
    setActing(null);
    setSelected(null);
  }

  async function applyExtension(b) {
    const hours = Number(extendHours);
    if (!Number.isFinite(hours) || hours <= 0) {
      toast.error("Select extension length");
      return;
    }
    let hourly = Number(b.hourlyRate);
    if (!Number.isFinite(hourly) || hourly <= 0) {
      try {
        const cs = await getDoc(doc(db, "courts", b.courtId));
        hourly = Number(cs.data()?.pricePerHour) || 0;
      } catch {
        hourly = 0;
      }
    }
    if (hourly <= 0) {
      toast.error("Could not read court hourly rate");
      return;
    }
    const check = canExtendBooking({
      timeSlot: b.timeSlot,
      duration: Number(b.duration) || 1,
      extendHours: hours,
      courtId: b.courtId,
      date: b.date,
      excludeBookingId: b.id,
      others: bookings,
    });
    if (!check.ok) {
      toast.error(check.reason);
      return;
    }
    const extra = roundMoney(hours * hourly);
    const prevTotal =
      Number.isFinite(Number(b.totalAmount)) && Number(b.totalAmount) > 0
        ? Number(b.totalAmount)
        : roundMoney(hourly * (Number(b.duration) || 1));
    const newTotal = roundMoney(prevTotal + extra);
    const amountPaid = roundMoney(Number(b.amountPaid) || 0);
    const newRemaining = roundMoney(Math.max(0, newTotal - amountPaid));
    const payStatus = resolveCustomerPayStatus(b.paymentPlan || PLAN_FULL, newTotal, amountPaid);

    setExtending(true);
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, "bookings", b.id), {
        duration: check.newDuration,
        totalAmount: newTotal,
        remainingBalance: newRemaining,
        customerPaymentStatus: payStatus,
        hourlyRate: roundMoney(hourly),
        extendedAt: Timestamp.now(),
      });
      const paySnap = await getDocs(query(collection(db, "payments"), where("bookingId", "==", b.id)));
      paySnap.forEach((d) => {
        batch.update(d.ref, {
          amount: newTotal,
          totalAmount: newTotal,
          remainingBalance: newRemaining,
          customerPaymentStatus: payStatus,
        });
      });
      await batch.commit();
      toast.success("Booking extended");
      setSelected((s) =>
        s && s.id === b.id
          ? {
              ...s,
              duration: check.newDuration,
              totalAmount: newTotal,
              remainingBalance: newRemaining,
              customerPaymentStatus: payStatus,
              hourlyRate: roundMoney(hourly),
            }
          : s
      );
    } catch (e) {
      console.error(e);
      toast.error("Could not extend booking");
    }
    setExtending(false);
  }

  async function removeBooking(id) {
    const row = bookings.find((b) => b.id === id) ?? selected;
    const label = row?.playerName || row?.courtName || "this booking";
    let linkedSnap;
    try {
      linkedSnap = await getDocs(
        query(collection(db, "payments"), where("bookingId", "==", id))
      );
    } catch (e) {
      console.error(e);
      window.alert("Could not load linked payment data. Try again.");
      return;
    }
    const linkedPayments = linkedSnap.size;
    const linkedNote =
      linkedPayments > 0
        ? `\n\nAlso removes ${linkedPayments} linked payment record(s) from the same submission.`
        : "";
    if (
      !window.confirm(
        `Delete this booking permanently?\n\n${label}${linkedNote}\n\nThis cannot be undone.`
      )
    ) {
      return;
    }
    setActing(id);
    try {
      const batch = writeBatch(db);
      linkedSnap.forEach((d) => batch.delete(d.ref));
      batch.delete(doc(db, "bookings", id));
      await batch.commit();
    } catch (err) {
      console.error(err);
      window.alert("Could not delete this booking. Check your connection and permissions.");
    }
    setActing(null);
    setSelected(null);
  }

  const filtered = bookings.filter(b => {
    const matchFilter = filter === "All" || b.status === filter;
    const matchSearch = !search ||
      b.playerName?.toLowerCase().includes(search.toLowerCase()) ||
      b.courtName?.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  const counts = {
    All:       bookings.length,
    Pending:   bookings.filter(b=>b.status==="Pending").length,
    Approved:  bookings.filter(b=>b.status==="Approved").length,
    Cancelled: bookings.filter(b=>b.status==="Cancelled").length,
  };

  if (loading) return <div className="ad-loading"><div className="ad-spinner"/></div>;

  return (
    <div className="ad-page">
      <div className="ad-page-header">
        <div>
          <h1 className="ad-page-title">Booking Management</h1>
          <p className="ad-page-sub">Review and manage all court bookings.</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="ad-filter-tabs">
        {Object.entries(counts).map(([k,v])=>(
          <button key={k} className={`ad-filter-tab ${filter===k?"active":""}`} onClick={()=>setFilter(k)}>
            {k} <span className="ad-filter-count">{v}</span>
          </button>
        ))}
      </div>

      <div className="ad-search-row">
        <input className="ad-search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by player or court..."/>
        <span className="ad-count">{filtered.length} booking{filtered.length!==1?"s":""}</span>
      </div>

      {/* Table */}
      <div className="ad-card">
        <div className="ad-table-wrap">
          <table className="ad-table">
            <thead>
              <tr>
                <th>Player</th><th>Court</th><th>Date</th>
                <th>Time</th><th>Pay</th><th>Status</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length===0 && (
                <tr><td colSpan={7} className="ad-empty">No bookings found.</td></tr>
              )}
              {filtered.map(b=>(
                <tr key={b.id} className="ad-table-row" onClick={()=>setSelected(b)}>
                  <td className="ad-td-main">{b.playerName??"—"}</td>
                  <td>{b.courtName??b.courtId??"—"}</td>
                  <td>{b.date??"—"}</td>
                  <td>{b.timeSlot??"—"}</td>
                  <td>
                    <span className={`ad-badge ad-badge-${PAY_STATUS_BADGE[(b.customerPaymentStatus||"").toLowerCase()]??"pending"}`}>
                      {(b.customerPaymentStatus ?? "—").toString()}
                    </span>
                  </td>
                  <td><span className={`ad-badge ad-badge-${STATUS_COLORS[b.status]??"pending"}`}>{b.status??"Pending"}</span></td>
                  <td onClick={e=>e.stopPropagation()}>
                    <div className="ad-action-btns">
                      {b.status!=="Approved" && (
                        <button className="ad-btn ad-btn-sm ad-btn-success"
                          disabled={acting===b.id}
                          onClick={()=>setStatus(b.id,"Approved")}>
                          ✓ Approve
                        </button>
                      )}
                      {b.status!=="Cancelled" && (
                        <button className="ad-btn ad-btn-sm ad-btn-danger"
                          disabled={acting===b.id}
                          onClick={()=>setStatus(b.id,"Cancelled")}>
                          ✕ Cancel
                        </button>
                      )}
                      <button
                        type="button"
                        className="ad-btn ad-btn-sm ad-btn-outline"
                        disabled={acting===b.id}
                        onClick={() => removeBooking(b.id)}
                        title="Remove this booking record"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail modal */}
      {selected && (
        <div className="ad-modal-backdrop" onClick={()=>setSelected(null)}>
          <div className="ad-modal" onClick={e=>e.stopPropagation()}>
            <div className="ad-modal-header">
              <h3>Booking Detail</h3>
              <button className="ad-modal-close" onClick={()=>setSelected(null)}>✕</button>
            </div>
            <div className="ad-detail-grid">
              <div className="ad-detail-row"><span>Player</span><strong>{selected.playerName??selected.userId??'—'}</strong></div>
              <div className="ad-detail-row"><span>Contact</span><strong>{selected.contactNumber ?? "—"}</strong></div>
              <div className="ad-detail-row"><span>Court</span><strong>{selected.courtName??selected.courtId??'—'}</strong></div>
              <div className="ad-detail-row"><span>Date</span><strong>{selected.date??'—'}</strong></div>
              <div className="ad-detail-row"><span>Time Slot</span><strong>{selected.timeSlot??'—'}</strong></div>
              <div className="ad-detail-row"><span>Duration</span><strong>{selected.duration ?? "—"} hr</strong></div>
              <div className="ad-detail-row"><span>Total</span><strong>₱{roundMoney(Number(selected.totalAmount)||0).toFixed(2)}</strong></div>
              <div className="ad-detail-row"><span>Paid</span><strong>₱{roundMoney(Number(selected.amountPaid)||0).toFixed(2)}</strong></div>
              <div className="ad-detail-row"><span>Balance</span><strong>₱{roundMoney(Number(selected.remainingBalance)||0).toFixed(2)}</strong></div>
              <div className="ad-detail-row"><span>Pay status</span>
                <span className={`ad-badge ad-badge-${PAY_STATUS_BADGE[(selected.customerPaymentStatus||"").toLowerCase()]??"pending"}`}>
                  {selected.customerPaymentStatus ?? "—"}
                </span>
              </div>
              <div className="ad-detail-row"><span>Booking status</span>
                <span className={`ad-badge ad-badge-${STATUS_COLORS[selected.status]??"pending"}`}>{selected.status??"Pending"}</span>
              </div>
              {selected.notes && <div className="ad-detail-row ad-detail-full"><span>Notes</span><strong>{selected.notes}</strong></div>}
            </div>
            {selected.status !== "Cancelled" && (
              <div className="px-6 py-3 border-t border-slate-800 bg-slate-900/30">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Extend time</p>
                <div className="flex flex-wrap items-end gap-2">
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-1">Add hours</label>
                    <select
                      className="ad-search text-sm py-2"
                      value={extendHours}
                      onChange={(e) => setExtendHours(Number(e.target.value))}
                    >
                      {EXTEND_OPTIONS.map((h) => (
                        <option key={h} value={h}>+{h} hr</option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="button"
                    className="ad-btn ad-btn-sm ad-btn-success"
                    disabled={extending}
                    onClick={() => applyExtension(selected)}
                  >
                    {extending ? "…" : "Extend"}
                  </button>
                </div>
              </div>
            )}
            <div className="ad-modal-footer ad-modal-footer-between">
              <button
                type="button"
                className="ad-btn ad-btn-outline"
                disabled={acting===selected.id}
                onClick={() => removeBooking(selected.id)}
              >
                Delete booking
              </button>
              <div className="ad-modal-footer-actions">
                {selected.status!=="Approved" && (
                  <button className="ad-btn ad-btn-success" disabled={acting===selected.id} onClick={()=>setStatus(selected.id,"Approved")}>✓ Approve</button>
                )}
                {selected.status!=="Cancelled" && (
                  <button className="ad-btn ad-btn-danger" disabled={acting===selected.id} onClick={()=>setStatus(selected.id,"Cancelled")}>✕ Cancel</button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
// src/admin/BookingManager.jsx
import { useState, useEffect } from "react";
import {
  collection, query, orderBy, onSnapshot,
  doc, updateDoc, Timestamp,
} from "firebase/firestore";
import { db } from "../firebase";

const STATUS_COLORS = { Pending:"pending", Approved:"approved", Cancelled:"rejected" };

export default function BookingManager() {
  const [bookings, setBookings] = useState([]);
  const [filter, setFilter]     = useState("All");
  const [search, setSearch]     = useState("");
  const [loading, setLoading]   = useState(true);
  const [acting, setActing]     = useState(null);
  const [selected, setSelected] = useState(null);

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
                <th>Time Slot</th><th>Notes</th><th>Status</th><th>Actions</th>
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
                  <td className="ad-td-notes">{b.notes?"📝":"—"}</td>
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
              <div className="ad-detail-row"><span>Court</span><strong>{selected.courtName??selected.courtId??'—'}</strong></div>
              <div className="ad-detail-row"><span>Date</span><strong>{selected.date??'—'}</strong></div>
              <div className="ad-detail-row"><span>Time Slot</span><strong>{selected.timeSlot??'—'}</strong></div>
              <div className="ad-detail-row"><span>Status</span>
                <span className={`ad-badge ad-badge-${STATUS_COLORS[selected.status]??"pending"}`}>{selected.status??"Pending"}</span>
              </div>
              {selected.notes && <div className="ad-detail-row ad-detail-full"><span>Notes</span><strong>{selected.notes}</strong></div>}
            </div>
            <div className="ad-modal-footer">
              {selected.status!=="Approved" && (
                <button className="ad-btn ad-btn-success" onClick={()=>setStatus(selected.id,"Approved")}>✓ Approve</button>
              )}
              {selected.status!=="Cancelled" && (
                <button className="ad-btn ad-btn-danger" onClick={()=>setStatus(selected.id,"Cancelled")}>✕ Cancel</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
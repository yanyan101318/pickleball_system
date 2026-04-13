// src/admin/CourtManager.jsx
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  collection, addDoc, updateDoc, deleteDoc,
  doc, onSnapshot, serverTimestamp, query, orderBy,
} from "firebase/firestore";
import { db } from "../firebase";

const BLANK = { name:"", description:"", pricePerHour:"", amenities:"", isActive:true };

export default function CourtManager() {
  const [courts, setCourts]   = useState([]);
  const [form, setForm]       = useState(BLANK);
  const [editId, setEditId]   = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [search, setSearch]   = useState("");

  useEffect(() => {
    const q = query(collection(db,"courts"), orderBy("createdAt","desc"));
    const unsub = onSnapshot(q, snap => {
      setCourts(snap.docs.map(d=>({id:d.id,...d.data()})));
    });
    return () => unsub();
  }, []);

  function set(k,v) { setForm(p=>({...p,[k]:v})); }

  function openAdd()   { setForm(BLANK); setEditId(null); setShowForm(true); }
  function openEdit(c) { setForm({...c, amenities: Array.isArray(c.amenities)?c.amenities.join(", "):c.amenities??""}); setEditId(c.id); setShowForm(true); }
  function closeForm() { setShowForm(false); setEditId(null); }

  async function logCourtActivity(title, description) {
    try {
      await addDoc(collection(db, "activityLogs"), {
        title,
        description,
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      console.error("Activity log failed:", err);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    const payload = {
      name:         form.name.trim(),
      description:  form.description.trim(),
      pricePerHour: Number(form.pricePerHour),
      amenities:    form.amenities.split(",").map(a=>a.trim()).filter(Boolean),
      isActive:     form.isActive,
    };
    try {
      if (editId) {
        await updateDoc(doc(db,"courts",editId), payload);
        await logCourtActivity(
          "Court Updated",
          `“${payload.name}” — price ₱${payload.pricePerHour}/hr${payload.isActive ? "" : " (inactive)"}`
        );
      } else {
        await addDoc(collection(db,"courts"), { ...payload, createdAt: serverTimestamp() });
        await logCourtActivity(
          "Court Added",
          `“${payload.name}” added at ₱${payload.pricePerHour}/hr`
        );
      }
      closeForm();
    } catch(err) { console.error(err); }
    setLoading(false);
  }

  async function handleDelete(id) {
    if (!window.confirm("Delete this court?")) return;
    setDeleting(id);
    const name = courts.find((c) => c.id === id)?.name || "Court";
    try {
      await deleteDoc(doc(db,"courts",id));
      await logCourtActivity("Court Deleted", `“${name}” was removed`);
    } catch(err){ console.error(err); }
    setDeleting(null);
  }

  async function toggleActive(court) {
    const next = !court.isActive;
    await updateDoc(doc(db,"courts",court.id), { isActive: next });
    await logCourtActivity(
      "Court Status Changed",
      `“${court.name}” ${next ? "activated" : "deactivated"}`
    );
  }

  const filtered = courts.filter(c =>
    c.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="ad-page">
      <div className="ad-page-header">
        <div>
          <h1 className="ad-page-title">Court Management</h1>
          <p className="ad-page-sub">Add, edit, and manage your pickleball courts.</p>
        </div>
        <button className="ad-btn ad-btn-primary" onClick={openAdd}>+ Add Court</button>
      </div>

      {/* Search */}
      <div className="ad-search-row">
        <input className="ad-search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search courts..."/>
        <span className="ad-count">{filtered.length} court{filtered.length!==1?"s":""}</span>
      </div>

      {/* Court grid */}
      <div className="cm-grid">
        {filtered.length === 0 && <div className="ad-empty">No courts found. Add your first court!</div>}
        {filtered.map(court => (
          <div key={court.id} className={`cm-card ${court.isActive?"":"cm-inactive"}`}>
            <div className="cm-card-header">
              <div className="cm-card-name">{court.name}</div>
              <div className={`ad-badge ${court.isActive?"ad-badge-approved":"ad-badge-rejected"}`}>
                {court.isActive ? "Active" : "Inactive"}
              </div>
            </div>
            <div className="cm-price">₱{court.pricePerHour?.toLocaleString()}<span>/hour</span></div>
            <p className="cm-desc">{court.description || "No description."}</p>
            {court.amenities?.length > 0 && (
              <div className="cm-amenities">
                {court.amenities.map((a,i)=>(
                  <span key={i} className="cm-amenity-tag">{a}</span>
                ))}
              </div>
            )}
            <div className="cm-actions">
              {court.isActive && (
                <Link
                  className="ad-btn ad-btn-sm"
                  style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                  to={`/admin/new-booking?court=${encodeURIComponent(court.id)}`}
                >
                  📅 Book
                </Link>
              )}
              <button className="ad-btn ad-btn-sm ad-btn-outline" onClick={()=>openEdit(court)}>✏️ Edit</button>
              <button className="ad-btn ad-btn-sm ad-btn-outline" onClick={()=>toggleActive(court)}>
                {court.isActive ? "🔒 Deactivate" : "✅ Activate"}
              </button>
              <button className="ad-btn ad-btn-sm ad-btn-danger" onClick={()=>handleDelete(court.id)} disabled={deleting===court.id}>
                {deleting===court.id ? "..." : "🗑️ Delete"}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal form */}
      {showForm && (
        <div className="ad-modal-backdrop" onClick={e=>e.target===e.currentTarget&&closeForm()}>
          <div className="ad-modal">
            <div className="ad-modal-header">
              <h3>{editId ? "Edit Court" : "Add New Court"}</h3>
              <button className="ad-modal-close" onClick={closeForm}>✕</button>
            </div>
            <form className="ad-modal-form" onSubmit={handleSubmit}>
              <div className="af-group">
                <label className="af-label">Court Name *</label>
                <input className="af-input" value={form.name} onChange={e=>set("name",e.target.value)} placeholder="e.g. Court 1" required/>
              </div>
              <div className="af-group">
                <label className="af-label">Description</label>
                <textarea className="af-input af-textarea" value={form.description} onChange={e=>set("description",e.target.value)} placeholder="Describe this court..." rows={3}/>
              </div>
              <div className="af-row">
                <div className="af-group">
                  <label className="af-label">Price per Hour (₱) *</label>
                  <input className="af-input" type="number" min="0" value={form.pricePerHour} onChange={e=>set("pricePerHour",e.target.value)} placeholder="200" required/>
                </div>
                <div className="af-group">
                  <label className="af-label">Status</label>
                  <select className="af-input" value={form.isActive} onChange={e=>set("isActive",e.target.value==="true")}>
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                </div>
              </div>
              <div className="af-group">
                <label className="af-label">Amenities <span style={{fontWeight:400,fontSize:"0.78rem"}}>(comma separated)</span></label>
                <input className="af-input" value={form.amenities} onChange={e=>set("amenities",e.target.value)} placeholder="Lights, Water Station, Parking"/>
              </div>
              <div className="ad-modal-footer">
                <button type="button" className="ad-btn ad-btn-outline" onClick={closeForm}>Cancel</button>
                <button type="submit" className="ad-btn ad-btn-primary" disabled={loading}>
                  {loading ? "Saving..." : editId ? "Save Changes" : "Add Court"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
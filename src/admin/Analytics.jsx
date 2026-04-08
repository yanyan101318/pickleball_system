// src/admin/Analytics.jsx
import { useState, useEffect } from "react";
import { collection, getDocs, query, where, orderBy } from "firebase/firestore";
import { db } from "../firebase";

function MiniBar({ label, value, max, color }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="an-bar-row">
      <span className="an-bar-label">{label}</span>
      <div className="an-bar-track">
        <div className="an-bar-fill" style={{ width:`${pct}%`, background: color }}/>
      </div>
      <span className="an-bar-val">{value}</span>
    </div>
  );
}

export default function Analytics() {
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      try {
        const [bookSnap, paySnap, userSnap, courtSnap] = await Promise.all([
          getDocs(collection(db,"bookings")),
          getDocs(collection(db,"payments")),
          getDocs(query(collection(db,"users"), where("role","==","customer"))),
          getDocs(collection(db,"courts")),
        ]);

        const bookings = bookSnap.docs.map(d=>d.data());
        const payments = paySnap.docs.map(d=>d.data());
        const courts   = courtSnap.docs.map(d=>({id:d.id,...d.data()}));

        // Bookings per court
        const bPerCourt = {};
        courts.forEach(c=>{ bPerCourt[c.name??c.id] = 0; });
        bookings.forEach(b=>{ const k = b.courtName??b.courtId; if(k) bPerCourt[k] = (bPerCourt[k]??0)+1; });

        // Bookings per status
        const bPerStatus = { Pending:0, Approved:0, Cancelled:0 };
        bookings.forEach(b=>{ if(b.status) bPerStatus[b.status] = (bPerStatus[b.status]??0)+1; });

        // Revenue (approved payments)
        const revenue = payments
          .filter(p=>p.paymentStatus==="Approved")
          .reduce((sum,p)=>sum+(Number(p.amount)||0),0);

        // Payment methods
        const methods = {};
        payments.forEach(p=>{ if(p.method) methods[p.method]=(methods[p.method]??0)+1; });

        // Bookings per day of week
        const days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
        const bPerDay = {Sun:0,Mon:0,Tue:0,Wed:0,Thu:0,Fri:0,Sat:0};
        bookings.forEach(b=>{
          if(b.date) {
            const d = new Date(b.date);
            if(!isNaN(d)) bPerDay[days[d.getDay()]] = (bPerDay[days[d.getDay()]]||0)+1;
          }
        });

        setData({ bookings, payments, userCount: userSnap.size, courtCount: courtSnap.size, bPerCourt, bPerStatus, revenue, methods, bPerDay });
      } catch(err) { console.error(err); }
      setLoading(false);
    }
    fetch();
  }, []);

  if (loading) return <div className="ad-loading"><div className="ad-spinner"/><span>Loading analytics...</span></div>;
  if (!data)   return <div className="ad-empty">Could not load analytics.</div>;

  const maxBPerCourt = Math.max(...Object.values(data.bPerCourt), 1);
  const maxBPerDay   = Math.max(...Object.values(data.bPerDay), 1);

  return (
    <div className="ad-page">
      <div className="ad-page-header">
        <div>
          <h1 className="ad-page-title">Analytics</h1>
          <p className="ad-page-sub">Overview of your facility performance.</p>
        </div>
      </div>

      {/* Summary stats */}
      <div className="ad-stats-grid">
        <div className="ad-stat-card ad-stat-blue">
          <div className="ad-stat-icon"></div>
          <div className="ad-stat-body">
            <div className="ad-stat-value">{data.bookings.length}</div>
            <div className="ad-stat-label">Total Bookings</div>
          </div>
        </div>
        <div className="ad-stat-card ad-stat-green">
          <div className="ad-stat-icon"></div>
          <div className="ad-stat-body">
            <div className="ad-stat-value">₱{data.revenue.toLocaleString()}</div>
            <div className="ad-stat-label">Total Revenue</div>
            <div className="ad-stat-sub">from approved payments</div>
          </div>
        </div>
        <div className="ad-stat-card ad-stat-purple">
          <div className="ad-stat-icon"></div>
          <div className="ad-stat-body">
            <div className="ad-stat-value">{data.userCount}</div>
            <div className="ad-stat-label">Registered Players</div>
          </div>
        </div>
        <div className="ad-stat-card ad-stat-amber">
          <div className="ad-stat-icon"></div>
          <div className="ad-stat-body">
            <div className="ad-stat-value">{data.payments.length}</div>
            <div className="ad-stat-label">Total Payments</div>
          </div>
        </div>
      </div>

      <div className="ad-two-col">
        {/* Bookings per court */}
        <div className="ad-card">
          <div className="ad-card-header"><h3 className="ad-card-title">Bookings per Court</h3></div>
          <div className="an-bars">
            {Object.entries(data.bPerCourt).map(([k,v])=>(
              <MiniBar key={k} label={k} value={v} max={maxBPerCourt} color="var(--ad-blue)"/>
            ))}
            {Object.keys(data.bPerCourt).length===0 && <div className="ad-empty">No data yet.</div>}
          </div>
        </div>

        {/* Booking status breakdown */}
        <div className="ad-card">
          <div className="ad-card-header"><h3 className="ad-card-title">Booking Status</h3></div>
          <div className="an-status-grid">
            {Object.entries(data.bPerStatus).map(([k,v])=>(
              <div key={k} className={`an-status-card an-status-${k.toLowerCase()}`}>
                <div className="an-status-val">{v}</div>
                <div className="an-status-lbl">{k}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Busiest days */}
        <div className="ad-card">
          <div className="ad-card-header"><h3 className="ad-card-title">Bookings by Day of Week</h3></div>
          <div className="an-bars">
            {Object.entries(data.bPerDay).map(([k,v])=>(
              <MiniBar key={k} label={k} value={v} max={maxBPerDay} color="var(--ad-purple)"/>
            ))}
          </div>
        </div>

        {/* Payment methods */}
        <div className="ad-card">
          <div className="ad-card-header"><h3 className="ad-card-title">Payment Methods</h3></div>
          <div className="an-methods">
            {Object.entries(data.methods).length===0 && <div className="ad-empty">No payment data.</div>}
            {Object.entries(data.methods).map(([k,v])=>(
              <div key={k} className="an-method-row">
                <span className="an-method-name">{k}</span>
                <span className="an-method-count">{v} payment{v!==1?"s":""}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
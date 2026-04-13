import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useSearchParams, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { db } from "../firebase";
import "./book.css";
import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  serverTimestamp,
  onSnapshot,
} from "firebase/firestore";
import { Link } from "react-router-dom";
import {
  Calendar, Clock, Users, ChevronRight, Check, Upload,
  Smartphone, AlertCircle, Package, User, FileText, X
} from "lucide-react";
import toast from "react-hot-toast";
import { format, addDays } from "date-fns";

function deriveCourtKind(c) {
  const joined = (c.amenities || [])
    .map((x) => String(x).toLowerCase())
    .join(" ");
  if (joined.includes("indoor")) return "Indoor";
  if (joined.includes("outdoor")) return "Outdoor";
  return "Court";
}

const TIME_SLOTS = [
  "06:00 AM", "07:00 AM", "08:00 AM", "09:00 AM", "10:00 AM", "11:00 AM",
  "12:00 PM", "01:00 PM", "02:00 PM", "03:00 PM", "04:00 PM", "05:00 PM",
  "06:00 PM", "07:00 PM", "08:00 PM", "09:00 PM",
];

const DURATIONS = [1, 1.5, 2, 2.5, 3, 4];

const EQUIPMENT = [
  { id: "paddle", name: "Paddle Rental", price: 80, icon: "🏓" },
  { id: "balls", name: "Ball Set (3 balls)", price: 50, icon: "🟡" },
  { id: "coach", name: "Coach (1 hour)", price: 500, icon: "👨‍🏫" },
];

const PROMOS = [
  { code: "PICKLE10", discount: 0.1, label: "10% off" },
  { code: "NEWUSER", discount: 0.15, label: "15% off for new users" },
  { code: "MEMBER20", discount: 0.2, label: "20% member discount" },
];

export default function Book() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const adminMode = location.pathname.startsWith("/admin/");
  const [searchParams] = useSearchParams();
  const courtParam = searchParams.get("court");
  const fileInputRef = useRef();

  const [courts, setCourts] = useState([]);
  const [courtsReady, setCourtsReady] = useState(false);
  const [step, setStep] = useState(1);
  const [bookedSlots, setBookedSlots] = useState([]);
  const [promoInput, setPromoInput] = useState("");
  const [appliedPromo, setAppliedPromo] = useState(null);
  const [paymentImg, setPaymentImg] = useState(null);
  const [paymentImgUrl, setPaymentImgUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [bookingId, setBookingId] = useState(null);

  const [form, setForm] = useState({
    courtId: courtParam || "",
    date: format(addDays(new Date(), 1), "yyyy-MM-dd"),
    timeSlot: "",
    duration: 1,
    players: 2,
    equipment: [],
    notes: "",
    playerName: "",
    paymentMethod: "gcash",
  });

  const activeCourts = useMemo(
    () => courts.filter((c) => c.isActive !== false),
    [courts]
  );

  const court = useMemo(() => {
    const raw = activeCourts.find((c) => c.id === form.courtId);
    if (!raw) return null;
    return {
      id: raw.id,
      name: raw.name || "Court",
      price: Number(raw.pricePerHour) || 0,
      type: deriveCourtKind(raw),
    };
  }, [activeCourts, form.courtId]);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "courts"),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        list.sort((a, b) => {
          const ta = a.createdAt?.toMillis?.() ?? 0;
          const tb = b.createdAt?.toMillis?.() ?? 0;
          return tb - ta;
        });
        setCourts(list);
        setCourtsReady(true);
      },
      () => setCourtsReady(true)
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    if (activeCourts.length === 0) return;
    setForm((f) => {
      if (courtParam && activeCourts.some((c) => c.id === courtParam)) {
        if (f.courtId === courtParam) return f;
        return { ...f, courtId: courtParam, timeSlot: "" };
      }
      if (activeCourts.some((c) => c.id === f.courtId)) return f;
      return { ...f, courtId: activeCourts[0].id, timeSlot: "" };
    });
  }, [activeCourts, courtParam]);

  const loadBookedSlots = useCallback(async () => {
    if (!form.courtId) return;
    try {
      const q = query(
        collection(db, "bookings"),
        where("courtId", "==", form.courtId),
        where("date", "==", form.date),
        where("status", "in", ["pending", "approved", "Pending", "Approved"])
      );
      const snap = await getDocs(q);
      const slots = snap.docs.map((d) => d.data().timeSlot);
      setBookedSlots(slots);
    } catch {
      setBookedSlots([]);
    }
  }, [form.courtId, form.date]);

  useEffect(() => {
    if (!user) {
      if (!adminMode) navigate("/login");
      return;
    }
    if (!form.courtId) return;
    loadBookedSlots();
  }, [form.courtId, form.date, user, adminMode, navigate, loadBookedSlots]);

  useEffect(() => {
    if (adminMode) return;
    if (profile?.name) setForm((f) => ({ ...f, playerName: profile.name }));
  }, [profile, adminMode]);

  const equipmentItems = EQUIPMENT.filter((e) => form.equipment.includes(e.id));
  const equipmentTotal = equipmentItems.reduce((s, e) => s + e.price, 0);
  const courtTotal = (court?.price ?? 0) * form.duration;
  const subtotal = courtTotal + equipmentTotal;
  const discount = appliedPromo ? subtotal * appliedPromo.discount : 0;
  const total = subtotal - discount;

  const toggleEquipment = (id) => {
    setForm((f) => ({
      ...f,
      equipment: f.equipment.includes(id) ? f.equipment.filter((e) => e !== id) : [...f.equipment, id],
    }));
  };

  const applyPromo = () => {
    const promo = PROMOS.find((p) => p.code === promoInput.toUpperCase());
    if (promo) { setAppliedPromo(promo); toast.success(`Promo applied: ${promo.label}`); }
    else toast.error("Invalid promo code");
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("File too large (max 5MB)"); return; }
    setPaymentImg(file);
    setPaymentImgUrl(URL.createObjectURL(file));
  };

  const handleSubmit = async () => {
    if (!court) return toast.error("Please select a court");
    if (!form.timeSlot) return toast.error("Please select a time slot");
    if (!form.playerName) return toast.error("Player name is required");
    setSubmitting(true);

    try {
      // Upload proof image to base64 or skip for demo (real app: use Firebase Storage)
      let imageUrl = "";
      if (paymentImg) {
        imageUrl = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target.result);
          reader.readAsDataURL(paymentImg);
        });
      }

      const bookingData = {
        courtId: form.courtId,
        courtName: court.name,
        date: form.date,
        timeSlot: form.timeSlot,
        duration: form.duration,
        players: form.players,
        equipment: form.equipment,
        notes: form.notes,
        playerName: form.playerName,
        userId: user.uid,
        status: "Pending",
        createdAt: serverTimestamp(),
        promoCode: appliedPromo?.code || null,
      };

      const bookingRef = await addDoc(collection(db, "bookings"), bookingData);

      await addDoc(collection(db, "payments"), {
        bookingId: bookingRef.id,
        userId: user.uid,
        name: form.playerName,
        courtId: form.courtId,
        courtName: court.name,
        date: form.date,
        timeSlot: form.timeSlot,
        amount: total,
        method: form.paymentMethod,
        paymentStatus: "Pending",
        paymentImageUrl: imageUrl,
        promoCode: appliedPromo?.code || null,
        discount,
        createdAt: serverTimestamp(),
      });

      setBookingId(bookingRef.id);
      setStep(4);
      toast.success("Booking submitted!");
    } catch (err) {
      console.error(err);
      toast.error("Submission failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const minDate = format(addDays(new Date(), 1), "yyyy-MM-dd");
  const maxDate = format(addDays(new Date(), 30), "yyyy-MM-dd");

  if (step === 4) {
    return (
      <div
        className={
          adminMode
            ? "hero-bg flex items-center justify-center px-4 py-10 rounded-2xl border border-slate-800"
            : "min-h-screen hero-bg flex items-center justify-center px-4 pt-20"
        }
      >
        <div className="max-w-md w-full text-center">
          <div className="card p-10">
            <div className="w-20 h-20 bg-green-500/20 border-2 border-green-500 rounded-full flex items-center justify-center mx-auto mb-6 glow-green">
              <Check size={36} className="text-green-400" />
            </div>
            <h2 className="font-display text-3xl tracking-wider text-white mb-2">BOOKING SUBMITTED!</h2>
            <p className="text-slate-400 text-sm mb-6">
              Your booking is <strong className="text-yellow-400">pending approval</strong>. We'll notify you once confirmed.
            </p>
            <div className="bg-slate-800 rounded-xl p-4 text-left space-y-2 mb-6">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Court</span>
                <span className="text-white">{court?.name ?? "—"}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Date</span>
                <span className="text-white">{form.date}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Time</span>
                <span className="text-white">{form.timeSlot}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Total Paid</span>
                <span className="text-green-400 font-semibold">₱{total.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Booking ID</span>
                <span className="text-white text-xs font-mono">{bookingId?.slice(0, 12)}...</span>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => navigate(adminMode ? "/admin/bookings" : "/bookings")}
                className="btn-primary flex-1 text-sm py-3"
              >
                {adminMode ? "View all bookings" : "View My Bookings"}
              </button>
              <button
                onClick={() => {
                  setStep(1);
                  setBookingId(null);
                  if (adminMode) setForm((f) => ({ ...f, playerName: "" }));
                }}
                className="btn-secondary flex-1 text-sm py-3"
              >
                Book Another
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={adminMode ? "book-page--embedded" : "min-h-screen"}>
      <div
        className={
          adminMode ? "court-pattern pt-4 pb-10 px-2 sm:px-4" : "min-h-screen court-pattern pt-20 pb-12 px-4"
        }
      >
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8 pt-4">
          <h1 className="font-display text-4xl tracking-wider text-white">BOOK A <span className="gradient-text">COURT</span></h1>
          <p className="text-slate-500 mt-1 text-sm">Complete all steps to confirm your reservation</p>
        </div>

        {/* Steps */}
        <div className="flex items-center justify-center gap-2 mb-10">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
                step > s ? "bg-green-500 text-slate-950" :
                step === s ? "bg-green-500/20 border-2 border-green-500 text-green-400" :
                "bg-slate-800 text-slate-600"
              }`}>
                {step > s ? <Check size={16} /> : s}
              </div>
              <span className={`text-sm font-medium hidden sm:block ${step >= s ? "text-white" : "text-slate-600"}`}>
                {s === 1 ? "Court & Schedule" : s === 2 ? "Add-ons" : "Payment"}
              </span>
              {s < 3 && <ChevronRight size={16} className="text-slate-700 mx-1" />}
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Form */}
          <div className="lg:col-span-2 space-y-5">

            {/* Step 1 */}
            {step === 1 && (
              <>
                {/* Court Selection */}
                <div className="card p-6">
                  <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                    <Calendar size={18} className="text-green-400" /> Select Court
                  </h3>
                  {!courtsReady ? (
                    <div className="flex items-center justify-center gap-2 py-12 text-slate-400 text-sm">
                      <svg className="animate-spin w-5 h-5 text-green-400" viewBox="0 0 24 24" fill="none" aria-hidden>
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
                      </svg>
                      Loading courts…
                    </div>
                  ) : activeCourts.length === 0 ? (
                    <div className="text-center py-10 border border-dashed border-slate-700 rounded-xl">
                      <p className="text-slate-400 text-sm mb-3">No active courts available yet.</p>
                      {adminMode ? (
                        <Link
                          to="/admin/courts"
                          className="inline-flex items-center gap-1 text-cyan-400 text-sm font-semibold hover:underline"
                        >
                          Add courts in Court Management →
                        </Link>
                      ) : (
                        <p className="text-slate-500 text-xs">Ask your facility admin to add courts.</p>
                      )}
                    </div>
                  ) : (
                    <div className="grid sm:grid-cols-2 gap-3">
                      {activeCourts.map((c) => {
                        const kind = deriveCourtKind(c);
                        const price = Number(c.pricePerHour) || 0;
                        const kindClass =
                          kind === "Indoor"
                            ? "bg-blue-500/20 text-blue-400"
                            : kind === "Outdoor"
                              ? "bg-orange-500/20 text-orange-400"
                              : "bg-slate-500/20 text-slate-400";
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => setForm({ ...form, courtId: c.id, timeSlot: "" })}
                            className={`p-4 rounded-xl border text-left transition-all ${
                              form.courtId === c.id
                                ? "border-green-500 bg-green-500/10"
                                : "border-slate-700 bg-slate-800 hover:border-slate-600"
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-white font-medium text-sm">{c.name}</span>
                              {form.courtId === c.id && <Check size={14} className="text-green-400" />}
                            </div>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${kindClass}`}>
                              {kind}
                            </span>
                            <div className="text-green-400 font-semibold mt-2">
                              ₱{price.toLocaleString()}
                              <span className="text-slate-500 text-xs font-normal">/hr</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Player Info */}
                <div className="card p-6">
                  <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                    <User size={18} className="text-green-400" /> Player Information
                  </h3>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="label">Player Name</label>
                      <input
                        type="text"
                        required
                        className="input-field"
                        placeholder="Full name"
                        value={form.playerName}
                        onChange={(e) => setForm({ ...form, playerName: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="label">Number of Players</label>
                      <select
                        className="input-field"
                        value={form.players}
                        onChange={(e) => setForm({ ...form, players: Number(e.target.value) })}
                      >
                        {[1, 2, 3, 4].map((n) => (
                          <option key={n} value={n}>{n} {n === 1 ? "player" : "players"}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Date & Time */}
                <div className="card p-6">
                  <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                    <Clock size={18} className="text-green-400" /> Date & Time
                  </h3>
                  <div className="grid sm:grid-cols-2 gap-4 mb-5">
                    <div>
                      <label className="label">Date</label>
                      <input
                        type="date"
                        className="input-field"
                        min={minDate}
                        max={maxDate}
                        value={form.date}
                        onChange={(e) => setForm({ ...form, date: e.target.value, timeSlot: "" })}
                      />
                    </div>
                    <div>
                      <label className="label">Duration</label>
                      <select
                        className="input-field"
                        value={form.duration}
                        onChange={(e) => setForm({ ...form, duration: Number(e.target.value) })}
                      >
                        {DURATIONS.map((d) => (
                          <option key={d} value={d}>{d} {d === 1 ? "hour" : "hours"}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <label className="label">Available Time Slots</label>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {TIME_SLOTS.map((slot) => {
                      const isBooked = bookedSlots.includes(slot);
                      return (
                        <button
                          key={slot}
                          disabled={isBooked}
                          onClick={() => setForm({ ...form, timeSlot: slot })}
                          className={`py-2.5 px-3 rounded-xl text-xs font-medium transition-all ${
                            isBooked ? "bg-red-500/10 border border-red-500/20 text-red-400/50 cursor-not-allowed" :
                            form.timeSlot === slot ? "bg-green-500 text-slate-950 glow-green" :
                            "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white border border-slate-700"
                          }`}
                        >
                          {slot}
                          {isBooked && <div className="text-xs">Booked</div>}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Notes */}
                <div className="card p-6">
                  <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                    <FileText size={18} className="text-green-400" /> Special Notes (Optional)
                  </h3>
                  <textarea
                    rows={3}
                    className="input-field resize-none"
                    placeholder="Any special requests, skill level, purpose of booking..."
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  />
                </div>
              </>
            )}

            {/* Step 2 - Equipment */}
            {step === 2 && (
              <div className="card p-6">
                <h3 className="text-white font-semibold mb-1 flex items-center gap-2">
                  <Package size={18} className="text-green-400" /> Equipment Rental Add-ons
                </h3>
                <p className="text-slate-500 text-sm mb-5">Optional extras to enhance your session</p>
                <div className="space-y-3">
                  {EQUIPMENT.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => toggleEquipment(item.id)}
                      className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${
                        form.equipment.includes(item.id)
                          ? "border-green-500 bg-green-500/10"
                          : "border-slate-700 bg-slate-800 hover:border-slate-600"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{item.icon}</span>
                        <div className="text-left">
                          <div className="text-white font-medium">{item.name}</div>
                          <div className="text-slate-500 text-sm">₱{item.price} per session</div>
                        </div>
                      </div>
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                        form.equipment.includes(item.id) ? "border-green-500 bg-green-500" : "border-slate-600"
                      }`}>
                        {form.equipment.includes(item.id) && <Check size={12} className="text-slate-950" />}
                      </div>
                    </button>
                  ))}
                </div>

                {/* Promo Code */}
                <div className="mt-6 border-t border-slate-800 pt-5">
                  <label className="label">Promo Code</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      className="input-field flex-1"
                      placeholder="Enter code (e.g. PICKLE10)"
                      value={promoInput}
                      onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                    />
                    <button onClick={applyPromo} className="btn-secondary px-4 py-2 text-sm whitespace-nowrap">
                      Apply
                    </button>
                  </div>
                  {appliedPromo && (
                    <div className="flex items-center gap-2 mt-2 text-green-400 text-sm">
                      <Check size={14} /> {appliedPromo.label} applied!
                    </div>
                  )}
                  <p className="text-slate-600 text-xs mt-2">Try: PICKLE10, NEWUSER, MEMBER20</p>
                </div>
              </div>
            )}

            {/* Step 3 - Payment */}
            {step === 3 && (
              <div className="card p-6">
                <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                  <Smartphone size={18} className="text-green-400" /> GCash Payment
                </h3>
                <div className="bg-green-500/5 border border-green-500/20 rounded-xl p-5 mb-5">
                  <div className="flex items-start gap-3">
                    <AlertCircle size={18} className="text-green-400 mt-0.5 shrink-0" />
                    <div className="text-sm">
                      <p className="text-white font-medium mb-1">Payment Instructions</p>
                      <ol className="text-slate-400 space-y-1 list-decimal list-inside">
                        <li>Open GCash on your phone</li>
                        <li>Send <strong className="text-green-400">₱{total.toFixed(2)}</strong> to: <strong className="text-white">09XX-XXX-XXXX</strong></li>
                        <li>Account Name: <strong className="text-white">PickleZone Inc.</strong></li>
                        <li>Take a screenshot of the receipt</li>
                        <li>Upload the screenshot below</li>
                      </ol>
                    </div>
                  </div>
                </div>

                <label className="label">Upload GCash Receipt *</label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                    paymentImgUrl ? "border-green-500 bg-green-500/5" : "border-slate-700 hover:border-slate-500"
                  }`}
                >
                  {paymentImgUrl ? (
                    <div>
                      <img src={paymentImgUrl} alt="Receipt" className="max-h-40 mx-auto rounded-lg mb-3 object-contain" />
                      <p className="text-green-400 text-sm font-medium flex items-center justify-center gap-1">
                        <Check size={14} /> Receipt uploaded
                      </p>
                    </div>
                  ) : (
                    <div>
                      <Upload size={32} className="text-slate-600 mx-auto mb-2" />
                      <p className="text-slate-400 text-sm">Click to upload GCash screenshot</p>
                      <p className="text-slate-600 text-xs mt-1">PNG, JPG up to 5MB</p>
                    </div>
                  )}
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                </div>

                {paymentImgUrl && (
                  <button
                    onClick={() => { setPaymentImg(null); setPaymentImgUrl(""); }}
                    className="mt-2 text-red-400 hover:text-red-300 text-xs flex items-center gap-1"
                  >
                    <X size={12} /> Remove image
                  </button>
                )}
              </div>
            )}

            {/* Nav Buttons */}
            <div className="flex gap-3">
              {step > 1 && (
                <button onClick={() => setStep(step - 1)} className="btn-secondary flex-1 py-3">
                  ← Back
                </button>
              )}
              {step < 3 ? (
                <button
                  onClick={() => {
                    if (step === 1 && !form.timeSlot) return toast.error("Please select a time slot");
                    if (step === 1 && !form.playerName) return toast.error("Player name is required");
                    setStep(step + 1);
                  }}
                  className="btn-primary flex-1 py-3 flex items-center justify-center gap-2"
                >
                  Continue <ChevronRight size={16} />
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="btn-primary flex-1 py-3 flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
                      </svg>
                      Submitting...
                    </span>
                  ) : (
                    <><Check size={16} /> Confirm Booking</>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Summary Sidebar */}
          <div className="space-y-4">
            <div className="card p-5 sticky top-24">
              <h3 className="text-white font-semibold mb-4 text-sm">Booking Summary</h3>

              <div className="space-y-3 text-sm">
                <div>
                  <div className="text-slate-500 text-xs mb-1">Court</div>
                  <div className="text-white font-medium">{court?.name ?? "—"}</div>
                  {court && (
                    <div className="flex gap-2 mt-1">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          court.type === "Indoor"
                            ? "bg-blue-500/20 text-blue-400"
                            : court.type === "Outdoor"
                              ? "bg-orange-500/20 text-orange-400"
                              : "bg-slate-500/20 text-slate-400"
                        }`}
                      >
                        {court.type}
                      </span>
                    </div>
                  )}
                </div>

                {form.date && (
                  <div>
                    <div className="text-slate-500 text-xs mb-1">Date & Time</div>
                    <div className="text-white">{form.date}</div>
                    <div className="text-green-400">{form.timeSlot || "Not selected"}</div>
                    <div className="text-slate-400 text-xs">{form.duration} {form.duration === 1 ? "hour" : "hours"}</div>
                  </div>
                )}

                <div>
                  <div className="text-slate-500 text-xs mb-1">Players</div>
                  <div className="text-white flex items-center gap-1">
                    <Users size={13} /> {form.players}
                  </div>
                </div>

                {form.playerName && (
                  <div>
                    <div className="text-slate-500 text-xs mb-1">Player Name</div>
                    <div className="text-white">{form.playerName}</div>
                  </div>
                )}

                {equipmentItems.length > 0 && (
                  <div>
                    <div className="text-slate-500 text-xs mb-1">Equipment</div>
                    {equipmentItems.map((e) => (
                      <div key={e.id} className="flex justify-between text-slate-300 text-xs">
                        <span>{e.icon} {e.name}</span>
                        <span>₱{e.price}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t border-slate-800 mt-4 pt-4 space-y-2 text-sm">
                <div className="flex justify-between text-slate-400">
                  <span>Court ({form.duration}hr)</span>
                  <span>₱{courtTotal}</span>
                </div>
                {equipmentTotal > 0 && (
                  <div className="flex justify-between text-slate-400">
                    <span>Equipment</span>
                    <span>₱{equipmentTotal}</span>
                  </div>
                )}
                {discount > 0 && (
                  <div className="flex justify-between text-green-400">
                    <span>Promo ({appliedPromo?.code})</span>
                    <span>-₱{discount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-white font-semibold text-base pt-2 border-t border-slate-800">
                  <span>Total</span>
                  <span className="text-green-400">₱{total.toFixed(2)}</span>
                </div>
              </div>

              <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                <p className="text-blue-400 text-xs">
                  💡 Booking is pending until payment is confirmed by our team (usually within 30 minutes).
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
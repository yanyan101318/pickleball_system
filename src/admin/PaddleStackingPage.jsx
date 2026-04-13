// src/admin/PaddleStackingPage.jsx — admin-only paddle queue & court rotation
import { useState, useEffect, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  updateDoc,
  collection,
  addDoc,
  query,
  orderBy,
  limit,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import toast from "react-hot-toast";
import { format } from "date-fns";

const STATE_DOC = doc(db, "paddleStack", "state");

function newId() {
  return crypto.randomUUID?.() || String(Date.now()) + Math.random().toString(36).slice(2);
}

function normName(s) {
  return (s || "").trim().toLowerCase();
}

export default function PaddleStackingPage() {
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState([]);
  const [facilityCourts, setFacilityCourts] = useState([]);
  const [newPlayer, setNewPlayer] = useState("");
  const [queueSearch, setQueueSearch] = useState("");
  const [assignCourtId, setAssignCourtId] = useState("");
  const [assignMode, setAssignMode] = useState("doubles");
  const [pickFacilityCourtId, setPickFacilityCourtId] = useState("");
  const [customCourtName, setCustomCourtName] = useState("");

  useEffect(() => {
    const cq = query(collection(db, "courts"), orderBy("createdAt", "desc"));
    const unsubC = onSnapshot(cq, (snap) => {
      setFacilityCourts(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsubC();
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const snap = await getDoc(STATE_DOC);
      if (!snap.exists() && mounted) {
        await setDoc(STATE_DOC, {
          queue: [],
          courts: [
            {
              id: newId(),
              name: "Court 1",
              status: "available",
              gameType: null,
              playerSlots: [],
              startedAt: null,
            },
          ],
          sessionNote: "",
          updatedAt: serverTimestamp(),
        });
      }
    })();
    const unsub = onSnapshot(STATE_DOC, (snap) => {
      if (snap.exists()) setState({ id: snap.id, ...snap.data() });
      else setState(null);
      setLoading(false);
    });
    const hq = query(collection(db, "paddleMatchHistory"), orderBy("endedAt", "desc"), limit(80));
    const unsubH = onSnapshot(hq, (snap) => {
      setHistory(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => {
      mounted = false;
      unsub();
      unsubH();
    };
  }, []);

  const queue = useMemo(() => state?.queue || [], [state]);
  const courts = useMemo(() => state?.courts || [], [state]);

  const facilityCourtsAvailable = useMemo(
    () =>
      facilityCourts.filter(
        (fc) =>
          fc.isActive !== false &&
          !courts.some((c) => c.facilityCourtId && c.facilityCourtId === fc.id)
      ),
    [facilityCourts, courts]
  );

  const filteredQueue = useMemo(() => {
    const q = queueSearch.trim().toLowerCase();
    if (!q) return queue;
    return queue.filter((e) => (e.name || "").toLowerCase().includes(q));
  }, [queue, queueSearch]);

  const needCount = assignMode === "singles" ? 2 : 4;
  const nextSuggestion = useMemo(() => queue.slice(0, needCount).map((e) => e.name), [queue, needCount]);

  const persistState = useCallback(async (partial) => {
    await updateDoc(STATE_DOC, { ...partial, updatedAt: serverTimestamp() });
  }, []);

  async function addPlayer(e) {
    e.preventDefault();
    const name = newPlayer.trim();
    if (!name) {
      toast.error("Enter a name");
      return;
    }
    const dup = queue.some((x) => normName(x.name) === normName(name));
    if (dup) {
      toast.error("That player is already in the queue");
      return;
    }
    const entry = { id: newId(), name, addedAt: Timestamp.now() };
    await persistState({ queue: [...queue, entry] });
    setNewPlayer("");
    toast.success("Added to stack");
  }

  async function removeFromQueue(entryId) {
    await persistState({ queue: queue.filter((x) => x.id !== entryId) });
  }

  async function clearQueue() {
    if (!window.confirm("Clear the entire queue?")) return;
    await persistState({ queue: [] });
    toast.success("Queue cleared");
  }

  async function moveQueue(i, dir) {
    const j = i + dir;
    if (j < 0 || j >= queue.length) return;
    const next = [...queue];
    [next[i], next[j]] = [next[j], next[i]];
    await persistState({ queue: next });
  }

  async function addCourtFromFacility() {
    const fc = facilityCourts.find((x) => x.id === pickFacilityCourtId);
    if (!fc) {
      toast.error("Choose a facility court from the list");
      return;
    }
    if (fc.isActive === false) {
      toast.error("That facility court is inactive — activate it under Court management first");
      return;
    }
    if (courts.some((c) => c.facilityCourtId === fc.id)) {
      toast.error("That court is already on the board");
      return;
    }
    await persistState({
      courts: [
        ...courts,
        {
          id: newId(),
          name: (fc.name || "Court").trim(),
          facilityCourtId: fc.id,
          status: "available",
          gameType: null,
          playerSlots: [],
          startedAt: null,
        },
      ],
    });
    setPickFacilityCourtId("");
    toast.success(`Added “${fc.name}” (linked to facility)`);
  }

  async function addCourtCustom() {
    const name = customCourtName.trim();
    if (!name) {
      toast.error("Enter a custom court name");
      return;
    }
    await persistState({
      courts: [
        ...courts,
        {
          id: newId(),
          name,
          facilityCourtId: null,
          status: "available",
          gameType: null,
          playerSlots: [],
          startedAt: null,
        },
      ],
    });
    setCustomCourtName("");
    toast.success(`Added “${name}” (custom label — not linked)`);
  }

  async function removeCourt(courtId) {
    const c = courts.find((x) => x.id === courtId);
    if (c?.status === "ongoing") {
      toast.error("Finish the game or assign elsewhere first");
      return;
    }
    if (!window.confirm("Remove this court?")) return;
    await persistState({ courts: courts.filter((x) => x.id !== courtId) });
  }

  async function assignMatch() {
    const court = courts.find((x) => x.id === assignCourtId);
    if (!court) {
      toast.error("Select a court");
      return;
    }
    if (court.status !== "available") {
      toast.error("That court is not available");
      return;
    }
    const n = assignMode === "singles" ? 2 : 4;
    if (queue.length < n) {
      toast.error(`Need at least ${n} players in the queue (FIFO)`);
      return;
    }
    const taken = queue.slice(0, n);
    const rest = queue.slice(n);
    const playerSlots = taken.map((t) => ({ queueEntryId: t.id, name: t.name }));
    const nextCourts = courts.map((c) =>
      c.id === court.id
        ? {
            ...c,
            status: "ongoing",
            gameType: assignMode,
            playerSlots,
            startedAt: Timestamp.now(),
          }
        : c
    );
    await persistState({ queue: rest, courts: nextCourts });
    toast.success(`${assignMode === "singles" ? "Singles" : "Doubles"} started on ${court.name}`);
  }

  async function finishMatch(courtId) {
    const court = courts.find((x) => x.id === courtId);
    if (!court || court.status !== "ongoing") return;
    const endedAt = Timestamp.now();
    const nextCourts = courts.map((c) =>
      c.id === courtId
        ? {
            ...c,
            status: "available",
            gameType: null,
            playerSlots: [],
            startedAt: null,
          }
        : c
    );
    await persistState({ courts: nextCourts });
    try {
      await addDoc(collection(db, "paddleMatchHistory"), {
        courtId: court.id,
        courtName: court.name,
        gameType: court.gameType,
        players: court.playerSlots || [],
        startedAt: court.startedAt || endedAt,
        endedAt,
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      console.error(err);
      toast.error("Court freed — history log failed (check rules).");
      return;
    }
    toast.success(`${court.name} is available again`);
  }

  async function requeueFromHistory(h) {
    const names = (h.players || []).map((p) => p.name).filter(Boolean);
    if (!names.length) return;
    const next = [...queue];
    let added = 0;
    for (const name of names) {
      if (next.some((x) => normName(x.name) === normName(name))) continue;
      next.push({ id: newId(), name, addedAt: Timestamp.now() });
      added++;
    }
    if (!added) {
      toast.error("Those players are already in the queue");
      return;
    }
    await persistState({ queue: next });
    toast.success(`Added ${added} player(s) to the stack`);
  }

  async function resetSession() {
    if (
      !window.confirm(
        "Reset session? This clears the queue and frees all courts. Match history is kept."
      )
    )
      return;
    const nextCourts = courts.map((c) => ({
      ...c,
      status: "available",
      gameType: null,
      playerSlots: [],
      startedAt: null,
    }));
    await persistState({ queue: [], courts: nextCourts });
    toast.success("Session reset");
  }

  useEffect(() => {
    if (courts.length && !assignCourtId) {
      const firstAvail = courts.find((c) => c.status === "available");
      if (firstAvail) setAssignCourtId(firstAvail.id);
    }
  }, [courts, assignCourtId]);

  if (loading || !state) {
    return (
      <div className="ad-loading">
        <div className="ad-spinner" />
      </div>
    );
  }

  return (
    <div className="ad-page">
      <div className="ad-page-header flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <h1 className="ad-page-title">Paddle stacking</h1>
          <p className="ad-page-sub">
            FIFO queue, court assignment (singles / doubles), and match log — admin only, no player portal.
          </p>
          <p className="text-[12px] text-[var(--ad-muted)] mt-2 max-w-2xl">
            <Link
              to="/admin/courts"
              className="text-[var(--ad-pickle)] font-semibold hover:underline"
            >
              Court management
            </Link>{" "}
            lists your real facility courts — link them below so staff pick the same names players see when booking.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="ad-btn ad-btn-outline ad-btn-sm" onClick={resetSession}>
            Reset session
          </button>
        </div>
      </div>

      <div className="grid xl:grid-cols-3 gap-6">
        {/* Queue */}
        <div className="xl:col-span-1 space-y-4">
          <div className="ad-card p-4">
            <h3 className="text-sm font-black text-white uppercase tracking-wide mb-3">Player queue (FIFO)</h3>
            <form onSubmit={addPlayer} className="flex gap-2 mb-3">
              <input
                className="af-input flex-1"
                placeholder="Player name"
                value={newPlayer}
                onChange={(e) => setNewPlayer(e.target.value)}
              />
              <button type="submit" className="ad-btn ad-btn-primary ad-btn-sm shrink-0">
                Add
              </button>
            </form>
            <input
              className="af-input mb-3"
              placeholder="Search queue…"
              value={queueSearch}
              onChange={(e) => setQueueSearch(e.target.value)}
            />
            {nextSuggestion.length > 0 && (
              <div className="mb-3 rounded-lg border border-cyan-500/30 bg-cyan-500/5 px-3 py-2 text-xs">
                <span className="text-cyan-400 font-bold uppercase tracking-wider">Next up ({needCount} for {assignMode})</span>
                <div className="text-white mt-1 font-medium">{nextSuggestion.join(" · ") || "—"}</div>
              </div>
            )}
            <div className="space-y-1 max-h-[420px] overflow-y-auto custom-scrollbar pr-1">
              {filteredQueue.length === 0 ? (
                <p className="text-sm text-[var(--ad-muted)] py-6 text-center">Queue empty</p>
              ) : (
                filteredQueue.map((entry, displayIdx) => {
                  const realIdx = queue.findIndex((q) => q.id === entry.id);
                  const isNext = realIdx < needCount;
                  return (
                    <div
                      key={entry.id}
                      className={`flex items-center gap-2 rounded-lg border px-2 py-2 text-sm ${
                        isNext && !queueSearch.trim()
                          ? "border-[var(--ad-pickle)]/50 bg-[var(--ad-pickle)]/5"
                          : "border-[var(--ad-border)] bg-[var(--ad-surface)]"
                      }`}
                    >
                      <span className="text-[var(--ad-muted)] w-6 text-center font-mono text-xs">{realIdx + 1}</span>
                      <span className="flex-1 font-semibold text-[var(--ad-text)] truncate">{entry.name}</span>
                      <span className="text-[10px] text-[var(--ad-muted)] hidden sm:inline">
                        {entry.addedAt?.toDate
                          ? format(entry.addedAt.toDate(), "HH:mm")
                          : ""}
                      </span>
                      <div className="flex gap-0.5">
                        <button
                          type="button"
                          className="ad-btn ad-btn-sm ad-btn-outline px-1"
                          title="Up"
                          onClick={() => moveQueue(realIdx, -1)}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className="ad-btn ad-btn-sm ad-btn-outline px-1"
                          title="Down"
                          onClick={() => moveQueue(realIdx, 1)}
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          className="ad-btn ad-btn-sm ad-btn-danger px-1"
                          onClick={() => removeFromQueue(entry.id)}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <button type="button" className="ad-btn ad-btn-outline w-full mt-3 ad-btn-sm" onClick={clearQueue}>
              Clear entire queue
            </button>
          </div>
        </div>

        {/* Courts + assign */}
        <div className="xl:col-span-2 space-y-4">
          <div className="ad-card p-4">
            <h3 className="text-sm font-black text-white uppercase tracking-wide mb-3">Game assignment</h3>

            <div className="rounded-lg border border-[var(--ad-border)] bg-[#0d0f14]/80 p-3 mb-4 space-y-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--ad-muted)]">
                Courts on this board
              </div>
              {facilityCourts.length === 0 ? (
                <p className="text-[11px] text-amber-400/95 leading-relaxed">
                  No courts in your facility yet.{" "}
                  <Link to="/admin/courts" className="underline font-semibold text-[var(--ad-pickle)]">
                    Add courts in Court management
                  </Link>{" "}
                  first, then choose them here so labels match bookings.
                </p>
              ) : facilityCourtsAvailable.length === 0 ? (
                <p className="text-[11px] text-[var(--ad-muted)]">
                  Every active facility court is already on this board, or add a{" "}
                  <strong className="text-[var(--ad-text)]">custom</strong> label for a temporary bay.
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2 items-end">
                <div className="af-group flex-1 min-w-[200px]">
                  <label className="af-label">Add from facility list</label>
                  <select
                    className="af-input"
                    value={pickFacilityCourtId}
                    onChange={(e) => setPickFacilityCourtId(e.target.value)}
                  >
                    <option value="">Select a court…</option>
                    {facilityCourtsAvailable.map((fc) => (
                      <option key={fc.id} value={fc.id}>
                        {fc.name}
                        {fc.pricePerHour != null && !Number.isNaN(Number(fc.pricePerHour))
                          ? ` · ₱${Number(fc.pricePerHour)}/hr`
                          : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  className="ad-btn ad-btn-primary ad-btn-sm shrink-0"
                  onClick={addCourtFromFacility}
                  disabled={!pickFacilityCourtId}
                >
                  Add linked court
                </button>
              </div>
              <div className="flex flex-wrap gap-2 items-end pt-2 border-t border-[var(--ad-border)]/70">
                <div className="af-group flex-1 min-w-[200px]">
                  <label className="af-label">Or custom label</label>
                  <input
                    className="af-input"
                    value={customCourtName}
                    onChange={(e) => setCustomCourtName(e.target.value)}
                    placeholder="e.g. Court A, spare bay…"
                  />
                </div>
                <button
                  type="button"
                  className="ad-btn ad-btn-outline ad-btn-sm shrink-0"
                  onClick={addCourtCustom}
                >
                  Add custom
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 mb-4">
              <div className="af-group min-w-[140px]">
                <label className="af-label">Format</label>
                <select
                  className="af-input"
                  value={assignMode}
                  onChange={(e) => setAssignMode(e.target.value)}
                >
                  <option value="doubles">Doubles (4)</option>
                  <option value="singles">Singles (2)</option>
                </select>
              </div>
              <div className="af-group flex-1 min-w-[160px]">
                <label className="af-label">Court</label>
                <select
                  className="af-input"
                  value={assignCourtId}
                  onChange={(e) => setAssignCourtId(e.target.value)}
                >
                  <option value="">Select…</option>
                  {courts.map((c) => (
                    <option key={c.id} value={c.id} disabled={c.status !== "available"}>
                      {c.name}
                      {c.facilityCourtId ? " · facility" : ""}
                      {c.status === "ongoing" ? " (busy)" : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <button type="button" className="ad-btn ad-btn-primary" onClick={assignMatch}>
                  Take next {needCount} from queue → court
                </button>
              </div>
            </div>
            <p className="text-[11px] text-[var(--ad-muted)] mb-4">
              Players are taken from the top of the queue (FIFO). Same name cannot be queued twice. To play again,
              add them back after the game.
            </p>

            <div className="grid sm:grid-cols-2 gap-3">
              {courts.map((c) => (
                <div
                  key={c.id}
                  className={`rounded-xl border p-4 ${
                    c.status === "ongoing"
                      ? "border-emerald-500/40 bg-emerald-500/5"
                      : "border-[var(--ad-border)] bg-[var(--ad-surface)]"
                  }`}
                >
                  <div className="flex justify-between items-start gap-2 mb-2">
                    <div>
                      <div className="font-bold text-[var(--ad-text)]">{c.name}</div>
                      {c.facilityCourtId ? (
                        <Link
                          to="/admin/courts"
                          className="inline-flex items-center gap-0.5 text-[10px] text-cyan-400/95 hover:underline font-medium mt-0.5"
                          title="Opens Court management — same court as bookings"
                        >
                          <span className="material-symbols-outlined text-[13px]" aria-hidden>
                            link
                          </span>
                          Linked to facility list
                        </Link>
                      ) : (
                        <span className="text-[10px] text-[var(--ad-muted)] mt-0.5 block">
                          Custom label (not linked)
                        </span>
                      )}
                      <span
                        className={`text-[10px] uppercase font-bold block mt-1 ${
                          c.status === "ongoing" ? "text-emerald-400" : "text-slate-500"
                        }`}
                      >
                        {c.status === "ongoing" ? "Ongoing" : "Available"}
                      </span>
                    </div>
                    {c.status === "available" && (
                      <button
                        type="button"
                        className="text-xs text-rose-400 hover:underline"
                        onClick={() => removeCourt(c.id)}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  {c.status === "ongoing" && (
                    <>
                      <div className="text-xs text-[var(--ad-muted)] mb-1">
                        {c.gameType === "singles" ? "Singles" : "Doubles"} · Started{" "}
                        {c.startedAt?.toDate ? format(c.startedAt.toDate(), "MMM d, HH:mm") : "—"}
                      </div>
                      <ul className="text-sm space-y-0.5 mb-3">
                        {(c.playerSlots || []).map((p) => (
                          <li key={p.queueEntryId} className="text-[var(--ad-text)]">
                            • {p.name}
                          </li>
                        ))}
                      </ul>
                      <button
                        type="button"
                        className="ad-btn ad-btn-success ad-btn-sm w-full"
                        onClick={() => finishMatch(c.id)}
                      >
                        Mark finished
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="ad-card overflow-hidden">
            <div className="ad-card-header">
              <h3 className="ad-card-title">Match history</h3>
              <span className="text-xs text-[var(--ad-muted)]">{history.length} recorded</span>
            </div>
            <div className="overflow-x-auto max-h-72">
              <table className="ad-table">
                <thead>
                  <tr>
                    <th>Court</th>
                    <th>Format</th>
                    <th>Players</th>
                    <th>Started</th>
                    <th>Ended</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {history.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="ad-empty">
                        No completed games yet.
                      </td>
                    </tr>
                  ) : (
                    history.map((h) => (
                      <tr key={h.id}>
                        <td className="ad-td-main">{h.courtName}</td>
                        <td className="text-sm capitalize">{h.gameType}</td>
                        <td className="text-sm">
                          {(h.players || []).map((p) => p.name).join(", ")}
                        </td>
                        <td className="text-xs whitespace-nowrap">
                          {h.startedAt?.toDate
                            ? format(h.startedAt.toDate(), "MMM d HH:mm")
                            : "—"}
                        </td>
                        <td className="text-xs whitespace-nowrap">
                          {h.endedAt?.toDate
                            ? format(h.endedAt.toDate(), "MMM d HH:mm")
                            : "—"}
                        </td>
                        <td className="text-right">
                          <button
                            type="button"
                            className="ad-btn ad-btn-sm ad-btn-outline"
                            onClick={() => requeueFromHistory(h)}
                          >
                            Re-queue
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

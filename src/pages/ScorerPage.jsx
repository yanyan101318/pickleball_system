// src/pages/ScorerPage.jsx
import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { subscribeToMatch, updateMatch, updateNextMatch, setChampion, getTournamentInfo } from "../services/tournamentService";
import { recordSetWin, undoLastSet, setsNeeded, setsTotal, recordPoint, recordFault } from "../utils/bracketGenerator";
import RulesReference from "../components/RulesReference";

// localStorage helpers
function getStoredScore(matchId) {
  try {
    const raw = localStorage.getItem(`score_${matchId}`);
    if (raw) { const p = JSON.parse(raw); return { a: p.a ?? 0, b: p.b ?? 0 }; }
  } catch (_) {}
  return { a: 0, b: 0 };
}
function saveScore(matchId, a, b) {
  try { localStorage.setItem(`score_${matchId}`, JSON.stringify({ a, b })); } catch (_) {}
}
function clearScore(matchId) {
  try { localStorage.removeItem(`score_${matchId}`); } catch (_) {}
}

// Pickleball SVG
function PickleballSVG({ size = 40 }) {
  return (
    <svg viewBox="0 0 40 40" fill="none" width={size} height={size}>
      <circle cx="20" cy="20" r="19" fill="#c8e63a" stroke="#a8c420" strokeWidth="1.5"/>
      {[[20,8],[20,32],[8,20],[32,20],[12,12],[28,12],[12,28],[28,28],[20,20]].map(([cx,cy],i)=>(
        <circle key={i} cx={cx} cy={cy} r="2.2" fill="#7aaa00" opacity="0.75"/>
      ))}
      <ellipse cx="14" cy="13" rx="4" ry="2.5" fill="white" opacity="0.2" transform="rotate(-30 14 13)"/>
    </svg>
  );
}

export default function ScorerPage() {
  const { tournamentId, matchId } = useParams();
  const [match, setMatch]               = useState(null);
  const [tournamentInfo, setTournamentInfo] = useState(null);
  const [localA, setLocalA]             = useState(() => getStoredScore(matchId).a);
  const [localB, setLocalB]             = useState(() => getStoredScore(matchId).b);
  const [saving, setSaving]             = useState(false);
  const [loading, setLoading]           = useState(true);
  const [flashA, setFlashA]             = useState(null);
  const [flashB, setFlashB]             = useState(null);
  const [toast, setToast]               = useState(null);
  const [showRules, setShowRules]       = useState(false);

  useEffect(() => { getTournamentInfo(tournamentId).then(setTournamentInfo); }, [tournamentId]);

  useEffect(() => {
    const unsub = subscribeToMatch(tournamentId, matchId, (data) => {
      setMatch(data); setLoading(false);
    });
    return () => unsub();
  }, [tournamentId, matchId]);

  useEffect(() => { saveScore(matchId, localA, localB); }, [matchId, localA, localB]);

  function triggerFlash(side, type) {
    if (side === "A") { setFlashA(type); setTimeout(() => setFlashA(null), 300); }
    else              { setFlashB(type); setTimeout(() => setFlashB(null), 300); }
  }

  function showToast(msg, type = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  }

  function handleUndoPointA() {
    if (localA > 0) {
      setLocalA(localA - 1);
      triggerFlash("A", "minus");
    }
  }

  function handleUndoPointB() {
    if (localB > 0) {
      setLocalB(localB - 1);
      triggerFlash("B", "minus");
    }
  }

  async function handlePointScored(scoringTeam) {
    if (!match || match.winner || saving || !match.teamA || !match.teamB) return;
    
    setSaving(true);
    try {
      const newScoreA = scoringTeam === "A" ? localA + 1 : localA;
      const newScoreB = scoringTeam === "B" ? localB + 1 : localB;
      
      const result = recordPoint(match, scoringTeam, newScoreA, newScoreB);
      
      setLocalA(newScoreA);
      setLocalB(newScoreB);
      triggerFlash(scoringTeam, "plus");
      
      if (result.gameEnded) {
        // Game auto-ended - record the set win
        const m = { ...match, sets: [...match.sets] };
        recordSetWin(m, result.winner, { [m.matchId]: m }, result.scoreA, result.scoreB);
        
        await updateMatch(tournamentId, m);
        
        if (m.winner && m.nextMatchId) {
          const { getDoc, doc } = await import("firebase/firestore");
          const { db } = await import("../firebase");
          const snap = await getDoc(doc(db, "tournaments", tournamentId, "matches", m.nextMatchId));
          if (snap.exists()) {
            const nm = snap.data();
            if (nm.fromMatchA === m.matchId) nm.teamA = m.winner;
            else nm.teamB = m.winner;
            await updateNextMatch(tournamentId, nm);
          }
        }
        
        if (m.winner && !m.nextMatchId) await setChampion(tournamentId, m.winner);
        
        clearScore(matchId);
        setLocalA(0); setLocalB(0);
        showToast(`🎉 ${result.winner === "A" ? match.teamA : match.teamB} wins the game! Set recorded.`);
      } else {
        showToast(`Point: ${match.teamA} ${newScoreA} - ${match.teamB} ${newScoreB}`);
      }
    } catch (err) {
      console.error(err);
      showToast("Failed to record point. Try again.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleFaultServing() {
    if (!match || match.winner || saving || !match.teamA || !match.teamB) return;
    
    setSaving(true);
    try {
      const m = { ...match, sets: [...match.sets] };
      const faultResult = recordFault(m);
      
      const servingIs = faultResult.servingTeam === "A" ? match.teamA : match.teamB;
      const isFirstServer = faultResult.firstServer ? "1st server" : "2nd server";
      
      await updateMatch(tournamentId, m);
      showToast(`⚠️ Fault! Now: ${servingIs} serving (${isFirstServer})`);
    } catch (err) {
      console.error(err);
      showToast("Failed to record fault. Try again.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleUndo() {
    if (!match || match.sets.length === 0 || saving) return;
    setSaving(true);
    try {
      const m = { ...match, sets: [...match.sets] };
      const hadWinner = !!m.winner; const nextId = m.nextMatchId;
      undoLastSet(m, { [m.matchId]: m });
      await updateMatch(tournamentId, m);
      if (hadWinner && nextId) {
        const { getDoc, doc } = await import("firebase/firestore");
        const { db } = await import("../firebase");
        const snap = await getDoc(doc(db, "tournaments", tournamentId, "matches", nextId));
        if (snap.exists()) {
          const nm = snap.data();
          if (nm.fromMatchA === m.matchId) nm.teamA = null; else nm.teamB = null;
          nm.winner = null; nm.loser = null; nm.sets = [];
          await updateNextMatch(tournamentId, nm);
        }
      }
      clearScore(matchId); setLocalA(0); setLocalB(0);
      showToast("Last set undone ↩");
    } catch (err) { console.error(err); }
    setSaving(false);
  }

  if (loading) return (
    <div className="sp-loading">
      <div className="sp-loading-ball"><PickleballSVG size={60}/></div>
      <p>Loading match...</p>
    </div>
  );
  if (!match) return (
    <div className="sp-loading"><p>Match not found.</p></div>
  );

  const { teamA, teamB, sets = [], winner, format } = match;
  const needed = setsNeeded(format);
  const total  = setsTotal(format);
  const winsA  = sets.filter(s => s.winner === "A").length;
  const winsB  = sets.filter(s => s.winner === "B").length;

  function initials(name) {
    if (!name) return "?";
    return name.split(" ").map(w => w[0]).join("").slice(0,2).toUpperCase();
  }
  function formatLabel() {
    if (format === "bo3") return "Best of 3";
    if (format === "bo5") return "Best of 5";
    return "Single Game";
  }

  return (
    <div className="sp-page">

      {/* ── BACKGROUND ── */}
      <div className="sp-bg" aria-hidden="true">
        <svg className="sp-bg-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
          {[15,30,45,60,75,90].map(y=>(
            <line key={`h${y}`} x1="0" y1={y} x2="100" y2={y} stroke="#c8e63a" strokeWidth="0.2" opacity="0.06"/>
          ))}
          {[20,40,60,80].map(x=>(
            <line key={`v${x}`} x1={x} y1="0" x2={x} y2="100" stroke="#c8e63a" strokeWidth="0.2" opacity="0.06"/>
          ))}
          <line x1="0" y1="50" x2="100" y2="50" stroke="#c8e63a" strokeWidth="0.5" opacity="0.1"/>
          <line x1="0" y1="22" x2="100" y2="22" stroke="#c8e63a" strokeWidth="0.3" opacity="0.08" strokeDasharray="2 3"/>
          <line x1="0" y1="78" x2="100" y2="78" stroke="#c8e63a" strokeWidth="0.3" opacity="0.08" strokeDasharray="2 3"/>
          <rect x="5" y="5" width="90" height="90" fill="none" stroke="#c8e63a" strokeWidth="0.4" opacity="0.08"/>
          <circle cx="50" cy="50" r="10" fill="none" stroke="#c8e63a" strokeWidth="0.3" opacity="0.06"/>
        </svg>
        {/* floating balls */}
        {[
          {x:8,y:15,s:32,d:12,dl:0},{x:88,y:20,s:24,d:9,dl:2},
          {x:5,y:70,s:40,d:15,dl:1},{x:90,y:75,s:28,d:11,dl:3},
          {x:50,y:5,s:20,d:8,dl:1.5},{x:45,y:92,s:36,d:13,dl:0.5},
        ].map((b,i)=>(
          <div key={i} className="sp-float-ball" style={{
            left:`${b.x}%`,top:`${b.y}%`,width:b.s,height:b.s,
            animationDuration:`${b.d}s`,animationDelay:`${b.dl}s`
          }}>
            <PickleballSVG size={b.s}/>
          </div>
        ))}
      </div>

      {/* ── HEADER ── */}
      <div className="sp-header">
        <div className="sp-header-left">
          <div className="sp-ball-icon"><PickleballSVG size={22}/></div>
          <div>
            <div className="sp-tournament-name">{tournamentInfo?.name ?? "Tournament"}</div>
            <div className="sp-match-meta">{matchId} · {formatLabel()}</div>
          </div>
        </div>
        <div style={{display: "flex", alignItems: "center", gap: "12px"}}>
          <button 
            onClick={() => setShowRules(true)}
            style={{
              background: "none", border: "none", cursor: "pointer",
              fontSize: "1.2rem", color: "var(--text-muted)", 
              transition: "color 0.2s", padding: "6px 10px",
              borderRadius: "8px"
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = "var(--pickle)"}
            onMouseLeave={(e) => e.currentTarget.style.color = "var(--text-muted)"}
            title="Pickleball Rules"
          >
            📚
          </button>
          {saving ? (
            <div className="sp-saving-badge">
              <div className="sp-saving-dot"/>Saving...
            </div>
          ) : (
            <div className="sp-live-badge">● LIVE</div>
          )}
        </div>
      </div>

      {/* ── WINNER STATE ── */}
      {winner ? (
        <div className="sp-winner-screen">
          <div className="sp-winner-ball"><PickleballSVG size={80}/></div>
          <div className="sp-winner-trophy">🏆</div>
          <div className="sp-winner-name">{winner}</div>
          <div className="sp-winner-sub">wins the match and advances!</div>
          <div className="sp-winner-sets">
            {sets.map((s,i) => (
              <div key={i} className={`sp-winner-set-chip ${s.winner==="A"?"chip-a":"chip-b"}`}>
                Set {i+1}: {s.winner==="A"?teamA:teamB}
                {s.scoreA !== undefined ? ` · ${s.scoreA}–${s.scoreB}` : ""}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="sp-content">

          {/* ── SCOREBOARD ── */}
          <div className="sp-scoreboard">

            {/* Team A */}
            <div className="sp-team-panel sp-team-a">
              <div className="sp-team-avatar sp-avatar-a">{initials(teamA)}</div>
              <div className="sp-team-name">
                {teamA || "TBD"}
                {match.currentGame?.servingTeam === "A" && (
                  <div style={{fontSize: "0.7rem", color: "var(--pickle)", marginTop: "4px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.5px"}}>
                    {match.currentGame.firstServer ? "🎾 1ST SERVER" : "🎾 2ND SERVER"}
                  </div>
                )}
              </div>
              <div className={`sp-score-ring ${flashA==="plus"?"sp-flash-plus":flashA==="minus"?"sp-flash-minus":""}`}>
                <span className="sp-score-num">{localA}</span>
              </div>
              <div style={{width: "100%", marginTop: "12px", gap: "8px", display: "flex", flexDirection: "column"}}>
                <button 
                  className="sp-score-btn sp-btn-plus" 
                  onClick={() => handlePointScored("A")} 
                  disabled={saving || !teamB || match.currentGame?.servingTeam !== "A"}
                  style={{width: "100%", fontSize: "1rem", opacity: (match.currentGame?.servingTeam !== "A") ? 0.4 : 1, cursor: (match.currentGame?.servingTeam !== "A") ? "not-allowed" : "pointer"}}
                >
                  <span>POINT</span>
                </button>
                <button 
                  className="sp-score-btn sp-btn-minus" 
                  onClick={() => handleUndoPointA()}
                  disabled={localA === 0}
                  style={{width: "100%", fontSize: "0.9rem", opacity: localA === 0 ? 0.4 : 1, cursor: localA === 0 ? "not-allowed" : "pointer"}}
                >
                  <span>UNDO (−1)</span>
                </button>
              </div>
              {format !== "bo1" && (
                <div className="sp-set-pips">
                  {Array.from({length:needed}).map((_,i)=>(
                    <span key={i} className={`sp-pip ${i<winsA?"sp-pip-a":""}`}/>
                  ))}
                </div>
              )}
            </div>

            {/* Center VS */}
            <div className="sp-vs-col">
              <div className="sp-vs-text">VS</div>
              <button 
                className="sp-score-btn sp-btn-minus"
                onClick={() => handleFaultServing()}
                disabled={saving || !teamB}
                style={{marginTop: "auto", marginBottom: "auto", fontSize: "0.75rem", width: "56px", height: "56px"}}
                title="Fault by serving team"
              >
                <span>⚠️</span>
                <span>FAULT</span>
              </button>
              {format !== "bo1" && (
                <>
                  <div className="sp-set-dots">
                    {Array.from({length:total}).map((_,i)=>{
                      const s = sets[i];
                      return <div key={i} className={`sp-set-dot ${s?.winner==="A"?"spd-a":s?.winner==="B"?"spd-b":"spd-empty"}`}/>;
                    })}
                  </div>
                  <div className="sp-tally">{winsA}–{winsB}</div>
                </>
              )}
            </div>

            {/* Team B */}
            <div className="sp-team-panel sp-team-b">
              <div className="sp-team-avatar sp-avatar-b">{initials(teamB)}</div>
              <div className="sp-team-name">
                {teamB || "TBD"}
                {match.currentGame?.servingTeam === "B" && (
                  <div style={{fontSize: "0.7rem", color: "var(--pickle)", marginTop: "4px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.5px"}}>
                    {match.currentGame.firstServer ? "🎾 1ST SERVER" : "🎾 2ND SERVER"}
                  </div>
                )}
              </div>
              <div className={`sp-score-ring ${flashB==="plus"?"sp-flash-plus":flashB==="minus"?"sp-flash-minus":""}`}>
                <span className="sp-score-num">{localB}</span>
              </div>
              <div style={{width: "100%", marginTop: "12px", gap: "8px", display: "flex", flexDirection: "column"}}>
                <button 
                  className="sp-score-btn sp-btn-plus" 
                  onClick={() => handlePointScored("B")} 
                  disabled={saving || !teamB || match.currentGame?.servingTeam !== "B"}
                  style={{width: "100%", marginTop: "0", fontSize: "1rem", background: "linear-gradient(145deg, #2a1500, #1c0f00)", borderColor: "#f9731655", opacity: (match.currentGame?.servingTeam !== "B") ? 0.4 : 1, cursor: (match.currentGame?.servingTeam !== "B") ? "not-allowed" : "pointer"}}
                >
                  <span>POINT</span>
                </button>
                <button 
                  className="sp-score-btn sp-btn-minus" 
                  onClick={() => handleUndoPointB()}
                  disabled={localB === 0}
                  style={{width: "100%", fontSize: "0.9rem", opacity: localB === 0 ? 0.4 : 1, cursor: localB === 0 ? "not-allowed" : "pointer"}}
                >
                  <span>UNDO (−1)</span>
                </button>
              </div>
              {format !== "bo1" && (
                <div className="sp-set-pips">
                  {Array.from({length:needed}).map((_,i)=>(
                    <span key={i} className={`sp-pip ${i<winsB?"sp-pip-b":""}`}/>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── UNDO ── */}
          <div className="sp-undo-row">
            <button className="sp-undo-btn" onClick={handleUndo} disabled={sets.length===0||saving}>
              ↩ Undo last set
            </button>
          </div>

          {/* ── SET HISTORY ── */}
          {sets.length > 0 && (
            <div className="sp-history">
              <div className="sp-history-label">Set History</div>
              <div className="sp-history-chips">
                {sets.map((s,i)=>(
                  <div key={i} className={`sp-history-chip ${s.winner==="A"?"spch-a":"spch-b"}`}>
                    <span className="spch-num">Set {i+1}</span>
                    <span className="spch-name">{s.winner==="A"?teamA:teamB}</span>
                    {s.scoreA!==undefined && <span className="spch-score">{s.scoreA}–{s.scoreB}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── SERVING INFO ── */}
          {match?.currentGame && (
            <div style={{
              padding: "12px 16px", background: "rgba(200,230,58,0.08)", borderTop: "1px solid var(--border)",
              display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.85rem"
            }}>
              <div>
                <span style={{color: "var(--text-muted)"}}>Currently Serving: </span>
                <span style={{color: "var(--pickle)", fontWeight: "700"}}>
                  {match.currentGame.servingTeam === "A" ? teamA : teamB}
                </span>
              </div>
              <div>
                <span style={{color: "var(--text-muted)", fontSize: "0.75rem", textTransform: "uppercase"}}>
                  {match.currentGame.firstServer ? "1st Server" : "2nd Server"} • {match.currentGame.servingSide === "right" ? "Right" : "Left"} Court
                </span>
              </div>
            </div>
          )}

        </div>
      )}

      {/* ── TOAST ── */}
      {toast && (
        <div className={`sp-toast ${toast.type==="error"?"sp-toast-err":"sp-toast-ok"}`}>
          {toast.msg}
        </div>
      )}

      {/* ── RULES MODAL ── */}
      {showRules && <RulesReference onClose={() => setShowRules(false)} />}
    </div>
  );
}
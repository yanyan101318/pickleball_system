// src/components/ScoreModal.jsx
import { useState, useEffect } from "react";
import { setsNeeded, setsTotal, isGameWon, getGameWinner } from "../utils/bracketGenerator";

function getStoredScore(matchId) {
  try {
    const raw = localStorage.getItem(`score_${matchId}`);
    if (raw) {
      const p = JSON.parse(raw);
      return { a: p.a ?? 0, b: p.b ?? 0 };
    }
  } catch (_) {}
  return { a: 0, b: 0 };
}

function saveScore(matchId, a, b) {
  try { localStorage.setItem(`score_${matchId}`, JSON.stringify({ a, b })); } catch (_) {}
}

function clearScore(matchId) {
  try { localStorage.removeItem(`score_${matchId}`); } catch (_) {}
}

export default function ScoreModal({ match, onSetWin, onUndo, onFault, onClose }) {
  const { teamA, teamB, sets = [], winner, format, matchId } = match;
  const needed = setsNeeded(format);
  const total  = setsTotal(format);
  const winsA  = sets.filter(s => s.winner === "A").length;
  const winsB  = sets.filter(s => s.winner === "B").length;

  const [localA, setLocalA] = useState(() => getStoredScore(matchId).a);
  const [localB, setLocalB] = useState(() => getStoredScore(matchId).b);
  const [flashA, setFlashA] = useState(null); // 'plus' | 'minus' | null
  const [flashB, setFlashB] = useState(null);
  const [autoGameEnded, setAutoGameEnded] = useState(false);

  useEffect(() => {
    const saved = getStoredScore(matchId);
    setLocalA(saved.a);
    setLocalB(saved.b);
  }, [matchId]);

  useEffect(() => { saveScore(matchId, localA, localB); }, [matchId, localA, localB]);

  // Auto-detect when game ends
  useEffect(() => {
    if (isGameWon(localA, localB) && !autoGameEnded && (localA > 0 || localB > 0)) {
      setAutoGameEnded(true);
      const winningTeam = getGameWinner(localA, localB);
      // Trigger auto set win after a brief delay for UI feedback
      setTimeout(() => {
        onSetWin(match, winningTeam, localA, localB);
        clearScore(matchId);
        setLocalA(0);
        setLocalB(0);
        setAutoGameEnded(false);
      }, 500);
    }
  }, [localA, localB, autoGameEnded, match, onSetWin, matchId]);

  function triggerFlash(side, type) {
    if (side === "A") { setFlashA(type); setTimeout(() => setFlashA(null), 300); }
    else              { setFlashB(type); setTimeout(() => setFlashB(null), 300); }
  }

  function handlePointScored(scoringTeam) {
    const newScoreA = scoringTeam === "A" ? localA + 1 : localA;
    const newScoreB = scoringTeam === "B" ? localB + 1 : localB;
    
    setLocalA(newScoreA);
    setLocalB(newScoreB);
    triggerFlash(scoringTeam, "plus");
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

  function handleFaultServing(e) {
    e.preventDefault();
    e.stopPropagation();
    if (onFault) {
      onFault(match);
    }
  }

  function handleUndo() {
    onUndo(match);
    clearScore(matchId);
    setLocalA(0); setLocalB(0);
  }

  function formatLabel() {
    if (format === "bo3") return "Best of 3";
    if (format === "bo5") return "Best of 5";
    return "Single Game";
  }

  function initials(name) {
    if (!name) return "?";
    return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  }

  function setWinnerName(s) {
    if (s.winner === "A") return teamA;
    if (s.winner === "B") return teamB;
    return s.winner;
  }

  const hasUnsaved = (localA > 0 || localB > 0) && !winner;

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">

        {/* Header */}
        <div className="modal-hdr">
          <div className="modal-hdr-left">
            <span className="modal-match-id">{matchId}</span>
            <span className="modal-format-tag">{formatLabel()}</span>
            {hasUnsaved && <span className="score-saved-badge">● Score saved locally</span>}
          </div>
          <div className="modal-hdr-actions" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {onUndo && !winner && (localA > 0 || localB > 0) && (
              <button
                type="button"
                className="modal-close"
                style={{ fontSize: "0.75rem", padding: "6px 10px", width: "auto" }}
                onClick={handleUndo}
                title="Clear local score and notify bracket"
              >
                Reset score
              </button>
            )}
            <button className="modal-close" onClick={onClose}>✕</button>
          </div>
        </div>

        {/* Game Status and Serving Info */}
        {!winner && (localA > 0 || localB > 0) && (
          <div className="modal-game-info">
            <div className="game-info-row">
              <div className="game-status">
                <span className="status-label">🎮 Game Status</span>
                {isGameWon(localA, localB) ? (
                  <span className="status-value ready">🎯 Auto-Recording...</span>
                ) : localA >= 10 || localB >= 10 ? (
                  <span className="status-value close">⚡ Close (need 2-point lead)</span>
                ) : (
                  <span className="status-value playing">Playing ({Math.max(localA, localB)} pts)</span>
                )}
              </div>
              <div className="serving-info">
                <span className="serving-label">🎾 Serving</span>
                <span className="serving-value">
                  {match.currentGame?.servingTeam === "A" ? teamA : teamB}
                  {match.currentGame?.servingSide && ` (${match.currentGame.servingSide === "right" ? "▶" : "◀"})`}
                  {match.currentGame?.firstServer ? " [1st]" : " [2nd]"}
                </span>
              </div>
            </div>
          </div>
        )}

        {winner ? (
          <div className="winner-state">
            <div className="winner-crown-big">🏆</div>
            <div className="winner-state-name">{winner}</div>
            <div className="winner-state-sub">wins the match and advances!</div>
            <div className="winner-sets-recap">
              {sets.map((s, i) => (
                <span key={i} className={`set-chip-recap ${s.winner === "A" ? "chip-a" : "chip-b"}`}>
                  Set {i + 1}: {setWinnerName(s)}{s.scoreA !== undefined ? ` (${s.scoreA}–${s.scoreB})` : ""}
                </span>
              ))}
            </div>
            <button className="modal-close-btn" onClick={onClose}>Close</button>
          </div>
        ) : (
          <>
            {/* Score panels */}
            <div className="score-panels">

              {/* Team A */}
              <div className="score-panel panel-a">
                <div className="panel-avatar avatar-a">{initials(teamA)}</div>
                <div className="panel-name">
                  {teamA}
                  {match.currentGame?.servingTeam === "A" && (
                    <div style={{fontSize: "0.7rem", color: "var(--pickle)", marginTop: "4px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.5px"}}>
                      {match.currentGame.firstServer ? "🎾 1ST SERVER" : "🎾 2ND SERVER"}
                    </div>
                  )}
                </div>

                {/* Big score with flash ring */}
                <div className={`panel-score-wrap ${flashA === "plus" ? "flash-plus" : flashA === "minus" ? "flash-minus" : ""}`}>
                  <div className="panel-big-score">{localA}</div>
                </div>

                {/* Button Group - POINT and UNDO */}
                <div className="score-btn-group" style={{width: "100%", marginTop: "12px", gap: "8px", flexDirection: "column"}}>
                  <button 
                    className="score-action-btn btn-plus" 
                    onClick={() => handlePointScored("A")}
                    disabled={match.currentGame?.servingTeam !== "A"}
                    style={{width: "100%", fontSize: "1rem", opacity: match.currentGame?.servingTeam !== "A" ? 0.4 : 1, cursor: match.currentGame?.servingTeam !== "A" ? "not-allowed" : "pointer"}}
                  >
                    <span>POINT</span>
                  </button>
                  <button 
                    className="score-action-btn btn-minus" 
                    onClick={() => handleUndoPointA()}
                    disabled={localA === 0}
                    style={{width: "100%", fontSize: "0.9rem", opacity: localA === 0 ? 0.4 : 1, cursor: localA === 0 ? "not-allowed" : "pointer"}}
                  >
                    <span>UNDO (−1)</span>
                  </button>
                </div>

                {format !== "bo1" && (
                  <div className="panel-set-wins">
                    {Array.from({ length: needed }).map((_, i) => (
                      <span key={i} className={`set-pip-lg ${i < winsA ? "pip-filled-a" : ""}`}/>
                    ))}
                  </div>
                )}
              </div>

              {/* Center */}
              <div className="score-center">
                <div className="score-center-vs">VS</div>
                <button 
                  className="score-action-btn btn-minus"
                  onClick={(e) => handleFaultServing(e)}
                  disabled={!onFault}
                  style={{marginTop: "auto", marginBottom: "auto", fontSize: "0.75rem", width: "56px", height: "56px", opacity: !onFault ? 0.5 : 1, cursor: !onFault ? "not-allowed" : "pointer"}}
                  title="Fault by serving team"
                >
                  <span>⚠️</span>
                </button>
                {format !== "bo1" && (
                  <>
                    <div className="score-center-sets">
                      {Array.from({ length: total }).map((_, i) => {
                        const s = sets[i];
                        return <div key={i} className={`center-pip ${s?.winner === "A" ? "cpip-a" : s?.winner === "B" ? "cpip-b" : "cpip-empty"}`}/>;
                      })}
                    </div>
                    <div className="score-center-tally">{winsA} – {winsB}</div>
                  </>
                )}
              </div>

              {/* Team B */}
              <div className="score-panel panel-b">
                <div className="panel-avatar avatar-b">{initials(teamB)}</div>
                <div className="panel-name">
                  {teamB}
                  {match.currentGame?.servingTeam === "B" && (
                    <div style={{fontSize: "0.7rem", color: "var(--pickle)", marginTop: "4px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.5px"}}>
                      {match.currentGame.firstServer ? "🎾 1ST SERVER" : "🎾 2ND SERVER"}
                    </div>
                  )}
                </div>

                <div className={`panel-score-wrap ${flashB === "plus" ? "flash-plus" : flashB === "minus" ? "flash-minus" : ""}`}>
                  <div className="panel-big-score">{localB}</div>
                </div>

                {/* Button Group - POINT and UNDO */}
                <div className="score-btn-group" style={{width: "100%", marginTop: "12px", gap: "8px", flexDirection: "column"}}>
                  <button 
                    className="score-action-btn btn-plus" 
                    onClick={() => handlePointScored("B")}
                    disabled={match.currentGame?.servingTeam !== "B"}
                    style={{width: "100%", fontSize: "1rem", background: "linear-gradient(145deg, #2a1500, #1c0f00)", borderColor: "#f9731655", opacity: match.currentGame?.servingTeam !== "B" ? 0.4 : 1, cursor: match.currentGame?.servingTeam !== "B" ? "not-allowed" : "pointer"}}
                  >
                    <span>POINT (+1)</span>
                  </button>
                  <button 
                    className="score-action-btn btn-minus" 
                    onClick={() => handleUndoPointB()}
                    disabled={localB === 0}
                    style={{width: "100%", fontSize: "0.9rem", opacity: localB === 0 ? 0.4 : 1, cursor: localB === 0 ? "not-allowed" : "pointer"}}
                  >
                    <span>UNDO (−1)</span>
                  </button>
                </div>

                {format !== "bo1" && (
                  <div className="panel-set-wins">
                    {Array.from({ length: needed }).map((_, i) => (
                      <span key={i} className={`set-pip-lg ${i < winsB ? "pip-filled-b" : ""}`}/>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Set history */}
            {sets.length > 0 && (
              <div className="sets-history">
                <div className="sh-label">Set history</div>
                <div className="sh-chips">
                  {sets.map((s, i) => (
                    <div key={i} className={`sh-chip ${s.winner === "A" ? "sh-chip-a" : "sh-chip-b"}`}>
                      Set {i + 1} — {setWinnerName(s)}{s.scoreA !== undefined ? ` (${s.scoreA}–${s.scoreB})` : ""}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
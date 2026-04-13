// src/pages/ViewerPage.jsx
import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { subscribeToMatches, subscribeToTournamentInfo } from "../services/tournamentService";
import { setsNeeded } from "../utils/bracketGenerator";

const ROUND_LABELS = ["Round 1","Quarterfinals","Semifinals","Final","Grand Final"];

function PickleballSVG({ size=40 }) {
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

function getSizeClass(count) {
  if (count <= 4)  return "vc-xl";
  if (count <= 8)  return "vc-lg";
  if (count <= 16) return "vc-md";
  if (count <= 32) return "vc-sm";
  return "vc-xs";
}

function getMaxCols(matchCount, sizeClass) {
  if (sizeClass === "vc-xl") return 2;
  if (sizeClass === "vc-lg") return 3;
  if (sizeClass === "vc-md") return 4;
  return Math.min(matchCount, 6);
}

function getRoundLabel(i, total) {
  return i < ROUND_LABELS.length ? ROUND_LABELS[i] : `Round ${i+1}`;
}

function buildRounds(matchMap) {
  const matches = Object.values(matchMap);
  if (!matches.length) return [];
  const maxRound = Math.max(...matches.map(m=>m.round||1));
  const rounds = [];
  for (let r=1; r<=maxRound; r++) {
    const rm = matches.filter(m=>m.round===r).sort((a,b)=>
      parseInt(a.matchId.split("-M")[1]) - parseInt(b.matchId.split("-M")[1])
    );
    if (rm.length) rounds.push(rm);
  }
  return rounds;
}

export default function ViewerPage() {
  const { tournamentId } = useParams();
  const [matchMap, setMatchMap] = useState({});
  const [info, setInfo]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [flashId, setFlashId]   = useState(null);

  useEffect(() => {
    const unsubInfo    = subscribeToTournamentInfo(tournamentId, setInfo);
    const unsubMatches = subscribeToMatches(tournamentId, (incoming) => {
      setMatchMap(prev => {
        const changed = Object.keys(incoming).find(id =>
          JSON.stringify(incoming[id]) !== JSON.stringify(prev[id])
        );
        if (changed) { setFlashId(changed); setTimeout(()=>setFlashId(null),1800); }
        return incoming;
      });
      setLoading(false);
    });
    return ()=>{ unsubInfo(); unsubMatches(); };
  }, [tournamentId]);

  if (loading) return (
    <div className="vp2-loading">
      <div className="vp2-loading-ball"><PickleballSVG size={72}/></div>
      <div className="vp2-loading-text">Loading bracket...</div>
      <div className="vp2-dots"><span/><span/><span/></div>
    </div>
  );

  if (!info) return (
    <div className="vp2-loading"><div className="vp2-loading-text">Tournament not found.</div></div>
  );

  const rounds       = buildRounds(matchMap);
  const allMatches   = Object.values(matchMap);
  const totalMatches = allMatches.length;
  const doneMatches  = allMatches.filter(m=>m.winner).length;
  const liveMatches  = allMatches.filter(m=>!m.winner&&(m.sets||[]).length>0);
  const progressPct  = totalMatches>0 ? Math.round((doneMatches/totalMatches)*100) : 0;
  const sizeClass    = getSizeClass(totalMatches);
  const timeStr      = new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});

  return (
    <div className="vp2-page">

      {/* BACKGROUND */}
      <div className="vp2-bg" aria-hidden="true">
        <svg className="vp2-court-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
          <rect x="4" y="4" width="92" height="92" fill="none" stroke="#c8e63a" strokeWidth="0.25" opacity="0.1"/>
          <line x1="4" y1="50" x2="96" y2="50" stroke="#c8e63a" strokeWidth="0.5" opacity="0.12"/>
          <line x1="4" y1="25" x2="96" y2="25" stroke="#c8e63a" strokeWidth="0.2" opacity="0.07" strokeDasharray="1.5 2.5"/>
          <line x1="4" y1="75" x2="96" y2="75" stroke="#c8e63a" strokeWidth="0.2" opacity="0.07" strokeDasharray="1.5 2.5"/>
          <line x1="50" y1="25" x2="50" y2="75" stroke="#c8e63a" strokeWidth="0.2" opacity="0.06" strokeDasharray="1 2"/>
          <circle cx="50" cy="50" r="10" fill="none" stroke="#c8e63a" strokeWidth="0.25" opacity="0.06"/>
          <circle cx="50" cy="50" r="4"  fill="none" stroke="#c8e63a" strokeWidth="0.15" opacity="0.05"/>
          <circle cx="4"  cy="50" r="0.8" fill="#c8e63a" opacity="0.2"/>
          <circle cx="96" cy="50" r="0.8" fill="#c8e63a" opacity="0.2"/>
          <path d="M4 12 L4 4 L12 4"    fill="none" stroke="#c8e63a" strokeWidth="0.4" opacity="0.15"/>
          <path d="M88 4 L96 4 L96 12"  fill="none" stroke="#c8e63a" strokeWidth="0.4" opacity="0.15"/>
          <path d="M4 88 L4 96 L12 96"  fill="none" stroke="#c8e63a" strokeWidth="0.4" opacity="0.15"/>
          <path d="M88 96 L96 96 L96 88" fill="none" stroke="#c8e63a" strokeWidth="0.4" opacity="0.15"/>
        </svg>
        {[
          {x:2,y:5,s:44,d:18,dl:0},{x:90,y:8,s:32,d:14,dl:2.5},
          {x:4,y:85,s:52,d:20,dl:1},{x:88,y:82,s:38,d:16,dl:3},
          {x:48,y:2,s:26,d:12,dl:1.5},{x:50,y:92,s:30,d:15,dl:0.5},
        ].map((b,i)=>(
          <div key={i} className="vp2-float-ball" style={{left:`${b.x}%`,top:`${b.y}%`,width:b.s,height:b.s,animationDuration:`${b.d}s`,animationDelay:`${b.dl}s`}}>
            <PickleballSVG size={b.s}/>
          </div>
        ))}
      </div>

      {/* HEADER */}
      <div className="vp2-header">
        <div className="vp2-header-left">
          <div className="vp2-logo-wrap"><PickleballSVG size={36}/></div>
          <div className="vp2-title-block">
            <h1 className="vp2-title">{info.name}</h1>
            <div className="vp2-subtitle">
              {info.format==="bo1"?"Single Game":info.format==="bo3"?"Best of 3":"Best of 5"}
              <span className="vp2-dot-sep">·</span>
              {totalMatches} matches
              <span className="vp2-dot-sep">·</span>
              <span className="vp2-live-badge">● LIVE</span>
            </div>
          </div>
        </div>

        <div className="vp2-header-right">
          <div className="vp2-progress-block">
            <svg viewBox="0 0 44 44" className="vp2-ring-svg">
              <circle cx="22" cy="22" r="18" fill="none" stroke="#2a3348" strokeWidth="3.5"/>
              <circle cx="22" cy="22" r="18" fill="none" stroke="#c8e63a" strokeWidth="3.5"
                strokeDasharray={`${2*Math.PI*18*progressPct/100} ${2*Math.PI*18}`}
                strokeLinecap="round" transform="rotate(-90 22 22)"
                style={{transition:"stroke-dasharray 0.6s ease"}}
              />
              <text x="22" y="26" textAnchor="middle" fontSize="9" fill="#e2e8f0" fontFamily="Bebas Neue,sans-serif" letterSpacing="0.5">
                {progressPct}%
              </text>
            </svg>
            <div className="vp2-progress-label">
              <span className="vp2-progress-done">{doneMatches}</span>
              <span className="vp2-progress-total">/{totalMatches}</span>
            </div>
          </div>
          {liveMatches.length>0 && (
            <div className="vp2-live-count">
              <div className="vp2-live-count-dot"/>
              <span>{liveMatches.length} in progress</span>
            </div>
          )}
          <div className="vp2-clock">{timeStr}</div>
        </div>
      </div>

      {/* CHAMPION */}
      {info.champion && (
        <div className="vp2-champion">
          <div className="vp2-champ-balls"><PickleballSVG size={44}/></div>
          <div className="vp2-champ-content">
            <div className="vp2-champ-crown">👑</div>
            <div className="vp2-champ-name">{info.champion}</div>
            <div className="vp2-champ-sub">TOURNAMENT CHAMPION</div>
          </div>
          <div className="vp2-champ-balls" style={{transform:"scaleX(-1)"}}><PickleballSVG size={44}/></div>
        </div>
      )}

      {/* BRACKET */}
      <div className="vp2-bracket-area">
        {rounds.map((round, rIdx) => (
          <div key={rIdx} className="vp2-round-section">
            <div className="vp2-round-header">
              <div className="vp2-round-line"/>
              <div className="vp2-round-title">{getRoundLabel(rIdx, rounds.length)}</div>
              <div className="vp2-round-line"/>
            </div>
            <div
              className={`vp2-matches-grid ${sizeClass}`}
              style={{gridTemplateColumns:`repeat(${Math.min(round.length, getMaxCols(round.length, sizeClass))}, 1fr)`}}
            >
              {round.map(match=>(
                <ViewerCard2 key={match.matchId} match={match} format={info.format} sizeClass={sizeClass} isFlashing={flashId===match.matchId}/>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* FOOTER */}
      <div className="vp2-footer">
        <div className="vp2-footer-ball"><PickleballSVG size={16}/></div>
        <span>Scores update automatically</span>
        <span className="vp2-dot-sep">·</span>
        <span className="vp2-footer-id">{tournamentId}</span>
      </div>
    </div>
  );
}

function ViewerCard2({ match, format, sizeClass, isFlashing }) {
  const { teamA, teamB, sets=[], winner, matchId } = match;
  const needed    = setsNeeded(format);
  const winsA     = sets.filter(s=>s.winner==="A").length;
  const winsB     = sets.filter(s=>s.winner==="B").length;
  const isPending = !teamA || !teamB;
  const isFinished= !!winner;
  const isLive    = !isFinished && sets.length>0;
  const isBig     = sizeClass==="vc-xl"||sizeClass==="vc-lg";

  function initials(n) {
    if (!n) return "?";
    return n.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();
  }

  return (
    <div className={`vp2-card ${sizeClass} ${isFinished?"vp2-done":isLive?"vp2-live":isPending?"vp2-pending":""} ${isFlashing?"vp2-flash":""}`}>

      <div className="vp2-card-topbar">
        <span className="vp2-card-id">{matchId}</span>
        {isLive     && <span className="vp2-status-pill vp2-pill-live">● LIVE</span>}
        {isFinished && <span className="vp2-status-pill vp2-pill-done">✓</span>}
        {isPending  && <span className="vp2-status-pill vp2-pill-wait">TBD</span>}
      </div>

      <div className="vp2-card-body">
        {/* Team A */}
        <div className={`vp2-side vp2-side-a ${winner===teamA?"vp2-side-win":winner&&winner!==teamA?"vp2-side-lose":""}`}>
          {isBig && <div className="vp2-team-avatar vp2-av-a">{initials(teamA)}</div>}
          <div className="vp2-team-info">
            <div className="vp2-team-nm">{teamA||"TBD"}</div>
            {format!=="bo1" && (
              <div className="vp2-team-pips">
                {Array.from({length:needed}).map((_,i)=>(
                  <span key={i} className={`vp2-pip ${i<winsA?"vp2-pip-a":""}`}/>
                ))}
              </div>
            )}
          </div>
          {isFinished&&winner===teamA&&<span className="vp2-winner-crown">👑</span>}
        </div>

        {/* Center */}
        <div className="vp2-center-col">
          {format!=="bo1" ? (
            <div className="vp2-score-display">
              <span className={`vp2-big-num ${winner===teamA?"vp2-num-win":""}`}>{winsA}</span>
              <span className="vp2-num-sep">–</span>
              <span className={`vp2-big-num ${winner===teamB?"vp2-num-win":""}`}>{winsB}</span>
            </div>
          ) : (
            <div className="vp2-vs-badge">VS</div>
          )}
          {isLive&&<div className="vp2-live-indicator">● live</div>}
        </div>

        {/* Team B */}
        <div className={`vp2-side vp2-side-b ${winner===teamB?"vp2-side-win":winner&&winner!==teamB?"vp2-side-lose":""}`}>
          {isBig && <div className="vp2-team-avatar vp2-av-b">{initials(teamB)}</div>}
          <div className="vp2-team-info vp2-info-right">
            <div className="vp2-team-nm">{teamB||"TBD"}</div>
            {format!=="bo1" && (
              <div className="vp2-team-pips">
                {Array.from({length:needed}).map((_,i)=>(
                  <span key={i} className={`vp2-pip ${i<winsB?"vp2-pip-b":""}`}/>
                ))}
              </div>
            )}
          </div>
          {isFinished&&winner===teamB&&<span className="vp2-winner-crown">👑</span>}
        </div>
      </div>

      {/* Set details for big cards */}
      {isBig&&sets.length>0&&(
        <div className="vp2-set-detail">
          {sets.map((s,i)=>(
            <div key={i} className={`vp2-set-chip ${s.winner==="A"?"vp2-sc-a":"vp2-sc-b"}`}>
              <span className="vp2-set-num">S{i+1}</span>
              {s.scoreA!==undefined&&<span>{s.scoreA}–{s.scoreB}</span>}
              <span className="vp2-set-winner">{s.winner==="A"?teamA:teamB}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
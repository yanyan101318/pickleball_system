// src/pages/AdminPage.jsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import SetupForm from "../components/SetupForm";
import BracketView from "../components/BracketView";
import { generateBracket, recordSetWin, undoLastSet } from "../utils/bracketGenerator";
import { getShareOrigin } from "../utils/shareUrl";
import { copyText } from "../utils/clipboard";
import {
  createTournament,
  updateMatch,
  updateNextMatch,
  setChampion,
  generateTournamentId,
  subscribeToMatches,
  subscribeToTournamentInfo,
} from "../services/tournamentService";
import { getStoredScoringMode } from "../utils/scoringModeStorage";

export default function AdminPage() {
  const [tournament, setTournament] = useState(null);
  const [matchMap, setMatchMap] = useState({});
  const [info, setInfo] = useState(null);
  const [saving, setSaving] = useState(false);
  const [tournamentId, setTournamentId] = useState(null);
  const navigate = useNavigate();

  async function copyBracketLink() {
    const shareOrigin = await getShareOrigin();
    await copyText(`${shareOrigin}/bracket/${tournamentId}`);
  }

  // Subscribe to Firebase updates when tournament is loaded
  useEffect(() => {
    if (!tournamentId) return;

    const unsubInfo = subscribeToTournamentInfo(tournamentId, (data) => {
      setInfo(data);
    });
    const unsubMatches = subscribeToMatches(tournamentId, (matches) => {
      setMatchMap(matches);
    });

    return () => {
      unsubInfo();
      unsubMatches();
    };
  }, [tournamentId]);

  async function handleStart(name, teams, format, tournamentFormat, scoringMode) {
    setSaving(true);
    try {
      const { rounds, matchMap } = generateBracket(teams, format, tournamentFormat || "single-elimination");
      const tId = generateTournamentId(name);
      await createTournament(tId, name, format, matchMap, tournamentFormat || "single-elimination", scoringMode);
      setTournamentId(tId);
      setTournament({ name, format });
      // matchMap will be loaded from Firebase subscription
    } catch (err) {
      console.error("Error creating tournament:", err);
      alert("Failed to save tournament. Check your Firestore connection.");
    }
    setSaving(false);
  }

  async function handleSetWin(match, winner, scoreA, scoreB) {
    const m = { ...matchMap[match.matchId] };
    const clonedMap = { ...matchMap, [m.matchId]: m };
    const mode = getStoredScoringMode(m.matchId, info?.scoringMode ?? "traditional");
    recordSetWin(m, winner, clonedMap, scoreA, scoreB, mode);

    try {
      // Save to Firestore
      await updateMatch(tournamentId, m);
      if (m.winner && m.nextMatchId) {
        await updateNextMatch(tournamentId, clonedMap[m.nextMatchId]);
      }
      // If final match done, save champion
      if (m.winner && !m.nextMatchId) {
        await setChampion(tournamentId, m.winner);
      }
    } catch (err) {
      console.error("Error saving set:", err);
      alert("Failed to save. Please try again.");
    }
  }

  async function handleUndo(match) {
    const m = { ...matchMap[match.matchId] };
    const hadWinner = !!m.winner;
    const nextId = m.nextMatchId;
    const clonedMap = { ...matchMap, [m.matchId]: m };
    undoLastSet(m, clonedMap);

    try {
      await updateMatch(tournamentId, m);
      if (hadWinner && nextId) {
        await updateNextMatch(tournamentId, clonedMap[nextId]);
      }
    } catch (err) {
      console.error("Error undoing set:", err);
      alert("Failed to undo. Please try again.");
    }
  }

  async function handlePersistMatch(match) {
    try {
      await updateMatch(tournamentId, match);
    } catch (err) {
      console.error("Error saving match:", err);
      alert("Failed to save. Please try again.");
    }
  }

  function handleReset() {
    setTournament(null);
    setTournamentId(null);
    setMatchMap({});
    setInfo(null);
  }

  if (saving) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <p>Saving tournament to Firebase...</p>
      </div>
    );
  }

  // Build rounds from matchMap
  const rounds = buildRounds(matchMap);
  const isLoading = tournament && !info;

  return (
    <div className="app">
      {!tournament ? (
        <SetupForm onStart={handleStart} />
      ) : isLoading ? (
        <div className="loading-screen">
          <div className="loading-spinner" />
          <p>Loading tournament from Firebase...</p>
        </div>
      ) : (
        <>
          {/* Share links panel */}
          <div className="share-panel">
            <div className="share-panel-inner">
              <div className="share-item">
                <span className="share-label">🔗 Bracket Viewer</span>
                <code className="share-url">{window.location.origin}/bracket/{tournamentId}</code>
                <button className="copy-btn" onClick={copyBracketLink}>Copy</button>
              </div>
              <div className="share-item">
                <span className="share-label">📋 Scorer Links</span>
                <button
                  className="copy-btn"
                  onClick={() => navigate(`/bracket/${tournamentId}`)}
                >
                  Open Viewer
                </button>
              </div>
            </div>
          </div>

          <BracketView
            tournamentName={tournament.name}
            rounds={rounds}
            format={tournament.format}
            tournamentId={tournamentId}
            scoringMode={info?.scoringMode ?? "traditional"}
            onSetWin={handleSetWin}
            onUndo={handleUndo}
            onPersistMatch={handlePersistMatch}
            onReset={handleReset}
            isAdmin={true}
          />
        </>
      )}
    </div>
  );
}

// Rebuild ordered rounds from flat matchMap
function buildRounds(matchMap) {
  const matches = Object.values(matchMap);
  if (matches.length === 0) return [];
  const maxRound = Math.max(...matches.map((m) => m.round || 1));
  const rounds = [];
  for (let r = 1; r <= maxRound; r++) {
    const roundMatches = matches
      .filter((m) => m.round === r)
      .sort((a, b) => {
        const numA = parseInt(a.matchId.split("-M")[1]);
        const numB = parseInt(b.matchId.split("-M")[1]);
        return numA - numB;
      });
    if (roundMatches.length > 0) rounds.push(roundMatches);
  }
  return rounds;
}
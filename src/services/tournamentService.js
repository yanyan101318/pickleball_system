// src/services/tournamentService.js
import {
  doc, getDoc, updateDoc, onSnapshot,
  collection, writeBatch,
} from "firebase/firestore";
import { db } from "../firebase";

export async function createTournament(tournamentId, name, format, matchMap, tournamentFormat, scoringMode) {
  const batch = writeBatch(db);
  const infoRef = doc(db, "tournaments", tournamentId);
  batch.set(infoRef, {
    name,
    format,
    tournamentFormat: tournamentFormat || "single-elimination",
    scoringMode: scoringMode === "rally" ? "rally" : "traditional",
    createdAt: Date.now(),
    champion: null,
  });
  Object.values(matchMap).forEach(match => {
    const matchRef = doc(db, "tournaments", tournamentId, "matches", match.matchId);
    batch.set(matchRef, sanitizeMatch(match));
  });
  await batch.commit();
}

export async function updateMatch(tournamentId, match) {
  const matchRef = doc(db, "tournaments", tournamentId, "matches", match.matchId);
  await updateDoc(matchRef, sanitizeMatch(match));
}

export async function updateNextMatch(tournamentId, nextMatch) {
  const matchRef = doc(db, "tournaments", tournamentId, "matches", nextMatch.matchId);
  await updateDoc(matchRef, sanitizeMatch(nextMatch));
}

export async function setChampion(tournamentId, champion) {
  const infoRef = doc(db, "tournaments", tournamentId);
  await updateDoc(infoRef, { champion });
}

export function subscribeToMatches(tournamentId, callback) {
  const matchesRef = collection(db, "tournaments", tournamentId, "matches");
  return onSnapshot(matchesRef, snapshot => {
    const matches = {};
    snapshot.forEach(doc => { matches[doc.id] = doc.data(); });
    callback(matches);
  });
}

export function subscribeToMatch(tournamentId, matchId, callback) {
  const matchRef = doc(db, "tournaments", tournamentId, "matches", matchId);
  return onSnapshot(matchRef, snap => { if (snap.exists()) callback(snap.data()); });
}

export function subscribeToTournamentInfo(tournamentId, callback) {
  const infoRef = doc(db, "tournaments", tournamentId);
  return onSnapshot(infoRef, snap => { if (snap.exists()) callback(snap.data()); });
}

export async function getTournamentInfo(tournamentId) {
  const infoRef = doc(db, "tournaments", tournamentId);
  const snap = await getDoc(infoRef);
  return snap.exists() ? snap.data() : null;
}

function sanitizeMatch(match) {
  const clean = {};
  for (const [k, v] of Object.entries(match)) {
    clean[k] = v === undefined ? null : v;
  }
  return clean;
}

export function generateTournamentId(name) {
  const slug = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  const rand = Math.random().toString(36).slice(2, 7);
  return `${slug}-${rand}`;
}
/** Must match court booking UI grid (1h starts). */
export const TIME_SLOTS = [
  "06:00 AM", "07:00 AM", "08:00 AM", "09:00 AM", "10:00 AM", "11:00 AM",
  "12:00 PM", "01:00 PM", "02:00 PM", "03:00 PM", "04:00 PM", "05:00 PM",
  "06:00 PM", "07:00 PM", "08:00 PM", "09:00 PM",
];

export const EXTEND_OPTIONS = [0.5, 1, 1.5, 2];

export function slotStartIndex(timeSlot) {
  const i = TIME_SLOTS.indexOf(timeSlot);
  return i >= 0 ? i : -1;
}

/** Each listed slot is one hour; duration uses wall-clock hours (ceil to whole slots). */
export function hoursToOccupiedSlotCount(durationHours) {
  const d = Number(durationHours);
  if (!Number.isFinite(d) || d <= 0) return 1;
  return Math.max(1, Math.ceil(d));
}

export function occupiedSlotIndices(timeSlot, durationHours) {
  const start = slotStartIndex(timeSlot);
  if (start < 0) return [];
  const n = hoursToOccupiedSlotCount(durationHours);
  const out = [];
  for (let j = 0; j < n; j++) out.push(start + j);
  return out;
}

export function indicesOverlap(a, b) {
  const setA = new Set(a);
  for (const x of b) {
    if (setA.has(x)) return true;
  }
  return false;
}

/**
 * @param {object} p
 * @param {string} p.timeSlot
 * @param {number} p.duration
 * @param {number} p.extendHours
 * @param {string} p.courtId
 * @param {string} p.date
 * @param {string} p.excludeBookingId
 * @param {Array<{ id: string, courtId?: string, date?: string, timeSlot?: string, duration?: number, status?: string }>} p.others
 */
export function canExtendBooking(p) {
  const { timeSlot, duration, extendHours, courtId, date, excludeBookingId, others } = p;
  const add = Number(extendHours);
  if (!Number.isFinite(add) || add <= 0) {
    return { ok: false, reason: "Choose a valid extension length." };
  }
  const newDur = Number(duration) + add;
  const start = slotStartIndex(timeSlot);
  if (start < 0) return { ok: false, reason: "Invalid start time." };
  const myIdx = occupiedSlotIndices(timeSlot, newDur);
  const endExclusive = start + myIdx.length;
  if (endExclusive > TIME_SLOTS.length) {
    return { ok: false, reason: "Extension would go past the last available slot." };
  }

  const active = (s) => {
    const x = String(s || "").toLowerCase();
    return x === "pending" || x === "approved";
  };

  for (const ob of others || []) {
    if (!ob || ob.id === excludeBookingId) continue;
    if (ob.courtId !== courtId || ob.date !== date) continue;
    if (!active(ob.status)) continue;
    const oidx = occupiedSlotIndices(ob.timeSlot, ob.duration ?? 1);
    if (oidx.length && indicesOverlap(myIdx, oidx)) {
      return { ok: false, reason: "The next time is already booked." };
    }
  }
  return { ok: true, newDuration: newDur, newIndices: myIdx };
}

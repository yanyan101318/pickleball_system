import { doc, runTransaction, serverTimestamp } from "firebase/firestore";
import { roundMoney } from "./bookingMoney";

/**
 * Upsert `customers/{userId}` after a booking (increments counts, refreshes contact fields).
 * @param {import("firebase/firestore").Firestore} db
 * @param {{ userId: string, fullName: string, contactNumber: string, email?: string|null, amountApplied: number }} payload
 */
export async function upsertCustomerAfterBooking(db, payload) {
  const { userId, fullName, contactNumber, email, amountApplied } = payload;
  if (!userId) return;

  const ref = doc(db, "customers", userId);
  const applied = roundMoney(amountApplied);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const prev = snap.exists() ? snap.data() : {};
    const nextBookings = (Number(prev.totalBookings) || 0) + 1;
    const nextSpent = roundMoney((Number(prev.totalAmountSpent) || 0) + applied);

    const emailNext =
      email != null && String(email).trim() !== ""
        ? String(email).trim()
        : prev.email != null
          ? String(prev.email)
          : "";

    tx.set(
      ref,
      {
        userId,
        fullName: String(fullName || prev.fullName || "").trim() || "—",
        contactNumber: String(contactNumber || prev.contactNumber || "").trim() || "—",
        email: emailNext,
        totalBookings: nextBookings,
        totalAmountSpent: nextSpent,
        updatedAt: serverTimestamp(),
        ...(snap.exists() ? {} : { createdAt: serverTimestamp() }),
      },
      { merge: true }
    );
  });
}

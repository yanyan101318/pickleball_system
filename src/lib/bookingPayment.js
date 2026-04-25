import { roundMoney } from "./bookingMoney";

export const PLAN_FULL = "full";
export const PLAN_PARTIAL = "downpayment";
export const PLAN_LATER = "pay_later";

/** Customer billing state (separate from payment doc approval workflow). */
export const CUSTOMER_PAY_PAID = "paid";
export const CUSTOMER_PAY_PARTIAL = "partial";
export const CUSTOMER_PAY_UNPAID = "unpaid";

/**
 * @param {"full"|"downpayment"|"pay_later"} plan
 * @param {number} total
 * @param {number} partialParsed
 */
export function resolveAmountPaid(plan, total, partialParsed) {
  const t = roundMoney(total);
  if (plan === PLAN_LATER) return 0;
  if (plan === PLAN_FULL) return t;
  return roundMoney(partialParsed);
}

export function resolveRemaining(total, amountPaid) {
  return roundMoney(Math.max(0, roundMoney(total) - roundMoney(amountPaid)));
}

/**
 * @param {"full"|"downpayment"|"pay_later"} plan
 * @param {number} total
 * @param {number} amountPaid
 */
export function resolveCustomerPayStatus(plan, total, amountPaid) {
  const t = roundMoney(total);
  const a = roundMoney(amountPaid);
  if (plan === PLAN_LATER) return CUSTOMER_PAY_UNPAID;
  if (a <= 0) return CUSTOMER_PAY_UNPAID;
  if (a + 1e-9 >= t) return CUSTOMER_PAY_PAID;
  return CUSTOMER_PAY_PARTIAL;
}

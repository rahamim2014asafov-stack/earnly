import type { Opportunity } from "./types";

// Comparison assumptions, not a prediction of the listing's actual workload.
const HOURS_PER_DAY = 8;
const DAYS_PER_WEEK = 5;
const DAYS_PER_MONTH = 20;

export const PAY_COMPARISON_HELP =
  "USD/day equivalent: 8 hours/day, 5 days/week, 20 days/month; fixed pay counts as one day.";

/** A common comparison scale; leave the original amount/unit for display. */
export function dailyPay(pay: Opportunity["pay"]): number {
  switch (pay.unit) {
    case "fixed": return pay.amount;
    case "per hour": return pay.amount * HOURS_PER_DAY;
    case "per week": return pay.amount / DAYS_PER_WEEK;
    case "per month": return pay.amount / DAYS_PER_MONTH;
  }
}

export function meetsMinimumPay(pay: Opportunity["pay"], minimum: number): boolean {
  return minimum <= 0 || dailyPay(pay) >= minimum;
}

/** Array.sort comparator: highest daily equivalent first, ties left stable. */
export function comparePay(a: Opportunity, b: Opportunity): number {
  return dailyPay(b.pay) - dailyPay(a.pay);
}

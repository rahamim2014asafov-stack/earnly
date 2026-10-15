import { beforeEach, describe, expect, it, vi } from "vitest";
import { comparePay, dailyPay, meetsMinimumPay } from "@/lib/pay";
import type { Opportunity, PayUnit } from "@/lib/types";

const data = vi.hoisted(() => ({ listings: [] as Opportunity[] }));
vi.mock("@/lib/data", () => ({ OPPORTUNITIES: data.listings }));
const { DEFAULT_PREFS, runSearch } = await import("@/lib/ai");

function listing(id: string, amount: number, unit: PayUnit): Opportunity {
  return {
    id, kind: "task", title: id, org: "Example", orgKind: "Business",
    category: "Other", summary: "Demo", description: "Demo", pay: { amount, unit },
    mode: "Remote", location: "Remote", skills: [], postedDaysAgo: 0,
    deadlineDays: 7, match: 60, matchReasons: [],
  };
}

beforeEach(() => { data.listings.length = 0; });

describe("daily pay comparisons", () => {
  it.each([
    [150, "fixed", 150], [15, "per hour", 120],
    [200, "per week", 40], [500, "per month", 25],
  ] as const)("converts %s %s to %s USD/day", (amount, unit, expected) => {
    const pay = { amount, unit };
    expect(dailyPay(pay)).toBe(expected);
    expect(pay).toEqual({ amount, unit });
  });

  // Hand-written boundaries: no production conversion is used to make fixtures.
  const boundaries: [PayUnit, number, number, number, number][] = [
    ["fixed", 25, 24, 25, 26], ["per hour", 25, 3, 3.125, 3.25],
    ["per week", 25, 120, 125, 130], ["per month", 25, 480, 500, 520],
    ["fixed", 50, 49, 50, 51], ["per hour", 50, 6, 6.25, 6.5],
    ["per week", 50, 245, 250, 255], ["per month", 50, 980, 1000, 1020],
  ];
  it.each(boundaries)("checks %s around %s+ inclusively", (unit, minimum, below, at, above) => {
    expect(meetsMinimumPay({ amount: below, unit }, minimum)).toBe(false);
    expect(meetsMinimumPay({ amount: at, unit }, minimum)).toBe(true);
    expect(meetsMinimumPay({ amount: above, unit }, minimum)).toBe(true);
  });

  it("orders the original mixed-unit example by daily equivalent", () => {
    const source = [listing("monthly", 500, "per month"), listing("hourly", 15, "per hour"),
      listing("weekly", 200, "per week"), listing("fixed", 150, "fixed")];
    expect([...source].sort(comparePay).map((o) => o.id)).toEqual([
      "fixed", "hourly", "weekly", "monthly",
    ]);
    expect(source[0].pay).toEqual({ amount: 500, unit: "per month" });
    expect(meetsMinimumPay(source[1].pay, 50)).toBe(true);
  });

  it("keeps equivalent pay tied and does not exclude zero pay with Any", () => {
    const fixed = listing("fixed", 25, "fixed");
    const monthly = listing("monthly", 500, "per month");
    expect(comparePay(fixed, monthly)).toBe(0);
    expect([monthly, fixed].sort(comparePay).map((o) => o.id)).toEqual(["monthly", "fixed"]);
    for (const unit of ["fixed", "per hour", "per week", "per month"] as const) {
      expect(meetsMinimumPay({ amount: 0, unit }, 0)).toBe(true);
      expect(meetsMinimumPay({ amount: 0, unit }, 25)).toBe(false);
    }
  });
});

describe("AI search uses the same pay scale", () => {
  it.each([
    { minimum: 25, pairs: [[24, 25], [3, 3.125], [120, 125], [480, 500]] },
    { minimum: 50, pairs: [[49, 50], [6, 6.25], [245, 250], [980, 1000]] },
  ])("filters all units at $minimum+ and explains the same minimum", ({ minimum, pairs }) => {
    const units: PayUnit[] = ["fixed", "per hour", "per week", "per month"];
    units.forEach((unit, i) => {
      data.listings.push(listing(`${unit}-below`, pairs[i][0], unit));
      data.listings.push(listing(`${unit}-at`, pairs[i][1], unit));
    });
    const results = runSearch({ ...DEFAULT_PREFS, minPay: minimum });
    expect(results.map((o) => o.id)).toEqual(units.map((unit) => `${unit}-at`));
    for (const result of results) {
      expect(result.why).toContain(`Meets your $${minimum}/day equivalent minimum`);
      expect(result.match).toBe(60);
    }
  });

  it("keeps Any unfiltered and preserves the original pay fields", () => {
    data.listings.push(listing("unpaid", 0, "fixed"), listing("monthly", 500, "per month"));
    const results = runSearch(DEFAULT_PREFS);
    expect(results.map((o) => o.id)).toEqual(["unpaid", "monthly"]);
    expect(results[1].pay).toEqual({ amount: 500, unit: "per month" });
    expect(results[1].why.join(" ")).not.toContain("minimum");
  });

  it("preserves the explicit pay-type preference bonus", () => {
    data.listings.push(listing("fixed", 50, "fixed"), listing("hourly", 6.25, "per hour"));
    expect(runSearch({ ...DEFAULT_PREFS, minPay: 50, payType: "hourly" }).map((o) => o.id))
      .toEqual(["hourly", "fixed"]);
    expect(runSearch({ ...DEFAULT_PREFS, minPay: 50, payType: "fixed" }).map((o) => o.id))
      .toEqual(["fixed", "hourly"]);
  });
});

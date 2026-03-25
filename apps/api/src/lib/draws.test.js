import test from "node:test";
import assert from "node:assert/strict";
import { calculatePrizeBreakdown } from "./draws.js";

test("calculatePrizeBreakdown splits prize pools using the PRD percentages", () => {
  const db = {
    meta: { rolloverJackpot: 100 },
    plans: {
      monthly: { billingMonths: 1, price: 20, prizePoolPercent: 0.3 }
    }
  };
  const subscribers = [
    { subscription: { planId: "monthly" } },
    { subscription: { planId: "monthly" } }
  ];

  const result = calculatePrizeBreakdown(db, subscribers);

  assert.equal(result.totalPrizeContribution, 12);
  assert.equal(result.tiers.match5, 104.8);
  assert.equal(result.tiers.match4, 4.2);
  assert.equal(result.tiers.match3, 3);
});

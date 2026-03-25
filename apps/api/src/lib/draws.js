import { randomUUID } from "crypto";
import { currentMonthKey } from "./domain.js";

function uniqueRandomNumbers(count, min = 1, max = 45) {
  const values = new Set();
  while (values.size < count) {
    values.add(Math.floor(Math.random() * (max - min + 1)) + min);
  }
  return [...values].sort((a, b) => a - b);
}

function weightedNumbers(users) {
  const frequency = new Map();

  for (const user of users) {
    for (const score of user.scores || []) {
      frequency.set(score.value, (frequency.get(score.value) || 0) + 1);
    }
  }

  const ranked = [...frequency.entries()]
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .slice(0, 12)
    .map(([value]) => value);

  if (ranked.length < 5) {
    return uniqueRandomNumbers(5);
  }

  return ranked.slice(0, 5).sort((a, b) => a - b);
}

export function generateDrawNumbers(users, mode) {
  return mode === "algorithmic" ? weightedNumbers(users) : uniqueRandomNumbers(5);
}

export function calculatePrizeBreakdown(db, activeSubscribers) {
  const totalPrizeContribution = activeSubscribers.reduce((sum, user) => {
    const plan = db.plans[user.subscription.planId];
    const monthlyValue = plan.billingMonths === 12 ? plan.price / 12 : plan.price;
    return sum + monthlyValue * plan.prizePoolPercent;
  }, 0);

  const jackpotBase = totalPrizeContribution * 0.4 + (db.meta.rolloverJackpot || 0);
  return {
    totalPrizeContribution: roundMoney(totalPrizeContribution),
    tiers: {
      match5: roundMoney(jackpotBase),
      match4: roundMoney(totalPrizeContribution * 0.35),
      match3: roundMoney(totalPrizeContribution * 0.25)
    }
  };
}

export function runDraw(db, mode, publish = false, drawDate = new Date()) {
  const activeSubscribers = db.users.filter(
    (user) => user.role === "subscriber" && user.subscription?.status === "active" && (user.scores || []).length === 5
  );
  const entrantUserIds = activeSubscribers.map((user) => user.id);
  const numbers = generateDrawNumbers(activeSubscribers, mode);
  const prizeBreakdown = calculatePrizeBreakdown(db, activeSubscribers);

  const winners = activeSubscribers
    .map((user) => {
      const picks = user.scores.map((score) => score.value).sort((a, b) => a - b);
      const matches = picks.filter((value) => numbers.includes(value)).length;
      if (matches < 3) {
        return null;
      }
      return {
        id: randomUUID(),
        userId: user.id,
        matches,
        picks,
        verificationStatus: "not_submitted",
        paymentStatus: "pending",
        amount: 0
      };
    })
    .filter(Boolean);

  const grouped = {
    5: winners.filter((winner) => winner.matches === 5),
    4: winners.filter((winner) => winner.matches === 4),
    3: winners.filter((winner) => winner.matches === 3)
  };

  const distribute = (bucket, pool) => {
    if (!bucket.length) {
      return [];
    }
    const each = roundMoney(pool / bucket.length);
    return bucket.map((winner) => ({ ...winner, amount: each }));
  };

  const computedWinners = [
    ...distribute(grouped[5], prizeBreakdown.tiers.match5),
    ...distribute(grouped[4], prizeBreakdown.tiers.match4),
    ...distribute(grouped[3], prizeBreakdown.tiers.match3)
  ];

  const rolloverJackpot = grouped[5].length ? 0 : prizeBreakdown.tiers.match5;
  const draw = {
    id: randomUUID(),
    monthKey: currentMonthKey(drawDate),
    drawDate: new Date(drawDate).toISOString(),
    mode,
    numbers,
    status: publish ? "published" : "simulated",
    entrantUserIds,
    prizeBreakdown,
    winners: computedWinners
  };

  return { draw, rolloverJackpot };
}

function roundMoney(value) {
  return Number(value.toFixed(2));
}

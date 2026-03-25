import { randomUUID } from "crypto";

export const SCORE_MIN = 1;
export const SCORE_MAX = 45;
export const MIN_CHARITY_PERCENT = 10;

export function normalizeScores(scores) {
  return [...scores]
    .sort((a, b) => new Date(b.playedAt) - new Date(a.playedAt))
    .slice(0, 5);
}

export function validateScoreInput(value, playedAt) {
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < SCORE_MIN || numeric > SCORE_MAX) {
    throw new Error("Score must be an integer between 1 and 45.");
  }

  if (!playedAt || Number.isNaN(Date.parse(playedAt))) {
    throw new Error("A valid score date is required.");
  }

  return {
    id: randomUUID(),
    value: numeric,
    playedAt
  };
}

export function ensureCharityPercent(percent) {
  const numeric = Number(percent);
  if (Number.isNaN(numeric) || numeric < MIN_CHARITY_PERCENT || numeric > 100) {
    throw new Error(`Charity contribution must be between ${MIN_CHARITY_PERCENT}% and 100%.`);
  }
  return numeric;
}

export function addMonths(dateInput, months) {
  const date = new Date(dateInput);
  date.setMonth(date.getMonth() + months);
  return date.toISOString().slice(0, 10);
}

export function currentMonthKey(dateInput = new Date()) {
  const date = new Date(dateInput);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function sanitizeUser(user) {
  const { passwordHash, ...safe } = user;
  return safe;
}


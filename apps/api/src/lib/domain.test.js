import test from "node:test";
import assert from "node:assert/strict";
import { normalizeScores } from "./domain.js";

test("normalizeScores keeps only the latest five scores in reverse chronological order", () => {
  const scores = [
    { id: "1", value: 20, playedAt: "2026-03-01" },
    { id: "2", value: 21, playedAt: "2026-03-02" },
    { id: "3", value: 22, playedAt: "2026-03-03" },
    { id: "4", value: 23, playedAt: "2026-03-04" },
    { id: "5", value: 24, playedAt: "2026-03-05" },
    { id: "6", value: 25, playedAt: "2026-03-06" }
  ];

  const result = normalizeScores(scores);

  assert.equal(result.length, 5);
  assert.deepEqual(
    result.map((entry) => entry.id),
    ["6", "5", "4", "3", "2"]
  );
});


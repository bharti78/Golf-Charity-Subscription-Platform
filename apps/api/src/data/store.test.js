import test from "node:test";
import assert from "node:assert/strict";
import { readDb } from "./store.js";

test("readDb loads seeded data from SQLite", async () => {
  const db = await readDb();

  assert.ok(db.plans.monthly);
  assert.ok(db.charities.length >= 1);
  assert.ok(db.users.find((user) => user.email === "admin@golfcharity.local"));
});

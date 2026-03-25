import { readFileSync } from "fs";
import { DatabaseSync } from "node:sqlite";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, "../../data");
const seedPath = path.join(dataDir, "seed-db.json");
const dbPath = path.join(dataDir, "app.db");
const sqlite = new DatabaseSync(dbPath);
sqlite.exec("PRAGMA foreign_keys = ON");

function parseJson(value, fallback) {
  if (!value) {
    return fallback;
  }
  return JSON.parse(value);
}

function createSchema() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS plans (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      billingMonths INTEGER NOT NULL,
      prizePoolPercent REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS charities (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL,
      image TEXT,
      location TEXT,
      upcomingEvent TEXT,
      upcomingEventsJson TEXT,
      featured INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      passwordHash TEXT NOT NULL,
      role TEXT NOT NULL,
      stripeCustomerId TEXT,
      stripeSubscriptionId TEXT,
      charityId TEXT,
      charityPercentage REAL NOT NULL DEFAULT 10,
      totalWon REAL NOT NULL DEFAULT 0,
      subscriptionPlanId TEXT,
      subscriptionStatus TEXT,
      subscriptionRenewalDate TEXT,
      subscriptionStartedAt TEXT,
      subscriptionCancelledAt TEXT,
      FOREIGN KEY (charityId) REFERENCES charities(id) ON DELETE SET NULL,
      FOREIGN KEY (subscriptionPlanId) REFERENCES plans(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS scores (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      value INTEGER NOT NULL,
      playedAt TEXT NOT NULL,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS donations (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      charityId TEXT NOT NULL,
      amount REAL NOT NULL,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (charityId) REFERENCES charities(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS draws (
      id TEXT PRIMARY KEY,
      monthKey TEXT NOT NULL,
      drawDate TEXT NOT NULL,
      mode TEXT NOT NULL,
      status TEXT NOT NULL,
      numbersJson TEXT NOT NULL,
      entrantUserIdsJson TEXT,
      prizeBreakdownJson TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS draw_winners (
      id TEXT PRIMARY KEY,
      drawId TEXT NOT NULL,
      userId TEXT NOT NULL,
      matches INTEGER NOT NULL,
      picksJson TEXT NOT NULL,
      verificationStatus TEXT NOT NULL,
      paymentStatus TEXT NOT NULL,
      amount REAL NOT NULL,
      FOREIGN KEY (drawId) REFERENCES draws(id) ON DELETE CASCADE,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS winner_claims (
      id TEXT PRIMARY KEY,
      drawId TEXT NOT NULL,
      userId TEXT NOT NULL,
      proofUrl TEXT NOT NULL,
      proofFilename TEXT,
      mimeType TEXT,
      status TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (drawId) REFERENCES draws(id) ON DELETE CASCADE,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      userId TEXT,
      status TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      monthKey TEXT,
      payloadJson TEXT,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE SET NULL
    );
  `);
}

function isSeeded() {
  const row = sqlite.prepare("SELECT COUNT(*) AS count FROM plans").get();
  return row.count > 0;
}

function ensureColumn(table, column, definition) {
  const columns = sqlite.prepare(`PRAGMA table_info(${table})`).all();
  if (!columns.some((entry) => entry.name === column)) {
    sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function seedDatabase() {
  const raw = readFileSync(seedPath, "utf8");
  const seed = JSON.parse(raw);
  persistDb(seed);
}

function syncSeedCharities() {
  const raw = readFileSync(seedPath, "utf8");
  const seed = JSON.parse(raw);
  const existingIds = new Set(
    sqlite.prepare("SELECT id FROM charities").all().map((row) => row.id)
  );

  const insertCharity = sqlite.prepare(
    "INSERT INTO charities (id, name, slug, description, image, location, upcomingEvent, upcomingEventsJson, featured) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
  );

  for (const charity of seed.charities || []) {
    if (existingIds.has(charity.id)) {
      continue;
    }

    insertCharity.run(
      charity.id,
      charity.name,
      charity.slug,
      charity.description,
      charity.image || null,
      charity.location || null,
      charity.upcomingEvent || null,
      JSON.stringify(charity.upcomingEvents || (charity.upcomingEvent ? [charity.upcomingEvent] : [])),
      charity.featured ? 1 : 0
    );
  }
}

function persistDb(db) {
  try {
    sqlite.exec("BEGIN");
    sqlite.exec(`
      DELETE FROM notifications;
      DELETE FROM winner_claims;
      DELETE FROM draw_winners;
      DELETE FROM draws;
      DELETE FROM donations;
      DELETE FROM scores;
      DELETE FROM users;
      DELETE FROM charities;
      DELETE FROM plans;
      DELETE FROM meta;
    `);

    const insertMeta = sqlite.prepare("INSERT INTO meta (key, value) VALUES (?, ?)");
    const insertPlan = sqlite.prepare(
      "INSERT INTO plans (id, name, price, billingMonths, prizePoolPercent) VALUES (?, ?, ?, ?, ?)"
    );
    const insertCharity = sqlite.prepare(
      "INSERT INTO charities (id, name, slug, description, image, location, upcomingEvent, upcomingEventsJson, featured) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );
    const insertUser = sqlite.prepare(`
      INSERT INTO users (
        id, name, email, passwordHash, role, stripeCustomerId, stripeSubscriptionId,
        charityId, charityPercentage, totalWon,
        subscriptionPlanId, subscriptionStatus, subscriptionRenewalDate, subscriptionStartedAt, subscriptionCancelledAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertScore = sqlite.prepare(
      "INSERT INTO scores (id, userId, value, playedAt) VALUES (?, ?, ?, ?)"
    );
    const insertDonation = sqlite.prepare(
      "INSERT INTO donations (id, userId, charityId, amount, createdAt) VALUES (?, ?, ?, ?, ?)"
    );
    const insertDraw = sqlite.prepare(
      "INSERT INTO draws (id, monthKey, drawDate, mode, status, numbersJson, entrantUserIdsJson, prizeBreakdownJson) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    );
    const insertWinner = sqlite.prepare(`
      INSERT INTO draw_winners (
        id, drawId, userId, matches, picksJson, verificationStatus, paymentStatus, amount
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertClaim = sqlite.prepare(
      "INSERT INTO winner_claims (id, drawId, userId, proofUrl, proofFilename, mimeType, status, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    );
    const insertNotification = sqlite.prepare(`
      INSERT INTO notifications (id, type, userId, status, createdAt, monthKey, payloadJson)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    for (const [key, value] of Object.entries(db.meta || {})) {
      insertMeta.run(key, JSON.stringify(value));
    }

    for (const plan of Object.values(db.plans || {})) {
      insertPlan.run(plan.id, plan.name, plan.price, plan.billingMonths, plan.prizePoolPercent);
    }

    for (const charity of db.charities || []) {
      insertCharity.run(
        charity.id,
        charity.name,
        charity.slug,
        charity.description,
        charity.image || null,
        charity.location || null,
        charity.upcomingEvent || null,
        JSON.stringify(charity.upcomingEvents || (charity.upcomingEvent ? [charity.upcomingEvent] : [])),
        charity.featured ? 1 : 0
      );
    }

    for (const user of db.users || []) {
      insertUser.run(
        user.id,
        user.name,
        user.email,
        user.passwordHash,
        user.role,
        user.stripeCustomerId || null,
        user.stripeSubscriptionId || null,
        user.charityId || null,
        user.charityPercentage ?? 10,
        user.stats?.totalWon || 0,
        user.subscription?.planId || null,
        user.subscription?.status || null,
        user.subscription?.renewalDate || null,
        user.subscription?.startedAt || null,
        user.subscription?.cancelledAt || null
      );

      for (const score of user.scores || []) {
        insertScore.run(score.id, user.id, score.value, score.playedAt);
      }

      for (const donation of user.donations || []) {
        insertDonation.run(donation.id, user.id, donation.charityId, donation.amount, donation.createdAt);
      }
    }

    for (const draw of db.draws || []) {
      insertDraw.run(
        draw.id,
        draw.monthKey,
        draw.drawDate,
        draw.mode,
        draw.status,
        JSON.stringify(draw.numbers || []),
        JSON.stringify(draw.entrantUserIds || []),
        JSON.stringify(draw.prizeBreakdown || {})
      );

      for (const winner of draw.winners || []) {
        insertWinner.run(
          winner.id,
          draw.id,
          winner.userId,
          winner.matches,
          JSON.stringify(winner.picks || []),
          winner.verificationStatus,
          winner.paymentStatus,
          winner.amount
        );
      }
    }

    for (const claim of db.winnerClaims || []) {
      insertClaim.run(
        claim.id,
        claim.drawId,
        claim.userId,
        claim.proofUrl,
        claim.proofFilename || null,
        claim.mimeType || null,
        claim.status,
        claim.createdAt
      );
    }

    for (const notification of db.notifications || []) {
      const { id, type, userId = null, status, createdAt, monthKey = null, ...rest } = notification;
      insertNotification.run(
        id,
        type,
        userId,
        status,
        createdAt,
        monthKey,
        Object.keys(rest).length ? JSON.stringify(rest) : null
      );
    }
    sqlite.exec("COMMIT");
    return db;
  } catch (error) {
    sqlite.exec("ROLLBACK");
    throw error;
  }
}

function buildDbObject() {
  const metaRows = sqlite.prepare("SELECT key, value FROM meta").all();
  const planRows = sqlite.prepare("SELECT * FROM plans").all();
  const charityRows = sqlite.prepare("SELECT * FROM charities ORDER BY featured DESC, name ASC").all();
  const userRows = sqlite.prepare("SELECT * FROM users ORDER BY rowid DESC").all();
  const scoreRows = sqlite.prepare("SELECT * FROM scores ORDER BY playedAt DESC").all();
  const donationRows = sqlite.prepare("SELECT * FROM donations ORDER BY createdAt DESC").all();
  const drawRows = sqlite.prepare("SELECT * FROM draws ORDER BY drawDate DESC").all();
  const winnerRows = sqlite.prepare("SELECT * FROM draw_winners").all();
  const claimRows = sqlite.prepare("SELECT * FROM winner_claims ORDER BY createdAt DESC").all();
  const notificationRows = sqlite.prepare("SELECT * FROM notifications ORDER BY createdAt DESC").all();

  const plans = Object.fromEntries(
    planRows.map((row) => [
      row.id,
      {
        id: row.id,
        name: row.name,
        price: row.price,
        billingMonths: row.billingMonths,
        prizePoolPercent: row.prizePoolPercent
      }
    ])
  );

  const users = userRows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    passwordHash: row.passwordHash,
    role: row.role,
    stripeCustomerId: row.stripeCustomerId,
    stripeSubscriptionId: row.stripeSubscriptionId,
    charityId: row.charityId,
    charityPercentage: row.charityPercentage,
    subscription: row.subscriptionPlanId
      ? {
          planId: row.subscriptionPlanId,
          status: row.subscriptionStatus,
          renewalDate: row.subscriptionRenewalDate,
          startedAt: row.subscriptionStartedAt,
          cancelledAt: row.subscriptionCancelledAt
        }
      : null,
    scores: scoreRows
      .filter((score) => score.userId === row.id)
      .map((score) => ({
        id: score.id,
        value: score.value,
        playedAt: score.playedAt
      })),
    stats: {
      totalWon: row.totalWon
    },
    donations: donationRows
      .filter((donation) => donation.userId === row.id)
      .map((donation) => ({
        id: donation.id,
        charityId: donation.charityId,
        amount: donation.amount,
        createdAt: donation.createdAt
      }))
  }));

  const draws = drawRows.map((row) => ({
    id: row.id,
    monthKey: row.monthKey,
    drawDate: row.drawDate,
    mode: row.mode,
    status: row.status,
    numbers: parseJson(row.numbersJson, []),
    entrantUserIds: parseJson(row.entrantUserIdsJson, []),
    prizeBreakdown: parseJson(row.prizeBreakdownJson, {}),
    winners: winnerRows
      .filter((winner) => winner.drawId === row.id)
      .map((winner) => ({
        id: winner.id,
        userId: winner.userId,
        matches: winner.matches,
        picks: parseJson(winner.picksJson, []),
        verificationStatus: winner.verificationStatus,
        paymentStatus: winner.paymentStatus,
        amount: winner.amount
      }))
  }));

  return {
    meta: Object.fromEntries(metaRows.map((row) => [row.key, JSON.parse(row.value)])),
    plans,
    charities: charityRows.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      image: row.image,
      location: row.location,
      upcomingEvent: row.upcomingEvent,
      upcomingEvents: parseJson(row.upcomingEventsJson, row.upcomingEvent ? [row.upcomingEvent] : []),
      featured: Boolean(row.featured)
    })),
    users,
    draws,
    winnerClaims: claimRows.map((row) => ({
      id: row.id,
      drawId: row.drawId,
      userId: row.userId,
      proofUrl: row.proofUrl,
      proofFilename: row.proofFilename,
      mimeType: row.mimeType,
      status: row.status,
      createdAt: row.createdAt
    })),
    notifications: notificationRows.map((row) => ({
      id: row.id,
      type: row.type,
      userId: row.userId,
      status: row.status,
      createdAt: row.createdAt,
      monthKey: row.monthKey,
      ...parseJson(row.payloadJson, {})
    }))
  };
}

function initializeDatabase() {
  createSchema();
  ensureColumn("users", "stripeCustomerId", "TEXT");
  ensureColumn("users", "stripeSubscriptionId", "TEXT");
  ensureColumn("charities", "upcomingEventsJson", "TEXT");
  ensureColumn("draws", "entrantUserIdsJson", "TEXT");
  ensureColumn("winner_claims", "proofFilename", "TEXT");
  ensureColumn("winner_claims", "mimeType", "TEXT");
  if (!isSeeded()) {
    seedDatabase();
  } else {
    syncSeedCharities();
  }
}

initializeDatabase();

export async function readDb() {
  return buildDbObject();
}

export async function writeDb(db) {
  return persistDb(db);
}

export async function updateDb(mutator) {
  const db = buildDbObject();
  const nextDb = await mutator(db);
  return persistDb(nextDb);
}

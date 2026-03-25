import cors from "cors";
import express from "express";
import multer from "multer";
import { randomUUID } from "crypto";
import path from "path";
import { fileURLToPath } from "url";
import { promises as fs } from "fs";
import { existsSync } from "fs";
import { comparePassword, hashPassword, signToken, verifyToken } from "./lib/auth.js";
import {
  addMonths,
  currentMonthKey,
  ensureCharityPercent,
  sanitizeUser,
  validateScoreInput,
  normalizeScores
} from "./lib/domain.js";
import { readDb, updateDb } from "./data/store.js";
import { runDraw } from "./lib/draws.js";
import {
  constructWebhookEvent,
  createBillingPortalSession,
  createSubscriptionCheckoutSession,
  retrieveCheckoutSession
} from "./lib/stripe.js";
import {
  dispatchNotifications,
  queueNotification
} from "./lib/notifications.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, "../../../.env");
if (typeof process.loadEnvFile === "function" && existsSync(envPath)) {
  process.loadEnvFile(envPath);
}

const app = express();
const PORT = Number(process.env.PORT || 4000);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5173";
const uploadDir = path.resolve(__dirname, "../uploads");

await fs.mkdir(uploadDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || "").toLowerCase();
      cb(null, `${randomUUID()}${ext}`);
    }
  }),
  limits: {
    fileSize: 5 * 1024 * 1024
  },
  fileFilter: (_req, file, cb) => {
    const allowed = new Set(["image/png", "image/jpeg", "image/webp", "application/pdf"]);
    if (!allowed.has(file.mimetype)) {
      return cb(new Error("Only PNG, JPEG, WEBP, and PDF proof files are allowed."));
    }
    cb(null, true);
  }
});

app.use(cors({ origin: CLIENT_ORIGIN, credentials: true }));
app.use("/uploads", express.static(uploadDir));
app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  try {
    const signature = req.headers["stripe-signature"];
    const event = await constructWebhookEvent(req.body, signature);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const userId = session.metadata?.userId;
      const planId = session.metadata?.planId;

      if (userId && planId && session.customer && session.subscription) {
        await updateDb(async (draft) => {
          const user = draft.users.find((entry) => entry.id === userId);
          if (!user) {
            return draft;
          }
          user.stripeCustomerId = session.customer;
          user.stripeSubscriptionId = session.subscription;
          user.subscription = user.subscription || {};
          user.subscription.planId = planId;
          user.subscription.status = "active";
          user.subscription.startedAt = new Date().toISOString().slice(0, 10);
          return draft;
        });
      }
    }

    if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
      const subscription = event.data.object;
      await updateDb(async (draft) => {
        const user = draft.users.find((entry) => entry.stripeSubscriptionId === subscription.id);
        if (!user) {
          return draft;
        }
        user.subscription = user.subscription || {};
        user.subscription.status =
          subscription.status === "active" || subscription.status === "trialing" ? "active" :
          subscription.status === "canceled" ? "cancelled" :
          subscription.status === "past_due" || subscription.status === "unpaid" ? "lapsed" :
          subscription.status;
        user.subscription.renewalDate = subscription.current_period_end
          ? new Date(subscription.current_period_end * 1000).toISOString().slice(0, 10)
          : user.subscription.renewalDate;
        if (subscription.cancel_at_period_end || subscription.status === "canceled") {
          user.subscription.cancelledAt = new Date().toISOString();
        }
        return draft;
      });
    }

    if (event.type === "invoice.payment_failed") {
      const invoice = event.data.object;
      await updateDb(async (draft) => {
        const user = draft.users.find((entry) => entry.stripeCustomerId === invoice.customer);
        if (!user) {
          return draft;
        }
        user.subscription.status = "lapsed";
        return draft;
      });
    }

    res.json({ received: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
app.use(express.json());

function getTokenFromRequest(req) {
  const auth = req.headers.authorization || "";
  if (!auth.startsWith("Bearer ")) {
    return null;
  }
  return auth.slice("Bearer ".length);
}

function getEffectiveSubscriptionStatus(subscription) {
  if (!subscription) {
    return "inactive";
  }
  if (subscription.status === "cancelled") {
    return "cancelled";
  }
  if (subscription.renewalDate && new Date(subscription.renewalDate) < new Date()) {
    return "lapsed";
  }
  return subscription.status || "inactive";
}

async function authRequired(req, res, next) {
  try {
    const token = getTokenFromRequest(req);
    if (!token) {
      return res.status(401).json({ error: "Authentication required." });
    }
    const payload = verifyToken(token);
    const db = await readDb();
    const user = db.users.find((entry) => entry.id === payload.sub);
    if (!user) {
      return res.status(401).json({ error: "Session invalid." });
    }
    user.subscription.status = getEffectiveSubscriptionStatus(user.subscription);
    req.user = user;
    req.db = db;
    next();
  } catch (error) {
    return res.status(401).json({ error: "Authentication failed." });
  }
}

function subscriberAccessRequired(req, res, next) {
  if (req.user.role !== "subscriber") {
    return next();
  }
  if (getEffectiveSubscriptionStatus(req.user.subscription) !== "active") {
    return res.status(403).json({ error: "An active subscription is required for this action." });
  }
  next();
}

function adminRequired(req, res, next) {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Admin access required." });
  }
  next();
}

function fireAndForget(promise) {
  promise.catch((error) => {
    console.error("Background task failed:", error.message);
  });
}

function mapDashboard(db, user) {
  const charity = db.charities.find((entry) => entry.id === user.charityId);
  const plan = db.plans[user.subscription.planId];
  const winningDraws = db.draws.filter((draw) =>
    draw.winners.some((winner) => winner.userId === user.id)
  );
  const enteredDraws = db.draws.filter((draw) =>
    (draw.entrantUserIds || []).includes(user.id)
  );
  const currentMonth = currentMonthKey();
  const latestPublished = db.draws.find(
    (draw) => draw.status === "published" && draw.monthKey === currentMonth
  );

  return {
    profile: sanitizeUser(user),
    subscription: {
      ...user.subscription,
      status: getEffectiveSubscriptionStatus(user.subscription),
      plan
    },
    charity,
    scores: normalizeScores(user.scores || []),
    participation: {
      drawsEntered: enteredDraws.length,
      upcomingDrawMonth: currentMonth,
      latestPublishedDraw: latestPublished,
      currentlyEligible:
        user.role === "subscriber" &&
        getEffectiveSubscriptionStatus(user.subscription) === "active" &&
        (user.scores || []).length === 5
    },
    winnings: {
      totalWon: user.stats?.totalWon || 0,
      entries: winningDraws.flatMap((draw) =>
        draw.winners
          .filter((winner) => winner.userId === user.id)
          .map((winner) => ({
            drawId: draw.id,
            monthKey: draw.monthKey,
            matches: winner.matches,
            amount: winner.amount,
            verificationStatus: winner.verificationStatus,
            paymentStatus: winner.paymentStatus
          }))
      )
    },
    donations: {
      total: Number(((user.donations || []).reduce((sum, item) => sum + item.amount, 0)).toFixed(2)),
      entries: user.donations || []
    }
  };
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/public/home", async (_req, res) => {
  const db = await readDb();
  const activeSubscribers = db.users.filter(
    (user) => user.role === "subscriber" && user.subscription.status === "active"
  );
  res.json({
    metrics: {
      activeSubscribers: activeSubscribers.length,
      totalCharities: db.charities.length,
      currentJackpot: db.meta.rolloverJackpot || 0
    },
    featuredCharity: db.charities.find((charity) => charity.featured) || db.charities[0]
  });
});

app.get("/api/public/charities", async (req, res) => {
  const db = await readDb();
  const search = (req.query.search || "").toString().trim().toLowerCase();
  const charities = db.charities.filter((charity) => {
    if (!search) {
      return true;
    }
    return [charity.name, charity.description, charity.location]
      .join(" ")
      .toLowerCase()
      .includes(search);
  });
  res.json(charities);
});

app.get("/api/public/charities/:slug", async (req, res) => {
  const db = await readDb();
  const charity = db.charities.find((entry) => entry.slug === req.params.slug);
  if (!charity) {
    return res.status(404).json({ error: "Charity not found." });
  }

  const supporters = db.users.filter((user) => user.charityId === charity.id).length;
  const monthlyContribution = db.users
    .filter((user) => user.role === "subscriber" && user.charityId === charity.id)
    .reduce((sum, user) => {
      const plan = db.plans[user.subscription?.planId];
      if (!plan) {
        return sum;
      }
      const monthlyValue = plan.billingMonths === 12 ? plan.price / 12 : plan.price;
      return sum + monthlyValue * (user.charityPercentage / 100);
    }, 0);

  res.json({
    ...charity,
    supporters,
    monthlyContribution: Number(monthlyContribution.toFixed(2))
  });
});

app.post("/api/auth/signup", async (req, res) => {
  try {
    const { name, email, password, charityId, charityPercentage, planId = "monthly" } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: "Name, email, and password are required." });
    }

    let welcomeNotificationId = null;
    const db = await updateDb(async (draft) => {
      if (draft.users.some((user) => user.email.toLowerCase() === email.toLowerCase())) {
        throw new Error("Email already in use.");
      }

      if (!draft.charities.some((charity) => charity.id === charityId)) {
        throw new Error("Select a valid charity.");
      }

      if (!draft.plans[planId]) {
        throw new Error("Select a valid subscription plan.");
      }

      const percent = ensureCharityPercent(charityPercentage);
      const passwordHash = await hashPassword(password);
      const startedAt = new Date().toISOString().slice(0, 10);
      const user = {
        id: randomUUID(),
        name,
        email: email.toLowerCase(),
        passwordHash,
        role: "subscriber",
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        charityId,
        charityPercentage: percent,
        subscription: {
          planId,
          status: "inactive",
          startedAt: null,
          renewalDate: null,
          cancelledAt: null
        },
        scores: [],
        stats: {
          totalWon: 0
        }
      };

      draft.users.unshift(user);
      const notification = await queueNotification(draft, {
        type: "welcome_email",
        userId: user.id,
        createdAt: new Date().toISOString()
      });
      welcomeNotificationId = notification.id;
      return draft;
    });

    if (welcomeNotificationId) {
      fireAndForget(dispatchNotifications([welcomeNotificationId]));
    }

    const user = db.users[0];
    const token = signToken(user);
    res.status(201).json({ token, user: sanitizeUser(user) });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  const db = await readDb();
  const user = db.users.find((entry) => entry.email.toLowerCase() === email.toLowerCase());
  if (!user) {
    return res.status(401).json({ error: "Invalid credentials." });
  }
  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: "Invalid credentials." });
  }
  const token = signToken(user);
  res.json({ token, user: sanitizeUser(user) });
});

app.get("/api/me", authRequired, async (req, res) => {
  const db = await readDb();
  const user = db.users.find((entry) => entry.id === req.user.id);
  res.json(mapDashboard(db, user));
});

app.patch("/api/me/profile", authRequired, subscriberAccessRequired, async (req, res) => {
  try {
    const db = await updateDb(async (draft) => {
      const user = draft.users.find((entry) => entry.id === req.user.id);
      const { charityId, charityPercentage, name } = req.body;
      if (name) {
        user.name = name;
      }
      if (charityId) {
        const charity = draft.charities.find((entry) => entry.id === charityId);
        if (!charity) {
          throw new Error("Invalid charity selected.");
        }
        user.charityId = charityId;
      }
      if (charityPercentage !== undefined) {
        user.charityPercentage = ensureCharityPercent(charityPercentage);
      }
      return draft;
    });
    const user = db.users.find((entry) => entry.id === req.user.id);
    res.json(mapDashboard(db, user));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/api/me/scores", authRequired, subscriberAccessRequired, async (req, res) => {
  try {
    const db = await updateDb(async (draft) => {
      const user = draft.users.find((entry) => entry.id === req.user.id);
      const score = validateScoreInput(req.body.value, req.body.playedAt);
      user.scores = normalizeScores([score, ...(user.scores || [])]);
      return draft;
    });
    const user = db.users.find((entry) => entry.id === req.user.id);
    res.status(201).json(normalizeScores(user.scores || []));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.put("/api/me/scores/:scoreId", authRequired, subscriberAccessRequired, async (req, res) => {
  try {
    const db = await updateDb(async (draft) => {
      const user = draft.users.find((entry) => entry.id === req.user.id);
      const score = user.scores.find((entry) => entry.id === req.params.scoreId);
      if (!score) {
        throw new Error("Score not found.");
      }
      const replacement = validateScoreInput(req.body.value, req.body.playedAt);
      score.value = replacement.value;
      score.playedAt = replacement.playedAt;
      user.scores = normalizeScores(user.scores);
      return draft;
    });
    const user = db.users.find((entry) => entry.id === req.user.id);
    res.json(normalizeScores(user.scores || []));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/api/me/subscription/cancel", authRequired, async (req, res) => {
  res.status(400).json({
    error: "Manage cancellation through the Stripe billing portal so billing status stays in sync."
  });
});

app.post("/api/me/subscription/renew", authRequired, async (req, res) => {
  res.status(400).json({
    error: "Manage renewal through Stripe checkout or the Stripe billing portal so billing status stays in sync."
  });
});

app.post("/api/stripe/checkout", authRequired, async (req, res) => {
  try {
    const db = await readDb();
    const user = db.users.find((entry) => entry.id === req.user.id);
    const planId = req.body.planId || user.subscription?.planId || "monthly";
    if (!db.plans[planId]) {
      return res.status(400).json({ error: "Invalid plan selected." });
    }

    const session = await createSubscriptionCheckoutSession(user, planId);
    await updateDb(async (draft) => {
      const draftUser = draft.users.find((entry) => entry.id === req.user.id);
      draftUser.stripeCustomerId = session.customerId;
      draftUser.subscription.planId = planId;
      return draft;
    });

    res.status(201).json(session);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/api/stripe/portal", authRequired, async (req, res) => {
  try {
    const db = await readDb();
    const user = db.users.find((entry) => entry.id === req.user.id);
    if (!user.stripeCustomerId) {
      return res.status(400).json({ error: "No Stripe customer found for this account yet." });
    }
    const session = await createBillingPortalSession(user.stripeCustomerId);
    res.json({ url: session.url });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/api/stripe/checkout/confirm", authRequired, async (req, res) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) {
      return res.status(400).json({ error: "sessionId is required." });
    }
    const session = await retrieveCheckoutSession(sessionId);
    if (session.payment_status !== "paid" && session.status !== "complete") {
      return res.status(400).json({ error: "Checkout session is not complete yet." });
    }

    const db = await updateDb(async (draft) => {
      const user = draft.users.find((entry) => entry.id === req.user.id);
      user.stripeCustomerId = session.customer;
      user.stripeSubscriptionId = session.subscription;
      user.subscription.planId = session.metadata?.planId || user.subscription.planId;
      user.subscription.status = "active";
      user.subscription.startedAt = new Date().toISOString().slice(0, 10);
      return draft;
    });

    const user = db.users.find((entry) => entry.id === req.user.id);
    res.json(mapDashboard(db, user));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/api/me/donations", authRequired, subscriberAccessRequired, async (req, res) => {
  const amount = Number(req.body.amount);
  const { charityId } = req.body;
  if (!charityId || Number.isNaN(amount) || amount <= 0) {
    return res.status(400).json({ error: "Valid donation amount and charity are required." });
  }
  const db = await updateDb(async (draft) => {
    const charity = draft.charities.find((entry) => entry.id === charityId);
    if (!charity) {
      throw new Error("Charity not found.");
    }
    const user = draft.users.find((entry) => entry.id === req.user.id);
    user.donations = user.donations || [];
    user.donations.unshift({
      id: randomUUID(),
      charityId,
      amount: Number(amount.toFixed(2)),
      createdAt: new Date().toISOString()
    });
    return draft;
  });
  const user = db.users.find((entry) => entry.id === req.user.id);
  res.status(201).json(mapDashboard(db, user));
});

app.post(
  "/api/me/verification",
  authRequired,
  subscriberAccessRequired,
  upload.single("proof"),
  async (req, res) => {
    try {
      const { drawId } = req.body;
      if (!drawId || !req.file) {
        return res.status(400).json({ error: "Draw and proof file are required." });
      }
      const proofUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;
      const db = await updateDb(async (draft) => {
        const draw = draft.draws.find((entry) => entry.id === drawId);
        if (!draw) {
          throw new Error("Draw not found.");
        }
        const winner = draw.winners.find((entry) => entry.userId === req.user.id);
        if (!winner) {
          throw new Error("No winner entry found for this user.");
        }
        winner.verificationStatus = "pending";
        draft.winnerClaims.unshift({
          id: randomUUID(),
          drawId,
          userId: req.user.id,
          proofUrl,
          proofFilename: req.file.originalname,
          mimeType: req.file.mimetype,
          status: "pending",
          createdAt: new Date().toISOString()
        });
        return draft;
      });
      const user = db.users.find((entry) => entry.id === req.user.id);
      res.json(mapDashboard(db, user));
    } catch (error) {
      if (req.file?.path) {
        await fs.unlink(req.file.path).catch(() => {});
      }
      res.status(400).json({ error: error.message });
    }
  }
);

app.get("/api/admin/overview", authRequired, adminRequired, async (_req, res) => {
  const db = await readDb();
  const activeSubscribers = db.users.filter(
    (user) => user.role === "subscriber" && user.subscription.status === "active"
  );
  const charityTotals = db.charities.map((charity) => {
    const total = activeSubscribers
      .filter((user) => user.charityId === charity.id)
      .reduce((sum, user) => {
        const plan = db.plans[user.subscription.planId];
        const monthlyValue = plan.billingMonths === 12 ? plan.price / 12 : plan.price;
        return sum + monthlyValue * (user.charityPercentage / 100);
      }, 0);
    return {
      charityId: charity.id,
      charityName: charity.name,
      total: Number(total.toFixed(2))
    };
  });
  res.json({
    totals: {
      users: db.users.length,
      activeSubscribers: activeSubscribers.length,
      prizeRollover: db.meta.rolloverJackpot || 0,
      publishedDraws: db.draws.filter((draw) => draw.status === "published").length
    },
    charities: db.charities,
    charityTotals,
    users: db.users.map(sanitizeUser),
    draws: db.draws,
    winnerClaims: db.winnerClaims,
    notifications: db.notifications.slice(0, 20)
  });
});

app.patch("/api/admin/users/:userId", authRequired, adminRequired, async (req, res) => {
  try {
    const db = await updateDb(async (draft) => {
      const user = draft.users.find((entry) => entry.id === req.params.userId);
      if (!user) {
        throw new Error("User not found.");
      }
      const { name, charityId, charityPercentage, subscriptionStatus } = req.body;
      if (name) user.name = name;
      if (charityId) user.charityId = charityId;
      if (charityPercentage !== undefined) {
        user.charityPercentage = ensureCharityPercent(charityPercentage);
      }
      if (subscriptionStatus) user.subscription.status = subscriptionStatus;
      return draft;
    });
    res.json(db.users.map(sanitizeUser));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.put("/api/admin/users/:userId/scores/:scoreId", authRequired, adminRequired, async (req, res) => {
  try {
    const db = await updateDb(async (draft) => {
      const user = draft.users.find((entry) => entry.id === req.params.userId);
      if (!user) {
        throw new Error("User not found.");
      }
      const score = user.scores.find((entry) => entry.id === req.params.scoreId);
      if (!score) {
        throw new Error("Score not found.");
      }
      const replacement = validateScoreInput(req.body.value, req.body.playedAt);
      score.value = replacement.value;
      score.playedAt = replacement.playedAt;
      user.scores = normalizeScores(user.scores);
      return draft;
    });
    res.json(db.users.map(sanitizeUser));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/api/admin/charities", authRequired, adminRequired, async (req, res) => {
  try {
    const db = await updateDb(async (draft) => {
      draft.charities.unshift({
        id: randomUUID(),
        featured: false,
        ...req.body
      });
      return draft;
    });
    res.status(201).json(db.charities);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.patch("/api/admin/charities/:charityId", authRequired, adminRequired, async (req, res) => {
  try {
    const db = await updateDb(async (draft) => {
      const charity = draft.charities.find((entry) => entry.id === req.params.charityId);
      if (!charity) {
        throw new Error("Charity not found.");
      }
      Object.assign(charity, req.body);
      return draft;
    });
    res.json(db.charities);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete("/api/admin/charities/:charityId", authRequired, adminRequired, async (req, res) => {
  try {
    const db = await updateDb(async (draft) => {
      draft.charities = draft.charities.filter((entry) => entry.id !== req.params.charityId);
      return draft;
    });
    res.json(db.charities);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/api/admin/draws/simulate", authRequired, adminRequired, async (req, res) => {
  const db = await readDb();
  const result = runDraw(db, req.body.mode || "random", false);
  res.json(result.draw);
});

app.post("/api/admin/draws/publish", authRequired, adminRequired, async (req, res) => {
  const notificationIds = [];
  const publishMonth = currentMonthKey();
  const alreadyPublished = (await readDb()).draws.some(
    (draw) => draw.status === "published" && draw.monthKey === publishMonth
  );
  if (alreadyPublished) {
    return res.status(400).json({
      error: `A draw has already been published for ${publishMonth}. Only one published draw per month is allowed.`
    });
  }

  const db = await updateDb(async (draft) => {
    const result = runDraw(draft, req.body.mode || "random", true);
    draft.draws.unshift(result.draw);
    draft.meta.rolloverJackpot = result.rolloverJackpot;
    draft.meta.lastPublishedDrawMonth = result.draw.monthKey;

    for (const winner of result.draw.winners) {
      const user = draft.users.find((entry) => entry.id === winner.userId);
      user.stats.totalWon = Number(((user.stats.totalWon || 0) + winner.amount).toFixed(2));
    }

    const recipients = draft.users.filter((entry) => entry.role === "subscriber");
    for (const subscriber of recipients) {
      const notification = await queueNotification(draft, {
        type: "draw_published",
        userId: subscriber.id,
        drawId: result.draw.id,
        monthKey: result.draw.monthKey
      });
      notificationIds.push(notification.id);
    }
    return draft;
  });
  fireAndForget(dispatchNotifications(notificationIds));
  res.status(201).json(db.draws[0]);
});

app.post("/api/admin/winners/:winnerId/verify", authRequired, adminRequired, async (req, res) => {
  let notificationId = null;
  const db = await updateDb(async (draft) => {
    const claim = draft.winnerClaims.find((entry) => entry.id === req.body.claimId);
    if (!claim) {
      throw new Error("Claim not found.");
    }
    claim.status = req.body.status;
    const draw = draft.draws.find((entry) => entry.id === claim.drawId);
    const winner = draw?.winners.find((entry) => entry.id === req.params.winnerId);
    if (!winner) {
      throw new Error("Winner not found.");
    }
    winner.verificationStatus = req.body.status;
    const notification = await queueNotification(draft, {
      type: "winner_claim_review",
      userId: claim.userId,
      drawId: claim.drawId,
      decision: req.body.status
    });
    notificationId = notification.id;
    return draft;
  });
  if (notificationId) {
    fireAndForget(dispatchNotifications([notificationId]));
  }
  res.json({ ok: true, winnerClaims: db.winnerClaims });
});

app.post("/api/admin/winners/:winnerId/pay", authRequired, adminRequired, async (req, res) => {
  let notificationId = null;
  const db = await updateDb(async (draft) => {
    for (const draw of draft.draws) {
      const winner = draw.winners.find((entry) => entry.id === req.params.winnerId);
      if (winner) {
        winner.paymentStatus = "paid";
        const notification = await queueNotification(draft, {
          type: "winner_paid",
          userId: winner.userId,
          drawId: draw.id
        });
        notificationId = notification.id;
        return draft;
      }
    }
    throw new Error("Winner not found.");
  });
  if (notificationId) {
    fireAndForget(dispatchNotifications([notificationId]));
  }
  res.json({ ok: true, draws: db.draws });
});

app.use((error, _req, res, _next) => {
  res.status(500).json({ error: error.message || "Internal server error." });
});

app.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`);
});

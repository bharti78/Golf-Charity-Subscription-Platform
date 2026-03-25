import { randomUUID } from "crypto";
import nodemailer from "nodemailer";
import { readDb, updateDb } from "../data/store.js";

export async function queueNotification(db, notification) {
  const record = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    status: "queued",
    ...notification
  };
  db.notifications.unshift(record);
  return record;
}

function getTransporter() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_FROM) {
    return null;
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth:
      process.env.SMTP_USER && process.env.SMTP_PASS
        ? {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
          }
        : undefined
  });
}

function renderNotification(db, notification) {
  const user = notification.userId
    ? db.users.find((entry) => entry.id === notification.userId)
    : null;

  if (notification.type === "welcome_email" && user) {
    return {
      to: user.email,
      subject: "Welcome to Golf for Good",
      text: `Hi ${user.name}, your account is ready. Choose your charity, complete billing, add your last five Stableford scores, and enter the next monthly draw.`,
      html: `<p>Hi ${user.name},</p><p>Your account is ready. Choose your charity, complete billing, add your last five Stableford scores, and enter the next monthly draw.</p>`
    };
  }

  if (notification.type === "draw_published" && user) {
    const draw = db.draws.find((entry) => entry.id === notification.drawId);
    const winner = draw?.winners.find((entry) => entry.userId === user.id);
    const resultLine = winner
      ? `You matched ${winner.matches} numbers and your current prize amount is $${winner.amount}.`
      : "You were entered in this month's draw and can review the published numbers in your dashboard.";
    return {
      to: user.email,
      subject: `Monthly draw results for ${notification.monthKey}`,
      text: `The draw for ${notification.monthKey} is now live. Numbers: ${(draw?.numbers || []).join(", ")}. ${resultLine}`,
      html: `<p>The draw for <strong>${notification.monthKey}</strong> is now live.</p><p>Numbers: ${(draw?.numbers || []).join(", ")}</p><p>${resultLine}</p>`
    };
  }

  if (notification.type === "winner_claim_review" && user) {
    const decision = notification.decision || "updated";
    return {
      to: user.email,
      subject: `Winner verification ${decision}`,
      text: `Your winner verification for draw ${notification.drawId} has been ${decision}.`,
      html: `<p>Your winner verification for draw <strong>${notification.drawId}</strong> has been <strong>${decision}</strong>.</p>`
    };
  }

  if (notification.type === "winner_paid" && user) {
    return {
      to: user.email,
      subject: "Your payout has been marked as paid",
      text: `Your payout for draw ${notification.drawId} has been marked as paid.`,
      html: `<p>Your payout for draw <strong>${notification.drawId}</strong> has been marked as paid.</p>`
    };
  }

  if (notification.type === "subscription_update" && user) {
    return {
      to: user.email,
      subject: `Subscription ${notification.action}`,
      text: `Your subscription has been ${notification.action}. Current status: ${notification.subscriptionStatus}.`,
      html: `<p>Your subscription has been <strong>${notification.action}</strong>.</p><p>Current status: ${notification.subscriptionStatus}</p>`
    };
  }

  return null;
}

export async function dispatchNotificationById(notificationId) {
  const db = await readDb();
  const notification = db.notifications.find((entry) => entry.id === notificationId);
  if (!notification) {
    return { status: "missing" };
  }

  const message = renderNotification(db, notification);
  if (!message) {
    await updateDb(async (draft) => {
      const item = draft.notifications.find((entry) => entry.id === notificationId);
      if (item) {
        item.status = "skipped";
      }
      return draft;
    });
    return { status: "skipped" };
  }

  const transporter = getTransporter();
  if (!transporter) {
    await updateDb(async (draft) => {
      const item = draft.notifications.find((entry) => entry.id === notificationId);
      if (item) {
        item.status = "pending_config";
      }
      return draft;
    });
    return { status: "pending_config" };
  }

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      ...message
    });
    await updateDb(async (draft) => {
      const item = draft.notifications.find((entry) => entry.id === notificationId);
      if (item) {
        item.status = "sent";
      }
      return draft;
    });
    return { status: "sent" };
  } catch (error) {
    await updateDb(async (draft) => {
      const item = draft.notifications.find((entry) => entry.id === notificationId);
      if (item) {
        item.status = "failed";
        item.error = error.message;
      }
      return draft;
    });
    return { status: "failed", error: error.message };
  }
}

export async function dispatchNotifications(notificationIds) {
  const results = [];
  for (const notificationId of notificationIds) {
    results.push(await dispatchNotificationById(notificationId));
  }
  return results;
}

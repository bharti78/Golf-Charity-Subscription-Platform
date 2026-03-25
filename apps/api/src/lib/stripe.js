const STRIPE_API_VERSION = "2024-12-18.acacia";

let stripeClientPromise;

async function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("Stripe is not configured. Set STRIPE_SECRET_KEY.");
  }

  if (!stripeClientPromise) {
    stripeClientPromise = import("stripe").then(({ default: Stripe }) => {
      return new Stripe(process.env.STRIPE_SECRET_KEY, {
        apiVersion: STRIPE_API_VERSION
      });
    });
  }

  return stripeClientPromise;
}

export function getBaseUrl() {
  return process.env.APP_URL || "http://localhost:5173";
}

export function getStripePriceId(planId) {
  const mapping = {
    monthly: process.env.STRIPE_PRICE_MONTHLY,
    yearly: process.env.STRIPE_PRICE_YEARLY
  };
  const priceId = mapping[planId];
  if (!priceId) {
    throw new Error(`Missing Stripe price configuration for ${planId}.`);
  }
  return priceId;
}

export async function ensureStripeCustomer(user) {
  const stripe = await getStripe();

  if (user.stripeCustomerId) {
    return user.stripeCustomerId;
  }

  const customer = await stripe.customers.create({
    email: user.email,
    name: user.name,
    metadata: {
      userId: user.id,
      role: user.role
    }
  });

  return customer.id;
}

export async function createSubscriptionCheckoutSession(user, planId) {
  const stripe = await getStripe();
  const customerId = await ensureStripeCustomer(user);
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [
      {
        price: getStripePriceId(planId),
        quantity: 1
      }
    ],
    success_url: `${getBaseUrl()}/dashboard?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${getBaseUrl()}/dashboard?checkout=cancelled`,
    metadata: {
      userId: user.id,
      planId
    }
  });

  return {
    customerId,
    sessionId: session.id,
    url: session.url
  };
}

export async function createBillingPortalSession(customerId) {
  const stripe = await getStripe();
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${getBaseUrl()}/dashboard`
  });
  return session;
}

export async function constructWebhookEvent(payload, signature) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error("Stripe webhook secret is not configured.");
  }
  const stripe = await getStripe();
  return stripe.webhooks.constructEvent(payload, signature, secret);
}

export async function retrieveCheckoutSession(sessionId) {
  const stripe = await getStripe();
  return stripe.checkout.sessions.retrieve(sessionId);
}

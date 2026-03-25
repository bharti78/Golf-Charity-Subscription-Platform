# Golf Charity Subscription Platform

PRD-driven full-stack starter for the Digital Heroes golf charity subscription platform.

## Stack

- `apps/web`: React + Vite frontend
- `apps/api`: Express API with JWT auth and SQLite persistence

## Features Covered

- Public marketing homepage with featured charity messaging
- Signup/login with subscriber and admin roles
- Monthly/yearly subscriptions with Stripe Checkout, Stripe Billing Portal, and lifecycle states
- Charity selection with minimum contribution enforcement
- Rolling golf score storage limited to the latest 5 entries
- Random and weighted monthly draw simulation/publish flows
- Prize pool calculation and jackpot rollover
- Winner verification and payout tracking
- Subscriber dashboard and admin dashboard
- Notification service abstraction for email events

## Demo Credentials

- Admin: `admin@golfcharity.local` / `Admin123!`
- User: `alex@golfcharity.local` / `User123!`

## Run

1. Install dependencies:
   `npm install`
2. Copy `.env.example` to `.env`
3. Add Stripe values:
   `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_YEARLY`, `APP_URL`
4. Add SMTP values if you want real email delivery:
   `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
5. Start the API:
   `npm run dev:api`
6. Start the frontend:
   `npm run dev:web`

API defaults to `http://localhost:4000`, frontend to `http://localhost:5173`.

## Stripe Setup

1. Create two recurring Stripe Prices:
   one monthly and one yearly
2. Put those price IDs into:
   `STRIPE_PRICE_MONTHLY` and `STRIPE_PRICE_YEARLY`
3. Configure a webhook endpoint pointing to:
   `http://localhost:4000/api/stripe/webhook`
4. Subscribe the webhook to:
   `checkout.session.completed`
   `customer.subscription.updated`
   `customer.subscription.deleted`
   `invoice.payment_failed`
5. Use the Stripe Billing Portal for customer self-service billing management

## Current Verification

- Business-rule tests pass for score rolling, draw pool logic, and SQLite bootstrap
- Stripe code paths are wired but not live-tested here because real Stripe keys, prices, and webhook delivery are required
- Email delivery is wired through SMTP-backed notifications for signup, subscription updates, draw publication, winner review, and payout status

## Notes

- Stripe is integrated through Checkout, Billing Portal, and webhooks.
- Data persists in `apps/api/data/app.db`, seeded from `apps/api/data/seed-db.json` on first run.
- The architecture is intentionally modular so the JSON store can be replaced with Supabase/Postgres later.

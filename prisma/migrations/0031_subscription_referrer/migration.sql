-- Records which partner referred a subscription, from the ?ref= captured before checkout.
--
-- Nullable with no default: the overwhelming majority of subscriptions have no referrer, and
-- NULL says "nobody" more honestly than an empty string. No RLS statement here because this
-- adds a column to an existing table -- Subscription already has row level security enabled.
ALTER TABLE "Subscription" ADD COLUMN "referrer" TEXT;

-- The only query this column will ever serve is "everything attributed to partner X".
CREATE INDEX "Subscription_referrer_idx" ON "Subscription"("referrer");

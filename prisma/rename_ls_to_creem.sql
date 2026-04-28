-- Rename Lemon Squeezy columns to Creem equivalents (data-safe, in-place rename)
ALTER TABLE "Subscription" RENAME COLUMN "lsSubscriptionId" TO "creemSubscriptionId";
ALTER TABLE "Subscription" RENAME COLUMN "lsCustomerId"     TO "creemCustomerId";
ALTER TABLE "Subscription" RENAME COLUMN "lsVariantId"      TO "creemProductId";
ALTER TABLE "Subscription" RENAME COLUMN "lsOrderId"        TO "creemOrderId";

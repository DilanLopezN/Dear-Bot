-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'OVERDUE', 'EXPIRED', 'CANCELLED');

-- Rename FREE to TESTER in SubscriptionPlan enum
ALTER TYPE "SubscriptionPlan" RENAME VALUE 'FREE' TO 'TESTER';

-- AlterTable: Add new columns to users
ALTER TABLE "users" ADD COLUMN "cpfCnpj" TEXT;
ALTER TABLE "users" ADD COLUMN "planExpiresAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "planActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "users" ADD COLUMN "asaasCustomerId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_asaasCustomerId_key" ON "users"("asaasCustomerId");

-- Set planExpiresAt for existing TESTER users (3 days from now)
UPDATE "users" SET "planExpiresAt" = NOW() + INTERVAL '3 days' WHERE "plan" = 'TESTER' AND "planExpiresAt" IS NULL;

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "asaasSubscriptionId" TEXT,
    "plan" "SubscriptionPlan" NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "value" DOUBLE PRECISION NOT NULL,
    "billingType" TEXT NOT NULL DEFAULT 'PIX',
    "nextDueDate" TIMESTAMP(3),
    "lastPaymentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_userId_key" ON "subscriptions"("userId");
CREATE UNIQUE INDEX "subscriptions_asaasSubscriptionId_key" ON "subscriptions"("asaasSubscriptionId");

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

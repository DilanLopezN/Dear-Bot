-- Add BAILEYS to ChannelProvider enum
ALTER TYPE "ChannelProvider" ADD VALUE 'BAILEYS';

-- Add new enums
CREATE TYPE "ScheduledMessageStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'CANCELLED');
CREATE TYPE "BroadcastStatus" AS ENUM ('DRAFT', 'SENDING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- Add Baileys fields to whatsapp_channels
ALTER TABLE "whatsapp_channels"
  ADD COLUMN "baileysApiUrl" TEXT,
  ADD COLUMN "baileysApiKey" TEXT,
  ADD COLUMN "baileysInstance" TEXT;

-- Create contacts table
CREATE TABLE "contacts" (
    "id" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "customFields" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "contacts_botId_phone_key" ON "contacts"("botId", "phone");
CREATE INDEX "contacts_botId_idx" ON "contacts"("botId");

ALTER TABLE "contacts" ADD CONSTRAINT "contacts_botId_fkey"
  FOREIGN KEY ("botId") REFERENCES "bots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create scheduled_messages table
CREATE TABLE "scheduled_messages" (
    "id" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "contactId" TEXT,
    "phone" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "status" "ScheduledMessageStatus" NOT NULL DEFAULT 'PENDING',
    "sentAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scheduled_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "scheduled_messages_status_scheduledAt_idx" ON "scheduled_messages"("status", "scheduledAt");
CREATE INDEX "scheduled_messages_botId_idx" ON "scheduled_messages"("botId");

ALTER TABLE "scheduled_messages" ADD CONSTRAINT "scheduled_messages_botId_fkey"
  FOREIGN KEY ("botId") REFERENCES "bots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "scheduled_messages" ADD CONSTRAINT "scheduled_messages_contactId_fkey"
  FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Create broadcast_lists table
CREATE TABLE "broadcast_lists" (
    "id" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phones" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "broadcast_lists_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "broadcast_lists_botId_idx" ON "broadcast_lists"("botId");

ALTER TABLE "broadcast_lists" ADD CONSTRAINT "broadcast_lists_botId_fkey"
  FOREIGN KEY ("botId") REFERENCES "bots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create broadcasts table
CREATE TABLE "broadcasts" (
    "id" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "listId" TEXT,
    "name" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "phones" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "BroadcastStatus" NOT NULL DEFAULT 'DRAFT',
    "scheduledAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "totalRecipients" INTEGER NOT NULL DEFAULT 0,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "failCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "broadcasts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "broadcasts_botId_idx" ON "broadcasts"("botId");
CREATE INDEX "broadcasts_status_scheduledAt_idx" ON "broadcasts"("status", "scheduledAt");

ALTER TABLE "broadcasts" ADD CONSTRAINT "broadcasts_botId_fkey"
  FOREIGN KEY ("botId") REFERENCES "bots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "broadcasts" ADD CONSTRAINT "broadcasts_listId_fkey"
  FOREIGN KEY ("listId") REFERENCES "broadcast_lists"("id") ON DELETE SET NULL ON UPDATE CASCADE;

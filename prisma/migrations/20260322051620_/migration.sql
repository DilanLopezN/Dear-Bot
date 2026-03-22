-- CreateEnum
CREATE TYPE "VariableType" AS ENUM ('STRING', 'NUMBER', 'BOOLEAN', 'DATE');

-- CreateEnum
CREATE TYPE "ConversationStatus" AS ENUM ('BOT', 'WAITING', 'HUMAN', 'CLOSED');

-- CreateEnum
CREATE TYPE "MessageSender" AS ENUM ('CONTACT', 'BOT', 'HUMAN');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'NEGOTIATION', 'CONVERTED', 'LOST');

-- CreateEnum
CREATE TYPE "LeadTemperature" AS ENUM ('COLD', 'WARM', 'HOT');

-- AlterEnum
ALTER TYPE "IterationType" ADD VALUE 'AI';

-- AlterTable
ALTER TABLE "conversations" ADD COLUMN     "humanTakeoverAt" TIMESTAMP(3),
ADD COLUMN     "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "pendingVariableGoto" JSONB,
ADD COLUMN     "pendingVariableName" TEXT,
ADD COLUMN     "pendingVariableType" "VariableType",
ADD COLUMN     "status" "ConversationStatus" NOT NULL DEFAULT 'BOT',
ADD COLUMN     "waitingForVariable" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "interactive_menus" ADD COLUMN     "captureVariable" JSONB;

-- AlterTable
ALTER TABLE "keywords" ADD COLUMN     "captureVariable" JSONB;

-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "senderType" "MessageSender" NOT NULL DEFAULT 'BOT';

-- CreateTable
CREATE TABLE "conversation_variables" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "VariableType" NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversation_variables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "temperature" "LeadTemperature" NOT NULL DEFAULT 'COLD',
    "source" TEXT,
    "totalMessages" INTEGER NOT NULL DEFAULT 0,
    "inboundMessages" INTEGER NOT NULL DEFAULT 0,
    "outboundMessages" INTEGER NOT NULL DEFAULT 0,
    "totalConversations" INTEGER NOT NULL DEFAULT 0,
    "lastInteractionAt" TIMESTAMP(3),
    "firstInteractionAt" TIMESTAMP(3),
    "responseRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avgResponseTime" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "humanTakeovers" INTEGER NOT NULL DEFAULT 0,
    "estimatedValue" DOUBLE PRECISION,
    "notes" TEXT,
    "convertedAt" TIMESTAMP(3),
    "lostReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_history" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bot_knowledge" (
    "id" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "totalChunks" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bot_knowledge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_chunks" (
    "id" TEXT NOT NULL,
    "knowledgeId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "wordCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "conversation_variables_conversationId_name_key" ON "conversation_variables"("conversationId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "leads_contactId_key" ON "leads"("contactId");

-- CreateIndex
CREATE INDEX "leads_botId_idx" ON "leads"("botId");

-- CreateIndex
CREATE INDEX "leads_botId_status_idx" ON "leads"("botId", "status");

-- CreateIndex
CREATE INDEX "leads_botId_temperature_idx" ON "leads"("botId", "temperature");

-- CreateIndex
CREATE INDEX "leads_score_idx" ON "leads"("score");

-- CreateIndex
CREATE INDEX "lead_history_leadId_idx" ON "lead_history"("leadId");

-- CreateIndex
CREATE INDEX "bot_knowledge_botId_idx" ON "bot_knowledge"("botId");

-- CreateIndex
CREATE INDEX "knowledge_chunks_knowledgeId_idx" ON "knowledge_chunks"("knowledgeId");

-- CreateIndex
CREATE INDEX "conversations_status_idx" ON "conversations"("status");

-- CreateIndex
CREATE INDEX "conversations_lastMessageAt_idx" ON "conversations"("lastMessageAt");

-- AddForeignKey
ALTER TABLE "conversation_variables" ADD CONSTRAINT "conversation_variables_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_botId_fkey" FOREIGN KEY ("botId") REFERENCES "bots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_history" ADD CONSTRAINT "lead_history_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bot_knowledge" ADD CONSTRAINT "bot_knowledge_botId_fkey" FOREIGN KEY ("botId") REFERENCES "bots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_knowledgeId_fkey" FOREIGN KEY ("knowledgeId") REFERENCES "bot_knowledge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: Add currentIterationIndex to conversations
ALTER TABLE "conversations" ADD COLUMN "currentIterationIndex" INTEGER NOT NULL DEFAULT -1;

-- CreateTable: AI Learnings
CREATE TABLE "ai_learnings" (
    "id" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "contactPhone" TEXT,
    "type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_learnings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_learnings_botId_idx" ON "ai_learnings"("botId");
CREATE INDEX "ai_learnings_botId_contactPhone_idx" ON "ai_learnings"("botId", "contactPhone");
CREATE INDEX "ai_learnings_botId_type_idx" ON "ai_learnings"("botId", "type");

-- AddForeignKey
ALTER TABLE "ai_learnings" ADD CONSTRAINT "ai_learnings_botId_fkey" FOREIGN KEY ("botId") REFERENCES "bots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

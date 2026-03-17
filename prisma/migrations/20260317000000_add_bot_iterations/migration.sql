-- CreateEnum
CREATE TYPE "IterationType" AS ENUM ('TEXT', 'LINK', 'DOCUMENT', 'GOTO', 'CAPTURE_VARIABLE');

-- CreateTable
CREATE TABLE "bot_iterations" (
    "id" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "IterationType" NOT NULL,
    "content" JSONB NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bot_iterations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bot_iterations_botId_idx" ON "bot_iterations"("botId");

-- CreateIndex
CREATE INDEX "bot_iterations_botId_order_idx" ON "bot_iterations"("botId", "order");

-- AddForeignKey
ALTER TABLE "bot_iterations" ADD CONSTRAINT "bot_iterations_botId_fkey" FOREIGN KEY ("botId") REFERENCES "bots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

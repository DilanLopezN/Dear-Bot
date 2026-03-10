-- CreateEnum
CREATE TYPE "AiProvider" AS ENUM ('CLAUDE', 'OPENAI', 'GEMINI');

-- AlterTable
ALTER TABLE "bots" ADD COLUMN     "aiConfigId" TEXT;

-- CreateTable
CREATE TABLE "ai_configs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "AiProvider" NOT NULL,
    "name" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "maxTokens" INTEGER NOT NULL DEFAULT 1024,
    "temperature" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_configs_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ai_configs" ADD CONSTRAINT "ai_configs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bots" ADD CONSTRAINT "bots_aiConfigId_fkey" FOREIGN KEY ("aiConfigId") REFERENCES "ai_configs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "IterationMode" AS ENUM ('FLUXO', 'CHAMADA');

-- AlterTable
ALTER TABLE "bot_iterations" ADD COLUMN "mode" "IterationMode" NOT NULL DEFAULT 'FLUXO';

-- AlterTable
ALTER TABLE "bots" ADD COLUMN     "flowConfig" JSONB;

-- AlterTable
ALTER TABLE "conversations" ADD COLUMN     "flowStepIndex" INTEGER NOT NULL DEFAULT 0;

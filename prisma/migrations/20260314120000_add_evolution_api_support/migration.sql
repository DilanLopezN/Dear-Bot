-- CreateEnum
CREATE TYPE "ChannelProvider" AS ENUM ('DIALOG360', 'EVOLUTION');

-- AlterTable: Add provider and Evolution fields to whatsapp_channels
ALTER TABLE "whatsapp_channels" ADD COLUMN "provider" "ChannelProvider" NOT NULL DEFAULT 'DIALOG360';
ALTER TABLE "whatsapp_channels" ADD COLUMN "evolutionApiUrl" TEXT;
ALTER TABLE "whatsapp_channels" ADD COLUMN "evolutionApiKey" TEXT;
ALTER TABLE "whatsapp_channels" ADD COLUMN "evolutionInstance" TEXT;

-- Make dialog360ApiKey optional (nullable) since Evolution channels don't need it
ALTER TABLE "whatsapp_channels" ALTER COLUMN "dialog360ApiKey" DROP NOT NULL;

-- AlterTable: Add externalMsgId to messages
ALTER TABLE "messages" ADD COLUMN "externalMsgId" TEXT;

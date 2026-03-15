-- AlterEnum
ALTER TYPE "ChannelProvider" ADD VALUE 'BAILEYS';

-- AlterTable
ALTER TABLE "whatsapp_channels" ADD COLUMN "baileysSessionId" TEXT;

-- AlterTable: Adiciona campo triggers (lista de variações) na tabela keywords
ALTER TABLE "keywords" ADD COLUMN "triggers" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Migrar dados existentes: copiar trigger para triggers
UPDATE "keywords" SET "triggers" = ARRAY["trigger"] WHERE "triggers" = ARRAY[]::TEXT[] OR "triggers" IS NULL;

-- AlterTable
ALTER TABLE "Acao" ADD COLUMN     "macroetapaId" TEXT;

-- AlterTable
ALTER TABLE "Projeto" ADD COLUMN     "cliente" TEXT,
ADD COLUMN     "objetivo" TEXT;

-- AlterTable
ALTER TABLE "RiscoProjeto" ADD COLUMN     "pedeAjuda" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Macroetapa" (
    "id" TEXT NOT NULL,
    "projetoId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Macroetapa_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Macroetapa_projetoId_idx" ON "Macroetapa"("projetoId");

-- CreateIndex
CREATE UNIQUE INDEX "Macroetapa_projetoId_nome_key" ON "Macroetapa"("projetoId", "nome");

-- CreateIndex
CREATE INDEX "Acao_macroetapaId_idx" ON "Acao"("macroetapaId");

-- AddForeignKey
ALTER TABLE "Acao" ADD CONSTRAINT "Acao_macroetapaId_fkey" FOREIGN KEY ("macroetapaId") REFERENCES "Macroetapa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Macroetapa" ADD CONSTRAINT "Macroetapa_projetoId_fkey" FOREIGN KEY ("projetoId") REFERENCES "Projeto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

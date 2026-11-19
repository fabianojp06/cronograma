-- CreateTable
CREATE TABLE "ComentarioAcao" (
    "id" TEXT NOT NULL,
    "acaoId" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "autor" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComentarioAcao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ComentarioAcao_acaoId_criadoEm_idx" ON "ComentarioAcao"("acaoId", "criadoEm");

-- AddForeignKey
ALTER TABLE "ComentarioAcao" ADD CONSTRAINT "ComentarioAcao_acaoId_fkey" FOREIGN KEY ("acaoId") REFERENCES "Acao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

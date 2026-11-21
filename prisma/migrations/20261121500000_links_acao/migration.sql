-- Links de apoio por ação (só o endereço, sem guardar arquivo). Aditiva: tabela nova.
CREATE TABLE "LinkAcao" (
    "id" TEXT NOT NULL,
    "acaoId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "criadoPor" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LinkAcao_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "LinkAcao_acaoId_idx" ON "LinkAcao"("acaoId");
ALTER TABLE "LinkAcao" ADD CONSTRAINT "LinkAcao_acaoId_fkey" FOREIGN KEY ("acaoId") REFERENCES "Acao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

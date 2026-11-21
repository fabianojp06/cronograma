-- Resumo semanal para os administradores, como foto por semana + aviso no sistema.
-- Aditiva: tabela nova e uma coluna nula em Notificacao.

CREATE TABLE "ResumoSemanal" (
    "id" TEXT NOT NULL,
    "semana" TEXT NOT NULL,
    "geradoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "conteudo" JSONB NOT NULL,
    CONSTRAINT "ResumoSemanal_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ResumoSemanal_semana_key" ON "ResumoSemanal"("semana");

ALTER TABLE "Notificacao" ADD COLUMN "resumoId" TEXT;
CREATE UNIQUE INDEX "Notificacao_destinatarioId_resumoId_key" ON "Notificacao"("destinatarioId", "resumoId");
CREATE INDEX "Notificacao_resumoId_idx" ON "Notificacao"("resumoId");
ALTER TABLE "Notificacao" ADD CONSTRAINT "Notificacao_resumoId_fkey" FOREIGN KEY ("resumoId") REFERENCES "ResumoSemanal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

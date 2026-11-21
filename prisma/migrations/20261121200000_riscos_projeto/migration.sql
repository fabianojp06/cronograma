-- Registro de riscos e bloqueios por projeto. Aditiva: tabelas novas e uma
-- coluna nula em Notificacao.

CREATE TABLE "RiscoProjeto" (
    "id" TEXT NOT NULL,
    "projetoId" TEXT NOT NULL,
    "acaoId" TEXT,
    "tipo" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "impacto" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ABERTO',
    "responsavelId" TEXT,
    "prazo" TIMESTAMP(3),
    "plano" TEXT,
    "criadoPor" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "resolvidoEm" TIMESTAMP(3),
    CONSTRAINT "RiscoProjeto_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RiscoHistorico" (
    "id" TEXT NOT NULL,
    "riscoId" TEXT NOT NULL,
    "campo" TEXT NOT NULL,
    "valorAntigo" TEXT,
    "valorNovo" TEXT,
    "alteradoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "alteradoPor" TEXT,
    CONSTRAINT "RiscoHistorico_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RiscoProjeto_projetoId_status_idx" ON "RiscoProjeto"("projetoId", "status");
CREATE INDEX "RiscoProjeto_acaoId_idx" ON "RiscoProjeto"("acaoId");
CREATE INDEX "RiscoProjeto_responsavelId_idx" ON "RiscoProjeto"("responsavelId");
CREATE INDEX "RiscoHistorico_riscoId_alteradoEm_idx" ON "RiscoHistorico"("riscoId", "alteradoEm");

ALTER TABLE "RiscoProjeto" ADD CONSTRAINT "RiscoProjeto_projetoId_fkey" FOREIGN KEY ("projetoId") REFERENCES "Projeto"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RiscoProjeto" ADD CONSTRAINT "RiscoProjeto_acaoId_fkey" FOREIGN KEY ("acaoId") REFERENCES "Acao"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RiscoProjeto" ADD CONSTRAINT "RiscoProjeto_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "Colaborador"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RiscoHistorico" ADD CONSTRAINT "RiscoHistorico_riscoId_fkey" FOREIGN KEY ("riscoId") REFERENCES "RiscoProjeto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Notificacao" ADD COLUMN "riscoId" TEXT;
CREATE INDEX "Notificacao_riscoId_idx" ON "Notificacao"("riscoId");
ALTER TABLE "Notificacao" ADD CONSTRAINT "Notificacao_riscoId_fkey" FOREIGN KEY ("riscoId") REFERENCES "RiscoProjeto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

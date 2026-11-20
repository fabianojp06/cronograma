-- Dependência entre ações e liberação de início pelo líder do projeto.
-- Aditiva, exceto por tornar Notificacao.comentarioId opcional (os avisos de
-- liberação não têm comentário): nenhuma linha existente muda.

ALTER TABLE "Notificacao" ALTER COLUMN "comentarioId" DROP NOT NULL;
ALTER TABLE "Notificacao" ADD COLUMN "liberacaoId" TEXT;

CREATE TABLE "DependenciaAcao" (
    "id" TEXT NOT NULL,
    "acaoId" TEXT NOT NULL,
    "predecessoraId" TEXT NOT NULL,
    "criadoPor" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DependenciaAcao_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LiberacaoAcao" (
    "id" TEXT NOT NULL,
    "acaoId" TEXT NOT NULL,
    "solicitante" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "decididoPor" TEXT,
    "justificativa" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decididoEm" TIMESTAMP(3),
    CONSTRAINT "LiberacaoAcao_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DependenciaAcao_acaoId_predecessoraId_key" ON "DependenciaAcao"("acaoId", "predecessoraId");
CREATE INDEX "DependenciaAcao_predecessoraId_idx" ON "DependenciaAcao"("predecessoraId");
CREATE INDEX "LiberacaoAcao_acaoId_status_idx" ON "LiberacaoAcao"("acaoId", "status");
CREATE INDEX "Notificacao_liberacaoId_idx" ON "Notificacao"("liberacaoId");

ALTER TABLE "DependenciaAcao" ADD CONSTRAINT "DependenciaAcao_acaoId_fkey" FOREIGN KEY ("acaoId") REFERENCES "Acao"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DependenciaAcao" ADD CONSTRAINT "DependenciaAcao_predecessoraId_fkey" FOREIGN KEY ("predecessoraId") REFERENCES "Acao"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LiberacaoAcao" ADD CONSTRAINT "LiberacaoAcao_acaoId_fkey" FOREIGN KEY ("acaoId") REFERENCES "Acao"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Notificacao" ADD CONSTRAINT "Notificacao_liberacaoId_fkey" FOREIGN KEY ("liberacaoId") REFERENCES "LiberacaoAcao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

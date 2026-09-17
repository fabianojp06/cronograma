-- CreateEnum
CREATE TYPE "StatusAcao" AS ENUM ('NAO_INICIADO', 'EM_CURSO_25', 'EM_CURSO_50', 'EM_CURSO_75', 'CONCLUIDO');

-- CreateTable
CREATE TABLE "Projeto" (
    "id" TEXT NOT NULL,
    "referencia" TEXT,
    "nome" TEXT NOT NULL,
    "equipe" TEXT,
    "natureza" TEXT,
    "categoria" TEXT,
    "responsavel" TEXT,
    "apoio" TEXT,
    "setorEnvolvido" TEXT,
    "comentario" TEXT,
    "prioridade" INTEGER,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Projeto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Acao" (
    "id" TEXT NOT NULL,
    "projetoId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "descricao" TEXT NOT NULL,
    "status" "StatusAcao" NOT NULL DEFAULT 'NAO_INICIADO',
    "previstoInicio" TIMESTAMP(3),
    "previstoTermino" TIMESTAMP(3),
    "realizadoInicio" TIMESTAMP(3),
    "realizadoTermino" TIMESTAMP(3),
    "duracaoDiasUteis" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Acao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HistoricoAlteracao" (
    "id" TEXT NOT NULL,
    "acaoId" TEXT NOT NULL,
    "campo" TEXT NOT NULL,
    "valorAntigo" TEXT,
    "valorNovo" TEXT,
    "alteradoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "alteradoPor" TEXT,

    CONSTRAINT "HistoricoAlteracao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Projeto_ativo_idx" ON "Projeto"("ativo");

-- CreateIndex
CREATE INDEX "Projeto_equipe_idx" ON "Projeto"("equipe");

-- CreateIndex
CREATE INDEX "Acao_projetoId_idx" ON "Acao"("projetoId");

-- CreateIndex
CREATE UNIQUE INDEX "Acao_projetoId_numero_key" ON "Acao"("projetoId", "numero");

-- CreateIndex
CREATE INDEX "HistoricoAlteracao_acaoId_alteradoEm_idx" ON "HistoricoAlteracao"("acaoId", "alteradoEm");

-- AddForeignKey
ALTER TABLE "Acao" ADD CONSTRAINT "Acao_projetoId_fkey" FOREIGN KEY ("projetoId") REFERENCES "Projeto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoricoAlteracao" ADD CONSTRAINT "HistoricoAlteracao_acaoId_fkey" FOREIGN KEY ("acaoId") REFERENCES "Acao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

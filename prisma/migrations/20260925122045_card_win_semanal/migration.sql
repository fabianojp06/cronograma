-- CreateEnum
CREATE TYPE "StatusWin" AS ENUM ('PENDENTE', 'EM_ANDAMENTO', 'FEITO', 'NAO_FEITO');

-- CreateTable
CREATE TABLE "Colaborador" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "clerkUserId" TEXT,
    "area" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Colaborador_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CardSemanal" (
    "id" TEXT NOT NULL,
    "colaboradorId" TEXT NOT NULL,
    "ano" INTEGER NOT NULL,
    "semana" INTEGER NOT NULL,
    "area" TEXT,
    "atividade" TEXT,
    "alertaRiscos" TEXT,
    "pedidoAjuda" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CardSemanal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Win" (
    "id" TEXT NOT NULL,
    "colaboradorId" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "suporte" TEXT,
    "aparicoesAnteriores" INTEGER NOT NULL DEFAULT 0,
    "promovidoEm" TIMESTAMP(3),
    "projetoId" TEXT,
    "acaoId" TEXT,
    "encerradoEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Win_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WinSemana" (
    "id" TEXT NOT NULL,
    "winId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "prazo" TIMESTAMP(3),
    "status" "StatusWin" NOT NULL DEFAULT 'PENDENTE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WinSemana_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Colaborador_nome_key" ON "Colaborador"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "Colaborador_clerkUserId_key" ON "Colaborador"("clerkUserId");

-- CreateIndex
CREATE INDEX "Colaborador_ativo_idx" ON "Colaborador"("ativo");

-- CreateIndex
CREATE INDEX "CardSemanal_ano_semana_idx" ON "CardSemanal"("ano", "semana");

-- CreateIndex
CREATE UNIQUE INDEX "CardSemanal_colaboradorId_ano_semana_key" ON "CardSemanal"("colaboradorId", "ano", "semana");

-- CreateIndex
CREATE INDEX "Win_colaboradorId_idx" ON "Win"("colaboradorId");

-- CreateIndex
CREATE INDEX "Win_promovidoEm_idx" ON "Win"("promovidoEm");

-- CreateIndex
CREATE INDEX "WinSemana_winId_idx" ON "WinSemana"("winId");

-- CreateIndex
CREATE UNIQUE INDEX "WinSemana_cardId_ordem_key" ON "WinSemana"("cardId", "ordem");

-- CreateIndex
CREATE UNIQUE INDEX "WinSemana_cardId_winId_key" ON "WinSemana"("cardId", "winId");

-- AddForeignKey
ALTER TABLE "CardSemanal" ADD CONSTRAINT "CardSemanal_colaboradorId_fkey" FOREIGN KEY ("colaboradorId") REFERENCES "Colaborador"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Win" ADD CONSTRAINT "Win_colaboradorId_fkey" FOREIGN KEY ("colaboradorId") REFERENCES "Colaborador"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Win" ADD CONSTRAINT "Win_projetoId_fkey" FOREIGN KEY ("projetoId") REFERENCES "Projeto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Win" ADD CONSTRAINT "Win_acaoId_fkey" FOREIGN KEY ("acaoId") REFERENCES "Acao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WinSemana" ADD CONSTRAINT "WinSemana_winId_fkey" FOREIGN KEY ("winId") REFERENCES "Win"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WinSemana" ADD CONSTRAINT "WinSemana_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "CardSemanal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

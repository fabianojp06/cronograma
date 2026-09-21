-- CreateTable
CREATE TABLE "AvaliacaoProjeto" (
    "id" TEXT NOT NULL,
    "projetoId" TEXT NOT NULL,
    "beneficioCompromissos" INTEGER NOT NULL DEFAULT 0,
    "beneficioValorTecnologico" INTEGER NOT NULL DEFAULT 0,
    "beneficioClima" INTEGER NOT NULL DEFAULT 0,
    "beneficioGovernanca" INTEGER NOT NULL DEFAULT 0,
    "beneficioEficiencia" INTEGER NOT NULL DEFAULT 0,
    "esforcoOrcamento" INTEGER NOT NULL DEFAULT 0,
    "esforcoDuracao" INTEGER NOT NULL DEFAULT 0,
    "esforcoCapacidadeEquipe" INTEGER NOT NULL DEFAULT 0,
    "esforcoResistencia" INTEGER NOT NULL DEFAULT 0,
    "esforcoComplexidade" INTEGER NOT NULL DEFAULT 0,
    "gravidade" INTEGER NOT NULL DEFAULT 1,
    "urgencia" INTEGER NOT NULL DEFAULT 1,
    "tendencia" INTEGER NOT NULL DEFAULT 1,
    "observacao" TEXT,
    "avaliadoPor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AvaliacaoProjeto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PesoCriterio" (
    "criterio" TEXT NOT NULL,
    "peso" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PesoCriterio_pkey" PRIMARY KEY ("criterio")
);

-- CreateIndex
CREATE UNIQUE INDEX "AvaliacaoProjeto_projetoId_key" ON "AvaliacaoProjeto"("projetoId");

-- AddForeignKey
ALTER TABLE "AvaliacaoProjeto" ADD CONSTRAINT "AvaliacaoProjeto_projetoId_fkey" FOREIGN KEY ("projetoId") REFERENCES "Projeto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

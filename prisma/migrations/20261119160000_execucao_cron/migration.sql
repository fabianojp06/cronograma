-- CreateTable
CREATE TABLE "ExecucaoCron" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "executadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ok" BOOLEAN NOT NULL,
    "resumo" TEXT NOT NULL,

    CONSTRAINT "ExecucaoCron_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExecucaoCron_nome_executadoEm_idx" ON "ExecucaoCron"("nome", "executadoEm");

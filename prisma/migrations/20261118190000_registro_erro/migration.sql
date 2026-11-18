-- CreateTable
CREATE TABLE "RegistroErro" (
    "id" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "origem" TEXT NOT NULL,
    "mensagem" TEXT NOT NULL,
    "detalhe" TEXT,
    "rota" TEXT,
    "digest" TEXT,

    CONSTRAINT "RegistroErro_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RegistroErro_criadoEm_idx" ON "RegistroErro"("criadoEm");

-- CreateTable
CREATE TABLE "ModeloProjeto" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "equipe" TEXT,
    "natureza" TEXT,
    "categoria" TEXT,
    "apoio" TEXT,
    "setorEnvolvido" TEXT,
    "criadoPor" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModeloProjeto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModeloAcao" (
    "id" TEXT NOT NULL,
    "modeloId" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "descricao" TEXT NOT NULL,
    "inicioDiasUteis" INTEGER,
    "duracaoDiasUteis" INTEGER,

    CONSTRAINT "ModeloAcao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ModeloProjeto_nome_key" ON "ModeloProjeto"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "ModeloAcao_modeloId_ordem_key" ON "ModeloAcao"("modeloId", "ordem");

-- AddForeignKey
ALTER TABLE "ModeloAcao" ADD CONSTRAINT "ModeloAcao_modeloId_fkey" FOREIGN KEY ("modeloId") REFERENCES "ModeloProjeto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

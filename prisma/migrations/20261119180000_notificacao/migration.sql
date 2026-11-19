-- CreateTable
CREATE TABLE "Notificacao" (
    "id" TEXT NOT NULL,
    "destinatarioId" TEXT NOT NULL,
    "comentarioId" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "lida" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notificacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Notificacao_destinatarioId_comentarioId_key" ON "Notificacao"("destinatarioId", "comentarioId");

-- CreateIndex
CREATE INDEX "Notificacao_destinatarioId_lida_criadoEm_idx" ON "Notificacao"("destinatarioId", "lida", "criadoEm");

-- AddForeignKey
ALTER TABLE "Notificacao" ADD CONSTRAINT "Notificacao_destinatarioId_fkey" FOREIGN KEY ("destinatarioId") REFERENCES "Colaborador"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notificacao" ADD CONSTRAINT "Notificacao_comentarioId_fkey" FOREIGN KEY ("comentarioId") REFERENCES "ComentarioAcao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

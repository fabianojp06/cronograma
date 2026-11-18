-- Responsável individual pela ação, escolhido entre os colaboradores.
-- Opcional: as ações já existentes ficam sem responsável.
ALTER TABLE "Acao" ADD COLUMN "responsavelId" TEXT;

CREATE INDEX "Acao_responsavelId_idx" ON "Acao"("responsavelId");

ALTER TABLE "Acao" ADD CONSTRAINT "Acao_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "Colaborador"("id") ON DELETE SET NULL ON UPDATE CASCADE;

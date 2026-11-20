-- Líder do projeto escolhido na lista de colaboradores. Aditiva: coluna nula;
-- os projetos existentes seguem com o nome em `responsavel` até alguém salvá-los.
ALTER TABLE "Projeto" ADD COLUMN "liderId" TEXT;
CREATE INDEX "Projeto_liderId_idx" ON "Projeto"("liderId");
ALTER TABLE "Projeto" ADD CONSTRAINT "Projeto_liderId_fkey" FOREIGN KEY ("liderId") REFERENCES "Colaborador"("id") ON DELETE SET NULL ON UPDATE CASCADE;

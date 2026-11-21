-- Lixeira de projetos: quando e por quem foi excluído e restaurado. Aditiva:
-- colunas nulas; projetos excluídos antes ficam sem data ("data não registrada").
ALTER TABLE "Projeto" ADD COLUMN "excluidoEm" TIMESTAMP(3);
ALTER TABLE "Projeto" ADD COLUMN "excluidoPor" TEXT;
ALTER TABLE "Projeto" ADD COLUMN "restauradoEm" TIMESTAMP(3);
ALTER TABLE "Projeto" ADD COLUMN "restauradoPor" TEXT;

-- O limite de 3 WINs por semana é do método, não da tela.
--
-- `@@unique([cardId, ordem])` garante que duas linhas não ocupem a mesma
-- posição, mas NÃO limita o valor de `ordem`: sem esta verificação, uma
-- gravação fora da tela poderia criar as posições 4, 5, 6 e furar o limite
-- silenciosamente. O Prisma não expressa CHECK no schema, então vai em SQL.
--
-- Migration separada de propósito: a anterior já pode ter sido aplicada em
-- alguma máquina, e o CLAUDE.md proíbe reescrever migration aplicada.
ALTER TABLE "WinSemana"
  ADD CONSTRAINT "WinSemana_ordem_entre_1_e_3" CHECK ("ordem" BETWEEN 1 AND 3);

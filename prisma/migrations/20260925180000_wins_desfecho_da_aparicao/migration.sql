-- O desfecho de uma aparição do WIN numa semana.
--
-- Antes, promover ou encerrar APAGAVA a linha `WinSemana` da semana da ação.
-- Isso destruía o histórico: a semana em que a equipe promoveu tudo ficava
-- vazia nos relatórios, e cada WIN promovido perdia uma aparição na contagem
-- de recorrência. Reconstruir por `Win.promovidoEm` não serve — esse campo
-- guarda quando a ação rodou, não a semana em que o WIN estava no card.
--
-- O desfecho mora na APARIÇÃO, e não no WIN, porque um WIN promovido na semana
-- 39 continua tendo acontecido nas semanas 37 e 38.
CREATE TYPE "DesfechoWin" AS ENUM ('NO_CARD', 'PROMOVIDO', 'ENCERRADO');

ALTER TABLE "WinSemana"
  ADD COLUMN "desfecho" "DesfechoWin" NOT NULL DEFAULT 'NO_CARD';

-- A vaga no card passa a ser liberada pelo desfecho, não pela ausência da
-- linha. A unicidade de (cardId, ordem) vira PARCIAL: duas linhas podem
-- compartilhar a mesma posição desde que só uma delas esteja no card.
--
-- O Prisma não expressa índice parcial, então ele vive aqui — mesmo caminho já
-- usado pela CHECK `WinSemana_ordem_entre_1_e_3`.
DROP INDEX "WinSemana_cardId_ordem_key";

CREATE UNIQUE INDEX "WinSemana_cardId_ordem_no_card"
  ON "WinSemana" ("cardId", "ordem")
  WHERE "desfecho" = 'NO_CARD';

-- Consulta quente dos relatórios: todas as aparições de um card, por desfecho.
CREATE INDEX "WinSemana_desfecho_idx" ON "WinSemana" ("desfecho");

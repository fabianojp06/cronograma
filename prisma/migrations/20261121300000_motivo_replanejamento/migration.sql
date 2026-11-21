-- Por que a data prevista mudou: duas colunas nulas no histórico. Aditiva; o
-- histórico antigo fica sem motivo e a tela o chama de "sem motivo registrado".
ALTER TABLE "HistoricoAlteracao" ADD COLUMN "motivo" TEXT;
ALTER TABLE "HistoricoAlteracao" ADD COLUMN "motivoDetalhe" TEXT;

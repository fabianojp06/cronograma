-- E-mail do colaborador, para as notificações de responsável por ação.
-- Opcional: quem veio da importação da planilha nunca fez login e só ganha
-- e-mail quando alguém o preenche em /colaboradores.
ALTER TABLE "Colaborador" ADD COLUMN "email" TEXT;

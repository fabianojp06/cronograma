#!/usr/bin/env bash
#
# autoloop.sh — Loop de execução autônoma para Claude Code (v1.1)
#
# Uso:
#   ./autoloop.sh
#   CHECK_CMD="npm test" MAX_ITERACOES=10 ./autoloop.sh
#
# Novidades desta versão (v1.1) em relação à original:
#   - Checa `claude auth status` ANTES de iniciar o loop, não durante a 1ª iteração
#     (evita descobrir sessão expirada só depois de já ter começado).
#   - Exige um cabeçalho esperado no PROGRESS.md (PROGRESS_HEADER) e PARA se não
#     bater, em vez de criar um PROGRESS.md genérico silenciosamente por cima do
#     arquivo certo que só não estava no lugar esperado.
#   - Checa se o git está limpo (working tree sem mudanças não commitadas) antes de
#     começar, e avisa (sem bloquear) se não estiver.
#
# Como funciona:
#   1. A cada rodada, chama `claude -p` com uma instrução fixa pedindo pra ler o
#      PROGRESS.md, executar o próximo passo pendente, rodar os testes/lint
#      definidos no projeto, e atualizar o PROGRESS.md.
#   2. Se os testes falharem (exit code != 0 do comando de check), o loop para e
#      não avança — evita empilhar erro sobre erro.
#   3. Se o Claude sinalizar TAREFA_CONCLUIDA no PROGRESS.md, o loop encerra.
#   4. Tudo fica logado em ./autoloop.log com timestamp.
#
# Pré-requisitos:
#   - Claude Code instalado, autenticado (`claude` no PATH) e com sessão válida
#   - Um PROGRESS.md na raiz do projeto, com o cabeçalho esperado (ver PROGRESS_HEADER)
#   - Opcional: um comando de check (testes/lint) via variável CHECK_CMD

set -uo pipefail

# ---------- Configuração (pode sobrescrever via variável de ambiente) ----------
PROJECT_DIR="${PROJECT_DIR:-$(pwd)}"
PROGRESS_FILE="${PROGRESS_FILE:-$PROJECT_DIR/PROGRESS.md}"
PROGRESS_HEADER="${PROGRESS_HEADER:-# PROGRESS}"        # início esperado do PROGRESS.md deste projeto
LOG_FILE="${LOG_FILE:-$PROJECT_DIR/autoloop.log}"
MAX_ITERACOES="${MAX_ITERACOES:-15}"
SLEEP_ENTRE_RODADAS="${SLEEP_ENTRE_RODADAS:-5}"       # segundos
CHECK_CMD="${CHECK_CMD:-}"                             # ex: "npm test" ou "npm run lint"
CLAUDE_MODEL="${CLAUDE_MODEL:-}"                       # opcional: "sonnet", "opus" etc
PROMPT_CUSTOM="${PROMPT_CUSTOM:-}"                     # instrução extra opcional

TOKEN_CONCLUIDO="TAREFA_CONCLUIDA"
TOKEN_BLOQUEADO="TAREFA_BLOQUEADA"

# ---------- Funções auxiliares ----------
log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

checar_prerequisitos() {
  if ! command -v claude &> /dev/null; then
    log "ERRO: comando 'claude' não encontrado no PATH. Instale o Claude Code primeiro."
    exit 1
  fi

  # Checa autenticação ANTES de entrar no loop — evita descobrir sessão
  # expirada só na primeira iteração (isso já aconteceu antes).
  log "Verificando autenticação do Claude Code..."
  if ! claude auth status &> /dev/null; then
    log "ERRO: sessão do Claude Code não autenticada ou expirada."
    log "Rode 'claude auth login' e tente novamente."
    exit 1
  fi

  # PROGRESS.md deve existir e ter o cabeçalho esperado. Se não existir OU não
  # bater o cabeçalho, PARA em vez de criar um genérico por cima — evitar repetir
  # o erro de sobrescrever silenciosamente o arquivo certo do projeto.
  if [ ! -f "$PROGRESS_FILE" ]; then
    log "ERRO: $PROGRESS_FILE não existe."
    log "Copie o PROGRESS.md específico deste projeto para a raiz antes de rodar."
    exit 1
  fi

  if ! head -n1 "$PROGRESS_FILE" | grep -q "^${PROGRESS_HEADER}"; then
    log "ERRO: $PROGRESS_FILE não começa com o cabeçalho esperado ('$PROGRESS_HEADER')."
    log "Isso normalmente indica que é o PROGRESS.md errado (de outro projeto, ou um"
    log "genérico). Verifique o arquivo manualmente antes de rodar o loop."
    exit 1
  fi

  # O fluxo passa pela homologação: sem a branch `homologacao` no GitHub o loop
  # não tem onde abrir PR (a main é só a produção). Para em vez de cair na main.
  if command -v git &> /dev/null && git -C "$PROJECT_DIR" rev-parse --is-inside-work-tree &> /dev/null; then
    if ! git -C "$PROJECT_DIR" ls-remote --exit-code --heads origin homologacao &> /dev/null; then
      log "ERRO: a branch 'homologacao' não existe no repositório remoto."
      log "O autoloop trabalha contra ela (nunca contra a main). Crie-a antes de rodar."
      exit 1
    fi
  fi

  # Aviso (não bloqueia) se o git não estiver limpo.
  if command -v git &> /dev/null && git -C "$PROJECT_DIR" rev-parse --is-inside-work-tree &> /dev/null; then
    if [ -n "$(git -C "$PROJECT_DIR" status --porcelain)" ]; then
      log "AVISO: working tree do git não está limpo. Recomenda-se commitar antes"
      log "de rodar o autoloop, para poder reverter facilmente se algo der errado."
    fi
  fi
}

montar_prompt() {
  local extra="$1"
  cat <<EOF
Leia o arquivo PROGRESS.md na raiz deste projeto.

Sua tarefa nesta rodada:
1. Identifique o próximo item pendente do backlog (primeiro item não marcado como concluído).
2. Execute esse item de ponta a ponta (código, migrations, testes, o que for necessário).
3. Se houver comando de verificação configurado, rode-o e garanta que passe antes de prosseguir.
4. Atualize o PROGRESS.md:
   - marque o item como concluído
   - adicione uma linha no "Log de decisões" explicando o que foi feito
   - se encontrar um bloqueio real (decisão de negócio, credencial faltando, ambiguidade que só o usuário resolve), escreva "$TOKEN_BLOQUEADO" na seção Status e explique o motivo
   - se o backlog inteiro estiver concluído, escreva "$TOKEN_CONCLUIDO" na seção Status
5. Não peça confirmação ao usuário — decida e prossiga, a menos que seja um bloqueio real (item 4).
6. Git: trabalhe numa branch etapa-N criada a partir de origin/homologacao, abra o PR contra a branch homologacao e só mescle lá, depois do CI verde. NUNCA faça push, PR ou merge na main: a promoção para a produção é decisão humana.

${extra}

Trabalhe apenas dentro deste projeto. Ao final, garanta que o PROGRESS.md reflita o estado real.
EOF
}

status_atual() {
  grep -A1 "^## Status" "$PROGRESS_FILE" 2>/dev/null | tail -n1 | tr -d '[:space:]'
}

# ---------- Loop principal ----------
main() {
  checar_prerequisitos
  cd "$PROJECT_DIR" || exit 1

  log "=== Iniciando autoloop.sh (v1.1) ==="
  log "Projeto: $PROJECT_DIR"
  log "Máximo de iterações: $MAX_ITERACOES"
  [ -n "$CHECK_CMD" ] && log "Comando de verificação: $CHECK_CMD"

  local iteracao=1
  while [ "$iteracao" -le "$MAX_ITERACOES" ]; do
    log "--- Iteração $iteracao/$MAX_ITERACOES ---"

    local prompt
    prompt="$(montar_prompt "$PROMPT_CUSTOM")"

    local claude_args=(-p "$prompt" --dangerously-skip-permissions)
    [ -n "$CLAUDE_MODEL" ] && claude_args+=(--model "$CLAUDE_MODEL")

    log "Chamando Claude Code..."
    if ! claude "${claude_args[@]}" 2>&1 | tee -a "$LOG_FILE"; then
      log "ERRO: chamada ao Claude Code falhou nesta iteração. Parando o loop."
      exit 1
    fi

    # Verificação opcional (testes/lint) após a mudança
    if [ -n "$CHECK_CMD" ]; then
      log "Rodando comando de verificação: $CHECK_CMD"
      if ! eval "$CHECK_CMD" >> "$LOG_FILE" 2>&1; then
        log "FALHA na verificação ($CHECK_CMD). Parando o loop para revisão manual."
        exit 1
      fi
      log "Verificação passou."
    fi

    local status
    status="$(status_atual)"
    log "Status atual do PROGRESS.md: ${status:-desconhecido}"

    if [[ "$status" == *"$TOKEN_CONCLUIDO"* ]]; then
      log "Backlog concluído. Encerrando o loop com sucesso."
      exit 0
    fi

    if [[ "$status" == *"$TOKEN_BLOQUEADO"* ]]; then
      log "Tarefa bloqueada — precisa de decisão humana. Encerrando o loop."
      exit 2
    fi

    iteracao=$((iteracao + 1))
    log "Aguardando ${SLEEP_ENTRE_RODADAS}s antes da próxima rodada..."
    sleep "$SLEEP_ENTRE_RODADAS"
  done

  log "Número máximo de iterações ($MAX_ITERACOES) atingido sem conclusão. Revise o PROGRESS.md."
  exit 3
}

main

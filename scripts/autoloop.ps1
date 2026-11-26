<#
.SYNOPSIS
    autoloop.ps1 — Loop de execução autônoma para Claude Code (v1.1, PowerShell)

.DESCRIPTION
    Equivalente em PowerShell do autoloop.sh. Mesma lógica:
      - Checa autenticação do Claude Code ANTES de iniciar o loop.
      - Exige que PROGRESS.md exista e comece com o cabeçalho esperado, para não
        confundir com o PROGRESS.md de outro projeto ou criar um genérico por cima.
      - Avisa (sem bloquear) se o git não estiver limpo.
      - A cada rodada, chama 'claude -p' pedindo para ler o PROGRESS.md, executar o
        próximo item pendente, rodar os testes/lint definidos, e atualizar o arquivo.
      - Se o comando de verificação falhar, o loop para.
      - Se o PROGRESS.md sinalizar TAREFA_CONCLUIDA, o loop encerra com sucesso.
      - Tudo fica logado em autoloop.log.

.PARAMETER ProjectDir
    Pasta raiz do projeto. Padrão: diretório atual.

.PARAMETER CheckCmd
    Comando de verificação (testes/lint) a rodar após cada iteração, ex: "npm test".

.PARAMETER MaxIteracoes
    Número máximo de rodadas. Padrão: 15.

.PARAMETER SleepEntreRodadas
    Segundos de espera entre rodadas. Padrão: 5.

.PARAMETER ClaudeModel
    Modelo específico a usar (opcional), ex: "sonnet".

.EXAMPLE
    .\scripts\autoloop.ps1 -CheckCmd "npm test" -MaxIteracoes 5
#>

param(
    [string]$ProjectDir = (Get-Location).Path,
    [string]$ProgressFile = $null,
    [string]$ProgressHeader = "# PROGRESS",
    [string]$LogFile = $null,
    [int]$MaxIteracoes = 15,
    [int]$SleepEntreRodadas = 5,
    [string]$CheckCmd = "",
    [string]$ClaudeModel = "",
    [string]$PromptCustom = ""
)

if (-not $ProgressFile) { $ProgressFile = Join-Path $ProjectDir "PROGRESS.md" }
if (-not $LogFile) { $LogFile = Join-Path $ProjectDir "autoloop.log" }

$TokenConcluido = "TAREFA_CONCLUIDA"
$TokenBloqueado = "TAREFA_BLOQUEADA"

function Write-Log {
    param([string]$Message)
    $linha = "[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Message
    Write-Host $linha
    Add-Content -Path $LogFile -Value $linha
}

function Test-Prerequisitos {
    if (-not (Get-Command claude -ErrorAction SilentlyContinue)) {
        Write-Log "ERRO: comando 'claude' nao encontrado no PATH. Instale o Claude Code primeiro."
        exit 1
    }

    # Checa autenticacao ANTES de entrar no loop.
    Write-Log "Verificando autenticacao do Claude Code..."
    $authOk = $true
    try {
        claude auth status | Out-Null
        if ($LASTEXITCODE -ne 0) { $authOk = $false }
    } catch {
        $authOk = $false
    }
    if (-not $authOk) {
        Write-Log "ERRO: sessao do Claude Code nao autenticada ou expirada."
        Write-Log "Rode 'claude auth login' e tente novamente."
        exit 1
    }

    if (-not (Test-Path $ProgressFile)) {
        Write-Log "ERRO: $ProgressFile nao existe."
        Write-Log "Copie o PROGRESS.md especifico deste projeto para a raiz antes de rodar."
        exit 1
    }

    $primeiraLinha = Get-Content $ProgressFile -TotalCount 1
    if (-not $primeiraLinha.StartsWith($ProgressHeader)) {
        Write-Log "ERRO: $ProgressFile nao comeca com o cabecalho esperado ('$ProgressHeader')."
        Write-Log "Isso normalmente indica que e o PROGRESS.md errado (de outro projeto, ou"
        Write-Log "um generico). Verifique o arquivo manualmente antes de rodar o loop."
        exit 1
    }

    if (Get-Command git -ErrorAction SilentlyContinue) {
        Push-Location $ProjectDir
        $isRepo = git rev-parse --is-inside-work-tree 2>$null
        if ($isRepo -eq "true") {
            $status = git status --porcelain
            if ($status) {
                Write-Log "AVISO: working tree do git nao esta limpo. Recomenda-se commitar antes"
                Write-Log "de rodar o autoloop, para poder reverter facilmente se algo der errado."
            }
        }
        if ($isRepo -eq "true") {
            # O fluxo passa pela homologacao: sem a branch no GitHub o loop nao tem onde
            # abrir PR (a main e so a producao). Para em vez de cair na main.
            git ls-remote --exit-code --heads origin homologacao *> $null
            if ($LASTEXITCODE -ne 0) {
                Write-Log "ERRO: a branch 'homologacao' nao existe no repositorio remoto."
                Write-Log "O autoloop trabalha contra ela (nunca contra a main). Crie-a antes de rodar."
                Pop-Location
                exit 1
            }
        }
        Pop-Location
    }
}

function New-Prompt {
    param([string]$Extra)
    @"
Leia o arquivo PROGRESS.md na raiz deste projeto.

Sua tarefa nesta rodada:
1. Identifique o proximo item pendente do backlog (primeiro item nao marcado como concluido).
2. Execute esse item de ponta a ponta (codigo, migrations, testes, o que for necessario).
3. Se houver comando de verificacao configurado, rode-o e garanta que passe antes de prosseguir.
4. Atualize o PROGRESS.md:
   - marque o item como concluido
   - adicione uma linha no "Log de decisoes" explicando o que foi feito
   - se encontrar um bloqueio real (decisao de negocio, credencial faltando, ambiguidade que so o usuario resolve), escreva "$TokenBloqueado" na secao Status e explique o motivo
   - se o backlog inteiro estiver concluido, escreva "$TokenConcluido" na secao Status
5. Nao peca confirmacao ao usuario - decida e prossiga, a menos que seja um bloqueio real (item 4).
6. Git: trabalhe numa branch etapa-N criada a partir de origin/homologacao, abra o PR contra a branch homologacao e so mescle la, depois do CI verde. NUNCA faca push, PR ou merge na main: a promocao para a producao e decisao humana.

$Extra

Trabalhe apenas dentro deste projeto. Ao final, garanta que o PROGRESS.md reflita o estado real.
"@
}

function Get-StatusAtual {
    $conteudo = Get-Content $ProgressFile
    $idx = ($conteudo | Select-String -Pattern "^## Status").LineNumber
    if ($idx -and $conteudo.Count -gt $idx) {
        return $conteudo[$idx].Trim()
    }
    return $null
}

# ---------- Execução principal ----------
Test-Prerequisitos
Set-Location $ProjectDir

Write-Log "=== Iniciando autoloop.ps1 (v1.1) ==="
Write-Log "Projeto: $ProjectDir"
Write-Log "Maximo de iteracoes: $MaxIteracoes"
if ($CheckCmd) { Write-Log "Comando de verificacao: $CheckCmd" }

for ($iteracao = 1; $iteracao -le $MaxIteracoes; $iteracao++) {
    Write-Log "--- Iteracao $iteracao/$MaxIteracoes ---"

    $prompt = New-Prompt -Extra $PromptCustom

    $claudeArgs = @("-p", $prompt, "--dangerously-skip-permissions")
    if ($ClaudeModel) { $claudeArgs += @("--model", $ClaudeModel) }

    Write-Log "Chamando Claude Code..."
    $output = & claude @claudeArgs 2>&1
    $output | Tee-Object -FilePath $LogFile -Append | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Log "ERRO: chamada ao Claude Code falhou nesta iteracao. Parando o loop."
        exit 1
    }

    if ($CheckCmd) {
        Write-Log "Rodando comando de verificacao: $CheckCmd"
        Invoke-Expression $CheckCmd *>> $LogFile
        if ($LASTEXITCODE -ne 0) {
            Write-Log "FALHA na verificacao ($CheckCmd). Parando o loop para revisao manual."
            exit 1
        }
        Write-Log "Verificacao passou."
    }

    $status = Get-StatusAtual
    Write-Log "Status atual do PROGRESS.md: $status"

    if ($status -like "*$TokenConcluido*") {
        Write-Log "Backlog concluido. Encerrando o loop com sucesso."
        exit 0
    }

    if ($status -like "*$TokenBloqueado*") {
        Write-Log "Tarefa bloqueada - precisa de decisao humana. Encerrando o loop."
        exit 2
    }

    Write-Log "Aguardando $SleepEntreRodadas s antes da proxima rodada..."
    Start-Sleep -Seconds $SleepEntreRodadas
}

Write-Log "Numero maximo de iteracoes ($MaxIteracoes) atingido sem conclusao. Revise o PROGRESS.md."
exit 3

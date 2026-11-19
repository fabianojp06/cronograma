# CLAUDE.md — Sistema Cronograma CTCEA

Este arquivo é lido pelo Claude Code no início de cada sessão/iteração. Mantenha-o
atualizado — é a fonte de verdade sobre o projeto para qualquer execução autônoma.

## O que é este sistema

Substitui duas planilhas Excel usadas hoje na CTCEA para acompanhamento de projetos:

- **PLA-DEP-2026-001.xlsx** — plano de ação consolidado, multi-equipe (STI, GIA, GRH...),
  com Prioridade, Equipe, Natureza, Assunto, Responsável, Apoio, Setor Envolvido,
  Comentário, Progresso, e uma grade semanal Previsto x Realizado por ação.
- **CRO-DEP-2026-001.xlsx** — cronograma detalhado de um único projeto (mesma lógica
  de grade semanal Previsto x Realizado, porém focado em um projeto específico).

O sistema deve oferecer as duas visões: uma **consolidada** (todos os projetos, modelo
PLA-DEP) e um **drill-down por projeto** (modelo CRO-DEP).

## Repositório

- GitHub: https://github.com/fabianojp06/cronograma (privado)
- `autoloop.sh` (bash) ou `autoloop.ps1` (PowerShell, para Windows sem WSL/Git
  Bash) espera este repositório já clonado e com pelo menos um commit inicial na
  raiz antes da primeira rodada. Use o script correspondente ao seu terminal —
  a lógica é idêntica nos dois.

## Infraestrutura

- Deploy: Vercel — Project ID `prj_HxI1VBYwefOAGBqyJXvEOCBAkHPO` (projeto
  `cronograma-lktu`). **É o único alvo de deploy.** Existiu um projeto duplicado
  `cronograma` (`prj_xVigzFjO4V2v01bJG3KgESToQ0TV`) ligado ao mesmo repositório,
  sem variáveis de ambiente; foi desconectado em 21/09/2026. Se um segundo deploy
  voltar a aparecer por push, é ele de novo.
- Banco de dados: Railway (PostgreSQL) — Project ID `28445ef3-95ee-44bd-bfba-b5af383d8057`
- Autenticação: Clerk — Instance ID `ins_3JTS4qDnU1wKm8mPloItwq6KxYJ`, com login social via Microsoft/Outlook (Azure AD OAuth)

## Contexto organizacional

- Uso interno único da CTCEA (OSCIP brasileira). **Não é multi-tenant.**
- Sistema **independente** — não é módulo do SGO 2.0, não compartilha banco com ele.
- Idioma da interface e dos dados: **Português (BR)**.

## Stack técnica

- Next.js (App Router) + TypeScript
- Prisma + PostgreSQL
- Tailwind CSS
- Server Actions para mutações (evitar API routes REST quando Server Action resolver)
- Testes: Jest ou Vitest (definir na Etapa 1 do backlog e manter consistente depois)

## Convenções de código

- Nomes de campos e tabelas do domínio em português (`Projeto`, `Acao`, `previstoInicio`,
  `realizadoTermino`) — reflete a linguagem do negócio, igual às planilhas originais.
- Toda mutação de status/data de uma `Acao` deve gravar uma linha em `HistoricoAlteracao`
  (campo, valor antigo, valor novo, timestamp). Isso é o que a planilha não tem hoje e é
  um requisito central do sistema — não pule isso.
- Datas de negócio calculadas em **dias úteis** (excluir sábados, domingos e feriados
  nacionais fixos — sem necessidade de calendário de feriados variável no MVP).
- Cores de status na UI: Previsto = azul, Realizado = verde, Atraso (Realizado ausente e
  Previsto < hoje, status != Concluído) = vermelho.

## Referência visual (protótipo aprovado)

As 4 telas prioritárias já têm protótipo aprovado pelo usuário, em:
https://claude.ai/artifact/WPxn8dThgUAmMPJHAPJzhs

Estilo escolhido: "Painel Operacional" — claro/moderno por padrão, sem cards com
sombra genérica; indicadores marcados por um traço colorido à esquerda em vez de
cartão; tabela/lista com barra de progresso ou timeline embutida na própria linha.
Tipografia: `Manrope` (títulos/display) + `Public Sans` (corpo). Deve existir
alternância completa entre modo claro e escuro (não só cor de fundo — todo o
conjunto de tokens abaixo troca junto).

**Implementado** (ver `src/lib/tema.ts` + `src/components/alternador-tema.tsx`):
o alternador fica no cabeçalho com três opções — **Sistema** (padrão, segue o
sistema operacional), **Claro** e **Escuro** — e a escolha é guardada no
`localStorage` sob a chave `ctcea-tema`. O modo escuro é ligado pela classe
`dark` no `<html>`; nenhum componente deve testar o tema por conta própria,
basta usar os tokens. Duas regras que não podem ser quebradas ao mexer nisso:

- `SCRIPT_TEMA` é injetado inline no `<head>` pelo layout e roda **antes da
  primeira pintura**. Sem ele, quem usa tema escuro vê um flash branco a cada
  navegação, porque o servidor não tem como conhecer a preferência.
- Por isso o `<html>` leva `suppressHydrationWarning`: o script altera a classe
  antes do React hidratar, e a divergência é intencional.
- O alternador lê a preferência por `useSyncExternalStore` (`localStorage` e
  `prefers-color-scheme` são stores externos), nunca com `setState` dentro de
  `useEffect` — o lint do React Compiler barra, e com razão.

Tokens de tema (usar exatamente estes valores; implementar como CSS variables ou
tema do Tailwind, não hardcoded em cada componente):

| Token | Claro | Escuro |
|---|---|---|
| `bg` | `#F5F7FA` | `#0B1418` |
| `surface` | `#FFFFFF` | `#121C21` |
| `border` | `#E3E8EC` | `#1E2B31` |
| `borderSoft` | `#F0F3F5` | `#18232A` |
| `text` | `#16212B` | `#EAF1F0` |
| `textMuted` | `#5B6B76` | `#8FA3A0` |
| `textFaint` | `#8B98A3` | `#5C716E` |
| `accent` | `#0F766E` | `#2DD4BF` |
| `onAccent` (texto sobre `accent`) | `#FFFFFF` | `#0B1418` |
| `warn` (atraso) | `#E76F51` | `#F3866A` |
| `tableHeadBg` | `#FAFBFC` | `#0F1A1F` |

Telas prototipadas, nesta ordem de prioridade — implementar visualmente fiel ao
protótipo, ajustando apenas o que a interatividade real exigir:
1. Dashboard consolidado (artboard `C-PainelOperacional`)
2. Detalhe do projeto com Gantt (artboard `D-DetalheGantt`) — barras Previsto
   (contorno) e Realizado (sólida) posicionadas proporcionalmente pela data, com
   linha vertical marcando "hoje"
3. Formulário de Projeto (artboard `E-FormularioProjeto`)
4. Formulário de Ação (artboard `F-FormularioAcao`) — inclui painel de histórico
   de alterações ao lado do formulário

As telas **Dashboards** (`/dashboards`) e **Matriz de Priorização**
(`/priorizacao`) não têm artboard no protótipo — foram desenhadas depois,
seguindo os mesmos tokens e o mesmo estilo (traço lateral, barra embutida na
linha, sem card com sombra).

## Regras de gráfico (tela Dashboards)

Valem para qualquer visualização nova. Não são estéticas — cada uma evita um erro
de leitura concreto.

- **Sem biblioteca de charting.** Os gráficos são SVG inline ou `div` com largura
  percentual, renderizados no servidor. Não adicionar dependência de gráfico sem
  necessidade real.
- **Um único eixo.** Nunca dois eixos Y no mesmo gráfico. Duas grandezas de escala
  diferente viram dois gráficos ou small multiples com escala compartilhada.
- **Magnitude usa uma cor só** (`accent`). Comparar volume não é questão de
  identidade; pintar cada linha de uma cor sugere uma categoria que não existe.
- **Cor de status é reservada.** `previsto` (azul), `realizado` (verde), `warn`
  (atraso) e `textFaint` (não iniciado) significam sempre a mesma coisa em toda a
  aplicação, e nunca são reaproveitadas como "série 4".
- **Ordem da pilha por status é fixa:** `SEM_ACOES → CONCLUIDO → EM_ANDAMENTO →
  NAO_INICIADO → ATRASADO`. Não é arbitrária: verde ao lado de laranja dá ΔE 6.6 em
  protanopia (abaixo do piso de legibilidade); nesta ordem o pior par adjacente sobe
  para ΔE 11.7. Se for mexer na ordem, revalidar.
- **Identidade nunca fica só na cor.** Toda série tem legenda; até 4 séries também
  levam rótulo direto. Todo gráfico vem acompanhado dos números (tabela ou rótulo).
- **Os dois modos são validados separadamente.** O modo escuro não é inversão
  automática — os tokens trocam juntos e o contraste é conferido nos dois.
- **Quadrante é posição, não cor.** No plano da Matriz de Priorização as quatro
  regiões têm tinta de FUNDO (`--quad-*` em globals.css), e os pontos ficam todos
  na mesma cor. Num gráfico 2×2 quem identifica o quadrante é a posição; colorir
  os pontos seria redundante e gastaria em decoração as cores reservadas a status.
  O contraste do ponto sobre cada uma das quatro tintas foi validado em ≥ 3:1 nos
  dois modos — ao trocar uma tinta, revalidar.
- **Ponto da matriz leva o número do ranking, não o nome.** Nome escrito no plano
  se sobrepunha quando dois projetos tinham notas parecidas. O número é o mesmo
  "#" da tabela e a legenda ao lado liga número → nome. Pontos que se tocam são
  afastados em círculo, com um traço até a posição real. `?projeto=<id>` destaca
  um projeto (os demais esmaecem); a tela `/priorizacao/[id]` usa o mesmo destaque.

## Estrutura de dados (ver SCHEMA.md para o schema Prisma completo)

- `Projeto` — um item do plano de ação (equivale a uma linha do PLA-DEP)
- `Acao` — pertence a um `Projeto`, tem datas Previsto/Realizado e status
- `HistoricoAlteracao` — trilha de auditoria de mudanças em `Acao`

## Catálogo de relatórios

`src/lib/dashboard-catalogo.ts` é a **única fonte de verdade** sobre quais relatórios
existem na tela `/dashboards`. O índice de navegação e as âncoras de seção são
derivados dele — ao criar um relatório novo, declare-o lá primeiro; a página estoura
de propósito se referenciar um id que não está no catálogo.

Cada relatório declara a `pergunta` de negócio que responde. Relatório que não
responde a uma pergunta que alguém realmente faz não entra.

A agregação fica em módulos puros (`dashboard-dimensoes`, `dashboard-prazos`,
`dashboard-temporal`, `dashboard-qualidade`, `dashboard-auditoria`), sem Prisma e
sem Next, cada um com seu `.test.ts` — igual ao resto de `src/lib/`. Os relatórios
partem das mesmas funções do painel consolidado (`montarLinhas`, `resumirAcoes`):
painel e dashboard nunca podem somar diferente.

## Desempenho de `/dashboards`

A página lê todos os projetos com todas as ações e agrega em memória a cada
acesso, sem cache. `scripts/medir-dashboards.ts` mede o custo de servidor (consulta
+ agregação, sem renderização nem rede) em escalas crescentes, **só contra banco
local** — ele semeia e apaga dados e recusa qualquer `DATABASE_URL` que não seja
localhost. Medição de 18/11/2026, mediana de 5 rodadas:

| ações | consulta | agregação | total |
|---:|---:|---:|---:|
| 300 | 18 ms | 3 ms | 21 ms |
| 2.000 | 27 ms | 24 ms | 51 ms |
| 9.000 | 94 ms | 123 ms | 217 ms |
| 30.000 | 816 ms | 661 ms | 1,5 s |

**Decisão: sem cache por enquanto.** Até uns 10 mil ações o custo fica abaixo de
meio segundo; cache traria invalidação (cada mutação teria de revalidar) por um
ganho que ninguém sente. **Gatilho para voltar ao assunto:** a carteira passar de
~10 mil ações, ou o servidor passar de ~1 s. A ordem de ataque, nesse caso:
agregar no banco (`groupBy`) em vez de trazer as linhas; só depois cache. Os
números reais de produção não foram medidos — o log da Vercel Hobby guarda 1 hora
e não traz duração; conte as ações de produção antes de decidir.

## Matriz de Priorização (`/priorizacao`)

Substitui a planilha `Matriz de Priorização: Benefício x Esforço (Ponderado por
GUT)`. As fórmulas foram transcritas da planilha e **não devem ser "melhoradas"
sem decisão do negócio** — são o modelo aprovado pela CTCEA:

```
TOTAL DE BENEFÍCIO = Σ (nota × peso)        5 critérios, escala 0/3/6/9
TOTAL DE ESFORÇO   = Σ (nota × peso)        5 critérios, escala 0/3/6/9
TOTAL GUT          = G × U × T              produto, cada fator de 1 a 5
PRIORIDADE         = SE(Esforço = 0; Benefício × GUT; (Benefício × GUT) / Esforço)
```

- `src/lib/matriz-criterios.ts` é a **fonte única** dos dez critérios, das escalas
  e dos quadrantes. Os `id` dos critérios são exatamente os nomes das colunas de
  `AvaliacaoProjeto` — formulário, cálculo e gravação percorrem a mesma lista.
- **O GUT é produto, não média.** A planilha exibe "33%" ao lado de G, U e T, mas
  nenhuma fórmula dela usa esse número. Multiplicar é o que dá ao GUT sua
  não-linearidade: 5×5×5 = 125 contra 3×3×3 = 27.
- **Esforço zero não divide**: a planilha devolve só Benefício × GUT nesse caso.
  A guarda foi reproduzida como está.
- **Totais não são colunas do banco.** São derivados das notas e dos pesos
  vigentes a cada leitura, porque mudar um peso tem de repontuar a carteira
  inteira na hora. Guardá-los daria dois valores para a mesma verdade.
- **Pesos** ficam em `PesoCriterio`, em pontos percentuais inteiros; cada grupo
  precisa somar exatamente 100. Critério sem linha usa o padrão do catálogo, então
  a tabela vazia equivale à configuração original da planilha.
- **A matriz recomenda, não sobrescreve.** O campo `Projeto.prioridade` continua
  sendo decisão humana; a tela mostra os dois lado a lado.
- Os três projetos preenchidos da planilha original estão em
  `matriz-calculo.test.ts` como teste de paridade. Se um deles quebrar, o cálculo
  deixou de ser o modelo aprovado.

## Card WIN Semanal (`/wins`)

Integra a planilha `CARD WIN Semanal` — o compromisso semanal individual da GIA
(*What's Important Now*). **Não é uma planilha concorrente do plano de ação: é o
funil de entrada dele.** A própria planilha diz isso no rodapé de toda aba:

> "Caso um mesmo WIN se repetir por 3 semanas, já na terceira semana ele deve ser
> cadastrado no Plano de Ação (PLA-DEP-2026-001) e retirado do Card WIN."

```
Colaborador ──< CardSemanal ──< WinSemana >── Win ──> Projeto | Acao
                (ano/semana)    (ordem 1-3,   (identidade     (promoção)
                                 prazo,        que atravessa
                                 status)       semanas)
```

- **`Win` é a identidade; `WinSemana` é a aparição.** É o que permite contar
  repetições sem comparar texto. Na planilha o mesmo item aparecia como
  "… relatórios orçamentários", "… orçamentários ()" e "… orçamentários () -
  SGO": qualquer contagem por string erraria.
- **O bloco "semana anterior" é consulta, nunca cópia.** Era a duplicação manual
  dele que fazia a planilha divergir de si mesma (a aba S37 repetia o bloco da
  S36 em vez de trazer os WINs atuais dela).
- **Limite de 3 por semana, rígido**, garantido em duas camadas no banco, não
  só pela tela: `@@unique([cardId, ordem])` impede duas linhas na mesma posição,
  e a CHECK `WinSemana_ordem_entre_1_e_3` limita a posição a 1–3. A unicidade
  sozinha não bastava — ela não limita o *valor* de `ordem`.
- **A regra das 3 semanas conta aparições, não semanas consecutivas.** A planilha
  não tem a semana 34; quem não preenche o card numa semana não deveria zerar o
  contador, seria premiar o esquecimento que a regra quer pegar.
- **Repetir um WIN é uma ação explícita, não o reconhecimento do texto.** O
  botão "Repetir nesta semana", na lista da semana anterior, reaproveita a
  **mesma linha `Win`** — é só assim que as aparições se somam. Redigitar o
  mesmo assunto no formulário cria um `Win` novo, com o contador em zero, e a
  regra das 3 semanas nunca dispararia. Comparar descrições para adivinhar a
  intenção é justamente o que o par `Win`/`WinSemana` existe para evitar.
- **Promoção escolhe o destino na hora**: projeto novo ou ação dentro de projeto
  existente. Nem todo WIN vira projeto — "Finalização da documentação do módulo
  de integração" é parte do SGO, e forçar projeto novo fragmentaria a carteira.
- **O desfecho pertence à APARIÇÃO, não ao WIN** (`WinSemana.desfecho`:
  `NO_CARD` | `PROMOVIDO` | `ENCERRADO`). Um WIN promovido na semana 39
  continua tendo acontecido nas semanas 37 e 38 — ler o desfecho de
  `Win.promovidoEm` o tiraria do denominador de todas as semanas anteriores.
- **Promover e encerrar MARCAM a aparição da semana da ação; não apagam.**
  Apagar destruía o histórico que os relatórios leem: a semana em que a equipe
  promoveu tudo ficava vazia, e cada WIN promovido perdia uma aparição. As duas
  ações recebem `ano`/`semana` no formulário e só mexem naquela semana.
- **A vaga no card é liberada por índice único PARCIAL**, não pela ausência da
  linha: `WinSemana_cardId_ordem_no_card` vale só onde `desfecho = NO_CARD`.
  Assim `ordem` continua `NOT NULL` e nenhum call site precisa lidar com nulo.
  O Prisma não expressa índice parcial — ele vive em SQL na migration, mesmo
  caminho da CHECK de `ordem`.
- **Ocupação e duplicata são consultas diferentes.** "Que posições estão
  ocupadas?" filtra `desfecho: NO_CARD`; "este WIN já esteve neste card?" olha
  TODAS as linhas, porque `@@unique([cardId, winId])` vale para todas.
  Confundi-las troca a mensagem amigável por um P2002 cru.
- **Encerrar pergunta o desfecho**: "Concluí" grava `FEITO`, "Abandonei" grava
  `NAO_FEITO`. Sem a pergunta o WIN encerrado guardava o status que por acaso
  tinha — quase sempre PENDENTE — e a taxa de conclusão o contava como fracasso.
- **O importador filtra por desfecho, e em três lugares.** `deleteMany` sem
  filtro destruiria as aparições promovidas e encerradas a cada reimportação; a
  varredura de órfãos precisa checar `encerradoEm` além de `promovidoEm`; e a
  lista de "já resolvidos" também — sem ela o WIN encerrado seria recriado como
  `Win` novo, com linha `NO_CARD` na mesma `ordem` (o índice parcial permite,
  porque a linha encerrada não ocupa mais a vaga), deixando 4 aparições num card
  de 3: `/wins` mostraria 3 e `/dashboards` contaria 4.
- **O índice parcial e a CHECK de `ordem` só existem em SQL.** O Prisma não
  expressa nenhum dos dois, então um `prisma migrate dev` pode gerar um DROP e
  tirar em silêncio a camada de banco do limite de 3. `tests/integracao/`
  verifica os dois contra o `pg_indexes` justamente para que perdê-los seja
  barulhento — `@@index([desfecho])`, esse sim expressável, está no schema.
- **`aparicoesAnteriores` nunca é incrementado pelo sistema.** Ele significa
  "aparições anteriores ao sistema", vindas da importação. Somar as aparições
  vivas nele para poder apagá-las daria dois lugares para a mesma verdade.
- **Tirar da semana e encerrar são coisas diferentes.** Tirar libera a vaga e o
  WIN pode voltar somando aparições; encerrar (`Win.encerradoEm`) diz que ele
  não volta. Tirar a última aparição de um WIN que nunca foi promovido apaga
  também o `Win`: o que sobraria é uma linha que nenhuma tela alcança.
- **Retry de numeração envolve a transação inteira** (`refazerNaColisao`), nunca
  o `create` por dentro dela. No Postgres a violação de constraint aborta a
  transação: a consulta seguinte falha com "current transaction is aborted"
  (P2039 pelo Prisma), não com P2002. Um laço por dentro troca uma colisão
  recuperável pela falha da operação inteira — o contrário do que se quer.
- `Colaborador.nome` é a mesma grafia de `Projeto.responsavel`: é ele que vai
  para lá na promoção, e é o que mantém o relatório por responsável somando certo.
  Por isso o cadastro sugere os `responsavel` que já existem — duas grafias da
  mesma pessoa viram dois responsáveis no painel, sem erro nenhum aparecer.
- **Quem entra e não está na lista cadastra o próprio nome** (`cadastrarColaborador`).
  Sem isso o sistema tinha uma porta trancada: a única coisa que criava um
  `Colaborador` era o script de importação, então num banco recém-migrado
  ninguém passava da tela "Quem é você?" — nem para cadastrar o primeiro WIN.
  Auto-cadastro é seguro aqui porque o Clerk já decide quem entra.
  O cadastro **reconhece a pessoa que o importador já criou**, comparando sem
  acento nem caixa (`chaveDoNome`): sem isso, digitar "fabiano jose" esbarraria
  no índice único de `nome` e devolveria erro de banco em vez de vincular.
- **A identidade por nome é uma regra só, nos dois sentidos** (`encontrarPorNome`),
  usada pela tela **e** por `scripts/importar-card-win.ts`. Enquanto o script
  casava por igualdade exata, a proteção era unidirecional: quem se cadastrasse
  como "Fabiano Jose" num banco zerado — sem `Projeto`, logo sem sugestão de
  grafia — ganhava uma segunda linha quando a planilha com "Fabiano José" fosse
  importada. Os cards iam para a linha nova, a conta do Clerk ficava na antiga,
  e o relatório por responsável contava duas pessoas. O importador **não
  renomeia** o cadastro existente (o nome pode já ter ido para
  `Projeto.responsavel` numa promoção); avisa a divergência e deixa a decisão
  para quem roda.
- **`chaveDoNome` cobre acento e caixa, e só isso** — um nome do meio a mais não
  casa. Foi o caso real da primeira importação: planilha "Fabiano Garcia",
  cadastro "Fabiano Santos Garcia", e o importador criaria uma SEGUNDA pessoa,
  com os cards de um lado e a conta do Clerk e os projetos do outro. Por isso
  `scripts/importar-card-win.ts` aceita `--colaborador="Nome no cadastro"`, que
  diz explicitamente em qual cadastro a planilha entra. Não é o script
  adivinhando por sobrenome em comum: "Ana Silva Costa" e "Ana Costa" podem ser
  duas pessoas, e essa decisão é de quem roda. Nome inexistente aborta com a
  lista dos cadastrados, antes de qualquer escrita.
- **A leitura dos argumentos é pura e testada** (`src/lib/argumentos-importacao.ts`),
  e não um laço dentro do script. A primeira versão de `--colaborador` só aceitava
  a forma `=`, enquanto `--semana` e `--ano`, no mesmo laço, aceitavam espaço:
  `--colaborador "Fabiano Santos Garcia"` era descartado em silêncio e a
  importação criava a pessoa duplicada **relatando "Gravado: 1 card, 3 WINs"**.
  Daí as duas regras: toda forma que um sinalizador aceita, todos aceitam; e
  valor faltando, valor vazio ou sinalizador desconhecido abortam com saída 1,
  nunca são ignorados.
- **A área da planilha SEMEIA o cadastro, não o sobrescreve.** Desde que existe
  a tela `/colaboradores`, `Colaborador.area` pode ter sido definido por uma
  pessoa, e reimportar desfaria a escolha em silêncio — pior, uma planilha com o
  cabeçalho de área em branco zeraria o campo e as semanas seguintes voltariam a
  abrir vazias. O importador só preenche quando o cadastro está sem área, e avisa
  quando as duas divergem. O `CardSemanal.area` continua vindo da planilha: ela é
  o cabeçalho daquela semana.

### Administração de colaboradores (`/colaboradores`)

Desativar, reativar, corrigir nome e definir a área. Há um único papel,
**administrador** (`Colaborador.administrador`), que exclui projeto, edita os
pesos da matriz e gerencia colaboradores. O resto segue aberto a qualquer conta
autenticada, coerente com o auto-cadastro — o Clerk já decide quem entra.

**Perfis: Administrador > Colaborador (padrão) > Leitor.** O Leitor
(`Colaborador.somenteLeitura`) consulta e exporta, mas não grava nada:
`contaPodeEditar` guarda todas as Server Actions de projeto, ação, matriz e Card
WIN (as de identidade — cadastrar e vincular o próprio nome — ficam abertas).

- **O padrão é Colaborador**: conta sem cadastro ou sem a marca edita como
  sempre. A restrição mora na linha do colaborador, então vale também para quem
  foi marcado antes de ter conta ligada.
- **Administrador define o perfil** em `/colaboradores` (`alternarLeitor`, por
  intenção: `tornar-leitor` / `tornar-colaborador`).
- **Administrador não é leitor, e leitor não é promovido direto**: duas
  permissões contraditórias na mesma pessoa. Quem vai virar administrador
  volta a colaborador antes.
- **Leitor nunca administra**, nem no estado "ainda não há administrador"
  (`contaPodeAdministrar`).
- **Desativar leitor não o libera**: `contaSomenteLeitura` não filtra `ativo`.
- As telas trocam o formulário por `AvisoSomenteLeitura` e escondem os atalhos
  ("Novo projeto", "Editar"); a ação em si segue legível, com o histórico. Quem
  recusa de verdade é a Server Action, como no papel de administrador.
- Ao criar uma Server Action de gravação nova, ponha o `contaPodeEditar` logo
  depois do `auth()`.

- **Enquanto não existir administrador ATIVO, todos podem** (`administracao.ts`).
  É o estado de antes do papel e evita o sistema nascer trancado; a restrição
  liga sozinha quando a primeira pessoa é promovida. Quem promove OUTRA pessoa
  nesse estado perde o acesso — a tela avisa para começar por si mesmo.
- **A guarda está na Server Action**, não só na tela: uma Server Action é um POST
  que qualquer conta consegue forjar. A tela esconde os controles; a ação
  recusa (`contaPodeAdministrar`).
- **O último administrador não sai**: remover o papel ou desativá-lo devolveria
  o sistema a "todos podem" sem ninguém ter decidido isso. Administrador
  desativado não conta.
- Promover age pela intenção clicada (`promover`/`remover`), como desativar.

- **Esta tela é o único lugar que preenche `Colaborador.area` fora da
  importação.** Quem se cadastra pela tela nasce sem área, e o campo não existia
  em lugar nenhum: o auto-cadastro grava só `nome` e `clerkUserId`, e o campo
  "Área" de `/wins` grava em `CardSemanal.area`, nunca no colaborador. O efeito
  de ficar sem ela é silencioso — `/wins` preenche a Área com
  `cardAtual?.area ?? colaborador.area`, então toda semana nova abria vazia e a
  pessoa redigitava.
- **Área ausente e área vazia são coisas diferentes**, e é `FormData` que as
  distingue: `get('area')` devolve `null` quando o formulário não traz o campo e
  `''` quando traz vazio. Ausente vira `undefined` (o Prisma pula a coluna) e
  vazio vira `null` (remove). Tratar os dois como remoção faria uma aba aberta
  antes desta versão apagar em silêncio a área de quem veio da planilha.
- **Definir a área não reescreve os cards já salvos.** `Colaborador.area` é o
  padrão de um card NOVO; cada card guarda a área da semana dele, e reescrevê-los
  apagaria o registro de quem mudou de área no meio do ano.
- **A área não tem lista fechada.** A planilha escreve por extenso ("AGP -
  Gerenciamento de Programa & Projetos") e um `enum` obrigaria a traduzir os dois
  lados a cada área nova da GIA. A tela sugere as grafias já em uso — lidas do
  cadastro **e** dos cards, porque a importação escreve nos dois e a tela só no
  cadastro; ler um só sugeriria metade das grafias.

- **Renomear e alinhar `Projeto.responsavel` são independentes.** A propagação
  não anda de carona numa mudança de nome: quem desmarcou a caixa uma vez
  precisa poder voltar e alinhar depois, e há divergência que nasce sem ninguém
  renomear nada — a planilha importada com uma grafia, o cadastro com outra.
  Amarrar as duas deixaria essa divergência sem conserto pela tela.
- **A propagação casa por `chaveDoNome`, não por igualdade exata.** A
  divergência que a tela cura é justamente a que um `where` exato não enxerga:
  "Fabiano Jose" no projeto contra "Fabiano José" no cadastro. Contar com uma
  regra e escrever com outra faria o rótulo prometer N e o resultado relatar M,
  então tela e ação usam a MESMA função (`projetosDaPessoa`).
- **A contagem não filtra `ativo`.** Projeto excluído logicamente pode ser
  restaurado, e voltaria com a grafia velha.
- **Desativar/reativar age pela INTENÇÃO clicada**, nunca negando o `ativo`
  lido. Entre a página renderizar e o clique chegar, outra pessoa pode ter
  mexido: negar o que se lê faria um clique em "Desativar" reativar alguém e
  ainda relatar "voltou a ficar ativo". O `updateMany` condicional devolve
  `count = 0` nesse caso e o usuário é avisado — mesmo padrão de
  `vincularColaborador`.
- **O `comentario` da promoção não é reescrito.** Ele também cita o nome
  ("Promovido do Card WIN de Fulano…"), mas em prosa e como registro do que
  aconteceu na época.
- **Conflito de nome usa `chaveDoNome`**, a mesma regra do cadastro e do
  importador: igualdade exata deixaria criar "Fabiano Jose" ao lado de "Fabiano
  José". Trocar só acento ou caixa do **próprio** nome é permitido — é a
  correção que a tela existe para fazer.
- **Desativar não apaga nada.** Cards e WINs seguem no histórico e a tela de
  equipe continua mostrando o que a pessoa comprometeu; o que muda é sair da
  lista de "quem falta" e da lista de vínculo.
- **Desativar não solta o `clerkUserId`.** Soltar deixaria a conta se cadastrar
  de novo com outro nome, e o histórico dela ficaria órfão. Reativar devolve o
  acesso exatamente como era.
- **Ninguém desativa a si mesmo**: cairia na tela "Quem é você?" sem conseguir
  se escolher (a lista só oferece ativos e sem dono) e ficaria sem acesso ao
  próprio card até alguém mexer no banco.

### O calendário de semanas (`semana-ctcea.ts`)

**Não é a semana ISO.** A semana começa no **domingo**, e a semana 1 de 2026
começa em **28/12/2025** — regra: o domingo igual ou anterior a 1º de janeiro.
`getISOWeek` daria números diferentes e desalinharia o histórico da equipe em
silêncio. As 52 semanas da aba `Referências` estão transcritas em
`semana-ctcea.test.ts` como teste de paridade, uma a uma.

A planilha lista 53 linhas, mas o `XLOOKUP` dela só varre as semanas 1 a 52 — a
53ª é sobra da fórmula que se estende sozinha, e por esta regra já é a semana 1
de 2027.

A divergência entre o ano do calendário e o ano civil acontece **nos dois
sentidos**: 30/12/2025 já é a semana 1 de 2026, e 27/12/2026 já é a semana 1 de
2027 (a semana 52 de 2026 termina em 26/12). Os quatro casos estão no teste.

## Relatórios do Card WIN

- **Visão de equipe (`/wins/equipe`)** — o "Compartilhamento dos Cards" da aba
  Agenda, para a daily. **Somente leitura**: editar card alheio é decisão de
  produto que ninguém tomou. Não filtra colaborador ativo na consulta, porque a
  tela navega por semanas passadas e esconder quem saiu reescreveria o que
  aconteceu; a lista de *quem falta* é que só considera os ativos.
- **`semWins` pergunta "tem WIN?", não "tem card?"** — salvar só o cabeçalho já
  cria a linha do `CardSemanal`, então o critério ingênuo esconderia quem digitou
  a área e mais nada, que é justamente quem a reunião precisa ver.
- **Os relatórios de WIN ficam fora dos filtros da tela `/dashboards`**, junto
  com a auditoria: equipe, natureza e prioridade são dimensões de `Projeto`, e um
  WIN não tem nenhuma delas. Mexer num filtro deixaria os números parados, o que
  leria como bug — daí o grupo próprio `WINS` e a ressalva no cabeçalho.
- **Promovido é categoria própria na taxa de conclusão**, fora do denominador:
  não é concluir nem falhar, o trabalho mudou de lugar. E os baldes de status só
  valem para o que não foi promovido — a linha promovida guarda o status que
  tinha, e contá-la nos dois somaria mais que o total.
- **`taxa: null` carrega o motivo** (`SEM_WINS` ou `TODOS_PROMOVIDOS`): sem isso,
  a semana em que o funil funcionou melhor renderiza igual a uma de recesso.
- **A janela é densa e atravessa o ano por `semanaAnterior`**, nunca por
  `semana - 1`: `ano`/`semana` são duas colunas inteiras e nenhum intervalo
  contínuo sai de um `gte`.
- **Hachura significa uma coisa só.** `PROMOVIDO` é hachura sobre `realizado`
  (textura, não cor — `accent` é reservado a magnitude); a semana em curso é
  contorno tracejado. As duas coincidiriam na última barra.
- **A amostra da legenda repete a TEXTURA, não só a cor.** Um quadrado liso ao
  lado de "Promovido" obrigaria quem lê a adivinhar que o listrado na barra
  corresponde àquele verde — e a legenda existe justamente para a identidade
  não ficar só na cor.
- **`desfecho` tem de ser consultado em TODA ação que age sobre uma aparição.**
  `salvarWin` (ramo de edição), `removerWinDaSemana` e `encerrarWin` filtram
  `NO_CARD`; `encerrarWin` exige também `encerradoEm: null`. Sem isso, uma aba
  aberta antes da promoção ainda mostra os botões antigos, e o clique reescreve
  ou apaga uma semana já fechada — o histórico que a migration existe para
  preservar.

### Testes que precisam de banco

`tests/integracao/` roda as Server Actions do Card WIN contra um Postgres de
verdade, por `npm run test:integracao` — **fora** do `npm test`, porque o CI não
sobe banco e um teste de integração no mesmo `include` deixaria o pipeline
vermelho por falta de infraestrutura, não por defeito no código.

Existe porque os erros desta área são invisíveis no teste unitário: repetição
que não acumulava, promoção que não liberava a vaga e remoção deixando `Win`
órfão passaram por `tsc`, por `eslint` e por 461 testes verdes. Só o banco
denunciou. Toda mudança nas ações de `/wins` roda os dois.

## Responsável pela ação e aviso por e-mail

`Acao.responsavelId` aponta para `Colaborador`; o e-mail sai de
`Colaborador.email` (semeado pelo Clerk no vínculo, editável em `/colaboradores`).

- **O histórico grava o NOME do responsável**, não o id (`campo = 'responsavel'`):
  um id no painel não diz nada, e o nome registra quem respondia na época.
- **Só colaborador ativo pode ser escolhido — exceto o responsável atual.** Se ele
  foi desativado depois, a tela de edição o mantém na lista "(inativo)" e salvar
  outro campo não o apaga nem dá erro.
- **Campo ausente não mexe** (`lerResponsavelId` → `undefined`), vazio remove.
- **O aviso sai ao criar com responsável e ao TROCAR para outra pessoa.** Salvar
  de novo com a mesma pessoa ou tirar o responsável não envia nada.
- **O aviso nunca derruba a gravação.** `enviarEmail` não lança; a tela recebe a
  frase do que aconteceu (`mensagemDoAviso`), inclusive "não tem e-mail".
- **Edição conferida por versão (`updatedAt`).** O formulário de edição manda a
  versão que viu e `gravarAcaoComHistorico` grava com `updateMany where
  { id, updatedAt }`: conferir e gravar são um comando só, e `count = 0` lança
  `ConflitoDeEdicao` de dentro da transação, sem escrever nem o histórico. O save
  devolve a nova versão para a pessoa não conflitar com o próprio save. Campo
  ausente ou ilegível = sem conferência (aba antiga, apontamento de realizado).
- **Só produção envia** (`email-config.ts`, `VERCEL_ENV=production`), pela mesma
  razão da guarda de migrations: o preview usa o banco de produção e avisaria
  colaboradores reais. Envio pela API HTTP do Resend, sem SDK.

## Avisos de atraso, "Minhas ações" e exportação

- **Aviso semanal de atraso** (`/api/cron/atrasos`, cron da Vercel às segundas,
  11h UTC em `vercel.json`): um e-mail por responsável com a lista das ações
  atrasadas (`avisar-atrasos.ts`, texto em `email-atrasos.ts`). A regra é a do
  painel (`acaoEstaAtrasada`). Fora do envio: ação sem responsável, responsável
  sem e-mail ou desativado, projeto excluído — o resumo devolvido conta os dois
  primeiros casos. A rota é pública para o Clerk (`ROTAS_PUBLICAS`) e se
  protege sozinha por `CRON_SECRET` (`autorizacao-cron.ts`): **sem a variável
  ela recusa tudo**, não fica aberta. Só produção envia (`email-config.ts`).
  Mudar a frequência é mudar o `schedule` do `vercel.json`; no plano Hobby o
  cron roda no máximo uma vez por dia.
- **`/minhas-acoes`**: ações do colaborador ligado à conta (projetos ativos),
  em Atrasadas / Em aberto / Concluídas (as 10 mais recentes).
  `minhas-acoes.ts` é puro. Conta sem colaborador vê o caminho para se ligar.
- **Exportação** (`/api/exportar/{projetos|acoes|atrasadas}`, `.xlsx` por
  `exceljs`): o conteúdo é decidido em `exportacao.ts` (puro) e o formato em
  `exportacao-xlsx.ts`. `projetos` respeita os filtros da query string, como o
  painel. Datas e números saem como data e número, não como texto. Texto do
  usuário entra como string, nunca como fórmula. **PDF é a impressão do
  navegador** (`BarraExportacao`): sem biblioteca; o tema escuro é desligado
  durante a impressão e filtros/cabeçalho têm `print:hidden`.
- O `auth()` falso do teste de navegador chama `headers()` de propósito: sem
  isso o Next pré-renderiza a página no build, com o banco vazio.

## Meus projetos (`/meus-projetos`)

Os projetos ativos de quem está logado, no menu ao lado de "Minhas ações".
Regra pura em `meus-projetos.ts`. Um projeto entra por QUALQUER um de três
vínculos, e a linha diz qual (badge): responsável pelo projeto
(`Projeto.responsavel`), responsável por ações dele (`Acao.responsavelId`,
com a contagem) e apoio (`Projeto.apoio`).

- **Os dois campos de texto casam por `chaveDoNome`** (sem acento, caixa nem
  espaço repetido), a mesma regra do cadastro e do importador. O `apoio` é lido
  como lista (separadores: vírgula, ponto e vírgula, barra, `&` e " e "), e vale
  também o campo inteiro, para um nome com separador dentro. **Nome parcial não
  casa** ("Ana Silva" não é "Ana Silva Costa"): adivinhar por sobrenome juntaria
  homônimos. O que não casa fica de fora, sem erro, e a tela avisa para conferir
  a grafia — o texto livre é o ponto fraco desta tela.
- **É pessoal**: o administrador também vê só os seus (o painel e `/projetos`
  mostram a carteira inteira).
- Ordem: quem tem ação MINHA atrasada primeiro, depois projeto atrasado, depois
  por nome. O resumo (progresso, status) é do projeto inteiro; só a contagem de
  atrasadas "suas" é pessoal. Mesma regra de atraso do painel.
- Filtro por link (`?filtro=respondo|apoio`): "respondo" = responsável pelo
  projeto ou por ações; "apoio" = quem tem o vínculo de apoio. Projeto excluído
  não aparece. Conta sem colaborador vinculado vê o caminho para se ligar.
- A consulta ao banco só descarta quem não tem nenhum dos três vínculos
  possíveis; a comparação de nomes é em memória (carteira pequena).

## Edição em lote de ações (`/projetos/[id]/lote`)

Remarcar o previsto e/ou trocar o responsável de várias ações de um projeto de
uma vez. Regra pura em `edicao-lote.ts`, gravação em `acao-lote.ts`, Server
Actions em `projetos/acoes-lote.ts` (`previaLote` e `aplicarLote`). Aparece como
"Editar em lote" na tela do projeto, para quem pode editar (Leitor recebe o
aviso de somente leitura; quem recusa de verdade são as Server Actions).

- **Dois passos, sempre**: a PRÉVIA mostra de/para ação por ação e não grava
  nada; a confirmação grava EXATAMENTE o que foi mostrado (os campos voltam como
  ocultos no formulário de confirmação — mexer no formulário de cima não
  altera o que será gravado).
- **Só previsto e responsável.** Status e datas realizadas ficam de fora de
  propósito: concluir em lote pede as datas realizadas e o erro em lote custa
  mais. Concluída não tem o previsto remarcado (mexeria na aderência de prazo
  já medida); sem data prevista não há o que deslocar; responsável igual ao
  atual não é mudança. Cada caso aparece como observação na linha da prévia.
- **Deslocar é em DIAS ÚTEIS** (`deslocarDiasUteis`: pula fim de semana e
  feriado nacional fixo; adiar ou adiantar). Início e término andam juntos
  pela mesma quantidade, então a ordem entre eles se mantém.
- **Limite de 100 ações por operação** (`LIMITE_LOTE`) e de 250 dias úteis.
  A seleção vale por projeto, não entre projetos.
- **Uma transação para tudo** (`gravarLote`): ou grava o lote com o histórico,
  ou nada muda. Histórico igual ao da edição individual: uma linha por ação e
  por campo alterado, com `alteradoPor`, e o NOME do responsável.
- **Conflito por versão**: cada ação é gravada com `updateMany where { id,
  updatedAt = versão vista na prévia }`. Se alguém a salvou depois, ela é
  PULADA e listada no resultado — nunca sobrescrita; as demais gravam. Sem a
  versão da prévia a ação conflita, em vez de gravar às cegas.
- **Aviso por e-mail**: quem PASSA a ser responsável recebe UM e-mail com a
  lista das ações (`montarAvisoLote`), não um por ação. Remover o responsável
  não avisa ninguém. Só produção envia, como no resto.

## Comentários por ação

A coluna de comentário da planilha, com autor e momento: `ComentarioAcao`
(`acaoId`, `texto`, `autor`, `criadoEm`), mostrada na tela de uma ação, acima do
histórico. Server Actions em `projetos/acoes-comentario.ts`; regra pura em
`comentario-validacao.ts`.

- **Só se acrescenta; não se edita.** A conversa não pode ser reescrita depois.
  Quem escreveu apaga o seu, e o administrador apaga qualquer um (mesma regra
  de administrador do resto: enquanto não houver nenhum, todos podem).
- **Perfil Leitor não comenta nem apaga**: comentar é gravar, e a guarda
  `contaPodeEditar` vale aqui como nas demais Server Actions. Ele lê os comentários.
- **`autor` é o `userId` do Clerk**, como `HistoricoAlteracao.alteradoPor`; o
  nome vem do colaborador vinculado na hora de mostrar (`rotularAutor`).
- Texto de 1 a 2000 caracteres, aparado; quebras de linha são preservadas.
- Comentário **não é auditoria**: não entra em `HistoricoAlteracao` e não
  aparece em dashboards, exportações nem na "foto em uma data". Apagar a ação
  apaga os comentários (cascata). **Não manda e-mail**: os avisos ficam no
  sistema (próxima seção).

### Notificações de comentário (`/notificacoes`)

`Notificacao` (destinatário, comentário, motivo, lida), criada na MESMA
transação do comentário (`acoes-comentario.ts`); regra pura em `notificacao.ts`.

- **Quem é avisado**: as pessoas escolhidas em "Avisar no sistema" (motivo
  `MARCADO`) e o **responsável pela ação, sempre** (`RESPONSAVEL`). Marcado e
  responsável ao mesmo tempo = uma só, como `MARCADO`. Ninguém é avisado do
  próprio comentário; só colaborador **ativo** recebe.
- **A marcação é por caixas de seleção, não por `@nome`**: nome com espaço e
  acento torna o reconhecimento no texto ambíguo (mesmo cuidado de
  `chaveDoNome`). Evoluir para autocompletar é possível sem mudar o modelo.
- **Sino no cabeçalho** (`SinoNotificacoes`, componente de servidor) conta as
  não lidas; falha ao contar vale 0, nunca derruba a página. Cada pessoa vê e
  marca só as suas: o `destinatarioId` vai no `where` do `updateMany`.
- **Conta sem colaborador vinculado não recebe** — a tela explica como se ligar.
- **Leitor** não comenta, mas lê e marca como lidas as suas (estado pessoal).
- Apagar o comentário apaga os avisos (cascata). Lidas com mais de 30 dias são
  apagadas por quem comenta (sem agendador). Desativar o colaborador mantém o
  histórico de avisos dele.

## Busca e paginação

Listas longas não vão inteiras para a tela. `paginacao.ts` (puro) lê `?pagina=`
(`?pagina=todas` desliga) e fatia; `correspondeABusca` compara sem acento nem
caixa e exige TODAS as palavras digitadas, em qualquer campo.

- **Painel e `/projetos`**: 25 por página, campo "Buscar" (nome, referência,
  equipe, categoria, responsável) junto dos filtros (`?busca=`). Os indicadores
  do painel somam a carteira FILTRADA inteira, não só a página. O Excel de
  projetos respeita a busca, como respeita os filtros.
- **Projeto (`/projetos/[id]`)**: 40 ações por página e busca por descrição,
  responsável ou número. O RESUMO do cabeçalho (percentual, status) conta todas
  as ações; busca e página só mudam o que o Gantt desenha — o período da grade
  é o das ações mostradas. Vale também na "foto em uma data".
- **Busca e página são em memória**, depois da consulta: o status agregado é
  derivado e não existe no banco, e a carteira (centenas de projetos) cabe
  folgada. Se passar de alguns milhares, mover a busca para o `where`.
- **Mudar filtro ou busca volta à página 1**: o formulário não carrega `pagina`.
  Página além do fim vira a última (link velho, busca que encolheu a lista).
- **PDF**: a impressão sai com a página atual; use "Ver todos" antes de
  imprimir a carteira inteira. Os controles de paginação não são impressos.
- Os Dashboards não paginam: agregam a carteira toda por definição.

## "Foto em uma data" (`/projetos/[id]?em=aaaa-mm-dd`)

O projeto como estava no fim de um dia passado, reconstruído do histórico
(`foto-em-data.ts`, puro). Parte do estado ATUAL e **desfaz** de trás para
frente cada alteração posterior ao dia (campo volta ao `valorAntigo`) — exato
para os campos auditados, e dispensa conhecer o estado inicial. O corte é o
começo do dia seguinte em Brasília (22h do dia da foto ainda é do dia).

A regra de aproximação, também dita na tela (somente leitura, sem link de edição):

- Ação só aparece se `createdAt` for anterior ao corte; as criadas depois são
  contadas, não escondidas em silêncio.
- **Data anterior à primeira ação registrada no sistema** (`min(createdAt)`):
  o que havia vinha da planilha e não há como reconstruir — a tela avisa que a
  foto não é confiável em vez de mostrar uma foto vazia como se fosse a verdade.
- Descrição e número não são auditados: saem como estão hoje.
- Projeto excluído depois da data não aparece (a exclusão lógica não guarda quando).
- Alteração feita fora do sistema (importação, SQL) não tem linha de histórico
  e não é desfeita.
- Hoje, futuro ou data inválida = estado atual. Só o drill-down por projeto tem
  foto; o painel consolidado e os dashboards não.

## Acesso: só contas @ctcea.org.br

Estar logado no Clerk não basta. `src/proxy.ts` confere, depois do
`auth.protect()`, o **e-mail principal e verificado** da conta
(`dominio-permitido.ts`, `verificar-conta.ts`): precisa ser do domínio
`ctcea.org.br`, exato — subdomínio e parecidos não valem. Quem não passa vai
para `/acesso-negado` (página) ou recebe 403 (rotas `/api`). Isso vale para o
link direto de um projeto, Server Actions e exportações: o proxy pega tudo que
não está em `ROTAS_PUBLICAS`.

- **Duas camadas, e a segunda é a que garante.** A lista de permissão do Clerk
  (Dashboard → Configure → Restrictions → Allowlist, domínio `ctcea.org.br`)
  impede a CRIAÇÃO da conta; esta regra confere na ENTRADA, porque contas já
  criadas continuam existindo no Clerk e a configuração externa pode ser mexida.
- **E-mail secundário ou não verificado não vale**: bastaria cadastrar um
  endereço ctcea.org.br em qualquer conta.
- **Na dúvida, nega**: se o Clerk não responder, o acesso é negado
  (`motivo=verificacao`), nunca liberado. A falha não fica em cache.
- **Cache em memória por instância**: 10 min para autorizada, 1 min para negada.
  Quem muda o e-mail leva alguns minutos para ser reavaliado.
- **Porta de emergência: `EMAILS_EXCECAO`** (variável da Vercel, vazia por
  padrão), endereços completos separados por vírgula, que entram mesmo fora do
  domínio — ainda exigem e-mail verificado. É uma decisão consciente de quem
  administra a Vercel; use para destravar alguém, e tire depois.
- `/acesso-negado` é pública de propósito: se não fosse, o redirecionamento
  entraria em laço. As rotas públicas seguem sendo só login, cadastro, webhooks
  e cron (este se protege por `CRON_SECRET`).
- No teste de navegador, o cookie `e2e_user=user_intruso` troca a conta de teste
  por uma de e-mail de fora do domínio (`tests/e2e/falso/`).

## Teste de navegador (Playwright)

`npm run test:e2e` sobe o sistema construído de verdade (`next build` + `next
start`) contra um Postgres descartável e dirige um Chromium pelos fluxos
principais (`tests/e2e/`): criar ação, editar, conflito de edição e filtro de
período. Existe porque `tsc`, `eslint` e centenas de testes verdes deixaram passar
defeitos que só a página aberta mostra — o primeiro uso já achou um erro 500 que
estava em produção (um arquivo `'use server'` exportando uma constante).

- **Entra sem conta de Clerk por um falso, trocado na configuração, não por uma
  exceção no código.** `E2E_AUTH_FALSA=1` faz o `next.config.ts` apontar
  `@clerk/nextjs` e `@clerk/nextjs/server` para `tests/e2e/falso/`. O código de
  domínio chama `auth()` como sempre. Os módulos falsos **recusam carregar na
  Vercel**: ligar a variável por engano num deploy derruba o build em vez de
  publicar um sistema sem login.
- **Só banco local**: `tests/e2e/banco.ts` apaga as tabelas e recusa qualquer
  `DATABASE_URL` que não seja localhost. Usa `pg` puro porque o cliente Prisma
  gerado é ESM com `import.meta` e o carregador do Playwright o trata como
  CommonJS.
- Local: banco descartável como na seção de testes de integração, depois
  `DATABASE_URL=postgresql://postgres:teste@127.0.0.1:57432/cronograma npm run test:e2e`.
  Precisa das bibliotecas do Chromium (`npx playwright install-deps chromium`).
- No CI é o job `navegador`, separado do de lint/testes/build.
- Teste novo de tela vai em `tests/e2e/*.spec.ts` (o `*.spec.ts` não é pego pelo
  Vitest, que só lê `*.test.ts`).

## Registro de erros

`registrarFalha(origem, erro)` (`src/lib/registrar-erro.ts`) substitui o
`console.error` dos `catch` das Server Actions e do envio de e-mail, e
`src/instrumentation.ts` (`onRequestError`) pega os erros de renderização. O
log de execução da Vercel Hobby guarda só 1 hora; o registro vai para
`RegistroErro` e o administrador lê em `/administracao/erros`.

- **Só produção grava** (`VERCEL_ENV=production`): preview e desenvolvimento
  usam o mesmo banco e misturariam erro de teste com erro de verdade.
- **Nunca lança**: roda dentro de um `catch`, e falhar de novo trocaria a
  mensagem amigável por um 500. O Prisma é importado sob demanda.
- **Retenção de 30 dias**, apagada por quem registra, no máximo uma vez por hora
  por instância — não há agendador. Mensagem e detalhe são truncados, porque o
  texto de um erro pode carregar dados da operação.
- Ao criar um `catch` novo, use `registrarFalha`, não `console.error`.

## Monitoramento

Três peças, todas só para produção e todas puras onde dá (`monitoramento.ts`):

- **`/api/saude`** (pública, `ROTAS_PUBLICAS`): `SELECT 1` com teto de 4 s;
  200 `{status:'ok', banco:{ok,ms}}` ou 503 `{status:'fora'}`. Devolve o mínimo
  de propósito — nenhuma variável, versão ou mensagem de erro. É o endereço que
  um verificador externo (UptimeRobot, Better Stack) consulta a cada 5 min e
  avisa por e-mail se cair; **esse cadastro é externo ao código e é de quem
  administra**.
- **Alerta de erro por e-mail**: `registrarFalha` avisa quem administra na
  PRIMEIRA falha de uma origem e silencia as da mesma origem por 1 hora (a
  pergunta é feita ao banco, porque a instância serverless não guarda memória).
  Destino: `EMAIL_ALERTAS` (vírgulas) ou, sem ela, os administradores ativos com
  e-mail. **As origens do próprio envio de e-mail nunca alertam**
  (`ORIGENS_SEM_ALERTA`): o alerta por e-mail falharia, registraria outra
  falha e tentaria alertar de novo. Ao criar uma origem nova de falha de
  e-mail, ponha-a nessa lista. O alerta nunca lança.
- **`/administracao/sistema`** (só administrador): banco, erros por origem (24 h
  e 7 dias), últimas execuções do cron (`ExecucaoCron`, 90 dias), configuração
  (só "definida ou não", nunca o valor) e volume contra o teto de 10 mil ações
  do `/dashboards`. O cron de atraso grava cada execução em `gravarExecucaoCron`;
  passar de 9 dias sem execução acende o aviso.

## Migrations em produção

O `build` roda `scripts/migrar-producao.ts` antes do `next build`, e esse script
aplica `prisma migrate deploy` **somente quando `VERCEL_ENV=production`**.

A guarda não é zelo excessivo: a `DATABASE_URL` está cadastrada nos **três**
ambientes da Vercel (Production, Preview e Development) apontando para o **mesmo**
banco do Railway. Sem ela, o preview de um pull request aplicaria a migration em
produção antes do merge, deixando o banco à frente do código no ar.

- A decisão fica em `src/lib/migracao-deploy.ts`, coberta por teste — não é um
  `&&` na linha do `build`.
- **Fora da Vercel pula**: o CI roda `next build` com uma `DATABASE_URL`
  descartável apontando para localhost; migrar ali derrubaria o pipeline.
- **Produção sem `DATABASE_URL` falha o build**, em vez de publicar uma versão
  que espera tabelas que ninguém criou.
- **Falha da migration aborta o build** pelo mesmo motivo.
- `PULAR_MIGRACAO=1` destrava um deploy sem mexer no código, em emergência.
- Migrar vem **antes** de construir: se o build falhar depois, o banco fica à
  frente do código, o que é seguro porque as migrations aqui são aditivas. O
  inverso não seria.

## Regras para o loop autônomo (autoloop.sh)

- Antes de cada rodada, o `PROGRESS.md` deste projeto (não um genérico) deve estar na
  raiz do repositório. Verifique o cabeçalho `# PROGRESS — Cronograma CTCEA` antes de
  começar a trabalhar; se não bater, pare e avise.
- Nunca marque um item como concluído sem rodar o `CHECK_CMD` (testes) e ele passar.
- Nunca sobrescreva migrations já aplicadas — crie uma nova migration para qualquer
  mudança de schema.
- Trabalhe apenas dentro deste repositório.

## O que NÃO fazer

- Não introduza multi-tenancy "por precaução" — está fora de escopo.
- Não troque nomes de campos do domínio para inglês.
- Não invente integração com o SGO 2.0 — são sistemas separados.

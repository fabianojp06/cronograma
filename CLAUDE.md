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
- **Promover e encerrar tiram o WIN só da semana em que a ação aconteceu.** As
  aparições anteriores são o registro do que foi de fato comprometido naquelas
  semanas — é delas que vivem o bloco "semana anterior" e a contagem de
  recorrência. Apagá-las reescreveria o passado para arrumar o presente, e por
  isso as duas ações recebem `ano`/`semana` no formulário.
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

### Testes que precisam de banco

`tests/integracao/` roda as Server Actions do Card WIN contra um Postgres de
verdade, por `npm run test:integracao` — **fora** do `npm test`, porque o CI não
sobe banco e um teste de integração no mesmo `include` deixaria o pipeline
vermelho por falta de infraestrutura, não por defeito no código.

Existe porque os erros desta área são invisíveis no teste unitário: repetição
que não acumulava, promoção que não liberava a vaga e remoção deixando `Win`
órfão passaram por `tsc`, por `eslint` e por 461 testes verdes. Só o banco
denunciou. Toda mudança nas ações de `/wins` roda os dois.

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

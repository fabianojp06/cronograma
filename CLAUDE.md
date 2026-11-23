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
| `textFaint` | `#626F79` | `#7A8F8C` |
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

## Identidade: a semana CTCEA

O motivo visual do sistema é UM só: a **semana do calendário da CTCEA** (`semana-ctcea.ts`),
com o número em destaque e em algarismos tabulares. Aparece onde o tempo é o assunto:

- **Card WIN e Equipe**: `SeloSemana` (número grande na cor de acento, "Semana de 2026" e os
  dias úteis "seg 23/11 a sex 27/11") ao lado do título.
- **Reunião**: "S48" em destaque no cabeçalho, com o intervalo do resumo ao lado.
- **Gantt**: cada coluna leva "S47" (a semana da segunda-feira da coluna) acima do dia, e a
  coluna de hoje ganha uma faixa de fundo suave.
- **O calendário vai de domingo a sábado**, não de segunda a sexta; o selo mostra os DIAS
  ÚTEIS dentro dela. Coluna do Gantt é segunda a domingo: no domingo, a coluna ainda traz
  o número da semana que terminou (a nova começa naquele domingo).
- Quem criar tela nova ligada a tempo reaproveita o `SeloSemana`/o "S{n}", em vez de inventar
  outro rótulo. Não espalhe o motivo por onde o tempo não é o assunto.

## Tipografia e contraste

Passada única sobre o sistema inteiro; as três regras são cobertas por
`src/lib/tipografia.test.ts` (quebra o CI se voltarem).

- **Contraste mínimo de 4,5:1 para `textFaint`** sobre `bg`, `surface` e `borderSoft`, nos
  dois modos (antes 2,7–3,3:1, abaixo do piso de leitura). Por isso o token mudou
  (`#8B98A3`→`#626F79`; `#5C716E`→`#7A8F8C`). `textFaint` continua mais claro que
  `textMuted`, mas é texto legível, não decoração. Ao trocar um token, rode o teste.
- **Piso de 13 px**: `--text-xs` do tema vale 0,8125 rem (o padrão do Tailwind é 12 px) e
  tamanhos fixos `text-[Npx]` abaixo de 13 px não existem mais. Para texto pequeno use
  `text-xs`, nunca um valor solto.
- **Sem caixa-alta nem espaçamento de letras**: sobrancelhas de página, rótulos de
  indicador, `legend` e cabeçalhos de tabela usam caixa normal (cabeçalho de tabela em
  `font-semibold`). A hierarquia vem do peso e da cor, não de gritar. Não reintroduza
  `uppercase`/`tracking-wide`.

## Estilo "Workspace" nos Dashboards (opção B do desenho)

Só `/dashboards` (a `<main>` leva `tema-workspace`, em `globals.css`): acento **azul**
(`#2B4BBE` claro / `#8FA8FF` escuro), Space Grotesk nos títulos e Inter no texto, cantos
arredondados e seções em cartão. O resto do sistema continua no estilo "Painel Operacional".

- **O azul é de controle** (abas, links, foco, botões). Ele difere do azul de Previsto
  (`#2563EB`), que segue significando só o previsto. Os gráficos de VOLUME usam o token
  `magnitude` (`bg-magnitude`, `stroke-magnitude`): igual ao acento fora do escopo, azul-marinho
  (`#35507A`/`#8DA9D4`) dentro dele. Gráfico de volume novo usa `magnitude`, não `accent`.
- Os tokens são trocados no escopo; nenhum componente testa o tema. `tipografia.test.ts`
  confere o contraste do azul (4,5:1) e do volume (3:1) nos dois modos.
- Estender o estilo a outra tela é pôr `tema-workspace` na `<main>` dela; o cabeçalho global
  continua no acento verde-azulado.

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

## Abas e resumo de `/dashboards`

A tela deixou de ser uma página única com 17 relatórios empilhados. Regra pura em
`dashboard-abas.ts`.

- **Uma aba por GRUPO do catálogo** (Panorama, Distribuição, Prazos, Evolução no
  tempo, Qualidade, Card WIN, Auditoria), mais **Todas**. A aba vive na URL
  (`?aba=prazos`; o panorama é a padrão e fica sem parâmetro), então continua
  linkável e funciona sem JavaScript. Aba desconhecida cai no panorama. Filtros e
  período acompanham a troca de aba, e "Limpar filtros" fica na mesma aba.
- **Ao criar um relatório novo**, declare-o no catálogo com o seu grupo: a aba
  e a contagem saem dele, e o teste confere que todo grupo tem aba e que a soma
  das abas é o catálogo inteiro. As seções ficam em `dashboards/secoes/` **por
  grupo** (`prazos`, `tempo`, `qualidade`, `wins`, `auditoria`); o teste
  `dashboard-catalogo.test.ts` lê esses arquivos na ORDEM de renderização — um
  arquivo novo entra na lista dele.
- **Resumo no topo** (`ResumoAtencao`): ações atrasadas, vencem em 7 dias,
  projetos sem ações, WINs para promover e replanejamentos, cada um um link para a
  aba e a seção do detalhe. Só os que são problema (atrasadas, sem ações, WINs a
  promover) ganham a cor de atraso, e só quando maior que zero; os outros são
  informação. Os números respeitam os filtros, menos os de Card WIN e auditoria,
  que olham o sistema inteiro (a regra de sempre).
- **Os dados continuam carregados por inteiro** (`dados.ts`), porque o resumo
  precisa de vários grupos ao mesmo tempo. Se o desempenho pedir (gatilho de
  ~10 mil ações), carregar só o da aba ativa é o primeiro passo.
- **PDF**: a impressão sai com a aba aberta. Para a tela inteira, abra a aba
  **Todas** antes de imprimir. Abas e resumo não são impressos.

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

## Duplicar ação e modelos de projeto

**Duplicar ação** (botão na tela de edição, `projetos/acoes-duplicar.ts`,
`duplicar-acao.ts`): a cópia fica no mesmo projeto, com a descrição + " (cópia)"
(copiar a cópia não empilha o sufixo), o mesmo previsto e o mesmo responsável, e
**sem andamento**: status "não iniciado", sem realizado, sem histórico. Leva à
edição da cópia. Responsável desativado não é copiado. O aviso ao responsável
segue a regra de toda ação nova (`NOVA_ACAO`).

**Modelos de projeto** (`/modelos`, regra pura em `modelo-projeto.ts`, Server
Actions em `modelos/acoes-modelo.ts`; tabelas `ModeloProjeto` e `ModeloAcao`):

- **Salvar como modelo** (link na tela do projeto) guarda a classificação
  (equipe, natureza, categoria, apoio, setor) e as ações com datas
  **relativas, em dias úteis**: `inicioDiasUteis` (a ação mais cedo é o dia 0) e
  `duracaoDiasUteis` (as duas pontas contam, como `diasUteisEntre`). **Pessoas e
  andamento não vão para o modelo** — responsável, status e realizado são do
  projeto, não do molde. Ação sem data vira item sem datas.
- **Usar o modelo** (`/modelos/[id]/usar`): informa nome e data de início; o
  projeto e as ações nascem em UMA transação (ou nasce tudo, ou nada), com as
  datas posicionadas por `deslocarDiasUteis` e `somarDiasUteis`. No mesmo início,
  as datas originais voltam (ida e volta, testado). **Início em fim de semana ou
  feriado vale o próximo dia útil**; e, ao salvar, uma data de início de ação
  em dia não útil volta como o dia útil anterior (aproximação, dita na tela).
- Ajustar depois é com a **edição em lote**: não há pré-visualização das datas
  antes de criar, de propósito — corrigir é barato.
- **Modelos iniciais** (`modelos-iniciais.ts`, carregados por
  `npm run carregar:modelos`, simulação por padrão e `-- --gravar` para gravar):
  ciclo orçamentário anual, prestação de contas, desenvolvimento de sistema e
  onboarding. São RASCUNHOS de senso comum, não a rotina medida da CTCEA. O
  script pula nome que já existe (nunca sobrescreve), roda contra o
  `DATABASE_URL` de quem o executa e cria com `criadoPor = 'sistema'` (só
  administrador exclui). Equipe, natureza e categoria ficam em branco. Um modelo
  novo no arquivo exige rodar o script de novo em cada banco.
- **Editor de modelos** (`/modelos/novo`, `/modelos/[id]/editar`,
  `EditorModelo`): cria um modelo do zero (nome, descrição, classificação e a
  lista de ações com "começa no dia N" e "dura N dias úteis", reordenável) e
  edita um existente. As linhas vão como campos paralelos repetidos
  (`acaoDescricao`/`acaoInicio`/`acaoDuracao`) e `lerItensDoFormulario`
  valida (início e duração vêm juntos ou ambos vazios = ação sem datas;
  duração ≥ 1; teto de 1000 dias; até 200 ações). O editor é todo CONTROLADO: o
  React 19 limpa campos não controlados depois de uma ação com erro.
- **Editar substitui as ações por inteiro**, numa transação (`updateMany` com
  `updatedAt` = versão vista, depois apaga e recria as ações). Versão velha =
  conflito, nada grava. Projetos já criados não mudam (cópia, não vínculo).
  **Quem edita = quem exclui** (`podeAlterarModelo`): o autor ou um administrador;
  modelo "do sistema" (`criadoPor = 'sistema'`) só o administrador. Excluir
  pede confirmação no navegador (`BotaoExcluirModelo`).
- Nome do modelo é único. **Quem salvou (ou um administrador) exclui**; Leitor vê
  a lista mas não cria, usa nem exclui. Excluir o modelo não altera os projetos
  já criados com ele (cópia, não vínculo). Teto de 200 ações por modelo.

## Líder do projeto na lista (`Projeto.liderId`)

O "Responsável" do formulário do projeto é um `<select>` de colaboradores
(`lider-projeto.ts`), não mais texto. Gravar escolhe o `liderId` E copia o nome
canônico do colaborador para `Projeto.responsavel`, que os relatórios agrupam:
a grafia deixa de divergir do cadastro.

- **Valores do select**: `''` sem líder (limpa os dois campos), `c:<id>`
  colaborador, `t` mantém o texto antigo de um projeto cujo nome não casa com
  ninguém. Campo `lider` AUSENTE (aba aberta antes da mudança) não mexe no
  líder e o texto do formulário antigo continua valendo.
- **Pré-seleção**: com `liderId`, ele; sem, o nome em `responsavel` casado por
  `chaveDoNome` (salvar já liga); sem casar, a opção `t`. Salvar outro campo
  nunca apaga o líder. Só ativo é oferecido, exceto o líder atual ("(inativo)").
- **Renomear o colaborador** atualiza `responsavel` dos projetos que ele lidera
  (sempre, independente da caixa "alinhar" de projetos por texto).
- **Promover WIN a projeto** já cria o projeto com `liderId` = quem promoveu.
- `Projeto.apoio` continua texto (e é o ponto fraco de "Meus projetos").
- Migration aditiva (`liderId` nulo); projetos existentes migram ao serem salvos.

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

## Menus por perfil e área de Administração

Dois menus, em `menu.ts`: `MENU` (trabalho, igual para Administrador,
Colaborador e Leitor) e `MENU_ADMIN` (Colaboradores, Pesos da priorização,
Painel do sistema, Registro de erros), alcançado pelo item "Administração" do
cabeçalho, que só o administrador vê (`/administracao` lista as ferramentas e
`NavegacaoAdministracao` liga as quatro telas entre si).

- **Esconder é conforto, não segurança.** Quem recusa de verdade são as Server
  Actions e as próprias telas (`contaPodeAdministrar`); abrir o endereço direto
  mostra "só administradores". Não confie no menu para proteger nada.
- **O cabeçalho usa `contaPodeAdministrar`**, a mesma regra das telas: enquanto
  não há administrador ativo, todos veem a área (o sistema ainda não restringe).
  Falha na consulta esconde o item — o cabeçalho de toda página não pode cair.
- **Tela de administração nova** vai em `MENU_ADMIN` (e ganha a barra
  `NavegacaoAdministracao` no topo), em vez de ficar só no endereço. O teste do
  manual exige seção para cada item de `MENU_ADMIN` e para `/administracao`.
- **Tour e manual seguem o perfil**: passo com `somenteAdmin` e seção do manual
  com `perfil: 'administrador'` não aparecem para quem não administra
  (`passosDoTour`, `secoesParaPerfil`).
- A lista de colaboradores deixou o menu de trabalho: ficou só na Administração
  (a página segue legível por endereço para quem não administra, como antes).
- NÃO existe ainda perfil intermediário (líder de equipe/gestor) nem restrição
  de edição por equipe: todo Colaborador edita qualquer projeto. Decisão
  pendente com a liderança.

## Manual do usuário e tour (`/manual`)

O manual mora DENTRO do sistema e é a fonte única do que cada tela faz:
conteúdo em `src/lib/manual-conteudo.ts` (seções e glossário), regras puras em
`manual.ts`, página em `app/manual/page.tsx` (busca, índice, "Novidades").

- **REGRA PARA TODA FUNCIONALIDADE NOVA: o manual entra no MESMO PR.** Seção
  nova (ou passo/dica nova em uma existente), com `desde` na data da entrega —
  é o que alimenta "Novidades". Atualizar o manual faz parte de "pronto", como
  teste e CLAUDE.md.
- **O que o CI cobra** (`manual.test.ts`): toda `page.tsx` de `src/app` precisa
  estar em `rotas` de alguma seção (ou em `ROTAS_SEM_MANUAL`, com motivo); rota
  do manual que deixou de existir quebra; todo item de `MENU` precisa de seção.
  Isso garante que a tela tem manual, NÃO que o texto está certo: funcionalidade
  sem tela própria (botão, regra nova) o teste não enxerga — quem a entrega
  escreve o passo no manual.
- **Texto**: português simples, imperativo, o nome exato do botão entre aspas.
  `perfil` diz quem pode usar. Ao mudar um rótulo de botão, procure-o no manual.
- **Tour** (`tour.ts`, `tour-guiado.tsx`): passeio sobre o CABEÇALHO, que existe
  em toda tela, por `data-tour`. Sem biblioteca. Item novo no `MENU`
  (`menu.ts`, compartilhado com o cabeçalho) exige passo no tour (teste cobra);
  item novo em `MENU_ADMIN` exige seção no manual.
  Convite de primeira visita e "visto" ficam no `localStorage` (conveniência por
  navegador); passo sem alvo visível aparece centralizado.

## Guia dos relatórios dos Dashboards

Cada relatório do catálogo tem uma entrada em `src/lib/guia-relatorios.ts`: **o que
mostra, como ler, de onde vem o número e quando olhar com cuidado**. É a fonte
ÚNICA de dois lugares: o "Guia dos relatórios dos Dashboards" do manual
(`/manual#guia-relatorios`, agrupado pelas abas e com busca) e o "Como ler este
relatório" recolhido embaixo do título de cada relatório (`DashboardSecao`).

- **Relatório novo no catálogo exige entrada no guia, no mesmo PR**:
  `guia-relatorios.test.ts` falha se faltar (ou sobrar) uma entrada, ou se algum dos
  quatro campos estiver vazio. Ao mudar a regra de um relatório, mude o texto.
- Escreva a REGRA real (não o que parece): confira no código o que entra e o que
  fica de fora, e como o grupo "sem valor" se chama (`Não informado` nas
  distribuições; `Sem equipe` nos relatórios de gestão).

## Relatórios de gestão dos Dashboards (aba Gestão)

A aba **Gestão** é a primeira e a que abre por padrão (`ABA_PADRAO`): cruzamentos
para diretoria e gerência. Regra pura em `dashboard-gestao.ts` (com teste), gráficos
em SVG/CSS sem biblioteca, componentes em `semaforo-equipes`, `mapa-de-calor`,
`barras-empilhadas`, `bolhas-prioridade` e `ritmo-de-entrega`. Dados em `dados.ts`.

- **Semáforo por equipe** (`semaforoPorEquipe`): cruza ações, riscos e
  replanejamentos. **Os limites moram em UM lugar**: `LIMITE_VERMELHO` (20%) e
  `LIMITE_AMARELO` (5%). Vermelho = mais de 20% das ações ABERTAS atrasadas OU risco
  de impacto alto com prazo vencido; amarelo = 5% a 20% OU risco de impacto alto
  aberto; verde = abaixo; "sem ações abertas" se não há o que medir. O atraso é
  medido sobre as ABERTAS (concluir não dilui o problema). A cor SEMPRE vem com a
  palavra e o motivo escrito: a identidade nunca fica só na cor.
- **Token `atencao`** (`--atencao`, amarelo): existe só para o estado "atenção" do
  semáforo; nunca use para dado comum. As outras cores do semáforo são as
  reservadas: atraso (`warn`) e realizado (verde).
- **Mapa de calor** (equipe × status, e motivo × equipe): a intensidade é a
  MAGNITUDE, numa cor só (a de atraso na coluna "Atrasado"); o número sempre
  aparece. Tinta máxima de 45%: acima disso o número perde contraste nos dois temas.
- **Barras empilhadas** (idade do atraso, riscos por impacto): todas na mesma
  escala, rampa de UMA cor (atraso), com legenda e número em cada fatia.
- **Prioridade × atraso**: a matriz Benefício × Esforço (mesmas tintas de
  quadrante e `calcularAvaliacao` com os pesos vigentes) com o atraso por cima:
  área da bolha ∝ ações atrasadas, contorno grosso = alto benefício atrasado.
  Só entram projetos avaliados.
- **Ritmo de entrega**: 12 semanas (domingo a sábado, a semana da CTCEA) de ações
  concluídas (pelo término REALIZADO) contra ações criadas (`createdAt`), com média
  móvel de 4 semanas. Mostra se a carteira encolhe ou cresce.
- **Idade do atraso** (aba Prazos) em dias CORRIDOS: até 7, 8 a 30, 31 a 90, mais
  de 90. **Motivos por equipe** (aba Auditoria) conta EVENTOS, como o relatório por
  motivo.
- Os relatórios de gestão seguem os filtros da carteira; o histórico (replanejamentos
  e motivos) segue o período, como toda a auditoria. A previsão de conclusão
  ("no ritmo atual, acabam em N semanas") ficou DE FORA de propósito: é projeção, e
  com pouco histórico engana.
- **Ao criar relatório de gestão novo**: declare-o no catálogo com o grupo, escreva
  a regra no módulo puro com teste, e confira no celular (a regra de não rolar a
  página de lado vale; gráfico largo rola com aviso).

## Cabeçalho: menu em grupos e "Ajuda e preferências"

O cabeçalho tinha 10 itens soltos, mais Manual, Tour, tema, sino e avatar: quebrava
em duas linhas e misturava tudo. Agora (`menu.ts` é a fonte única):

- **Painel + três grupos** (`GRUPOS_DO_MENU`): **Trabalho** (Projetos, Priorização,
  Modelos), **Pessoas** (Meus projetos, Minhas ações, Card WIN, Equipe) e
  **Análise** (Dashboards, Reunião). **Administração** (`GRUPO_ADMINISTRACAO`: visão
  geral + `MENU_ADMIN`) só aparece para o administrador. Cada grupo abre uma lista
  (`NavegacaoPrincipal`, padrão de "disclosure": botão com `aria-expanded`, não
  `role=menu`); fecha ao escolher, com Esc e ao clicar fora; o grupo da página
  atual fica destacado (`grupoAtivo`/`itemAtivo`: vence o endereço MAIS LONGO, então
  `/priorizacao/pesos` é da Administração e não da Priorização).
- **Item novo no menu** vai no grupo em que a pessoa o procuraria (e em `MENU`, que
  é derivado dos grupos, para o teste do manual cobrar a seção). Grupo novo exige
  passo no tour (`tour.test.ts` cobra). Se um grupo passar de ~6 itens, repense.
- **Botão de tema** (`BotaoTema`, sol/lua ao lado do sino): um clique alterna claro/escuro a partir
  do tema que vale agora e grava a preferência explícita; "Sistema" volta pelo menu abaixo.
- **"Ajuda e preferências"** (`MenuAjuda`, ícone de interrogação ao lado do sino):
  Manual, "Fazer o tour" (`iniciarTour`) e o seletor de tema. O avatar continua o
  `UserButton` do Clerk (conta e sair): o menu dele NÃO é personalizado porque o
  ambiente de teste usa um Clerk falso e não dá para testar o componente real.
- **Celular** (`MenuCelular`, abaixo de `lg`): o botão "Menu" abre a mesma estrutura,
  com o Painel e cada grupo com o seu título. Os `data-tour` ficam nos botões de
  grupo (só existem em tela larga): no celular os passos saem centralizados.
- Menus abertos valem só para a página em que foram abertos (o caminho muda, e
  eles se consideram fechados): evita efeito que mexa em estado.

## Celular e tablet (Dashboards e cabeçalho)

Regra de ouro: **nenhuma tela pode rolar a página de lado**. O cabeçalho tinha
um menu em linha que não quebrava e estourava a largura de TODAS as telas (516
px a mais no celular, 138 no tablet). O e2e `dashboards no celular e no tablet`
confere `scrollWidth <= innerWidth` em todas as abas, a 390 px e a 768 px.

- **Cabeçalho**: abaixo de `lg` (1024 px) o menu em linha some (`hidden lg:flex`)
  e entra o botão "Menu" (`menu-celular.tsx`): grade de 2 (3 em `sm`) itens com
  área de toque de 44 px, fecha ao escolher uma tela. Os `data-tour` ficam só no
  menu em linha: no celular os passos do tour sem alvo visível saem centralizados.
- **Dashboards**: abas numa faixa que rola de lado (`lg:flex-wrap` volta ao normal);
  filtros atrás do botão "Filtros (N ativos)" abaixo de `md`
  (`filtros-recolhiveis.tsx`: o servidor renderiza RECOLHIDO e o CSS `md:block`
  mostra em tela larga — sem "piscada" em nenhum dos dois); tabelas viram
  cartões (`TabelaEmpilhavel` + CSS em `globals.css`, só `screen` abaixo de
  768 px: a impressão e a tela larga ficam como sempre); gráficos largos
  (evolução, carga por mês) rolam de lado com um aviso.
- **`TabelaEmpilhavel`** lê os rótulos do `<thead>` e os põe em `data-rotulo` nas
  células (efeito no cliente): tabela nova ou com coluna nova funciona sem
  marcar célula por célula. Antes da hidratação os cartões saem sem rótulo.
- **Ao criar tela nova**, confira no celular (390 px) e no tablet (768 px): sem
  rolagem lateral, com alvos de toque de pelo menos 40 px. Tabela larga: use
  `TabelaEmpilhavel`. Gráfico largo: `overflow-x-auto` com largura mínima.
- Fora dos Dashboards só se conferiu a ROLAGEM LATERAL das telas principais
  (painel, projetos, projeto, ação, minhas ações, Card WIN, modelos, reunião e
  manual: nenhuma estoura). Layout fino de cada uma no celular ainda não foi revisto.

## Links e anexos por ação (`LinkAcao`)

Só o ENDEREÇO de ata, contrato ou planilha de apoio: o arquivo fica onde a CTCEA
já o guarda (SharePoint, Drive...) e **quem consegue abri-lo é decidido lá**, não
aqui (o manual diz isso). Regra pura em `link-acao.ts`, Server Actions em
`projetos/acoes-link.ts`, tela em `LinksAcao` (edição da ação).

- **Só `http` e `https`** (`urlValida`, pelo parser de `URL`, sem espaço nem
  caractere de controle, até 2000 caracteres). `javascript:`, `data:`, `file:`,
  `blob:` e endereço sem esquema são recusados, porque o link vira `<a href>`.
  O endereço é guardado COMO FOI DIGITADO (não normalizado).
- Todo link abre em outra aba com `rel="noopener noreferrer"`; a tela mostra o
  site de origem (`origemDoLink`) antes do clique.
- **Campos**: título (até 200), endereço e tipo (ATA, CONTRATO, PLANILHA,
  DOCUMENTO, OUTRO). Adicionar, editar (só se algo mudou) e remover entram em
  `HistoricoAlteracao` com `campo = 'link'` (texto livre "Ata: Título (site)").
- Qualquer Colaborador mexe; o Leitor só vê e abre. Por AÇÃO, não por projeto.
- A lista de ações do projeto mostra "· N links" (`groupBy` em uma consulta).
- Não há upload, e não há como saber se o link continua válido.

## Lixeira (`/administracao/lixeira`)

Restaura projetos excluídos. A exclusão sempre foi lógica (`ativo = false`);
agora também grava `excluidoEm`/`excluidoPor` (`dadosDaExclusao`), e a
restauração grava `restauradoEm`/`restauradoPor` (`dadosDaRestauracao`).

- **Só administrador** exclui e restaura (a mesma regra). Fica em
  `MENU_ADMIN`; o menu de trabalho não tem lixeira.
- **Restaurar devolve tudo como estava**: ações, comentários, riscos, histórico
  e dependências nunca saíram do banco. `restaurarProjeto` é um `updateMany`
  com `ativo: false` no filtro: restaurar de novo (ou um projeto que já voltou)
  não é erro, só nenhuma linha afetada, e a tela avisa.
- **NÃO há exclusão definitiva**: a trilha de auditoria é requisito central.
  Se um dia for preciso apagar de verdade, é uma operação pontual no banco.
- **Excluir de novo um projeto restaurado** vale como a última exclusão
  (`restauradoEm/Por` voltam a nulo). Projetos excluídos antes das colunas
  existirem têm `excluidoEm` nulo e aparecem por último, como "data não
  registrada". Não há registro de QUANTAS vezes foi excluído/restaurado.

## Motivo do replanejamento

Mudar a data PREVISTA (início ou término) de uma ação que já tinha data pede o
"por quê?". Regra pura em `motivo-replanejamento.ts`; colunas `motivo` e
`motivoDetalhe` em `HistoricoAlteracao` (só nas linhas de data prevista).

- **Quando pede** (`replanejaDataExistente`): campo presente que MUDA ou LIMPA
  uma data que existia. Preencher uma data vazia não é replanejamento. Campo
  ausente não conta (como no resto da edição). `registrarRealizado`, duplicar e
  criar nunca pedem: não mexem no previsto.
- **Obrigatório**: lista fechada de 6 motivos (`ESCOPO`, `DEPENDENCIA_EXTERNA`,
  `RECURSOS`, `PRIORIDADE`, `ESTIMATIVA`, `OUTRO`) + detalhe de até 500
  caracteres; `OUTRO` exige o detalhe. Mudar a lista exige tratar o código velho
  no histórico (`descreverMotivo` devolve o próprio código se desconhecido).
- **Edição da ação**: o formulário controla as duas datas e mostra o bloco do
  motivo quando mudam em relação ao que está GRAVADO (depois de salvar, a base é
  o que acabou de ser salvo: `salva.previstoInicio/Termino`). Em `criar` o campo
  fica não controlado (o React reinicia o formulário pela `key`).
- **Edição em lote**: UM motivo para o lote inteiro, pedido na CONFIRMAÇÃO
  (`precisaMotivo` na prévia, só se alguma data prevista vai mudar; lote só de
  responsável não pede). Vale para todas as linhas de data do lote; a linha de
  responsável não leva motivo.
- **Onde aparece**: histórico da ação ("Motivo: …", ou "Sem motivo registrado"
  nas mudanças antigas), tela Reunião (replanejadas: o motivo da última mudança)
  e o relatório `replanejamentos-por-motivo` dos Dashboards (aba Auditoria),
  que conta EVENTOS — início e término no mesmo instante (mesma transação)
  valem um — e não mostra pessoas, só categorias.
- Histórico anterior à regra fica com `motivo` nulo: nada é inventado.

## Riscos e bloqueios (`RiscoProjeto`)

O campo estruturado do que o Card WIN chama de "alerta de riscos". Regra pura em
`risco-projeto.ts`, Server Actions em `projetos/acoes-risco.ts`, telas
`/projetos/[id]/riscos/novo` e `.../[riscoId]/editar`, lista em `SecaoRiscos` na
tela do projeto (âncora `#riscos`).

- **RISCO (pode acontecer) e BLOQUEIO (já trava) no mesmo cadastro**, por `tipo`.
  Campos: título, descrição, impacto (BAIXO/MEDIO/ALTO), status
  (ABERTO/EM_TRATAMENTO/RESOLVIDO/ACONTECEU), responsável (colaborador ativo),
  prazo, plano e, opcional, a ação afetada (do MESMO projeto). Strings, não enums,
  como `LiberacaoAcao`. **Sem "probabilidade"** de propósito: basta o impacto.
- **Aberto** = ABERTO ou EM_TRATAMENTO (`riscoAberto`). `resolvidoEm` é gravado ao
  sair de aberto e limpo ao reabrir. Resolver é mudar o status; **excluir apaga o
  histórico** e é só de quem registrou ou do administrador.
- **Ordem de atenção** (`ordenarPorAtencao`): impacto alto, bloqueio antes de
  risco, prazo mais próximo, mais antigo. Prazo vencido (aberto + prazo < hoje)
  vai em destaque.
- **Histórico** (`RiscoHistorico`): tipo, impacto, status, responsável (o NOME) e
  prazo, na mesma transação do `update`, com `alteradoPor`.
- **Aviso no sistema** (`Notificacao.riscoId`, motivo `RISCO_RESPONSAVEL`) ao
  escolher alguém (na criação ou ao TROCAR) que não seja quem está salvando.
- **Aparece**: na tela do projeto; na edição da ação afetada (só os abertos); e na
  tela Reunião ("Riscos e bloqueios abertos", por equipe, mais o indicador do
  Panorama). Ainda NÃO aparece no painel consolidado, nos Dashboards nem no
  resumo semanal: ficou para quando houver uso real.
- Qualquer Colaborador registra e edita (como nas ações); o Leitor só lê.

## Reunião (`/reuniao`): apresentação para a daily

Telas grandes, uma de cada vez, sobre o cabeçalho (`fixed inset-0 z-40`):
**Panorama, Atrasadas, Vencem em 7 dias, Replanejadas na semana, Riscos e
bloqueios abertos, Concluídas na semana**. Regra pura em `reuniao.ts`, dados em `reuniao-servidor.ts`, tela em
`apresentacao-reuniao.tsx` (cliente). No menu de trabalho, para todos os perfis
(só consulta).

- **Dados de AGORA, não foto** (o retrato semanal é o Resumo semanal). A
  classificação das ações é `classificarAcao` (`resumo-semanal.ts`), a mesma do
  resumo e do painel: concluída = término realizado nos 7 dias até hoje; atrasada
  = `acaoEstaAtrasada`; vence = previsto de hoje a hoje+7.
- **Filtro por equipe na URL** (`?equipe=STI`; `Sem equipe` para projetos sem
  equipe): vale o link guardado da daily de cada equipe. Equipe desconhecida =
  todas (`lerEquipe`).
- **Replanejadas** = mudanças de `previstoTermino`/`previstoInicio` nos últimos
  7 dias (`HistoricoAlteracao`), UMA linha por ação: data de antes (primeira
  mudança da janela), de depois (a última), total de mudanças e quem fez a
  última. Mostra o término; o início só se ele for o único que mudou. Ida e
  volta à data original não conta (`agruparReplanejadas`).
- **Lista longa vira telas** (`ITENS_POR_TELA` = 6, "2/3"): ninguém rola a
  página numa reunião. Tela vazia continua na sequência, com a mensagem (dizer
  "nenhuma atrasada" também é informação).
- **Teclado**: setas/PageUp/PageDown/espaço navegam, F alterna a tela cheia, Esc
  sai (com tela cheia ligada, o primeiro Esc é do navegador). Ignora teclas em
  campos de formulário.

## Resumo semanal para os administradores (`/resumo-semanal`)

Uma FOTO por semana (`ResumoSemanal`, `semana` = a segunda-feira, `aaaa-mm-dd`,
única) do que foi concluído nos últimos 7 dias, do que está atrasado e do que
vence nos próximos 7, por equipe. Regra pura em `resumo-semanal.ts`; leitura e
gravação em `resumo-servidor.ts`. **Sem e-mail por enquanto**: vira aviso no
sistema (`Notificacao.resumoId`, motivo `RESUMO_SEMANAL`) e popup na entrada.

- **A semana começa na segunda, 8h de Brasília** (UTC-3, sem horário de verão;
  `semanaDisponivel`). Antes disso, a semana disponível é a anterior. O mesmo
  `vercel.json` (segunda, 11h UTC) já dispara `/api/cron/atrasos`, que também
  chama `garantirResumoDaSemana` num bloco à parte (um não derruba o outro) e
  grava a execução `resumo-semanal` em `ExecucaoCron`.
- **Rede de segurança**: o administrador que entra depois do horário também
  provoca a foto (`resumoPendenteDe`, chamado pelo popup no layout). Um cron
  perdido não deixa a semana sem resumo. A semana é única: corrida entre duas
  chamadas termina com UM resumo.
- **Quem recebe**: administradores ATIVOS (`Colaborador.administrador`),
  administrador de verdade — no estado "ainda não há administrador" ninguém
  recebe (um popup em toda página para todos seria ruído). Quem vira
  administrador depois da foto recebe o aviso da semana corrente na entrada.
- **Concluída** = término realizado nos 7 dias até hoje (ou, sem data
  realizada, o dia da última mudança de status para Concluído no histórico).
  **Atrasada** = `acaoEstaAtrasada`, a regra do painel. **Vence** = término
  previsto de hoje a hoje+7. Cada bloco guarda o TOTAL e só as 10 ações mais
  relevantes (concluídas: as mais recentes; atrasadas: as mais antigas; vencem:
  as mais próximas). Equipe sem nada não entra; sem equipe = "Sem equipe".
- **O popup** (`ResumoSemanalPopup` no layout + `PopupResumoSemanal`) mostra os
  totais por equipe; "Fechar" ou Esc dispensa (`dispensarResumo` marca como
  lidos os avisos de resumo de quem clicou); abrir `/resumo-semanal` também
  marca o da semana. Não aparece em `/resumo-semanal` nem nas telas de cadastro.
  `resumoPendenteDe` nunca lança: o popup é conveniência.
- **Quando houver e-mail**: o domínio da CTCEA no Resend ainda não foi
  verificado. O resumo já está montado de forma que enviar é só renderizar o
  `ConteudoResumo` em texto (como `email-atrasos.ts`) para os mesmos
  destinatários; ficou de fora de propósito, por decisão do negócio.

## Dependência entre ações e liberação pelo líder

"B só começa quando A terminar." Regra pura em `dependencia-acao.ts`, vínculos
em `DependenciaAcao` (B depende de A, mesmo projeto, vários predecessores),
Server Actions em `projetos/acoes-dependencia.ts`, tela na edição da ação
(`secao-dependencias.tsx`) e selo "bloqueada por #N" no Gantt.

- **O bloqueio vale só para o INÍCIO REAL**: passar de "não iniciada" para
  qualquer outro status ou apontar realizado (`gravacaoInicia`). O previsto fica
  livre, para o planejamento não travar. Ação já em andamento não é bloqueada
  (o vínculo pode ter sido criado depois), e editar sem iniciar também não.
  Quem recusa é a Server Action (`bloqueioParaGravar`, em `atualizarAcao` e
  `registrarRealizado`), não só a tela. Edição em lote, duplicar e modelos não
  iniciam nada, então não passam por aqui.
- **Sem ciclo, sem outro projeto, sem a própria ação** (`validarNovaDependencia`,
  busca em profundidade nos vínculos do projeto).
- **Líder = o colaborador escolhido em `Projeto.liderId` (lista no formulário do
  projeto), ou administrador DE VERDADE** (`contaELiderDoProjeto`). Projeto
  antigo, sem `liderId`, cai no nome em `Projeto.responsavel` casado por
  `chaveDoNome`. Com `liderId` o texto NÃO vale: a lista é a verdade. Não usa
  `contaPodeAdministrar`: no estado "ainda não há administrador" todos podem
  tudo, e qualquer um aprovaria o próprio pedido.
- **Pedido de liberação** (`LiberacaoAcao`: PENDENTE → APROVADA | RECUSADA) com
  motivo obrigatório (5 a 500 caracteres). Se quem pede é o líder, nasce
  APROVADA, com o registro. O líder (ou administrador) decide; **recusar exige
  justificativa**, aprovar não. A decisão é um `updateMany where status =
  PENDENTE` (dois cliques decidem uma vez). Recusado, dá para pedir de novo.
- **Aprovada, a ação fica liberada** e a dependência continua visível, com a
  marca "liberada pelo líder". A liberação vale para a ação, não por predecessora.
- **Trilha**: vínculo adicionado/removido e pedido/decisão entram em
  `HistoricoAlteracao` com os campos `dependencia` e `liberacao` (texto livre,
  rotulados em `rotularCampo`). Não são campos auditados da ação: a foto em uma
  data os ignora.
- **Avisos no sistema** (`Notificacao.liberacaoId`, `comentarioId` agora
  opcional): pedido avisa o líder (ou, sem líder com cadastro, os administradores
  ativos); a decisão avisa quem pediu. Motivos `LIBERACAO_*`.
- **Aviso de risco** na tela da ação: predecessora atrasada ou com término
  previsto depois do início previsto desta (`riscoDaPredecessora`). Ainda NÃO há
  aviso proativo por e-mail (as setas no Gantt existem, ver "Gantt" abaixo).

## Gantt do projeto (`gantt-projeto.tsx`, `gantt-geometria.ts`)

O Gantt deixou de ser um CSS grid de colunas-semana (barra sempre em semanas
inteiras, cabeçalho que desalinhava) e tem UMA régua em pixels: a semana mede
`LARGURA_SEMANA_PX` e tudo é posicionado por DIA a partir do início da primeira
semana da janela. Cabeçalho (mês e semana), raias, barras, "hoje", losangos e setas
usam a mesma conta, em `gantt-geometria.ts` (puro, com teste).

- **Previsto e Realizado na mesma linha**: contorno grosso (22 px) com o Realizado
  sólido e mais fino (10 px) POR CIMA. Uma linha por ação (antes eram duas).
- **Progresso estimado** (`barraDeProgresso`): ação EM_CURSO_25/50/75 SEM nenhuma data realizada ganha uma barra HACHURADA (textura, não cor nova) com esse percentual do previsto. É estimativa: a data realizada, quando existe, vale mais e a hachura some; o verde sólido continua significando só "tem data realizada".
- **Intervalo fechado**: o término ocupa o dia inteiro; ação de 1 dia tem largura
  mínima visível; com uma ponta só a barra tem uma semana a partir dela.
- **"Hoje"**: linha sólida de 2 px na cor de acento e etiqueta "Hoje" no cabeçalho
  (antes, tracejado fino de 1 px). Na "foto em uma data" marca o dia da foto.
- **Setas** (`montarSetas`): do FIM do previsto da predecessora ao INÍCIO do previsto
  da dependente; laranja se a dependente está bloqueada. Só desenha com as duas
  barras visíveis (janela, página e busca); se a dependente começa antes de a
  predecessora terminar, o traço contorna pela fronteira das linhas.
- **Losango de risco**: prazo de risco/bloqueio ABERTO com ação afetada; laranja e
  cheio se vencido, maior se impacto alto. Risco sem ação ou sem prazo não aparece
  (fica na seção de riscos). Na foto em uma data não há losangos (risco é de hoje).
- `faixaDaBarra`/`colunaDeHoje` (em semanas) seguem em `gantt.ts` mas o Gantt não os usa mais.

## Tela da ação em duas colunas (`AbasAcao`)

`/projetos/[id]/acoes/[acaoId]/editar`: formulário (e "Duplicar") à esquerda, contexto
em ABAS à direita (`abas-acao.tsx`, cliente): **Histórico** (aba de partida),
**Comentários**, **Links**, **Dependências** e **Riscos** (só se a ação tem risco aberto),
cada uma com a contagem. Abaixo de `lg` empilha.

- **Os painéis são renderizados no servidor e TODOS ficam no DOM**; o inativo só tem
  `hidden`. É de propósito: o rascunho de um comentário ou de um link não se perde ao
  trocar de aba. Padrão WAI-ARIA de abas (`tablist`/`tab`/`tabpanel`, setas, Home, End).
- **`?aba=historico|comentarios|links|dependencias|riscos`** abre já na aba (aba
  desconhecida = Histórico). Os testes de navegador usam isso para ir direto ao
  comentário, link, dependência ou risco; o histórico é a aba padrão.
- Seção nova de contexto da ação entra como aba nova em `page.tsx`, não solta abaixo
  do formulário. A coluna de grade precisa de `grid-cols-[minmax(0,1fr)]` na base: sem
  isso as abas estouram a largura no celular.

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

## Primeiro acesso: cadastro do colaborador

Entrar (conta no domínio) e ser colaborador são coisas diferentes: quem entra
sem cadastro não pode ser responsável por ação, não recebe aviso nem notificação
e não vê "Meus projetos". Por isso o `proxy.ts`, depois de conferir o domínio,
manda a conta SEM colaborador para `/bem-vindo?volta=<caminho>` antes de qualquer
tela, e o cadastro devolve a pessoa ao endereço que ela tentou abrir (o link do
projeto, por exemplo). Regra pura em `primeiro-acesso.ts`.

- **A tela reusa "Quem é você?"** (`VincularColaborador`): escolher o próprio
  nome entre os cadastros que ainda não têm conta (os da planilha) ou cadastrar
  o nome. O nome que o Clerk conhece vem sugerido, e, se bater (sem acento nem
  caixa) com alguém da lista, vem pré-selecionado — um clique só, sem duplicar.
- **O que nunca é desviado**: `/bem-vindo`, `/entrar`, `/cadastrar`,
  `/acesso-negado`, `/api/*` e qualquer requisição que não seja GET/HEAD (uma
  Server Action a meio caminho não pode virar redirecionamento). Sem essa lista,
  haveria laço.
- **`volta` só aceita caminho interno** (`caminhoSeguro`): endereço completo,
  `//host` e barra invertida viram `/`. Não é redirecionamento aberto.
- **É conforto, não segurança, e falha aberta**: `verificar-cadastro.ts` guarda
  só o "sim" (10 min, por instância), nunca o "não" — quem acabou de se
  cadastrar é liberado na hora — e, se o banco falhar, deixa passar (e registra a
  falha). O acesso em si continua decidido pelo domínio.
- **Perfil Leitor**: quem já tem cadastro não é desviado, então o Leitor nunca
  vê esta tela. Conta sem cadastro é Colaborador por padrão e passa pelo
  cadastro. Não há como marcar Leitor quem ainda não existe em Colaboradores.
- **`/entrar` e `/cadastrar`** ganharam, em volta do componente do Clerk, um
  painel (`PainelDeAcesso`) dizendo que o acesso é restrito a `@ctcea.org.br` e
  oferecendo criar a conta. O `redirect_url` do Clerk só acompanha a troca entre
  as duas telas se for caminho interno ou endereço do próprio sistema
  (`redirectSeguro`); o resto é descartado. O miolo (campos, botões sociais) é
  do Clerk e não é alterado por dentro.
- As telas "Minhas ações", "Meus projetos" e "Notificações" ainda explicam como
  se ligar a um colaborador, mas na prática o desvio para `/bem-vindo` vem antes.

## Flash Report e Sinal do projeto

Relatório semanal do projeto para a diretoria (`/projetos/[id]/flash-report?semana=aaaa-ss`)
e o "Sinal" (farol) na lista, no painel e no Excel. Regras puras em `avanco-fisico.ts`,
`farol-projeto.ts` e `flash-report.ts`; leitura em `flash-report-servidor.ts`;
telas em `src/components/flash-report/`.

- **O sinal tem UM só cálculo** (`farol-projeto.ts`): desvio = realizado − previsto, em
  p.p. `LIMITE_ATRASADO` −10, `LIMITE_ATENCAO` −3, `LIMITE_ADIANTADO` +3. **A fronteira
  −3 pertence a Atenção** (e −10 a Atrasado). Risco de impacto ALTO aberto com prazo
  vencido sobe um nível de gravidade. Lista, painel, Excel e Flash Report chamam a mesma
  função; não recalcule o sinal em outro lugar.
- **Duas medidas, dois nomes.** "Avanço físico" é ponderado por dias úteis previstos
  (previsto pela posição de hoje no intervalo; realizado pelo status 0/25/50/75/100). O
  "percentual concluído" do painel conta AÇÕES. Nunca chame um pelo nome do outro.
- **Macroetapa é opcional** (`Macroetapa`, `Acao.macroetapaId`); ação sem ela cai no grupo
  "Sem macroetapa" e entra no total. O histórico da ação grava o NOME da macroetapa, não o
  id. **Excluir só desvincula** as ações e registra histórico. Criar e renomear usam trava
  advisory por projeto (limite de 12 por projeto), para duas abas não furarem o teto.
- **`RiscoProjeto.pedeAjuda`** alimenta o bloco "Pedido de ajuda" e não gera histórico
  (não é campo auditado do risco).
- **Regra de data única**: `corte = min(hoje, sábado da semana escolhida)`. Semana de hoje
  é avaliada até hoje; passada, até o sábado. Previsto, realizado, curva e farol usam o
  mesmo corte. Numa semana passada, avanço, farol, curva e alerta de desvio das macroetapas
  usam a foto DAQUELA semana (previsto e realizado de cada ponto da curva saem da mesma
  foto, então o ponto da semana escolhida bate com o cabeçalho mesmo após replanejamento);
  os alertas de ações atrasadas e bloqueadas, os riscos e as próximas atividades são sempre
  de HOJE (o aviso diz).
- **"Hoje" é `inicioDeHojeUTC`**, o mesmo da lista, do painel e do Excel: o relatório e o
  sinal da lista nunca divergem à noite (21h–23h59 em Brasília). Levar o sistema inteiro
  para o horário de Brasília é uma decisão à parte, que mexeria em todas essas telas.
- **Células do Gantt macro**: por semana de cada macroetapa até a escolhida, avanço no fim
  da semana (foto dela): `ATENCAO` se desvio ≤ −3; senão `REALIZADO` (verde) só se houve
  avanço (realizado > 0); senão `DECORRIDO` (contorno neutro, texto "Decorrido, sem
  avanço"). Semana passada sem foto é `DECORRIDO`; depois da escolhida, `PLANEJADO`.
  Verde sempre significa realizado, nunca "o tempo passou".
- **Ação sem datas previstas pesa 0**, fica fora das médias e é contada num aviso do relatório.
- **Semanas passadas dependem do histórico** (`foto-em-data`). Antes do primeiro registro
  do sistema a foto não é confiável e a tela avisa. `acoesNoFimDeCada` precisa do `id` da
  ação para casar a foto com a macroetapa; sem ele o aviso cai para "estado atual".
- **`umaCasa` nunca devolve −0** (aparecia "−0,0 p.p."); teste de borda cobre.
- O cabeçalho mostra `Projeto.responsavel`/líder, cliente e objetivo (`Projeto.cliente`,
  `Projeto.objetivo`, opcionais).
- **Fora de escopo, de propósito**: envio por e-mail, relatório consolidado de vários
  projetos e macroetapas nos modelos de projeto.
- Manual: seções `flash-report`, `macroetapas`, `sinal-projeto` e
  `cliente-objetivo-decisao`; glossário com Avanço físico, Desvio, Sinal e Macroetapa.

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

## Homologação (branch `homologacao`)

Fluxo: branch da etapa → PR contra `homologacao` (o autoloop mescla só lá, com o CI
verde) → PR `homologacao` → `main`, aprovado por quem administra. A `main` é só a
produção; o autoloop nunca abre PR nem mescla nela (`autoloop.sh`/`.ps1` recusam rodar
sem a branch `homologacao` no remoto).

- **Projeto próprio na Vercel**: `cronograma-homologacao` (`prj_l6yvZ2GWfDrZlV5wxA9hwOTr3sGC`),
  ligado ao mesmo repositório, com **Production Branch = `homologacao`**. Endereço fixo:
  `cronograma-homologacao.vercel.app`. A `DATABASE_URL` de produção NUNCA existe nele,
  que é a proteção de verdade: não há como a homologação alcançar o banco de produção.
  Os endereços com hash de cada deploy pedem login da Vercel (Vercel Authentication);
  o endereço fixo não.
- **Cada projeto só builda a sua branch** (Ignored Build Step, configurado na Vercel):
  `cronograma-homologacao` pula tudo que não é `homologacao`; `cronograma-lktu` (produção)
  pula a `homologacao`. Sem isso, cada push geraria um build falho no outro projeto e um
  check vermelho no PR. Se um check da Vercel voltar a falhar na `homologacao`, comece
  conferindo essas duas configurações.
- **Banco próprio** (Postgres no Railway, serviço `Postgres-WZMG`, acesso por TCP proxy
  público). A `DATABASE_URL` dele é montada à mão (`postgresql://usuario:senha@host:porta/banco`
  a partir das variáveis do serviço) e cadastrada como Sensitive em Production do projeto
  da homologação. Nunca cole em chat, issue ou commit.
- **Migrations**: no projeto da homologação a Vercel enxerga o build como produção
  (`VERCEL_ENV=production`), então `scripts/migrar-producao.ts` aplica as migrations no
  banco dela a cada build, e um build sem `DATABASE_URL` falha, como na produção.
  A trava `HOMOLOGACAO_BANCO_HOST` (`decidirMigracao`, ramo preview + branch `homologacao`)
  só vale se alguém voltar a construir a branch no projeto de produção: aí o build ERRA
  se o host da `DATABASE_URL` não for o do banco da homologação, em vez de migrar o banco
  errado. Previews de outras branches continuam sem migrar.
- **Login**: o Clerk é o mesmo da produção (a aplicação só tem uma instância, de
  desenvolvimento); as contas valem nos dois ambientes, mas o cadastro de colaborador é do
  banco: na primeira entrada na homologação a pessoa passa por `/bem-vindo`. As variáveis
  `NEXT_PUBLIC_CLERK_*` e `CLERK_SECRET_KEY` foram copiadas da produção.
- **E-mails e cron**: desligados. `RESEND_API_KEY`, `CRON_SECRET`, `EMAIL_ALERTAS` e
  `EMAILS_EXCECAO` NÃO existem no projeto da homologação (e o envio de e-mail exige a chave).
  Ao cadastrar variável nova nele, confira antes se ela não religa e-mail ou cron.
- **Promoção `homologacao` → `main`**: abra o PR com o modelo `promocao.md`
  (`.github/PULL_REQUEST_TEMPLATE/promocao.md`; pela URL, `?template=promocao.md`). Ele pede
  a conferência das migrations e da validação na homologação. O workflow `aviso-migration`
  só roda em PR contra a `main` e, se houver migration nova, deixa uma anotação de aviso e
  um resumo no job. Não bloqueia: é um lembrete para quem aprova, porque a produção aplica
  a migration no build, antes do código no ar, no banco real.
- **Carga inicial**: banco novo nasce vazio. `npm run db:seed` e `npm run carregar:modelos
  -- --gravar`, com a `DATABASE_URL` da homologação no comando (ver README).

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

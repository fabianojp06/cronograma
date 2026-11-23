# Flash Report do projeto — desenho

Data: 23/11/2026. Status: aguardando aprovação.

## Intenção

A gerência e a diretoria acompanham cada projeto numa folha semanal de uma página, o
"Flash Report" (modelo em imagem, feito hoje em Excel): farol, previsto x realizado
acumulado, macroetapas em Gantt, curva de avanço, o que foi feito, o que vem, riscos,
alertas e o pedido de ajuda à diretoria. O sistema já tem as ações, os riscos e o histórico
que alimentam quase tudo isso. O objetivo é que o relatório saia **calculado do sistema**,
sem redigitar, e bata sempre com o resto das telas.

## Objetivos

- Tela `/projetos/[id]/flash-report`, visualmente fiel ao modelo (cabeçalho com semana
  "S07/10", farol, 6 blocos), nos tokens do sistema (claro e escuro).
- Macroetapa como cadastro do projeto; cada ação pertence a uma.
- Farol, desvio, alertas e curva calculados por regra pura, com teste.
- Escolha da semana por `?semana=` (padrão: a semana corrente), para reler relatórios
  passados.
- Impressão/PDF pelo navegador (A4 paisagem), como o resto do sistema.

## Não objetivos

- Não substitui o Gantt detalhado do projeto nem o painel consolidado.
- Sem e-mail nem envio automático do relatório (decisão já tomada para o resumo semanal).
- Sem edição de percentual à mão: o número vem das ações.
- Sem macroetapa em modelos de projeto nesta entrega (fica para depois).
- Sem consolidado de vários projetos num relatório só.

## Anti-objetivos (falha mesmo que "funcione")

- Número do relatório divergir do painel sem explicação.
- Alerta ou farol aparecer só em cor, sem palavra e motivo.
- Campo novo obrigatório que trave o fluxo atual de criar/editar ação.

## Abordagens consideradas

1. **Macroetapa como entidade (escolhida pelo usuário).** Tabela própria, ordem e nome único
   por projeto; a ação aponta para ela. Custo: migration e um campo nos formulários.
2. Rótulo de texto livre na ação. Mais barato, mas grafias diferentes viram macroetapas
   diferentes, sem ordem nem unicidade (o mesmo problema de `responsavel`).
3. Preencher à mão por semana. Repete a falha da planilha: número que não bate com as ações.

## Decisões do usuário

- Macroetapa é entidade (`Macroetapa`: projeto, nome, ordem); `Acao.macroetapaId` opcional.
- Percentuais saem das ações da macroetapa, ponderados pelos dias úteis previstos; o total
  consolidado sai de todas as ações do projeto.
- Gantt macro: da primeira à última data prevista das ações da macroetapa.
- Ações sem macroetapa continuam válidas e caem em "Sem macroetapa".
- Farol por desvio em p.p. e riscos de impacto alto, limites num só lugar.
- **Sinal na lista de projetos**: coluna "Sinal" em `/projetos` e no painel, com a MESMA regra
  do farol do relatório (módulo único). Convive com o status atual (lado a lado), com o desvio
  visível para o sinal não parecer contradição.
- `Projeto.cliente` e `Projeto.objetivo`: texto simples.
- Alertas gerados pelo sistema.
- Pedido de ajuda = risco/bloqueio marcado como "precisa de decisão da diretoria".

## Desenho

### Dados (migration aditiva, nunca editar migration aplicada)

- `Macroetapa { id, projetoId, nome, ordem, createdAt, updatedAt }`, `@@unique([projetoId, nome])`
  (comparado por `chaveDoNome`, como o resto), `@@index([projetoId])`.
- `Acao.macroetapaId String?` com `onDelete: SetNull`.
- `Projeto.cliente String?`, `Projeto.objetivo String?`.
- `RiscoProjeto.pedeAjuda Boolean @default(false)`.
- Mudar a macroetapa de uma ação grava `HistoricoAlteracao` (campo `macroetapa`, com o NOME),
  regra central do sistema.

### Regra pura (`src/lib/flash-report.ts`, sem Prisma nem Next, com `.test.ts`)

- **Semana do projeto**: da semana CTCEA da menor data prevista à da maior; "S{n}/{total}" é a
  posição da semana escolhida nessa janela. Projeto sem datas previstas: o relatório avisa.
- **Peso da ação**: dias úteis do previsto (`duracaoDiasUteis`); ação sem datas pesa 0 e fica de
  fora das médias (e é contada num aviso).
- **Realizado da ação**: 0, 25, 50, 75 ou 100 % pelo `StatusAcao`.
- **Previsto da ação numa data**: fração dos dias úteis do previsto já decorrida (0 antes do
  início, 100 depois do término).
- **Macroetapa/total**: média ponderada pelo peso. Desvio = realizado − previsto, em p.p.
- **Curva**: um ponto por semana da janela. O previsto acumulado sai da fórmula acima ao
  fim da semana. O realizado acumulado das semanas passadas sai de `foto-em-data.ts`
  (reconstrução pelo histórico); da semana corrente, do estado atual; semanas futuras não têm
  ponto de realizado.
- **Sinal/farol** (`src/lib/farol-projeto.ts`, puro, com teste; fonte ÚNICA para a lista, o
  painel e o relatório). Entra: ações, risco ALTO aberto vencido, hoje. Sai: estado, desvio em
  p.p., motivo escrito. Limites em um só lugar (valores propostos por mim, ajustáveis):
  - **Atrasado** (vermelho): desvio ≤ −10 p.p.
  - **Atenção** (amarelo): entre −10 e −3 p.p.
  - **Em dia** (verde): de −3 a +3 p.p.
  - **Adiantado** (verde com seta para cima): > +3 p.p. Verde, não azul: o azul é do Previsto.
  - **Sem dados** (cinza): sem ações com datas.
  Risco ALTO aberto com prazo vencido sobe um nível (nunca passa de Atrasado). Sempre com
  palavra, ícone e motivo: a identidade nunca fica só na cor. Token `atencao` para o amarelo.
  O relatório usa a mesma função na semana corrente; em semanas passadas, com o estado
  reconstruído pelo histórico.
- **Macroetapa no Gantt**: célula "realizado" (azul sólido) onde há avanço, "atenção"
  (laranja) onde a macroetapa está atrasada, "planejado" (cinza) no resto do previsto, como
  na imagem.
- **Atividades realizadas / próximas**: concluídas na semana escolhida e com previsto na
  semana seguinte, via `classificarAcao` (mesma regra do resumo e da Reunião). Até 4 por bloco
  + "e mais N".
- **Alertas** (gerados, em ordem): macroetapa com desvio ≤ −10 p.p.; ações atrasadas (N e a
  mais antiga); riscos abertos com prazo vencido; ações bloqueadas por dependência.
- **Pedido de ajuda**: riscos abertos com `pedeAjuda`, com risco, plano (como "ação"),
  responsável e prazo, ordenados por `ordenarPorAtencao`.

### Coluna "Sinal" na lista de projetos

- Em `/projetos` e no painel consolidado: bolinha + palavra + desvio ("Atenção · −4 p.p."),
  ao lado do status existente, que NÃO muda (status = existe ação vencida; sinal = ritmo do
  projeto inteiro; um projeto pode ser "Atrasado" no status e "Em dia" no sinal). O texto
  "Como ler" da coluna explica a diferença.
- Filtro por sinal (`?sinal=`) e ordenação por pior sinal; busca e paginação como hoje.
- Sem custo de consulta: as ações já são carregadas para o status; o cálculo é em memória
  (`montarLinhas` ganha o sinal, para painel e lista não somarem diferente).
- O Excel de projetos ganha a coluna (texto do estado + desvio como número).
- Em celular a coluna vira rótulo no cartão (`TabelaEmpilhavel`), e o PDF imprime a palavra.
- Fora desta entrega: sinal nos Dashboards (aba Gestão já tem o semáforo por equipe).

### Tela do relatório

Servidor renderiza tudo (SVG/CSS, sem biblioteca de gráfico). Cabeçalho com `SeloSemana`
(identidade da semana CTCEA). Curva em SVG com um só eixo, previsto tracejado e realizado
sólido, legenda e tabela dos números (regras de gráfico do CLAUDE.md). Impacto e farol com
texto. Abaixo de 768 px os blocos empilham, sem rolagem lateral. `tema-workspace` não se aplica:
fica no estilo "Painel Operacional".

### Formulários

- Tela do projeto: gerenciar macroetapas (criar, renomear, reordenar, excluir; excluir só
  desvincula as ações) e editar cliente/objetivo. Leitor não grava (`contaPodeEditar`).
- Formulário de ação: select "Macroetapa". Campo ausente não mexe; vazio remove.
- Formulário de risco: caixa "Precisa de decisão da diretoria".
- Server Actions novas: `contaPodeEditar` logo após `auth()`; erros por `registrarFalha`.

### Manual e CLAUDE.md

Entram no mesmo PR: seção no manual (`desde` = data da entrega, rota em `rotas`), entrada
nas "Novidades", e uma seção no CLAUDE.md com as regras acima.

## Pontos a decidir/ cuidado (minhas chamadas, marcadas)

- **Duas medidas de progresso.** `percentualConcluido` do painel conta ações concluídas;
  o Flash Report usa avanço ponderado. Chamada minha: no relatório o rótulo é "Avanço
  físico", e o texto "Como ler" explica a diferença. O painel não muda.
- Ação com status EM_CURSO conta 25/50/75 % (mesma estimativa do Gantt).
- Ação sem macroetapa: grupo "Sem macroetapa" só aparece se houver alguma.
- Máximo de 12 macroetapas por projeto, para caber na folha.

## Fica a cargo de quem constrói

Layout fino dos blocos, textos de aviso, ordem dos testes, nomes internos dos componentes,
paginação do PDF.

## Etapas sugeridas (para o plano)

1. Schema + migration + histórico de `macroetapa` + testes de integração.
2. Cadastro de macroetapas e campos cliente/objetivo/pedeAjuda nos formulários.
3. `avanco-fisico.ts` + `farol-projeto.ts` + `flash-report.ts` (regras puras, TDD): avanço
   ponderado, sinal, curva, alertas.
4. Coluna "Sinal" em `/projetos` e no painel (filtro, ordenação, Excel).
5. Tela do Flash Report + impressão.
6. Manual, CLAUDE.md, teste de navegador (celular e tablet).

A etapa 4 entrega valor sozinha e vem antes da tela do relatório de propósito.

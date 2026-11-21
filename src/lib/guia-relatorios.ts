/**
 * Guia dos relatórios dos Dashboards: para cada relatório do catálogo, o que
 * mostra, como ler, de onde vem o número e quando se preocupar.
 *
 * É a fonte do "Guia dos relatórios" do manual E do "Como ler este relatório"
 * que aparece embaixo do título de cada relatório na tela. REGRA: relatório novo
 * no catálogo (`dashboard-catalogo.ts`) exige entrada aqui no mesmo PR —
 * `guia-relatorios.test.ts` falha se faltar (ou sobrar) uma.
 */

export type GuiaRelatorio = {
  /** O que o relatório mostra, em uma frase. */
  mostra: string
  /** Como ler: o que cada número, cor, eixo ou coluna significa. */
  comoLer: readonly string[]
  /** De onde vem o número: a regra do cálculo. */
  deOndeVem: string
  /** O sinal de alerta: quando olhar com cuidado. */
  alerta: string
}

export const GUIA_RELATORIOS: Record<string, GuiaRelatorio> = {
  // ───────────── Gestão ─────────────
  'semaforo-equipes': {
    mostra: 'Um cartão por equipe, com a cor do semáforo e o motivo dela.',
    comoLer: [
      'A palavra ao lado do nome da equipe diz o estado: Crítica (vermelho), Atenção (amarelo) ou Em dia (verde). A cor nunca vem sozinha.',
      'O medidor mostra a proporção de ações abertas atrasadas, com os limites de 5% e 20% marcados.',
      '"No prazo" é a aderência (das ações concluídas, quantas terminaram dentro do previsto). "Riscos" são os riscos e bloqueios abertos, com quantos têm impacto alto. "Replan. 30d" são as mudanças de data prevista dos últimos 30 dias.',
      'Abaixo, em frases, está o motivo da cor.',
    ],
    deOndeVem:
      'Atrasada segue a regra do painel (término previsto já passou e a ação não foi concluída). O atraso é medido sobre as ações ABERTAS, para concluir trabalho não esconder o problema. Crítica: mais de 20% das abertas atrasadas, ou risco de impacto alto com prazo vencido. Atenção: de 5% a 20%, ou risco de impacto alto aberto. Em dia: abaixo disso.',
    alerta: 'Equipe Crítica, ou Atenção que continua assim semana após semana. Veja os motivos escritos no cartão e abra a equipe na tela Reunião.',
  },
  'mapa-calor-status': {
    mostra: 'Quantos projetos de cada equipe estão em cada status.',
    comoLer: [
      'Cada linha é uma equipe; cada coluna, um status (Sem ações, Concluído, Em andamento, Não iniciado, Atrasado). O número é a quantidade de projetos.',
      'Quanto mais escura a célula, maior a quantidade. A coluna Atrasado usa a cor de atraso.',
      'O "·" é zero. A última coluna soma a linha.',
    ],
    deOndeVem:
      'O status do projeto é calculado a partir das ações dele (não é um campo digitado): Atrasado tem precedência quando há ação atrasada. Projetos sem equipe preenchida ficam em "Sem equipe".',
    alerta: 'Uma coluna Atrasado escura, ou uma equipe com muitos projetos "Não iniciado" no meio do ano.',
  },
  'prioridade-x-atraso': {
    mostra: 'A matriz Benefício × Esforço com o atraso por cima: quais projetos importantes estão atrasados.',
    comoLer: [
      'Cada bolha é um projeto avaliado na matriz de priorização. A posição é a da matriz: esforço na horizontal, benefício na vertical, com os quatro quadrantes ao fundo.',
      'O tamanho e a cor da bolha dizem o atraso: bolha cheia na cor de atraso, quanto maior, mais ações atrasadas; bolha vazada, em dia.',
      'Contorno grosso marca o projeto de alto benefício (Quick Wins ou Estratégicos) que tem ação atrasada: o atraso que mais custa.',
      'O número dentro da bolha liga ao quadro abaixo, que lista projeto, equipe, quadrante, benefício, esforço e atrasadas.',
    ],
    deOndeVem:
      'Benefício e esforço são calculados na hora, com as notas da avaliação e os pesos vigentes da matriz de priorização. Só entram projetos avaliados. As atrasadas seguem a regra do painel.',
    alerta: 'Bolhas com contorno grosso: são os projetos que mais valem a conversa. Projeto sem avaliação não aparece: avalie em Priorização.',
  },
  'riscos-por-equipe': {
    mostra: 'Onde estão os riscos e bloqueios abertos, com qual impacto.',
    comoLer: [
      'Cada barra é uma equipe. As fatias são o impacto (alto, médio, baixo), do mais escuro (alto) ao mais claro, todas na mesma escala.',
      'Ao lado do total aparecem quantos são bloqueios (já travam o trabalho) e quantos estão com o prazo para tratar vencido.',
    ],
    deOndeVem: 'Os riscos e bloqueios registrados nos projetos, só os abertos (abertos ou em tratamento). Resolvidos e ocorridos não entram.',
    alerta: 'Impacto alto com prazo vencido, e equipes com muitos bloqueios.',
  },
  'ritmo-de-entrega': {
    mostra: 'Quantas ações a equipe conclui por semana contra quantas cria.',
    comoLer: [
      'As barras verdes são as ações concluídas em cada semana, nas últimas 12 (a corrente inclusive). A linha são as ações criadas. A linha tracejada é a média das concluídas nas últimas 4 semanas.',
      'A frase no alto resume: se concluiu mais do que criou, a carteira encolheu; se criou mais, cresceu.',
    ],
    deOndeVem:
      'Concluídas: pela data de término REALIZADO. Criadas: pela data em que a ação foi cadastrada. A semana vai de domingo a sábado, como a semana da CTCEA.',
    alerta: 'A linha de criadas acima das barras por várias semanas seguidas: a carteira só cresce.',
  },

  // ───────────── Panorama ─────────────
  panorama: {
    mostra: 'Os quatro números que resumem a carteira inteira.',
    comoLer: [
      'Projetos ativos: quantos projetos existem (os excluídos não contam), com quantos já estão concluídos.',
      'Ações: o total, com quantas estão concluídas.',
      'Progresso geral: ações concluídas sobre o total de ações.',
      'Projetos com atraso: quantos têm ao menos uma ação atrasada, e quantas ações atrasadas são ao todo.',
    ],
    deOndeVem: 'As mesmas funções do painel consolidado, então os números aqui e no painel sempre batem. Seguem os filtros e o período da tela.',
    alerta: 'Projetos com atraso crescendo de um mês para o outro, ou progresso geral parado.',
  },
  'composicao-status': {
    mostra: 'A divisão dos projetos entre os status possíveis.',
    comoLer: [
      'Uma barra única dividida em fatias: Sem ações, Concluído, Em andamento, Não iniciado e Atrasado, sempre nessa ordem. Cada fatia traz o número e o percentual.',
      'A ordem das fatias é fixa de propósito, para as cores vizinhas se distinguirem bem, inclusive para quem não enxerga verde e laranja.',
    ],
    deOndeVem: 'O status é calculado a partir das ações do projeto; Atrasado tem precedência. Conta projetos, não ações.',
    alerta: 'A fatia de Atrasado grande, ou muitos projetos "Sem ações" (cadastrados e sem plano).',
  },

  // ───────────── Distribuição ─────────────
  'por-equipe': {
    mostra: 'Quanto trabalho e quanto atraso cada equipe tem.',
    comoLer: [
      'Volume de ações: a barra mostra o tamanho da equipe em ações, na mesma escala das outras linhas.',
      'Projetos, Concluídas e Em atraso são contagens; Progresso é o percentual de ações concluídas.',
      'Clique no nome da equipe para abrir o painel já filtrado por ela.',
    ],
    deOndeVem: 'Projetos agrupados pela equipe cadastrada, com os mesmos cálculos do painel. Projetos sem equipe ficam no grupo "Não informado", sempre no fim da lista.',
    alerta: 'Uma equipe com muito volume e muito atraso, ou o grupo "Não informado" grande: cadastro incompleto distorce a leitura.',
  },
  'por-responsavel': {
    mostra: 'Como a carga está distribuída entre as pessoas responsáveis pelos projetos.',
    comoLer: ['As mesmas colunas de Por equipe, agora por responsável do projeto. Clique no nome para filtrar o painel.'],
    deOndeVem: 'O responsável do projeto (a pessoa escolhida como líder). Projetos sem responsável ficam em "Não informado".',
    alerta: 'Uma pessoa concentrando muitos projetos e atrasos: risco de gargalo.',
  },
  'por-natureza': {
    mostra: 'O esforço dividido entre desenvolvimento, infraestrutura e iniciativa (ou outras naturezas cadastradas).',
    comoLer: ['As mesmas colunas de Por equipe, agora por natureza do projeto.'],
    deOndeVem: 'O campo Natureza do projeto, como foi digitado. Projetos sem natureza ficam em "Não informado".',
    alerta: 'Uma natureza muito dominante, ou muitos projetos sem natureza.',
  },
  'por-categoria': {
    mostra: 'Como os projetos se distribuem entre as categorias do plano de ação.',
    comoLer: ['As mesmas colunas de Por equipe, agora por categoria. Clique no nome para filtrar o painel.'],
    deOndeVem: 'O campo Categoria do projeto. Projetos sem categoria ficam em "Não informado".',
    alerta: 'Categorias com atraso concentrado, ou variações da mesma categoria escritas de jeitos diferentes.',
  },
  'por-prioridade': {
    mostra: 'Se o atraso está concentrado nos projetos de maior prioridade.',
    comoLer: ['As mesmas colunas de Por equipe, agora por número de prioridade do projeto.'],
    deOndeVem: 'O campo Prioridade do projeto (uma decisão humana, não a recomendação da matriz). Projetos sem prioridade ficam em "Não informado".',
    alerta: 'Atraso e baixo progresso nas prioridades mais altas.',
  },

  // ───────────── Prazos ─────────────
  'aderencia-prazo': {
    mostra: 'Das ações já concluídas, quantas terminaram dentro do previsto.',
    comoLer: [
      '"Entregues no prazo" é o percentual sobre as ações avaliáveis. Os demais cartões mostram quantas entraram no prazo, quantas atrasaram e o atraso médio, em dias úteis, só entre as que atrasaram.',
    ],
    deOndeVem:
      'Só entram ações concluídas com data prevista E realizada de término. Sem as duas pontas não há como medir, e essas ações ficam de fora (a tela conta quantas).',
    alerta: 'Aderência baixa, ou atraso médio alto nas entregas que estouraram.',
  },
  'ranking-atrasos': {
    mostra: 'As ações que estão paradas há mais tempo depois do prazo.',
    comoLer: [
      'A lista vai da ação mais atrasada para a menos. As colunas dizem a ação, o projeto, o responsável, o término previsto e o atraso em dias úteis.',
      'Cada linha leva ao projeto.',
    ],
    deOndeVem: 'Ações atrasadas (término previsto já passou e não concluídas). O atraso é contado em dias úteis, sem fins de semana nem feriados nacionais fixos.',
    alerta: 'Ações com atraso de meses: ou ninguém atualizou o status, ou o trabalho parou de fato.',
  },
  'idade-do-atraso': {
    mostra: 'Se o atraso é recente ou antigo, por equipe.',
    comoLer: [
      'Cada barra é uma equipe, dividida em faixas de dias de atraso: até 7, de 8 a 30, de 31 a 90 e mais de 90. Quanto mais escura a fatia, mais antigo o atraso.',
    ],
    deOndeVem: 'Ações atrasadas, com o atraso em dias corridos desde o término previsto.',
    alerta: 'Fatia escura grande: atraso antigo costuma ser ação esquecida ou plano que mudou sem ser atualizado.',
  },
  'proximos-vencimentos': {
    mostra: 'O que vence nos próximos 7, 15 e 30 dias.',
    comoLer: ['Três cartões, um por janela, com a quantidade de ações a vencer. As janelas são cumulativas: os 30 dias incluem os 15 e os 7.'],
    deOndeVem: 'Ações abertas (não concluídas) com término previsto de hoje até o fim da janela.',
    alerta: 'Muita coisa vencendo na próxima semana, principalmente em ações que ainda não começaram.',
  },

  // ───────────── Evolução no tempo ─────────────
  'evolucao-mensal': {
    mostra: 'Se o ritmo de entrega acompanha o que foi planejado.',
    comoLer: [
      'Duas curvas acumuladas, mês a mês: Previsto (azul) e Realizado (verde), na mesma escala. As ações acumuladas são contagens.',
      'A curva Realizado para no mês corrente: estender sobre meses futuros mostraria uma queda de ritmo que não aconteceu.',
      'Realizado abaixo de Previsto significa entrega atrás do plano.',
    ],
    deOndeVem: 'Previsto: ações pelo mês do término previsto. Realizado: ações concluídas, pelo mês do término realizado.',
    alerta: 'Uma distância crescente entre as duas curvas.',
  },
  'carga-mensal': {
    mostra: 'Em que meses se concentram os inícios e os términos previstos.',
    comoLer: ['Duas faixas de barras, uma para os inícios e outra para os términos, com a MESMA escala vertical, então a altura se compara de verdade entre as duas.'],
    deOndeVem: 'Ações pelo mês do início previsto e do término previsto.',
    alerta: 'Meses com picos de términos: é onde o risco de atraso se acumula.',
  },

  // ───────────── Qualidade ─────────────
  'higiene-dados': {
    mostra: 'Os registros incompletos ou inconsistentes que distorcem os números.',
    comoLer: [
      'Cada linha é um tipo de pendência (projeto sem ação, sem responsável ou sem equipe; ação sem data prevista; datas invertidas; concluída sem data realizada; realizada mas não concluída), com a quantidade e o efeito nos números.',
      'Zero é boa notícia e aparece sem a cor de alerta.',
    ],
    deOndeVem: 'Conferência dos projetos e das ações dentro do recorte atual.',
    alerta: 'Qualquer número acima de zero: cada pendência esconde ou distorce algo (ação sem data prevista nunca aparece como atrasada, por exemplo).',
  },

  // ───────────── Card WIN ─────────────
  'wins-conclusao': {
    mostra: 'Dos WINs comprometidos em cada semana, quantos foram concluídos.',
    comoLer: [
      'Uma barra por semana, empilhada na ordem Concluído (verde), Promovido (verde hachurado), Em andamento (azul), Pendente (cinza) e Não feito (laranja). A taxa é a dos concluídos.',
      'A semana em curso aparece com contorno tracejado. Quando não há taxa, a tela diz por quê: semana sem WINs, ou todos promovidos.',
    ],
    deOndeVem:
      'A taxa é feitos sobre os WINs da semana, SEM contar os promovidos ao plano de ação: promover não é concluir nem falhar, o trabalho só mudou de lugar. Não segue os filtros da carteira, só o período.',
    alerta: 'Taxa baixa por várias semanas, ou muitos pendentes que nunca andam.',
  },
  'wins-reincidentes': {
    mostra: 'Os WINs que ficam voltando semana após semana.',
    comoLer: [
      'A tabela traz o WIN, a pessoa, o período, o número de aparições e a situação. A borda do WIN fica na cor de atraso quando ele deve ser promovido (chegou à terceira aparição) e verde quando já foi promovido; o WIN promovido leva ao projeto.',
    ],
    deOndeVem: 'WINs que aparecem em 2 semanas ou mais (a contagem soma as aparições, não exige semanas seguidas). Não segue os filtros da carteira, só o período.',
    alerta: 'WINs que já deveriam ter virado ação no plano e continuam no card.',
  },

  // ───────────── Auditoria ─────────────
  replanejamentos: {
    mostra: 'Quais ações tiveram a data prevista empurrada, e quantas vezes.',
    comoLer: [
      'Os cartões somam as alterações registradas (das últimas 500), os replanejamentos e quantas pessoas alteraram.',
      'A tabela lista as ações mais remexidas, com o número de vezes e a última mudança (data de antes e de depois).',
    ],
    deOndeVem: 'O histórico de alterações das ações, nas datas previstas de início e término. Não segue os filtros da carteira, só o período.',
    alerta: 'Ação replanejada várias vezes e sem atraso aberto: não aparece em nenhum outro relatório, e é a que merece uma conversa.',
  },
  'replanejamentos-por-motivo': {
    mostra: 'Por que as datas previstas mudam.',
    comoLer: [
      'Uma barra por motivo (escopo mudou, dependência externa, falta de pessoas ou recursos, prioridade mudou, estimativa errada, outro), com a quantidade.',
      '"Sem motivo registrado" são as mudanças de antes de o sistema perguntar o motivo.',
    ],
    deOndeVem: 'O motivo informado ao mudar uma data prevista que já existia. Cada mudança conta uma vez, mesmo que início e término tenham mudado juntos. Mostra categorias, nunca pessoas.',
    alerta: '"Estimativa errada" ou "Falta de pessoas" dominando: o problema está no planejamento ou na capacidade, não nas pessoas.',
  },
  'motivos-por-equipe': {
    mostra: 'Cada equipe replaneja por qual motivo.',
    comoLer: ['Cada linha é um motivo e cada coluna uma equipe. O número é a quantidade de mudanças de data; a célula é tingida pela quantidade.'],
    deOndeVem: 'O mesmo registro de motivos do relatório anterior, cruzado com a equipe do projeto. Conta eventos.',
    alerta: 'Uma equipe em que um motivo se repete: é o padrão a tratar.',
  },
  'alteracoes-recentes': {
    mostra: 'O que mudou por último, em que campo e por quem.',
    comoLer: [
      'No alto, a contagem de alterações por campo (status, datas, responsável...). Abaixo, as 15 mais recentes: o campo, a ação, o valor de antes e o de depois, quem alterou e quando.',
    ],
    deOndeVem: 'A trilha de auditoria: toda mudança de status, data ou responsável de uma ação é gravada. Não segue os filtros da carteira, só o período.',
    alerta: 'Mudanças inesperadas ou alterações em massa fora de hora.',
  },
}

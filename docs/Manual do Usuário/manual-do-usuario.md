# Manual do Usuário — Sistema Cronograma CTCEA

> Este arquivo é **gerado** a partir do manual que está dentro do sistema (`/manual`). Não edite aqui: altere `src/lib/manual-conteudo.ts` e rode `npm run gerar:manual`.

## Índice

- **Começando**
  - Primeiro acesso e cadastro
  - Perfis: Administrador, Colaborador e Leitor
  - Menu, ajuda e notificações
- **Projetos e ações**
  - Painel consolidado
  - Lista de projetos
  - Projeto: cronograma (Gantt) e foto em uma data
  - Flash Report do projeto
  - Macroetapas do projeto
  - Macroetapas no modelo DMAIC
  - Sinal do projeto (coluna, filtro e ordem)
  - Cliente, objetivo e pedido de decisão da diretoria
  - Criar, editar e excluir projeto
  - Ações: criar, editar e registrar o realizado
  - Links e anexos da ação
  - Comentários e avisos
  - Dependência entre ações e liberação de início
  - Riscos e bloqueios do projeto
  - Duplicar ação
  - Edição em lote
  - Modelos de projeto
- **Meu trabalho**
  - Meus projetos
  - Minhas ações
- **Card WIN**
  - Card WIN semanal
  - Equipe: cards da semana
- **Análise**
  - Dashboards
  - Reunião (modo de projeção)
  - Matriz de priorização
- **Administração**
  - Colaboradores
  - Área de Administração
  - Resumo semanal
  - Lixeira de projetos
  - Erros e painel do sistema
- **Guia dos relatórios dos Dashboards**
- **Glossário**

## Começando

### Primeiro acesso e cadastro

Como entrar no sistema e se cadastrar como colaborador.

**Quem pode usar:** Todos os perfis. **Desde:** 19/11/2026.

**Como fazer**

1. Abra o endereço do sistema (ou o link de um projeto que recebeu) e clique em "Entrar". Se ainda não tem conta, use "Criar conta" com o seu e-mail @ctcea.org.br.
2. Na primeira vez, a tela "Bem-vindo ao sistema" pede para você dizer quem é. Se o seu nome já está na lista (veio das planilhas), escolha-o. Se não, cadastre o seu nome.
3. Concluído o cadastro, você segue direto para a tela que tentou abrir.

**Dicas e regras**

- Só e-mails @ctcea.org.br e verificados entram. Outro domínio vê a tela "Acesso negado".
- Escreva o nome como ele aparece nos projetos, com os acentos. Duas grafias viram duas pessoas nos relatórios.
- Sem cadastro de colaborador você não pode ser responsável por ações nem recebe avisos.

### Perfis: Administrador, Colaborador e Leitor

O que cada perfil pode fazer.

**Quem pode usar:** Todos os perfis. **Desde:** 18/11/2026.

**Como fazer**

1. Colaborador (o padrão): cria e edita projetos, ações, comentários e o próprio Card WIN.
2. Leitor: só consulta e exporta. Os botões de gravar são trocados por um aviso de somente leitura.
3. Administrador: faz tudo o que o colaborador faz e ainda exclui projetos, edita os pesos da priorização, gerencia colaboradores e vê o painel do sistema. Só ele vê o item "Administração" no menu.
4. Quem muda o perfil de alguém é um administrador, em Administração > Colaboradores.

**Dicas e regras**

- O sistema sempre precisa de pelo menos um administrador ativo.
- Se você não consegue gravar algo que deveria, confira com a sua liderança qual é o seu perfil.

### Menu, ajuda e notificações

Como se orientar: o menu em grupos, o sino, a ajuda (manual, tour e tema) e a conta.

**Quem pode usar:** Todos os perfis. **Desde:** 19/11/2026.

**Como fazer**

1. O menu no topo tem o Painel e três grupos: Trabalho (Projetos, Priorização e Modelos), Pessoas (Meus projetos, Minhas ações, Card WIN e Equipe) e Análise (Dashboards e Reunião). Clique no nome do grupo para abrir a lista e escolha a tela. O grupo da tela em que você está fica destacado. Quem administra o sistema vê também o grupo "Administração", com as ferramentas de administrador.
2. No celular e no tablet em pé, o menu vira o botão "Menu", no alto: toque nele para abrir as telas, já separadas por grupo, e escolha uma.
3. O botão de sol ou lua, ao lado do sino, alterna entre o tema claro e o escuro com um clique. O ícone de interrogação abre "Ajuda e preferências": o Manual (esta página), "Fazer o tour" (um passeio de 1 minuto sobre onde fica cada coisa) e a escolha do tema. O avatar, mais à direita, é a sua conta (perfil e sair).
4. O sino mostra quantas notificações você não leu. Clique para ver os avisos de comentários e de liberações de início, e use "Marcar como lida" ou "Marcar todas como lidas".
5. Em "Ajuda e preferências", escolha o tema: Sistema (padrão), Claro ou Escuro. A escolha fica guardada neste navegador.

**Dicas e regras**

- Os avisos ficam só dentro do sistema. Avisos lidos há mais de 30 dias são apagados.
- Quem não tem cadastro de colaborador não recebe notificações.

## Projetos e ações

### Painel consolidado

A visão de todos os projetos: indicadores, atrasos e a lista com filtros.

**Quem pode usar:** Todos os perfis. **Desde:** 27/11/2026.

**Como fazer**

1. Os indicadores no topo somam a carteira inteira: projetos, ações, concluídas e atrasadas.
2. Use os filtros (equipe, categoria, responsável, status, período) e o campo "Buscar" para reduzir a lista. Os indicadores acompanham o filtro.
3. A coluna "Prioridade", logo depois do nome do projeto, mostra o número definido no cadastro (1 é a mais alta) e a lista vem em ordem crescente de prioridade (1, 2, 3…), com o nome desempatando. Projetos sem prioridade mostram "-" e ficam por último. "Pior sinal primeiro", em "Ordem", troca essa ordem pela do sinal.
4. Clique em um projeto para abrir o cronograma dele. A lista tem 25 projetos por página; "Ver todos" mostra tudo.
5. Para levar a uma reunião, use "Exportar": Excel (projetos, todas as ações ou só as atrasadas) ou a impressão do navegador, que gera PDF.

**Dicas e regras**

- Uma ação está atrasada quando o término previsto já passou e ela não foi concluída.
- Mudar um filtro volta à primeira página. Para o PDF da carteira inteira, clique em "Ver todos" antes de imprimir.

### Lista de projetos

Todos os projetos ativos, com progresso e status.

**Quem pode usar:** Todos os perfis. **Desde:** 17/09/2026.

**Como fazer**

1. Abra "Projetos" no menu. Cada linha mostra a barra de progresso e o status do projeto.
2. Filtre e busque como no painel. Clique no nome para abrir o projeto.
3. Para criar, use "Novo projeto" (ou "Modelos", se já existe um molde parecido).

### Projeto: cronograma (Gantt) e foto em uma data

O cronograma do projeto, ação por ação, com previsto e realizado.

**Quem pode usar:** Todos os perfis. **Desde:** 17/09/2026.

**Como fazer**

1. No cabeçalho, veja o percentual concluído e o status do projeto (calculados sobre todas as ações).
2. No Gantt, a barra de contorno é o Previsto e a barra cheia, mais fina, é o Realizado desenhado POR CIMA dele: dá para ver de relance se o realizado saiu do previsto. A linha vertical com a etiqueta "Hoje" marca o dia de hoje. As barras são posicionadas pelo dia, não só pela semana. No cabeçalho, cada coluna traz o número da semana do calendário da CTCEA ("S47") e o dia da segunda-feira; a semana de hoje fica em destaque. Ação em curso (25, 50 ou 75%) que ainda não tem data realizada mostra, dentro do Previsto, uma barra listrada com esse percentual: é uma ESTIMATIVA, não uma medida exata, e some assim que você aponta uma data realizada. No campo "Exibir por" escolha Mês, Trimestre, Semestre ou Ano: o gráfico mostra um período por vez, com as setas e o botão "Hoje" para navegar. Ao trocar, o gráfico reabre no período que contém o ponto em que você estava. Semestre e Ano são colunas semanais mais numerosas: o gráfico rola de lado dentro do quadro.
3. As setas ligam as dependências: saem do fim da ação que precisa terminar e chegam ao início da que depende dela (em laranja quando a dependente está bloqueada). O losango marca o prazo de um risco ou bloqueio ABERTO ligado à ação (cheio e laranja quando o prazo venceu; maior quando o impacto é alto); passe o mouse para ler o título. Setas e losangos só aparecem quando as duas pontas estão na janela e nas ações mostradas.
4. Clique na descrição de uma ação para editá-la. Use "Buscar" para achar por descrição, responsável ou número; são 40 ações por página.
5. "Foto em uma data" mostra o projeto como estava no fim de um dia passado, reconstruído do histórico. Escolha a data no seletor; é somente leitura.
6. Ações com dependência mostram o selo "bloqueada por #N" enquanto a predecessora não termina.

**Dicas e regras**

- Cores: azul é o previsto, verde é o realizado, laranja é atraso.
- A foto de uma data anterior ao uso do sistema não é confiável, e a tela avisa.

### Flash Report do projeto

O relatório semanal do projeto, para a reunião com a diretoria.

**Quem pode usar:** Todos os perfis. **Desde:** 23/11/2026.

**Como fazer**

1. Na tela do projeto, clique em "Flash Report". Abre a semana de hoje. Para outra semana, use "Semana anterior" ou "Semana seguinte", no alto da página (a semana é a do calendário da CTCEA, de domingo a sábado, e vai na URL como ?semana=aaaa-ss, então o link pode ser guardado).
2. O cabeçalho traz o nome e a referência do projeto, o cliente e o objetivo (se preenchidos), o líder, a semana escolhida, a semana do projeto ("S03 / 12"), o farol (Atrasado, Atenção, Em dia, Adiantado ou Sem dados, com o motivo escrito) e o avanço físico previsto e realizado acumulados, com o desvio em pontos percentuais.
3. O cronograma macro mostra, por macroetapa, o previsto, o realizado e o desvio, e a faixa semana a semana; a última linha é o "Total consolidado". Na faixa, verde (Realizado) só aparece onde houve avanço até o fim da semana; a hachurada é Atenção (desvio de −3 p.p. ou pior naquela semana); o contorno vazio é "Decorrido, sem avanço" (ou semana sem foto do histórico); o tracejado azul é semana futura. Se faltarem semanas na tela, role a tabela de lado.
4. A curva compara o previsto acumulado (tracejado) com o realizado acumulado (contínuo, que para na semana escolhida). Os mesmos números aparecem na tabela logo abaixo do gráfico.
5. Os blocos de baixo listam as atividades realizadas na semana, as próximas atividades, os principais riscos e bloqueios, os alertas e pontos de atenção e o "Pedido de ajuda e decisões executivas necessárias".
6. Clique em "Imprimir / salvar em PDF" para sair em A4 paisagem (no navegador, escolha "Salvar como PDF"). Os controles de navegação não saem na impressão; o relatório se ajusta para caber em uma folha (com muito conteúdo, como muitos riscos e alertas, a letra encolhe até um limite e o resto vai para uma segunda folha; com muitas semanas, o cronograma ocupa a largura toda e a curva vai logo abaixo), as descrições das macroetapas saem escritas e o rodapé traz o projeto, a semana e a data de emissão. "Como ler este relatório", no rodapé, resume as regras.

**Dicas e regras**

- Avanço físico é a média, ponderada pelos dias úteis previstos de cada ação, do percentual de cada uma (não iniciada 0%, em curso 25, 50 ou 75%, concluída 100%). Por isso ele difere do "percentual concluído" do painel, que apenas conta quantas ações estão concluídas. Os dois estão certos: medem coisas diferentes.
- Uma data só: a semana de hoje é avaliada até hoje; uma semana passada é avaliada até o sábado dela. Semana futura não é avaliada além de hoje.
- Semanas passadas usam a foto reconstruída do histórico de alterações. Se a semana que você está vendo terminou antes de o sistema começar a registrar (por exemplo, um projeto vindo da planilha), um aviso no alto diz que o realizado dela não é confiável; nessa semana a curva mostra o previsto do plano e deixa o realizado em branco (—). A semana de hoje e as seguintes ao início do registro não têm esse aviso. Se a foto não tiver as ações identificadas, o aviso diz que os valores usam o estado atual.
- Numa semana passada, o avanço, o farol e o alerta de desvio das macroetapas são os daquela semana; os alertas de ações atrasadas e bloqueadas, os riscos e as próximas atividades mostram a situação de HOJE, e o aviso diz isso.
- Ação sem datas previstas pesa zero e fica fora das médias; um aviso diz quantas ficaram de fora. Sem ações com datas previstas não há avanço para calcular: o aviso pede para preencher início e término previstos. Sem macroetapas, o aviso pede para cadastrá-las.
- O relatório é só de consulta (todos os perfis abrem). Não é enviado por e-mail.

### Macroetapas do projeto

Agrupe as ações em etapas grandes para ver o avanço por etapa no Flash Report.

**Quem pode usar:** Colaborador e Administrador. **Desde:** 23/11/2026.

**Como fazer**

1. Na tela do projeto, role até "Macroetapas" (ou abra o link "Cadastrar macroetapas" no Flash Report). Digite o nome e clique em "Adicionar macroetapa". Cada projeto aceita até 12.
2. Para mudar o nome, clique em "Renomear", edite e clique em "Salvar". Para mudar a ordem, use "Subir" e "Descer": a ordem é a do Flash Report.
3. Na tela de uma ação (nova ou editada), escolha a etapa no campo "Macroetapa". O campo só aparece quando o projeto tem macroetapas.
4. "Excluir" remove só a macroetapa: as ações dela ficam no projeto, sem macroetapa, e passam a aparecer no grupo "Sem macroetapa" do Flash Report.

**Dicas e regras**

- A macroetapa é opcional. Ação sem macroetapa entra no total do projeto normalmente.
- Trocar a macroetapa de uma ação, renomear e excluir ficam no histórico (com o NOME da macroetapa, não um código).
- Duas pessoas criando macroetapas ao mesmo tempo não passam do limite: a segunda recebe um aviso.

### Macroetapas no modelo DMAIC

Use as cinco fases do DMAIC como macroetapas, cada uma com uma breve explicação, em projetos de melhoria de processo.

**Quem pode usar:** Colaborador e Administrador. **Desde:** 24/11/2026.

**Como fazer**

1. Na tela do projeto, em "Macroetapas", clique em "Usar modelo DMAIC". O sistema cria Definir, Medir, Analisar, Melhorar e Controlar, nessa ordem, cada uma com a sua explicação.
2. Se o projeto já tem algumas das fases, o botão vira "Completar com as fases do DMAIC" e cria só as que faltam, depois das macroetapas que já existem.
3. Cada macroetapa pode ter uma descrição (opcional): digite ao criar ou clique em "Renomear" para editar. Apague o texto e salve para remover.
4. No Flash Report, passe o mouse sobre o nome da macroetapa ou abra "O que é cada macroetapa", embaixo do cronograma macro, para ler a explicação.
5. Com as fases no projeto, o cabeçalho do relatório mostra a "Fase atual (DMAIC)": a primeira fase, na ordem D-M-A-I-C, que ainda não chegou a 100%.
6. Para já começar com ações em cada fase, crie o projeto a partir do modelo "Projeto de melhoria de processo (DMAIC)", em "Modelos". No editor de modelos, cada ação tem o campo "Macroetapa".

**Dicas e regras**

- O DMAIC é opcional. Projetos que não são de melhoria de processo, como um desenvolvimento de sistema, continuam com macroetapas de nome livre.
- O sistema reconhece as fases pelo nome ("D – Definir" etc.). Se você renomear uma fase para outro texto, ela deixa de contar como fase do DMAIC.
- Alerta "já tem avanço, mas ... ainda está em 0%": uma fase posterior já avançou enquanto uma anterior, com ações, não saiu do zero. Vale conferir se a solução não foi implantada sem a causa-raiz confirmada. Fase parcial e fase sem ações não disparam o alerta.
- O projeto aceita até 12 macroetapas. Se não couberem todas as fases que faltam, o sistema não cria nenhuma e explica quantas vagas há.

### Sinal do projeto (coluna, filtro e ordem)

Um farol por projeto, na lista e no painel, comparando o avanço realizado com o previsto.

**Quem pode usar:** Todos os perfis. **Desde:** 23/11/2026.

**Como fazer**

1. Em "Projetos" e no painel, a coluna "Sinal" mostra uma palavra por projeto: Atrasado, Atenção, Em dia, Adiantado ou Sem dados. A palavra vem sempre escrita; a cor só reforça.
2. O sinal usa o desvio de avanço físico, em pontos percentuais (p.p.): realizado menos previsto. De −10 p.p. para baixo (o −10 exato inclusive): Atrasado. De −10 (exclusive) até −3 p.p.: Atenção (o −3 exato ainda é Atenção). Entre −3 (exclusive) e +3 p.p.: Em dia (o +3 exato ainda é Em dia). Acima de +3 p.p.: Adiantado. Sem ações com datas previstas: Sem dados.
3. Se o projeto tem risco ou bloqueio de impacto ALTO aberto com prazo vencido, o sinal sobe um nível de gravidade (Em dia vira Atenção, por exemplo), e o motivo diz isso.
4. Para filtrar, escolha um valor em "Sinal" nos filtros. Para ver os piores primeiro, escolha "Pior sinal primeiro" em "Ordem". Esses filtros e essa ordem existem na lista "Projetos" e no painel. Os dois ficam na URL (?sinal= e ?ordem=sinal) e valem também na exportação para Excel, que ganha as colunas "Sinal" e "Desvio (p.p.)".

**Dicas e regras**

- O "Status" conta as ações que passaram do prazo; o "Sinal" compara o avanço com o plano. Um projeto pode estar com poucas ações atrasadas e mesmo assim em Atenção, ou o contrário.
- O mesmo cálculo alimenta o farol do Flash Report: lista e relatório nunca divergem.

### Cliente, objetivo e pedido de decisão da diretoria

Campos novos que alimentam o cabeçalho e o pedido de ajuda do Flash Report.

**Quem pode usar:** Colaborador e Administrador. **Desde:** 23/11/2026.

**Como fazer**

1. No formulário do projeto, preencha "Cliente" e "Objetivo" (opcionais). Eles aparecem no cabeçalho do Flash Report. O líder mostrado ali é o "Responsável (líder do projeto)".
2. No formulário de risco ou bloqueio, marque "Precisa de decisão da diretoria" quando o tratamento depende de uma decisão que a equipe não pode tomar sozinha. Na lista de riscos aparece o selo "Pede decisão da diretoria".
3. Os riscos abertos marcados assim entram no bloco "Pedido de ajuda e decisões executivas necessárias" do Flash Report. Ao resolver o risco, ele sai do bloco.

**Dicas e regras**

- A marcação de decisão não gera linha no histórico do risco.

### Criar, editar e excluir projeto

Cadastro do projeto e de sua classificação.

**Quem pode usar:** Colaborador e Administrador. **Desde:** 17/09/2026.

**Como fazer**

1. Em "Projetos", clique em "Novo projeto" e preencha nome, prioridade (obrigatória: um número inteiro a partir de 1, onde 1 é a mais alta), equipe, natureza, categoria, responsável e demais campos.
2. Para alterar, abra o projeto e clique em "Editar".
3. Só um administrador exclui, em "Excluir projeto" na tela do projeto. A exclusão é lógica: o projeto sai das telas, mas os dados são mantidos, e um administrador pode restaurá-lo em Administração > Lixeira.

**Dicas e regras**

- "Responsável (líder do projeto)" é uma lista dos colaboradores ativos: escolha o nome, sem digitar. É por ele que o sistema reconhece o líder, que decide as liberações de início, e monta "Meus projetos".
- Projetos antigos, com o nome digitado à mão, mostram o nome já escolhido na lista quando ele bate com o cadastro (sem acento nem maiúscula). Se não bater, aparece "(texto antigo, fora do cadastro)" e o texto é mantido até você escolher alguém.
- Se o líder for renomeado em Colaboradores, o nome nos projetos que ele lidera acompanha.

### Ações: criar, editar e registrar o realizado

O dia a dia de uma ação: datas, status, responsável e histórico.

**Quem pode usar:** Colaborador e Administrador. **Desde:** 17/09/2026.

**Como fazer**

1. No projeto, clique em "Nova ação". Informe descrição, datas previstas e, se quiser, o responsável.
2. Para editar, clique na ação no Gantt. Altere status, datas ou responsável e salve.
3. Para apontar o andamento, preencha as datas Realizado. O término realizado conclui a ação; só o início a tira de "não iniciado".
4. Em tela larga, a tela da ação tem duas colunas: o formulário à esquerda e, à direita, o contexto em abas: Histórico, Comentários, Links, Dependências (e Riscos, quando a ação tem algum aberto). O número ao lado do nome da aba diz quantos itens ela tem. No celular, o contexto vem abaixo do formulário. Use as setas do teclado para trocar de aba; o que você começou a escrever numa aba não se perde ao mudar de aba.
5. A aba "Histórico" mostra cada mudança de status, datas e responsável, com quem fez e quando.
6. Se você mudar o início ou o término PREVISTO de uma ação que já tinha data, aparece "Por que a data prevista mudou?": escolha o motivo (escopo, dependência externa, falta de pessoas ou recursos, prioridade, estimativa errada ou outro) e, se quiser, acrescente um detalhe. Sem o motivo, não salva. Em "Outro", o detalhe é obrigatório.

**Dicas e regras**

- Se outra pessoa salvar a ação antes de você, o sistema avisa o conflito em vez de sobrescrever; recarregue e refaça.
- A data realizada não pode estar no futuro, e o término não pode ser anterior ao início.
- Quando uma ação tem responsável com e-mail, ele recebe um aviso ao ser designado (só em produção).
- Ação de projeto excluído não pode ser editada.
- Preencher uma data que estava vazia não é replanejamento e não pede motivo. O motivo fica no histórico da ação, na tela Reunião e no relatório "Replanejamentos por motivo" dos Dashboards; mudanças de antes dessa regra aparecem como "Sem motivo registrado".

### Links e anexos da ação

Guardar, na ação, o endereço da ata, do contrato ou da planilha de apoio.

**Quem pode usar:** Colaborador e Administrador. **Desde:** 21/11/2026.

**Como fazer**

1. Na tela da ação, em "Links e anexos", preencha o título (por exemplo, "Ata do kickoff"), o endereço completo do documento (começando com https://) e o tipo: ata, contrato, planilha de apoio, documento ou outro. Clique em "Adicionar link".
2. Cada link aparece com o tipo, o título e o site de origem. Clique no título para abri-lo em outra aba.
3. Para corrigir, use "Editar" no link. Para tirar, use "Remover" e confirme: só o endereço sai da ação, o documento em si não é afetado.
4. Na lista de ações do projeto, um "· 2 links" ao lado do responsável mostra quantas ações têm links.

**Dicas e regras**

- O sistema guarda só o endereço, não o arquivo. O documento continua onde a CTCEA já o guarda (SharePoint, Drive...).
- Quem consegue abrir o documento é decidido lá, não aqui: se alguém clicar num link do SharePoint sem ter acesso, o próprio SharePoint nega. Compartilhe o documento com quem precisa.
- Só endereços http e https são aceitos. O endereço precisa estar completo, com https:// no começo.
- Adicionar, editar e remover links fica no histórico da ação, com quem fez e quando.
- O Leitor vê e abre os links, mas não adiciona nem remove.

### Comentários e avisos

Conversar dentro da ação e avisar quem precisa saber.

**Quem pode usar:** Colaborador e Administrador. **Desde:** 19/11/2026.

**Como fazer**

1. Na tela da ação, escreva em "Novo comentário" (até 2000 caracteres).
2. Em "Avisar no sistema", marque quem deve ser avisado. O responsável pela ação é avisado sempre.
3. Os avisos aparecem no sino de cada pessoa.
4. Você apaga os seus comentários; o administrador apaga qualquer um.

**Dicas e regras**

- Comentário não se edita: a conversa não pode ser reescrita depois.
- Comentários não entram nos relatórios nem na foto em uma data.

### Dependência entre ações e liberação de início

"B só começa quando A terminar", com exceção autorizada pelo líder.

**Quem pode usar:** Colaborador e Administrador. **Desde:** 20/11/2026.

**Como fazer**

1. Na tela da ação B, em "Dependências", escolha a ação A que precisa terminar antes e clique em "Adicionar".
2. Enquanto A não estiver concluída, B fica bloqueada: não dá para mudar o status nem apontar datas realizadas. O previsto continua livre.
3. Se precisa começar antes, preencha o motivo em "Pedir liberação ao líder". O líder do projeto é avisado no sino.
4. O líder (responsável do projeto) ou um administrador aprova ou recusa. Recusar exige uma justificativa. Se o próprio líder pede, a liberação sai na hora.
5. Aprovada, a ação fica "liberada pelo líder" e pode ser iniciada. Tudo fica no histórico da ação.
6. Para desfazer um vínculo, use "Remover dependência".

**Dicas e regras**

- Só vale entre ações do mesmo projeto, e o sistema recusa ciclos (A depende de B e B de A).
- A tela avisa quando a predecessora está atrasada ou termina depois do início previsto da ação.
- O líder é o "Responsável (líder do projeto)" escolhido na lista, na edição do projeto. Se o projeto ainda não tem líder definido, o pedido vai para os administradores.

### Riscos e bloqueios do projeto

Registrar o que ameaça (risco) ou já trava (bloqueio) um projeto, com responsável e prazo.

**Quem pode usar:** Colaborador e Administrador. **Desde:** 21/11/2026.

**Como fazer**

1. Na tela do projeto, desça até "Riscos e bloqueios" e clique em "Registrar risco ou bloqueio".
2. Escolha o tipo: Risco é o que pode acontecer; Bloqueio é o que já está travando o trabalho. Dê um título e, se quiser, a descrição.
3. Marque o impacto (baixo, médio ou alto), o responsável pelo tratamento (da lista de colaboradores), o prazo para tratar, a ação do projeto que ele afeta e o plano de ação.
4. Para atualizar, clique em "Editar" no registro e mude o status: Aberto, Em tratamento, Resolvido ou Aconteceu (para um risco que virou realidade). Registros resolvidos ou ocorridos ficam recolhidos na lista.
5. Cada mudança de tipo, impacto, status, responsável ou prazo fica no histórico do registro, com quem fez e quando.

**Dicas e regras**

- O responsável escolhido recebe um aviso no sino.
- Os abertos aparecem por ordem de atenção: impacto alto primeiro, bloqueio antes de risco, prazo mais próximo antes. Prazo vencido aparece em destaque.
- Na tela Reunião, há uma tela "Riscos e bloqueios abertos", por equipe. A ação afetada mostra os registros abertos dela na sua tela de edição.
- Resolver é mudar o status, não excluir: excluir apaga também o histórico. Só quem registrou, ou um administrador, exclui.
- O Leitor vê os registros, mas não cria nem edita.

### Duplicar ação

Criar uma ação parecida a partir de outra.

**Quem pode usar:** Colaborador e Administrador. **Desde:** 19/11/2026.

**Como fazer**

1. Na tela de edição da ação, clique em "Duplicar esta ação".
2. A cópia nasce no mesmo projeto, com "(cópia)" na descrição, o mesmo previsto e o mesmo responsável, mas sem andamento: "não iniciado" e sem realizado.
3. A cópia abre em seguida para você ajustar o que muda.

### Edição em lote

Remarcar datas ou trocar o responsável de várias ações de uma vez.

**Quem pode usar:** Colaborador e Administrador. **Desde:** 19/11/2026.

**Como fazer**

1. No projeto, clique em "Editar em lote".
2. Marque as ações (até 100). Informe quantos dias úteis adiar ou adiantar e/ou o novo responsável e clique em "Ver prévia".
3. A prévia mostra, ação por ação, o de/para e as observações, e não grava nada.
4. Se alguma data prevista vai mudar, a confirmação pede o motivo: é um só, e vale para todas as ações do lote.
5. Confira e confirme. O sistema grava exatamente o que foi mostrado, com uma linha de histórico por ação e por campo.

**Dicas e regras**

- O deslocamento é em dias úteis (pula fins de semana, feriados nacionais fixos e os móveis: Carnaval, Sexta-feira Santa e Corpus Christi); início e término andam juntos.
- Ação concluída ou sem data prevista não tem o previsto remarcado; a prévia diz o motivo.
- Se alguém salvou uma ação depois da prévia, ela é pulada e listada no resultado, nunca sobrescrita.
- Quem passa a ser responsável recebe um e-mail só, com a lista das ações.

### Modelos de projeto

Criar, editar e usar moldes de projeto (ciclos anuais, rotinas).

**Quem pode usar:** Colaborador e Administrador. **Desde:** 20/11/2026.

**Como fazer**

1. Para criar um modelo do zero, abra "Modelos" no menu e clique em "Novo modelo". Dê um nome único e, se quiser, a classificação (equipe, natureza, categoria, apoio, setor).
2. Monte a lista de ações: para cada uma, escreva a descrição, "Começa no dia" (em dias úteis a partir do início do projeto; 0 é o mesmo dia) e "Dura (dias)". Use "+ Adicionar ação" (o início da nova linha já sugere o dia seguinte ao término da anterior), ↑ e ↓ para reordenar e "Remover". Início e duração em branco deixam a ação sem datas.
3. Outro jeito de criar: abra um projeto bem montado e clique em "Salvar como modelo". As datas viram relativas ao início, sem pessoas nem andamento.
4. Para editar, clique em "Editar" no modelo, altere o que precisar e salve. A lista de ações é substituída pelo que está na tela. A edição vale para os projetos criados dali em diante; os que já existem não mudam.
5. Para excluir, clique em "Excluir" e confirme. Não há como recuperar.
6. Para usar, clique em "Usar este modelo", informe o nome do projeto e a data de início. O projeto e as ações nascem juntos, com as datas recalculadas em dias úteis. Use "Ver as ações" na lista para conferir o que o modelo contém antes.

**Dicas e regras**

- Só quem criou o modelo, ou um administrador, edita e exclui. Os cinco modelos iniciais do sistema (ciclo orçamentário, prestação de contas, desenvolvimento de sistema, onboarding e melhoria de processo DMAIC) são rascunhos: só administradores os editam ou excluem, e vale conferir as ações e durações antes de usar.
- Se outra pessoa salvar o modelo enquanto você edita, o sistema avisa e não grava; recarregue e refaça.
- Início em fim de semana ou feriado vale o próximo dia útil.
- O modelo não leva responsáveis, status nem dependências: ajuste depois no projeto, com a edição em lote se precisar.

## Meu trabalho

### Meus projetos

Só os projetos em que você tem papel.

**Quem pode usar:** Todos os perfis. **Desde:** 19/11/2026.

**Como fazer**

1. Abra "Meus projetos". Entram os projetos em que você é responsável, tem ações ou aparece como apoio; a etiqueta diz qual é o seu vínculo.
2. Os projetos com ação sua atrasada vêm primeiro.
3. Use os filtros "Os que eu respondo" e "Onde sou apoio" para separar.

**Dicas e regras**

- O Responsável do projeto é escolhido na lista de colaboradores, então vem com a grafia certa. O campo Apoio ainda é texto: o sistema compara o seu nome com ele sem diferenciar acento ou maiúscula, mas nome parcial não vale ("Ana Silva" não é "Ana Silva Costa"). Se um projeto seu não aparece como apoio, confira a grafia.

### Minhas ações

Tudo o que está sob a sua responsabilidade, separado por urgência.

**Quem pode usar:** Todos os perfis. **Desde:** 19/11/2026.

**Como fazer**

1. Abra "Minhas ações". Elas vêm em três grupos: Atrasadas, Em aberto e Concluídas (as 10 mais recentes).
2. Clique em uma ação para registrar o realizado ou editá-la.
3. Se a tela pedir, ligue a sua conta ao seu nome no cadastro de colaboradores.

**Dicas e regras**

- Toda segunda-feira o sistema envia, por e-mail, a cada responsável a lista das suas ações atrasadas.

## Card WIN

### Card WIN semanal

O seu compromisso da semana: até 3 itens do que é importante agora.

**Quem pode usar:** Colaborador e Administrador. **Desde:** 25/09/2026.

**Como fazer**

1. Abra "Card WIN". A semana vai de domingo a sábado e a semana 1 começa no domingo igual ou anterior a 1º de janeiro.
2. Preencha a área e cadastre até 3 WINs, com prazo e status.
3. Na lista da semana anterior, use "Repetir nesta semana" para trazer um WIN adiante. Só assim as repetições somam.
4. Quando um WIN se repete por 3 semanas, passe-o ao plano: "Promover ao plano de ação" cria um projeto novo ou uma ação num projeto existente.
5. "Encerrar" tira o WIN do card (Concluí ou Abandonei); "Tirar da semana" só libera a vaga.

**Dicas e regras**

- O limite de 3 por semana é rígido.
- Redigitar o mesmo assunto cria um WIN novo, com a contagem zerada. Use "Repetir".
- Promover e encerrar marcam a semana; não apagam o histórico.

### Equipe: cards da semana

Os cards de todos na mesma tela, para a daily.

**Quem pode usar:** Todos os perfis. **Desde:** 25/09/2026.

**Como fazer**

1. Abra "Equipe" e navegue pelas semanas.
2. Veja os WINs de cada pessoa e quem ainda não preencheu o card.

**Dicas e regras**

- É somente leitura: para mudar um card, a própria pessoa edita em "Card WIN".

## Análise

### Dashboards

Relatórios sobre a carteira, organizados em abas.

**Quem pode usar:** Todos os perfis. **Desde:** 18/09/2026.

**Como fazer**

1. A tela abre na aba Gestão, feita para diretoria e gerência: o Semáforo por equipe (verde, amarelo ou vermelho, cruzando atraso, aderência ao prazo, riscos de impacto alto e replanejamentos), o Mapa de calor de equipe por status, a Prioridade × atraso (a matriz Benefício × Esforço com o atraso por cima, e os projetos de alto benefício atrasados em destaque), os Riscos e bloqueios por equipe e o Ritmo de entrega (ações concluídas contra ações criadas, semana a semana).
2. No topo, o resumo lista o que pede atenção (atrasadas, vencendo em 7 dias, projetos sem ações, WINs a promover, replanejamentos). Cada número leva ao detalhe.
3. Escolha a aba: Gestão (a que abre), Panorama, Distribuição, Prazos, Evolução no tempo, Qualidade, Card WIN, Auditoria, ou Todas.
4. Os filtros e o período valem para as abas (menos Card WIN e Auditoria, que olham o sistema inteiro) e acompanham a troca de aba.
5. Para PDF, abra a aba e imprima; para a tela inteira, abra "Todas" antes.
6. O semáforo é vermelho ("Crítica") quando mais de 20% das ações abertas da equipe estão atrasadas ou há risco de impacto alto com prazo vencido; amarelo ("Atenção") de 5% a 20% de atraso ou com risco de impacto alto aberto; verde ("Em dia") abaixo disso. A cor vem sempre com a palavra e com o motivo escrito no cartão.
7. A aba Prazos ganhou a Idade do atraso por equipe (até 7 dias, 8 a 30, 31 a 90 e mais de 90 dias), e a aba Auditoria, o mapa de calor de Replanejamentos: motivo × equipe.
8. No celular e no tablet, os Dashboards se adaptam: as abas viram uma faixa que rola de lado, os filtros ficam atrás do botão "Filtros" (que mostra quantos estão ativos), as tabelas viram cartões, com o nome de cada coluna, e os gráficos largos rolam de lado.

**Dicas e regras**

- Cada relatório responde a uma pergunta de negócio, escrita no próprio título.
- Embaixo do título de cada relatório há "Como ler este relatório": o que mostra, como ler, de onde vem o número e quando olhar com cuidado. O mesmo texto está no Guia dos relatórios, no fim deste manual, que se pode buscar.
- A Auditoria mostra quantas vezes cada prazo foi empurrado (replanejamento) e, em "Replanejamentos por motivo", por que as datas mudam. Cada mudança conta uma vez, mesmo que início e término tenham mudado juntos.

### Reunião (modo de projeção)

Os pontos de atenção da semana em telas grandes, para a daily, sem montar slide.

**Quem pode usar:** Todos os perfis. **Desde:** 21/11/2026.

**Como fazer**

1. Abra "Reunião" no menu. A tela cobre o sistema inteiro, com letra grande, no tema claro ou escuro que você escolheu.
2. Escolha a equipe na barra do alto ("Todas as equipes", STI, GIA...). A escolha vai no endereço: guarde o link da daily de cada equipe.
3. Avance com a seta para a direita, a barra de espaço ou "Próxima"; volte com a seta para a esquerda. As telas são: Panorama, Atrasadas, Vencem nos próximos 7 dias, Replanejadas na semana, Riscos e bloqueios abertos e Concluídas na semana.
4. Use F (ou "Tela cheia") para projetar em tela cheia. Esc sai da apresentação e volta ao painel.

**Dicas e regras**

- Os dados são os de agora, não uma foto: se alguém registrar algo durante a reunião, recarregue a página. Para o retrato da segunda-feira, use o Resumo semanal (administradores).
- Lista longa vira várias telas ("2/3"), para ninguém rolar a página durante a reunião.
- Replanejadas são as mudanças de data prevista dos últimos 7 dias, com a data de antes e a de depois, quantas mudanças a ação teve, quem fez a última e o motivo informado. A ação que voltou à data original não aparece.
- Atrasada segue a regra do painel (término previsto já passou e a ação não foi concluída).
- É só consulta: todos os perfis, inclusive o Leitor, usam.

### Matriz de priorização

Recomenda a ordem dos projetos por Benefício, Esforço e GUT.

**Quem pode usar:** Todos os perfis. **Desde:** 21/09/2026.

**Como fazer**

1. Abra "Priorização" para ver o ranking e o gráfico Benefício x Esforço, com os quatro quadrantes.
2. Para avaliar um projeto, abra-o na matriz e dê as notas (0, 3, 6 ou 9) aos critérios de benefício e esforço, e de 1 a 5 a Gravidade, Urgência e Tendência.
3. O número no ponto do gráfico é o mesmo do ranking.
4. Administradores ajustam os pesos em "Administração > Pesos da priorização"; cada grupo precisa somar 100.

**Dicas e regras**

- A matriz recomenda; quem decide a prioridade do projeto é uma pessoa, e os dois valores aparecem lado a lado.
- Mudar um peso recalcula o ranking inteiro na hora.

## Administração

### Colaboradores

O cadastro de pessoas: perfil, área, e-mail e situação.

**Quem pode usar:** Só administrador. **Desde:** 25/09/2026.

**Como fazer**

1. Abra "Administração" no menu e escolha "Colaboradores". Só administradores alteram; os demais perfis não têm esse item no menu.
2. Corrija o nome, defina a área e o e-mail. Ao renomear, marque a opção de alinhar o Responsável dos projetos, se quiser.
3. Altere o perfil: tornar Leitor, voltar a Colaborador, promover a Administrador.
4. Desative quem saiu (e reative se voltar). Desativar não apaga nada do histórico.

**Dicas e regras**

- Ninguém desativa a si mesmo, e o último administrador não pode sair.
- Quem vai de Leitor a Administrador passa antes por Colaborador.
- A área sugerida vem das grafias já usadas, para não duplicar.

### Área de Administração

O lugar de quem administra o sistema, separado do menu de trabalho.

**Quem pode usar:** Só administrador. **Desde:** 20/11/2026.

**Como fazer**

1. Clique em "Administração", no fim do menu. O item só aparece para administradores.
2. A página lista as ferramentas: Colaboradores, Pesos da priorização, Resumo semanal, Lixeira, Painel do sistema e Registro de erros. Dentro de cada uma, a barra no topo leva às outras.
3. Os demais perfis não veem o item; se abrirem o endereço direto, a tela diz que o acesso é de administradores.

**Dicas e regras**

- Esconder o item é só conforto: a permissão é conferida pelo servidor em cada ação.
- Enquanto não houver nenhum administrador ativo, todos veem a área (o sistema ainda não restringe nada).

### Resumo semanal

O retrato da semana, por equipe: o que foi concluído, o que atrasou e o que vence nos próximos 7 dias.

**Quem pode usar:** Só administrador. **Desde:** 21/11/2026.

**Como fazer**

1. Toda segunda-feira, a partir das 8h (horário de Brasília), o sistema tira o resumo da semana. Na primeira vez que um administrador entra depois disso, aparece um popup com os totais por equipe.
2. No popup, clique em "Ver o resumo completo" para abrir a tela, ou em "Fechar" (ou Esc) para dispensar. O aviso também fica no sino, em "Notificações".
3. Em Administração > Resumo semanal, cada equipe mostra três blocos: Atrasadas, Vencem em 7 dias e Concluídas. Cada bloco traz o total e as 10 ações mais relevantes, com projeto, responsável e data; clique numa ação para abri-la.
4. Para ver semanas anteriores, use "Outras semanas" no alto da tela.

**Dicas e regras**

- Só administradores ativos recebem o popup e o aviso. Quem for promovido a administrador no meio da semana também recebe o resumo da semana corrente.
- É uma foto: o que você viu no dia não muda depois, mesmo que as ações mudem. Para o estado de agora, use os Dashboards.
- Atrasada segue a regra do painel (término previsto já passou e a ação não foi concluída). Concluída é a de término realizado nos últimos 7 dias.
- Equipe sem nada para dizer não aparece. Projetos sem equipe preenchida ficam em "Sem equipe".
- Por enquanto o resumo não vai por e-mail, só dentro do sistema.

### Lixeira de projetos

Restaurar um projeto que foi excluído.

**Quem pode usar:** Só administrador. **Desde:** 21/11/2026.

**Como fazer**

1. Abra Administração > Lixeira. A lista mostra cada projeto excluído, com equipe, responsável, quantas ações tem e quando e por quem foi excluído.
2. Clique em "Restaurar" e confirme. O projeto volta para a lista de Projetos, com todas as ações, comentários, riscos e o histórico.
3. Um aviso no alto da tela confirma a restauração e leva ao projeto.

**Dicas e regras**

- Excluir um projeto nunca apaga dados: ele só some das telas. Por isso restaurar devolve tudo como estava.
- Não há exclusão definitiva, para a trilha de auditoria nunca se perder.
- Projetos excluídos antes desta tela existir aparecem como "data não registrada".
- Só administradores excluem e restauram projetos. O sistema registra quando e por quem foi restaurado.

### Erros e painel do sistema

Saúde do sistema para quem administra.

**Quem pode usar:** Só administrador. **Desde:** 18/11/2026.

**Como fazer**

1. "Administração > Painel do sistema" mostra o estado do banco, os erros por origem (24 horas e 7 dias), as últimas execuções do aviso semanal e o volume contra o limite recomendado.
2. "Administração > Registro de erros" lista os erros registrados (guardados por 30 dias).
3. O endereço /api/saude responde "ok" ou "fora" e é o que um monitor externo consulta.

**Dicas e regras**

- Falhas novas geram um e-mail de alerta, no máximo um por hora para cada origem.
- As telas mostram só se uma configuração está definida, nunca o valor.

## Guia dos relatórios dos Dashboards

### Gestão

#### Semáforo por equipe

**Pergunta que responde:** Em quais equipes está o problema? Cruza atraso, aderência ao prazo, riscos de impacto alto e replanejamentos.

**O que mostra:** Um cartão por equipe, com a cor do semáforo e o motivo dela.

**Como ler**

- A palavra ao lado do nome da equipe diz o estado: Crítica (vermelho), Atenção (amarelo) ou Em dia (verde). A cor nunca vem sozinha.
- O medidor mostra a proporção de ações abertas atrasadas, com os limites de 5% e 20% marcados.
- "No prazo" é a aderência (das ações concluídas, quantas terminaram dentro do previsto). "Riscos" são os riscos e bloqueios abertos, com quantos têm impacto alto. "Replan. 30d" são as mudanças de data prevista dos últimos 30 dias.
- Abaixo, em frases, está o motivo da cor.

**De onde vem o número:** Atrasada segue a regra do painel (término previsto já passou e a ação não foi concluída). O atraso é medido sobre as ações ABERTAS, para concluir trabalho não esconder o problema. Crítica: mais de 20% das abertas atrasadas, ou risco de impacto alto com prazo vencido. Atenção: de 5% a 20%, ou risco de impacto alto aberto. Em dia: abaixo disso.

**Quando olhar com cuidado:** Equipe Crítica, ou Atenção que continua assim semana após semana. Veja os motivos escritos no cartão e abra a equipe na tela Reunião.

#### Mapa de calor: equipe × status

**Pergunta que responde:** Como os projetos de cada equipe se distribuem entre concluído, em andamento, não iniciado e atrasado?

**O que mostra:** Quantos projetos de cada equipe estão em cada status.

**Como ler**

- Cada linha é uma equipe; cada coluna, um status (Sem ações, Concluído, Em andamento, Não iniciado, Atrasado). O número é a quantidade de projetos.
- Quanto mais escura a célula, maior a quantidade. A coluna Atrasado usa a cor de atraso.
- O "·" é zero. A última coluna soma a linha.

**De onde vem o número:** O status do projeto é calculado a partir das ações dele (não é um campo digitado): Atrasado tem precedência quando há ação atrasada. Projetos sem equipe preenchida ficam em "Sem equipe".

**Quando olhar com cuidado:** Uma coluna Atrasado escura, ou uma equipe com muitos projetos "Não iniciado" no meio do ano.

#### Prioridade × atraso

**Pergunta que responde:** Os projetos de maior benefício são os que estão em dia, ou os que estão atrasados?

**O que mostra:** A matriz Benefício × Esforço com o atraso por cima: quais projetos importantes estão atrasados.

**Como ler**

- Cada bolha é um projeto avaliado na matriz de priorização. A posição é a da matriz: esforço na horizontal, benefício na vertical, com os quatro quadrantes ao fundo.
- O tamanho e a cor da bolha dizem o atraso: bolha cheia na cor de atraso, quanto maior, mais ações atrasadas; bolha vazada, em dia.
- Contorno grosso marca o projeto de alto benefício (Quick Wins ou Estratégicos) que tem ação atrasada: o atraso que mais custa.
- O número dentro da bolha liga ao quadro abaixo, que lista projeto, equipe, quadrante, benefício, esforço e atrasadas.

**De onde vem o número:** Benefício e esforço são calculados na hora, com as notas da avaliação e os pesos vigentes da matriz de priorização. Só entram projetos avaliados. As atrasadas seguem a regra do painel.

**Quando olhar com cuidado:** Bolhas com contorno grosso: são os projetos que mais valem a conversa. Projeto sem avaliação não aparece: avalie em Priorização.

#### Riscos e bloqueios por equipe

**Pergunta que responde:** Onde estão os riscos e bloqueios abertos, com qual impacto, e quais já passaram do prazo para tratar?

**O que mostra:** Onde estão os riscos e bloqueios abertos, com qual impacto.

**Como ler**

- Cada barra é uma equipe. As fatias são o impacto (alto, médio, baixo), do mais escuro (alto) ao mais claro, todas na mesma escala.
- Ao lado do total aparecem quantos são bloqueios (já travam o trabalho) e quantos estão com o prazo para tratar vencido.

**De onde vem o número:** Os riscos e bloqueios registrados nos projetos, só os abertos (abertos ou em tratamento). Resolvidos e ocorridos não entram.

**Quando olhar com cuidado:** Impacto alto com prazo vencido, e equipes com muitos bloqueios.

#### Ritmo de entrega

**Pergunta que responde:** A equipe conclui mais ações por semana do que cria? A carteira está encolhendo ou crescendo?

**O que mostra:** Quantas ações a equipe conclui por semana contra quantas cria.

**Como ler**

- As barras verdes são as ações concluídas em cada semana, nas últimas 12 (a corrente inclusive). A linha são as ações criadas. A linha tracejada é a média das concluídas nas últimas 4 semanas.
- A frase no alto resume: se concluiu mais do que criou, a carteira encolheu; se criou mais, cresceu.

**De onde vem o número:** Concluídas: pela data de término REALIZADO. Criadas: pela data em que a ação foi cadastrada. A semana vai de domingo a sábado, como a semana da CTCEA.

**Quando olhar com cuidado:** A linha de criadas acima das barras por várias semanas seguidas: a carteira só cresce.

### Panorama

#### Panorama geral

**Pergunta que responde:** Como está a carteira de projetos como um todo, hoje?

**O que mostra:** Os quatro números que resumem a carteira inteira.

**Como ler**

- Projetos ativos: quantos projetos existem (os excluídos não contam), com quantos já estão concluídos.
- Ações: o total, com quantas estão concluídas.
- Progresso geral: ações concluídas sobre o total de ações.
- Projetos com atraso: quantos têm ao menos uma ação atrasada, e quantas ações atrasadas são ao todo.

**De onde vem o número:** As mesmas funções do painel consolidado, então os números aqui e no painel sempre batem. Seguem os filtros e o período da tela.

**Quando olhar com cuidado:** Projetos com atraso crescendo de um mês para o outro, ou progresso geral parado.

#### Composição por status

**Pergunta que responde:** Quantos projetos estão parados, em andamento, atrasados ou concluídos?

**O que mostra:** A divisão dos projetos entre os status possíveis.

**Como ler**

- Uma barra única dividida em fatias: Sem ações, Concluído, Em andamento, Não iniciado e Atrasado, sempre nessa ordem. Cada fatia traz o número e o percentual.
- A ordem das fatias é fixa de propósito, para as cores vizinhas se distinguirem bem, inclusive para quem não enxerga verde e laranja.

**De onde vem o número:** O status é calculado a partir das ações do projeto; Atrasado tem precedência. Conta projetos, não ações.

**Quando olhar com cuidado:** A fatia de Atrasado grande, ou muitos projetos "Sem ações" (cadastrados e sem plano).

### Distribuição

#### Por equipe

**Pergunta que responde:** Qual equipe concentra mais ações e qual acumula mais atraso?

**O que mostra:** Quanto trabalho e quanto atraso cada equipe tem.

**Como ler**

- Volume de ações: a barra mostra o tamanho da equipe em ações, na mesma escala das outras linhas.
- Projetos, Concluídas e Em atraso são contagens; Progresso é o percentual de ações concluídas.
- Clique no nome da equipe para abrir o painel já filtrado por ela.

**De onde vem o número:** Projetos agrupados pela equipe cadastrada, com os mesmos cálculos do painel. Projetos sem equipe ficam no grupo "Não informado", sempre no fim da lista.

**Quando olhar com cuidado:** Uma equipe com muito volume e muito atraso, ou o grupo "Não informado" grande: cadastro incompleto distorce a leitura.

#### Por responsável

**Pergunta que responde:** Como a carga está distribuída entre as pessoas responsáveis?

**O que mostra:** Como a carga está distribuída entre as pessoas responsáveis pelos projetos.

**Como ler**

- As mesmas colunas de Por equipe, agora por responsável do projeto. Clique no nome para filtrar o painel.

**De onde vem o número:** O responsável do projeto (a pessoa escolhida como líder). Projetos sem responsável ficam em "Não informado".

**Quando olhar com cuidado:** Uma pessoa concentrando muitos projetos e atrasos: risco de gargalo.

#### Por natureza

**Pergunta que responde:** Quanto do esforço é desenvolvimento, infraestrutura ou iniciativa?

**O que mostra:** O esforço dividido entre desenvolvimento, infraestrutura e iniciativa (ou outras naturezas cadastradas).

**Como ler**

- As mesmas colunas de Por equipe, agora por natureza do projeto.

**De onde vem o número:** O campo Natureza do projeto, como foi digitado. Projetos sem natureza ficam em "Não informado".

**Quando olhar com cuidado:** Uma natureza muito dominante, ou muitos projetos sem natureza.

#### Por categoria

**Pergunta que responde:** Como os projetos se distribuem entre as categorias do plano de ação?

**O que mostra:** Como os projetos se distribuem entre as categorias do plano de ação.

**Como ler**

- As mesmas colunas de Por equipe, agora por categoria. Clique no nome para filtrar o painel.

**De onde vem o número:** O campo Categoria do projeto. Projetos sem categoria ficam em "Não informado".

**Quando olhar com cuidado:** Categorias com atraso concentrado, ou variações da mesma categoria escritas de jeitos diferentes.

#### Por prioridade

**Pergunta que responde:** O atraso está concentrado nos projetos de maior prioridade?

**O que mostra:** Se o atraso está concentrado nos projetos de maior prioridade.

**Como ler**

- As mesmas colunas de Por equipe, agora por número de prioridade do projeto.

**De onde vem o número:** O campo Prioridade do projeto (uma decisão humana, não a recomendação da matriz). Projetos sem prioridade ficam em "Não informado".

**Quando olhar com cuidado:** Atraso e baixo progresso nas prioridades mais altas.

### Prazos

#### Aderência ao prazo

**Pergunta que responde:** Das ações já concluídas, quantas terminaram dentro do previsto?

**O que mostra:** Das ações já concluídas, quantas terminaram dentro do previsto.

**Como ler**

- "Entregues no prazo" é o percentual sobre as ações avaliáveis. Os demais cartões mostram quantas entraram no prazo, quantas atrasaram e o atraso médio, em dias úteis, só entre as que atrasaram.

**De onde vem o número:** Só entram ações concluídas com data prevista E realizada de término. Sem as duas pontas não há como medir, e essas ações ficam de fora (a tela conta quantas).

**Quando olhar com cuidado:** Aderência baixa, ou atraso médio alto nas entregas que estouraram.

#### Maiores atrasos

**Pergunta que responde:** Quais ações estão paradas há mais tempo depois do prazo?

**O que mostra:** As ações que estão paradas há mais tempo depois do prazo.

**Como ler**

- A lista vai da ação mais atrasada para a menos. As colunas dizem a ação, o projeto, o responsável, o término previsto e o atraso em dias úteis.
- Cada linha leva ao projeto.

**De onde vem o número:** Ações atrasadas (término previsto já passou e não concluídas). O atraso é contado em dias úteis, sem fins de semana, feriados nacionais fixos nem os móveis (Carnaval, Sexta-feira Santa e Corpus Christi).

**Quando olhar com cuidado:** Ações com atraso de meses: ou ninguém atualizou o status, ou o trabalho parou de fato.

#### Idade do atraso por equipe

**Pergunta que responde:** O atraso é recente ou é antigo? Quantas ações atrasadas há até 7, 30, 90 dias ou mais?

**O que mostra:** Se o atraso é recente ou antigo, por equipe.

**Como ler**

- Cada barra é uma equipe, dividida em faixas de dias de atraso: até 7, de 8 a 30, de 31 a 90 e mais de 90. Quanto mais escura a fatia, mais antigo o atraso.

**De onde vem o número:** Ações atrasadas, com o atraso em dias corridos desde o término previsto.

**Quando olhar com cuidado:** Fatia escura grande: atraso antigo costuma ser ação esquecida ou plano que mudou sem ser atualizado.

#### Próximos vencimentos

**Pergunta que responde:** O que vence nos próximos 7, 15 e 30 dias?

**O que mostra:** O que vence nos próximos 7, 15 e 30 dias.

**Como ler**

- Três cartões, um por janela, com a quantidade de ações a vencer. As janelas são cumulativas: os 30 dias incluem os 15 e os 7.

**De onde vem o número:** Ações abertas (não concluídas) com término previsto de hoje até o fim da janela.

**Quando olhar com cuidado:** Muita coisa vencendo na próxima semana, principalmente em ações que ainda não começaram.

### Evolução no tempo

#### Previsto x Realizado acumulado

**Pergunta que responde:** O ritmo de entrega está acompanhando o que foi planejado?

**O que mostra:** Se o ritmo de entrega acompanha o que foi planejado.

**Como ler**

- Duas curvas acumuladas, mês a mês: Previsto (azul) e Realizado (verde), na mesma escala. As ações acumuladas são contagens.
- A curva Realizado para no mês corrente: estender sobre meses futuros mostraria uma queda de ritmo que não aconteceu.
- Realizado abaixo de Previsto significa entrega atrás do plano.

**De onde vem o número:** Previsto: ações pelo mês do término previsto. Realizado: ações concluídas, pelo mês do término realizado.

**Quando olhar com cuidado:** Uma distância crescente entre as duas curvas.

#### Carga por mês

**Pergunta que responde:** Em que meses se concentram os inícios e os términos previstos?

**O que mostra:** Em que meses se concentram os inícios e os términos previstos.

**Como ler**

- Duas faixas de barras, uma para os inícios e outra para os términos, com a MESMA escala vertical, então a altura se compara de verdade entre as duas.

**De onde vem o número:** Ações pelo mês do início previsto e do término previsto.

**Quando olhar com cuidado:** Meses com picos de términos: é onde o risco de atraso se acumula.

### Qualidade do cadastro

#### Pendências de cadastro

**Pergunta que responde:** Que registros estão incompletos ou inconsistentes e distorcem os números?

**O que mostra:** Os registros incompletos ou inconsistentes que distorcem os números.

**Como ler**

- Cada linha é um tipo de pendência (projeto sem ação, sem responsável ou sem equipe; ação sem data prevista; datas invertidas; concluída sem data realizada; realizada mas não concluída), com a quantidade e o efeito nos números.
- Zero é boa notícia e aparece sem a cor de alerta.

**De onde vem o número:** Conferência dos projetos e das ações dentro do recorte atual.

**Quando olhar com cuidado:** Qualquer número acima de zero: cada pendência esconde ou distorce algo (ação sem data prevista nunca aparece como atrasada, por exemplo).

### Card WIN

#### Conclusão dos WINs por semana

**Pergunta que responde:** Dos WINs comprometidos em cada semana, quantos foram concluídos?

**O que mostra:** Dos WINs comprometidos em cada semana, quantos foram concluídos.

**Como ler**

- Uma barra por semana, empilhada na ordem Concluído (verde), Promovido (verde hachurado), Em andamento (azul), Pendente (cinza) e Não feito (laranja). A taxa é a dos concluídos.
- A semana em curso aparece com contorno tracejado. Quando não há taxa, a tela diz por quê: semana sem WINs, ou todos promovidos.

**De onde vem o número:** A taxa é feitos sobre os WINs da semana, SEM contar os promovidos ao plano de ação: promover não é concluir nem falhar, o trabalho só mudou de lugar. Não segue os filtros da carteira, só o período.

**Quando olhar com cuidado:** Taxa baixa por várias semanas, ou muitos pendentes que nunca andam.

#### WINs reincidentes

**Pergunta que responde:** Que assuntos se repetem semana após semana, e quais já viraram plano de ação?

**O que mostra:** Os WINs que ficam voltando semana após semana.

**Como ler**

- A tabela traz o WIN, a pessoa, o período, o número de aparições e a situação. A borda do WIN fica na cor de atraso quando ele deve ser promovido (chegou à terceira aparição) e verde quando já foi promovido; o WIN promovido leva ao projeto.

**De onde vem o número:** WINs que aparecem em 2 semanas ou mais (a contagem soma as aparições, não exige semanas seguidas). Não segue os filtros da carteira, só o período.

**Quando olhar com cuidado:** WINs que já deveriam ter virado ação no plano e continuam no card.

### Auditoria

#### Replanejamentos

**Pergunta que responde:** Quais ações tiveram a data prevista empurrada, e quantas vezes?

**O que mostra:** Quais ações tiveram a data prevista empurrada, e quantas vezes.

**Como ler**

- Os cartões somam as alterações registradas (das últimas 500), os replanejamentos e quantas pessoas alteraram.
- A tabela lista as ações mais remexidas, com o número de vezes e a última mudança (data de antes e de depois).

**De onde vem o número:** O histórico de alterações das ações, nas datas previstas de início e término. Não segue os filtros da carteira, só o período.

**Quando olhar com cuidado:** Ação replanejada várias vezes e sem atraso aberto: não aparece em nenhum outro relatório, e é a que merece uma conversa.

#### Replanejamentos por motivo

**Pergunta que responde:** Por que as datas previstas mudam: escopo, dependência externa, falta de gente, prioridade ou estimativa?

**O que mostra:** Por que as datas previstas mudam.

**Como ler**

- Uma barra por motivo (escopo mudou, dependência externa, falta de pessoas ou recursos, prioridade mudou, estimativa errada, outro), com a quantidade.
- "Sem motivo registrado" são as mudanças de antes de o sistema perguntar o motivo.

**De onde vem o número:** O motivo informado ao mudar uma data prevista que já existia. Cada mudança conta uma vez, mesmo que início e término tenham mudado juntos. Mostra categorias, nunca pessoas.

**Quando olhar com cuidado:** "Estimativa errada" ou "Falta de pessoas" dominando: o problema está no planejamento ou na capacidade, não nas pessoas.

#### Replanejamentos: motivo × equipe

**Pergunta que responde:** Cada equipe replaneja por qual motivo? Escopo, dependência externa, falta de gente, prioridade ou estimativa?

**O que mostra:** Cada equipe replaneja por qual motivo.

**Como ler**

- Cada linha é um motivo e cada coluna uma equipe. O número é a quantidade de mudanças de data; a célula é tingida pela quantidade.

**De onde vem o número:** O mesmo registro de motivos do relatório anterior, cruzado com a equipe do projeto. Conta eventos.

**Quando olhar com cuidado:** Uma equipe em que um motivo se repete: é o padrão a tratar.

#### Alterações recentes

**Pergunta que responde:** O que mudou por último, em que campo e por quem?

**O que mostra:** O que mudou por último, em que campo e por quem.

**Como ler**

- No alto, a contagem de alterações por campo (status, datas, responsável...). Abaixo, as 15 mais recentes: o campo, a ação, o valor de antes e o de depois, quem alterou e quando.

**De onde vem o número:** A trilha de auditoria: toda mudança de status, data ou responsável de uma ação é gravada. Não segue os filtros da carteira, só o período.

**Quando olhar com cuidado:** Mudanças inesperadas ou alterações em massa fora de hora.

## Glossário

- **Previsto**: O plano: datas de início e término que se espera cumprir.
- **Realizado**: O que de fato aconteceu: datas apontadas depois que a ação começou ou terminou.
- **Atrasada**: Ação não concluída cujo término previsto já passou.
- **Status**: Não iniciado, Em curso (25%, 50% ou 75%) ou Concluído.
- **Dias úteis**: Dias sem sábado, domingo, feriados nacionais fixos e os móveis (segunda e terça de Carnaval, Sexta-feira Santa e Corpus Christi). A Quarta-feira de Cinzas conta como dia útil; feriados estaduais e municipais não entram. É a medida dos deslocamentos e das durações.
- **Replanejamento**: Mudança de uma data prevista. Fica no histórico e alimenta o relatório de auditoria.
- **WIN**: What's Important Now: um compromisso da semana, até 3 por pessoa.
- **GUT**: Gravidade, Urgência e Tendência: três notas de 1 a 5 que se multiplicam na priorização.
- **Líder do projeto**: O colaborador escolhido como Responsável do projeto, na lista (ou um administrador). Decide as liberações de início.
- **Avanço físico**: Média do percentual de cada ação, ponderada pelos dias úteis previstos dela. Não é o percentual de ações concluídas.
- **Desvio (p.p.)**: Avanço realizado menos avanço previsto, em pontos percentuais. Negativo é atraso.
- **Sinal**: Farol do projeto: Atrasado, Atenção, Em dia, Adiantado ou Sem dados, pelo desvio de avanço físico e por riscos altos vencidos.
- **DMAIC**: Roteiro de melhoria de processos em cinco fases: Definir, Medir, Analisar, Melhorar e Controlar. No sistema, pode ser aplicado como macroetapas do projeto.
- **Macroetapa**: Agrupamento opcional de ações dentro de um projeto, usado no cronograma macro do Flash Report.
- **Leitor**: Perfil que só consulta e exporta.

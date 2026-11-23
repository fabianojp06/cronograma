/**
 * Fluxos principais no navegador de verdade: criar ação, editar, conflito de
 * edição e filtrar os Dashboards.
 *
 * Existe porque três defeitos de tela (gráfico gigante com período curto, filtro
 * sem sinal de processamento, conflito invisível) passaram por `tsc`, `eslint` e
 * centenas de testes verdes e só apareceram quando alguém abriu a página.
 */

import { expect, test } from '@playwright/test'

import { consultar, encerrarBanco, limparBanco, semear } from './banco'

let projetoId: string
let acaoId: string

test.beforeEach(async () => {
  await limparBanco()
  ;({ projetoId, acaoId } = await semear())
})

test.afterAll(async () => {
  await encerrarBanco()
})

const statusDaAcao = async () =>
  (await consultar<{ status: string }>('SELECT "status" FROM "Acao" WHERE "id" = $1', [acaoId]))[0]
    .status

test('cria uma ação e mostra a janela de sucesso', async ({ page }) => {
  await page.goto(`/projetos/${projetoId}/acoes/nova`)

  await page.locator('#descricao').fill('Levantar inventário dos switches')
  await page.locator('#responsavelId').selectOption({ label: 'Ana Souza' })
  await page.getByRole('button', { name: 'Salvar ação' }).click()

  const janela = page.getByRole('dialog')
  await expect(janela).toContainText('Ação incluída com sucesso')
  await expect(janela).toContainText('Levantar inventário dos switches')

  const [criada] = await consultar<{ numero: number; responsavelId: string | null }>(
    'SELECT "numero","responsavelId" FROM "Acao" WHERE "projetoId" = $1 AND "descricao" = $2',
    [projetoId, 'Levantar inventário dos switches'],
  )
  expect(criada.numero).toBe(2)
  expect(criada.responsavelId).not.toBeNull()
})

test('edita o status da ação e registra no histórico', async ({ page }) => {
  await page.goto(`/projetos/${projetoId}/acoes/${acaoId}/editar`)

  await page.locator('#status').selectOption('EM_CURSO_50')
  await page.getByRole('button', { name: 'Salvar alterações' }).click()

  await expect(page.getByRole('status').filter({ hasText: 'Alterações salvas.' })).toBeVisible()
  expect(await statusDaAcao()).toBe('EM_CURSO_50')
  const [{ total }] = await consultar<{ total: string }>(
    `SELECT count(*) AS total FROM "HistoricoAlteracao" WHERE "acaoId" = $1 AND "campo" = 'status'`,
    [acaoId],
  )
  expect(Number(total)).toBe(1)

  // Salvar de novo na mesma tela não pode conflitar com o próprio save.
  await page.locator('#status').selectOption('EM_CURSO_75')
  await page.getByRole('button', { name: 'Salvar alterações' }).click()
  await expect(page.getByText('alterada por outra pessoa')).toHaveCount(0)
  await expect.poll(statusDaAcao).toBe('EM_CURSO_75')
})

test('avisa o conflito quando outra pessoa salvou antes', async ({ browser }) => {
  // Dois contextos = duas pessoas com abas separadas. Contexto novo não herda
  // o `baseURL` do projeto, então passa-se à mão.
  const baseURL = test.info().project.use.baseURL
  const contextoA = await browser.newContext({ baseURL })
  const contextoB = await browser.newContext({ baseURL })
  const a = await contextoA.newPage()
  const b = await contextoB.newPage()
  const caminho = `/projetos/${projetoId}/acoes/${acaoId}/editar`

  await a.goto(caminho)
  await b.goto(caminho)

  await a.locator('#status').selectOption('EM_CURSO_25')
  await a.getByRole('button', { name: 'Salvar alterações' }).click()
  await expect(a.getByText('Alterações salvas.')).toBeVisible()

  await b.locator('#status').selectOption('CONCLUIDO')
  await b.getByRole('button', { name: 'Salvar alterações' }).click()

  await expect(b.getByText('alterada por outra pessoa')).toBeVisible()
  await expect(b.getByRole('button', { name: 'Recarregar a ação' })).toBeVisible()
  // O que a primeira pessoa salvou não foi sobrescrito.
  expect(await statusDaAcao()).toBe('EM_CURSO_25')

  await contextoA.close()
  await contextoB.close()
})

test('filtra os Dashboards por período sem estourar o gráfico de WINs', async ({ page }) => {
  // O gráfico de WINs fica na aba "Card WIN"; o filtro mantém a aba.
  await page.goto('/dashboards?aba=wins')

  await page.locator('#de').fill('2026-03-01')
  await page.locator('#ate').fill('2026-03-14')
  await page.getByRole('button', { name: 'Filtrar' }).click()

  await expect(page).toHaveURL(/de=2026-03-01/)
  await expect(page).toHaveURL(/ate=2026-03-14/)
  await expect(page).toHaveURL(/aba=wins/)
  await expect(page.getByText('Período aplicado.')).toBeVisible()

  // Período curto = poucas semanas. O gráfico já esticou até a largura da tela e
  // ficou gigante; tem de manter o tamanho natural.
  const grafico = page.locator('svg[aria-label^="WINs por semana"]')
  await expect(grafico).toBeVisible()
  const caixa = await grafico.boundingBox()
  expect(caixa!.height).toBeLessThan(300)
})

test('o filtro de período some ao limpar', async ({ page }) => {
  await page.goto('/dashboards?de=2026-03-01&ate=2026-03-14')
  await expect(page.getByText('Período aplicado.')).toBeVisible()

  await page.getByRole('link', { name: 'Limpar filtros' }).click()

  await expect(page).toHaveURL(/\/dashboards$/)
  await expect(page.getByText('Período aplicado.')).toHaveCount(0)
})

test('"Minhas ações" mostra a ação atrasada de quem está logado', async ({ page }) => {
  await consultar(
    `UPDATE "Acao" SET "responsavelId" = (SELECT "id" FROM "Colaborador" WHERE "clerkUserId" = 'user_e2e') WHERE "id" = $1`,
    [acaoId],
  )

  await page.goto('/minhas-acoes')

  const atrasadas = page.locator('section', { has: page.getByRole('heading', { name: /Atrasadas/ }) })
  await expect(atrasadas).toContainText('Ação de partida')
  await expect(atrasadas).toContainText('de atraso')
})

test('exporta as ações atrasadas em Excel', async ({ page }) => {
  await page.goto('/')

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('link', { name: 'Ações atrasadas (Excel)' }).click(),
  ])

  expect(download.suggestedFilename()).toMatch(/^acoes-atrasadas-\d{4}-\d{2}-\d{2}\.xlsx$/)
  const caminho = await download.path()
  const { readFileSync } = await import('node:fs')
  // .xlsx é um zip: começa com "PK".
  expect(readFileSync(caminho).subarray(0, 2).toString()).toBe('PK')
})

test('"Foto em uma data" reconstrói o status do histórico e avisa o que não sabe', async ({
  page,
}) => {
  // A ação existe desde março; em 10/04 passou de "não iniciado" para 50%.
  await consultar(
    `UPDATE "Acao" SET "createdAt" = '2026-03-01', "status" = 'EM_CURSO_50' WHERE "id" = $1`,
    [acaoId],
  )
  await consultar(
    `INSERT INTO "HistoricoAlteracao" ("id","acaoId","campo","valorAntigo","valorNovo","alteradoEm")
     VALUES ($1,$2,'status','NAO_INICIADO','EM_CURSO_50','2026-04-10')`,
    [crypto.randomUUID(), acaoId],
  )

  // Antes da mudança: estava como "Não iniciado", e sem link de edição.
  await page.goto(`/projetos/${projetoId}?em=2026-03-31`)
  await expect(page.getByRole('status').filter({ hasText: 'Foto de 31/03/2026' })).toBeVisible()
  await expect(page.getByText('Não iniciado')).toBeVisible()
  await expect(page.getByRole('link', { name: /Ação de partida/ })).toHaveCount(0)

  // Depois da mudança: já em 50%.
  await page.goto(`/projetos/${projetoId}?em=2026-04-30`)
  await expect(page.getByText('Em curso — 50%')).toBeVisible()

  // Antes de a ação existir (e do início do registro): diz o que não sabe.
  await page.goto(`/projetos/${projetoId}?em=2026-02-01`)
  await expect(page.getByText('1 ação foi criada depois dessa data')).toBeVisible()
  await expect(page.getByText('anterior ao início do registro')).toBeVisible()

  // Sem `em` (ou com data inválida) é o estado atual, editável.
  await page.goto(`/projetos/${projetoId}?em=lixo`)
  await expect(page.getByText(/Foto de/)).toHaveCount(0)
  await expect(page.getByRole('link', { name: /Ação de partida/ })).toBeVisible()
})

test('perfil Leitor: vê tudo, não encontra como editar e a tela explica', async ({ page }) => {
  await consultar(`UPDATE "Colaborador" SET "somenteLeitura" = true WHERE "clerkUserId" = 'user_e2e'`)

  // O painel mostra os projetos, sem "Novo projeto" nem "Editar".
  await page.goto('/')
  await expect(page.getByRole('link', { name: 'Projeto E2E' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Novo projeto' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Editar', exact: true })).toHaveCount(0)

  // Quem chega pela URL vê o aviso, não o formulário.
  await page.goto('/projetos/novo')
  await expect(page.getByText('Seu perfil é somente leitura.')).toBeVisible()
  await expect(page.getByRole('button', { name: /Salvar/ })).toHaveCount(0)

  // A ação continua legível, com o histórico, mas sem formulário.
  await page.goto(`/projetos/${projetoId}/acoes/${acaoId}/editar`)
  await expect(page.getByText('Seu perfil é somente leitura.')).toBeVisible()
  await expect(page.getByText('Ação de partida')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Salvar ação' })).toHaveCount(0)

  // O Card WIN também vira consulta.
  await page.goto('/wins')
  await expect(page.getByText('Seu perfil é somente leitura.')).toBeVisible()
})

test('administrador define o perfil de um colaborador pela tela', async ({ page }) => {
  await consultar(`UPDATE "Colaborador" SET "administrador" = true WHERE "clerkUserId" = 'user_e2e'`)
  await consultar(
    `INSERT INTO "Colaborador" ("id","nome","updatedAt") VALUES ($1,'Bruno Lima',now())`,
    [crypto.randomUUID()],
  )

  await page.goto('/colaboradores')
  // O administrador recebe o resumo semanal ao entrar: dispensa o popup.
  await page.getByRole('dialog', { name: 'Resumo da semana' }).getByRole('button', { name: 'Fechar' }).click()
  const linhaBruno = page.getByRole('listitem').filter({ hasText: 'Bruno Lima' })
  await linhaBruno.getByRole('button', { name: 'Tornar leitor' }).click()

  await expect(linhaBruno.getByText('Bruno Lima agora é leitor')).toBeVisible()
  const [{ somenteLeitura }] = await consultar<{ somenteLeitura: boolean }>(
    `SELECT "somenteLeitura" FROM "Colaborador" WHERE "nome" = 'Bruno Lima'`,
  )
  expect(somenteLeitura).toBe(true)

  await linhaBruno.getByRole('button', { name: 'Tornar colaborador' }).click()
  await expect(linhaBruno.getByText('Bruno Lima voltou a ser colaborador')).toBeVisible()
})

test.describe('só contas @ctcea.org.br', () => {
  test('conta de fora do domínio é barrada, mesmo com o link direto de um projeto', async ({
    page,
    context,
  }) => {
    await context.addCookies([{ name: 'e2e_user', value: 'user_intruso', url: 'http://127.0.0.1:3100' }])

    await page.goto(`/projetos/${projetoId}`)

    await expect(page).toHaveURL(/\/acesso-negado\?motivo=dominio/)
    await expect(page.getByRole('heading', { name: 'Acesso restrito' })).toBeVisible()
    await expect(page.getByText('@ctcea.org.br').first()).toBeVisible()
    // O conteúdo do projeto não foi servido.
    await expect(page.getByText('Projeto E2E')).toHaveCount(0)
  })

  test('as APIs também respondem 403 à conta de fora do domínio', async ({ request }) => {
    const resposta = await request.get('/api/exportar/acoes', {
      headers: { cookie: 'e2e_user=user_intruso' },
    })
    expect(resposta.status()).toBe(403)
  })

  test('conta do domínio entra normalmente', async ({ page }) => {
    await page.goto(`/projetos/${projetoId}`)
    await expect(page).toHaveURL(new RegExp(`/projetos/${projetoId}$`))
    await expect(page.getByRole('heading', { name: 'Projeto E2E' })).toBeVisible()
  })
})

test.describe('busca e paginação', () => {
  test('o painel pagina a carteira e a busca encontra um projeto fora da primeira página', async ({
    page,
  }) => {
    // Mais 29 projetos (com o semeado, 30): a página tem 25.
    await consultar(
      `INSERT INTO "Projeto" ("id","nome","equipe","updatedAt")
       SELECT gen_random_uuid()::text, 'Projeto ' || lpad(n::text, 2, '0'), 'GIA', now()
       FROM generate_series(1, 29) AS n`,
    )
    await consultar(`UPDATE "Projeto" SET "nome" = 'Zona de Migração da Rede' WHERE "nome" = 'Projeto 29'`)

    await page.goto('/')
    await expect(page.getByText('1–25 de 30 projetos')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Zona de Migração da Rede' })).toHaveCount(0)

    await page.getByRole('link', { name: 'Próxima' }).click()
    await expect(page).toHaveURL(/pagina=2/)
    await expect(page.getByText('26–30 de 30 projetos')).toBeVisible()

    // Busca sem acento nem caixa, de qualquer página: volta à primeira.
    await page.getByLabel('Buscar', { exact: true }).fill('migracao rede')
    await page.getByRole('button', { name: 'Filtrar' }).click()
    await expect(page.getByRole('link', { name: 'Zona de Migração da Rede' })).toBeVisible()
    await expect(page.getByText(/de \d+ projetos/)).toHaveCount(0)
  })

  test('o projeto pagina as ações, mantém o resumo inteiro e a busca filtra', async ({ page }) => {
    await consultar(
      `INSERT INTO "Acao" ("id","projetoId","numero","descricao","previstoInicio","previstoTermino","updatedAt")
       SELECT gen_random_uuid()::text, $1, n + 1, 'Tarefa ' || n, '2026-03-02', '2026-03-20', now()
       FROM generate_series(1, 49) AS n`,
      [projetoId],
    )
    await consultar(
      `UPDATE "Acao" SET "descricao" = 'Homologar certificado' WHERE "projetoId" = $1 AND "numero" = 50`,
      [projetoId],
    )

    await page.goto(`/projetos/${projetoId}`)
    await expect(page.getByText('1–40 de 50 ações')).toBeVisible()
    // O resumo conta as 50, não as 40 da página.
    await expect(page.getByText(/0 de 50 ações concluídas/)).toBeVisible()
    await expect(page.getByText('Homologar certificado')).toHaveCount(0)

    await page.getByLabel('Buscar nas ações').fill('certificado')
    await page.getByRole('button', { name: 'Buscar' }).click()
    await expect(page.getByText('Homologar certificado')).toBeVisible()
    await expect(page.getByText('Tarefa 1', { exact: true })).toHaveCount(0)
    await expect(page.getByText(/0 de 50 ações concluídas/)).toBeVisible()

    await page.getByLabel('Buscar nas ações').fill('inexistente')
    await page.getByRole('button', { name: 'Buscar' }).click()
    await expect(page.getByText('Nenhuma ação corresponde a')).toBeVisible()
  })
})

test('comenta uma ação, o comentário aparece com o autor e o autor pode apagá-lo', async ({
  page,
}) => {
  await page.goto(`/projetos/${projetoId}/acoes/${acaoId}/editar?aba=comentarios`)
  await expect(page.getByText('Nenhum comentário nesta ação.')).toBeVisible()

  await page.getByLabel('Novo comentário').fill('Aguardando retorno do fornecedor')
  await page.getByRole('button', { name: 'Comentar' }).click()

  await expect(page.getByText('Comentário salvo.')).toBeVisible()
  await expect(page.getByText('Aguardando retorno do fornecedor')).toBeVisible()
  // O autor aparece pelo nome do colaborador vinculado à conta.
  await expect(
    page.getByRole('listitem').filter({ hasText: 'Aguardando retorno do fornecedor' }),
  ).toContainText('Ana Souza')
  expect(
    (await consultar('SELECT 1 FROM "ComentarioAcao" WHERE "acaoId" = $1', [acaoId])).length,
  ).toBe(1)

  // Campo vazio é recusado com mensagem, sem gravar.
  await page.getByRole('button', { name: 'Comentar' }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'Escreva o comentário.' })).toBeVisible()

  await page.getByRole('button', { name: 'Apagar' }).click()
  await expect(page.getByText('Nenhum comentário nesta ação.')).toBeVisible()
  expect(
    (await consultar('SELECT 1 FROM "ComentarioAcao" WHERE "acaoId" = $1', [acaoId])).length,
  ).toBe(0)
})

test.describe('monitoramento', () => {
  test('/api/saude responde sem login, só com ok e o tempo do banco', async ({ request }) => {
    const resposta = await request.get('/api/saude')
    expect(resposta.status()).toBe(200)
    const corpo = await resposta.json()
    expect(corpo.status).toBe('ok')
    expect(corpo.banco.ok).toBe(true)
    expect(Object.keys(corpo).sort()).toEqual(['banco', 'status'])
  })

  test('o painel do sistema é do administrador, e mostra erros, cron e volume', async ({ page }) => {
    // Sem ser administrador (e já havendo um), a tela recusa.
    await consultar(
      `INSERT INTO "Colaborador" ("id","nome","administrador","updatedAt") VALUES ($1,'Outro Admin',true,now())`,
      [crypto.randomUUID()],
    )
    await page.goto('/administracao/sistema')
    await expect(page.getByText('Só administradores consultam o painel do sistema.')).toBeVisible()

    await consultar(`UPDATE "Colaborador" SET "administrador" = true WHERE "clerkUserId" = 'user_e2e'`)
    await consultar(
      `INSERT INTO "RegistroErro" ("id","origem","mensagem") VALUES ($1,'Falha ao salvar WIN','x'),($2,'Falha ao salvar WIN','y')`,
      [crypto.randomUUID(), crypto.randomUUID()],
    )
    await consultar(
      `INSERT INTO "ExecucaoCron" ("id","nome","ok","resumo") VALUES ($1,'atrasos',true,'{"enviados":4}')`,
      [crypto.randomUUID()],
    )

    await page.goto('/administracao/sistema')
    await expect(page.getByRole('heading', { name: 'Painel do sistema' })).toBeVisible()
    await expect(page.getByText(/Respondendo em \d+ ms/)).toBeVisible()
    await expect(page.getByRole('cell', { name: 'Falha ao salvar WIN' })).toBeVisible()
    await expect(page.getByText('2 erro(s) nas últimas 24 horas.')).toBeVisible()
    await expect(page.getByText('Última execução:').first()).toContainText('concluída')
    await expect(page.getByText('{"enviados":4}')).toBeVisible()
    await expect(page.getByText('do ponto em que')).toBeVisible()
  })
})

test.describe('notificações de comentário', () => {
  test('quem é marcado vê o sino com a contagem, abre a notificação e marca como lida', async ({
    page,
    context,
  }) => {
    const bruno = crypto.randomUUID()
    await consultar(
      `INSERT INTO "Colaborador" ("id","nome","clerkUserId","updatedAt") VALUES ($1,'Bruno Lima','user_bruno',now())`,
      [bruno],
    )

    // Ana (a conta de teste) comenta e marca o Bruno.
    await page.goto(`/projetos/${projetoId}/acoes/${acaoId}/editar?aba=comentarios`)
    await page.getByText('Marcar outras pessoas').click()
    await page.getByLabel('Bruno Lima').check()
    await page.getByLabel('Novo comentário').fill('Bruno, preciso do relatório até sexta')
    await page.getByRole('button', { name: 'Comentar' }).click()
    await expect(page.getByText('Comentário salvo.')).toBeVisible()
    // Quem comentou não se avisa.
    await expect(page.getByRole('link', { name: 'Notificações', exact: true })).toBeVisible()

    // Agora como o Bruno.
    await context.addCookies([{ name: 'e2e_user', value: 'user_bruno', url: 'http://127.0.0.1:3100' }])
    await page.goto('/')
    await expect(page.getByRole('link', { name: 'Notificações: 1 não lida' })).toBeVisible()

    await page.getByRole('link', { name: 'Notificações: 1 não lida' }).click()
    await expect(page.getByText('1 não lida.')).toBeVisible()
    await expect(page.getByText('Ana Souza')).toBeVisible()
    await expect(page.getByText('marcou você')).toBeVisible()
    await expect(page.getByText('Bruno, preciso do relatório até sexta')).toBeVisible()
    await expect(page.getByRole('link', { name: 'ação 1' })).toHaveAttribute(
      'href',
      `/projetos/${projetoId}/acoes/${acaoId}/editar`,
    )

    await page.getByRole('button', { name: 'Marcar como lida' }).click()
    await expect(page.getByText('Tudo lido.')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Notificações', exact: true })).toBeVisible()
  })

  test('o responsável pela ação é avisado sem ser marcado', async ({ page, context }) => {
    const bruno = crypto.randomUUID()
    await consultar(
      `INSERT INTO "Colaborador" ("id","nome","clerkUserId","updatedAt") VALUES ($1,'Bruno Lima','user_bruno',now())`,
      [bruno],
    )
    await consultar(`UPDATE "Acao" SET "responsavelId" = $1 WHERE "id" = $2`, [bruno, acaoId])

    await page.goto(`/projetos/${projetoId}/acoes/${acaoId}/editar?aba=comentarios`)
    await expect(page.getByText('Bruno Lima, que responde pela ação, é avisado(a) sempre.')).toBeVisible()
    await page.getByLabel('Novo comentário').fill('Atualizei o prazo')
    await page.getByRole('button', { name: 'Comentar' }).click()
    await expect(page.getByText('Comentário salvo.')).toBeVisible()

    await context.addCookies([{ name: 'e2e_user', value: 'user_bruno', url: 'http://127.0.0.1:3100' }])
    await page.goto('/notificacoes')
    await expect(page.getByText('comentou uma ação sua')).toBeVisible()
  })

  test('conta sem colaborador é levada ao cadastro antes de ver a tela', async ({ page, context }) => {
    await context.addCookies([{ name: 'e2e_user', value: 'user_sem_cadastro', url: 'http://127.0.0.1:3100' }])
    await page.goto('/notificacoes')
    await expect(page).toHaveURL(/\/bem-vindo\?volta=/)
    await expect(page.getByRole('heading', { name: 'Quem é você?' })).toBeVisible()
  })
})

test.describe('edição em lote', () => {
  async function maisUmaAcao() {
    await consultar(
      `INSERT INTO "Acao" ("id","projetoId","numero","descricao","previstoInicio","previstoTermino","updatedAt")
       VALUES ($1,$2,2,'Segunda ação','2026-03-09','2026-03-13',now())`,
      [crypto.randomUUID(), projetoId],
    )
  }

  test('remarca o previsto de duas ações: prévia, confirmação e histórico por ação', async ({ page }) => {
    await maisUmaAcao()
    await page.goto(`/projetos/${projetoId}`)
    await page.getByRole('link', { name: 'Editar em lote' }).click()
    await expect(page.getByRole('heading', { name: 'Editar ações em lote' })).toBeVisible()

    await page.getByRole('button', { name: 'Marcar todas' }).click()
    await page.getByLabel('Dias úteis').fill('3')
    await page.getByRole('button', { name: 'Ver prévia' }).click()

    await expect(page.getByText('Adiar o previsto em 3 dias úteis:')).toBeVisible()
    await expect(page.getByText('2 de 2 ações mudam.')).toBeVisible()
    // 02/03 + 3 úteis = 05/03; 20/03 + 3 úteis = 25/03
    await expect(page.getByText(/Início previsto: 02\/03\/2026.*05\/03\/2026/)).toBeVisible()
    await expect(page.getByText(/Término previsto: 20\/03\/2026.*25\/03\/2026/)).toBeVisible()
    // A prévia não gravou nada.
    expect((await consultar('SELECT 1 FROM "HistoricoAlteracao"')).length).toBe(0)

    // As datas mudam: a confirmação pede um motivo só, para o lote todo.
    await page.getByLabel('Motivo *').selectOption('ESCOPO')
    await page.getByRole('button', { name: 'Confirmar e gravar 2 ação(ões)' }).click()
    await expect(page.getByText('ações alteradas')).toBeVisible()

    const [{ n }] = await consultar<{ n: string }>(
      `SELECT count(*) AS n FROM "HistoricoAlteracao" WHERE "campo" IN ('previstoInicio','previstoTermino')`,
    )
    expect(Number(n)).toBe(4)
    const [acao] = await consultar<{ t: string }>(
      `SELECT to_char("previstoTermino",'YYYY-MM-DD') AS t FROM "Acao" WHERE "id" = $1`,
      [acaoId],
    )
    expect(acao.t).toBe('2026-03-25')
  })

  test('troca o responsável em lote', async ({ page }) => {
    await maisUmaAcao()
    await page.goto(`/projetos/${projetoId}/lote`)
    await page.getByLabel('Marcar a ação 1').check()
    await page.getByLabel('Responsável', { exact: true }).selectOption({ label: 'Ana Souza' })
    await page.getByRole('button', { name: 'Ver prévia' }).click()
    await expect(page.getByText(/Responsável: —.*Ana Souza/)).toBeVisible()
    await page.getByRole('button', { name: /Confirmar e gravar/ }).click()
    await expect(page.getByText('ação alterada')).toBeVisible()
    const [{ nome }] = await consultar<{ nome: string }>(
      `SELECT c."nome" FROM "Acao" a JOIN "Colaborador" c ON c."id" = a."responsavelId" WHERE a."id" = $1`,
      [acaoId],
    )
    expect(nome).toBe('Ana Souza')
  })

  test('pedido sem ação marcada ou sem operação é recusado com mensagem', async ({ page }) => {
    await maisUmaAcao()
    await page.goto(`/projetos/${projetoId}/lote`)
    await page.getByRole('button', { name: 'Ver prévia' }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'Marque pelo menos' })).toBeVisible()
    await page.getByLabel('Marcar a ação 1').check()
    await page.getByRole('button', { name: 'Ver prévia' }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'Escolha o que fazer' })).toBeVisible()
  })

  test('o Leitor vê o aviso no lugar do formulário', async ({ page }) => {
    await maisUmaAcao()
    await consultar(`UPDATE "Colaborador" SET "somenteLeitura" = true WHERE "clerkUserId" = 'user_e2e'`)
    await page.goto(`/projetos/${projetoId}`)
    await expect(page.getByRole('link', { name: 'Editar em lote' })).toHaveCount(0)
    await page.goto(`/projetos/${projetoId}/lote`)
    await expect(page.getByText('Seu perfil é somente leitura.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Ver prévia' })).toHaveCount(0)
  })
})

test.describe('meus projetos', () => {
  const novoProjeto = (nome: string, campos: { responsavel?: string; apoio?: string; ativo?: boolean }) =>
    consultar(
      `INSERT INTO "Projeto" ("id","nome","responsavel","apoio","ativo","updatedAt") VALUES ($1,$2,$3,$4,$5,now())`,
      [crypto.randomUUID(), nome, campos.responsavel ?? null, campos.apoio ?? null, campos.ativo ?? true],
    )

  test('lista só os projetos da pessoa, com o motivo, e o filtro separa o apoio', async ({ page }) => {
    // O semeado ("Projeto E2E") tem Ana Souza como responsável.
    await novoProjeto('Projeto de apoio', { responsavel: 'Bruno', apoio: 'Carla, ana  souza' })
    await novoProjeto('Projeto alheio', { responsavel: 'Bruno', apoio: 'Carla' })
    await novoProjeto('Projeto excluído', { responsavel: 'Ana Souza', ativo: false })
    // Uma ação do projeto alheio é da Ana: ele entra por "responsável por ações", e atrasada.
    const [{ id: alheio }] = await consultar<{ id: string }>(`SELECT "id" FROM "Projeto" WHERE "nome" = 'Projeto alheio'`)
    await consultar(
      `INSERT INTO "Acao" ("id","projetoId","numero","descricao","previstoInicio","previstoTermino","responsavelId","updatedAt")
       SELECT $1,$2,1,'Ação da Ana','2026-03-02','2026-03-20',"id",now() FROM "Colaborador" WHERE "clerkUserId" = 'user_e2e'`,
      [crypto.randomUUID(), alheio],
    )

    await page.goto('/')
    await page.getByRole('navigation', { name: 'Navegação principal' }).getByRole('button', { name: 'Pessoas' }).click()
    await page.getByRole('navigation', { name: 'Navegação principal' }).getByRole('link', { name: 'Meus projetos' }).click()
    await expect(page).toHaveURL(/\/meus-projetos$/)
    await expect(page.getByRole('heading', { name: 'Meus projetos' })).toBeVisible()

    const itens = page.getByRole('listitem')
    await expect(itens.filter({ hasText: 'Projeto E2E' })).toContainText('Responsável pelo projeto')
    await expect(itens.filter({ hasText: 'Projeto de apoio' })).toContainText('Apoio')
    await expect(itens.filter({ hasText: 'Projeto alheio' })).toContainText('Responsável por ações: 1')
    await expect(itens.filter({ hasText: 'Projeto alheio' })).toContainText('1 ação sua em atraso')
    await expect(page.getByText('Projeto excluído')).toHaveCount(0)
    await expect(page.getByText('3 projetos')).toBeVisible()
    // Os de ação minha atrasada vêm primeiro.
    await expect(itens.first()).toContainText('Projeto alheio')

    await page.getByRole('link', { name: 'Onde sou apoio' }).click()
    await expect(page).toHaveURL(/filtro=apoio/)
    await expect(page.getByRole('link', { name: 'Projeto de apoio' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Projeto E2E' })).toHaveCount(0)

    await page.getByRole('link', { name: 'Os que eu respondo' }).click()
    await expect(page.getByRole('link', { name: 'Projeto de apoio' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Projeto E2E' })).toBeVisible()
  })

  test('conta sem colaborador é levada ao cadastro antes de ver a tela', async ({ page, context }) => {
    await context.addCookies([{ name: 'e2e_user', value: 'user_sem_cadastro', url: 'http://127.0.0.1:3100' }])
    await page.goto('/meus-projetos')
    await expect(page).toHaveURL(/\/bem-vindo\?volta=/)
    await expect(page.getByRole('heading', { name: 'Quem é você?' })).toBeVisible()
  })
})

test.describe('dashboards em abas', () => {
  test('abre em Gestão, mostra o resumo do que pede atenção e só as seções da aba', async ({ page }) => {
    await page.goto('/dashboards')

    const resumo = page.getByRole('region', { name: 'O que pede atenção' })
    await expect(resumo.getByText('Ações atrasadas')).toBeVisible()
    await expect(resumo.getByText('WINs para promover')).toBeVisible()
    // A ação semeada tem prazo em março: está atrasada.
    await expect(resumo.getByRole('link', { name: /Ações atrasadas/ })).toContainText('1')

    await expect(page.getByRole('link', { name: /^Gestão/ })).toHaveAttribute('aria-current', 'page')
    await expect(page.getByRole('heading', { name: 'Semáforo por equipe' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Panorama geral' })).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Maiores atrasos' })).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Alterações recentes' })).toHaveCount(0)

    // O panorama continua numa aba própria.
    await page.getByRole('link', { name: /^Panorama/ }).click()
    await expect(page).toHaveURL(/aba=panorama/)
    await expect(page.getByRole('heading', { name: 'Panorama geral' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Semáforo por equipe' })).toHaveCount(0)
  })

  test('cada aba mostra os relatórios do seu grupo e o filtro de período a acompanha', async ({ page }) => {
    await page.goto('/dashboards?de=2026-03-01&ate=2026-12-31')
    await page.getByRole('link', { name: /^Prazos/ }).click()

    await expect(page).toHaveURL(/aba=prazos/)
    await expect(page).toHaveURL(/de=2026-03-01/) // o período acompanha a troca de aba
    await expect(page.getByRole('heading', { name: 'Aderência ao prazo' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Maiores atrasos' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Próximos vencimentos' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Panorama geral' })).toHaveCount(0)
  })

  test('um número do resumo leva à aba e à seção certas', async ({ page }) => {
    await page.goto('/dashboards')
    await page.getByRole('region', { name: 'O que pede atenção' }).getByRole('link', { name: /Ações atrasadas/ }).click()
    await expect(page).toHaveURL(/aba=prazos#ranking-atrasos/)
    await expect(page.getByRole('heading', { name: 'Maiores atrasos' })).toBeVisible()
  })

  test('"Todas" junta tudo numa página (para imprimir) e aba inválida cai em Gestão', async ({ page }) => {
    await page.goto('/dashboards?aba=todas')
    await expect(page.getByRole('heading', { name: 'Semáforo por equipe' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Panorama geral' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Maiores atrasos' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Alterações recentes' })).toBeVisible()

    await page.goto('/dashboards?aba=nao-existe')
    await expect(page.getByRole('heading', { name: 'Semáforo por equipe' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Maiores atrasos' })).toHaveCount(0)
  })

  test('limpar filtros mantém a aba', async ({ page }) => {
    await page.goto('/dashboards?aba=prazos&de=2026-03-01&ate=2026-03-14')
    await page.getByRole('link', { name: 'Limpar filtros' }).click()
    await expect(page).toHaveURL(/\/dashboards\?aba=prazos$/)
  })
})

test.describe('duplicar ação e modelos de projeto', () => {
  test('duplica a ação: abre a cópia, sem andamento, e a original continua', async ({ page }) => {
    await consultar(`UPDATE "Acao" SET "status" = 'EM_CURSO_50' WHERE "id" = $1`, [acaoId])
    await page.goto(`/projetos/${projetoId}/acoes/${acaoId}/editar`)
    await page.getByRole('button', { name: 'Duplicar esta ação' }).click()

    // Abriu a edição da CÓPIA, não da original.
    await expect(page).toHaveURL(/\/acoes\/[^/]+\/editar$/)
    await expect(page).not.toHaveURL(new RegExp(acaoId))
    await expect(page.getByLabel('Descrição')).toHaveValue('Ação de partida (cópia)')
    await expect(page.getByLabel('Status')).toHaveValue('NAO_INICIADO')
    expect((await consultar('SELECT 1 FROM "Acao" WHERE "projetoId" = $1', [projetoId])).length).toBe(2)
    const [{ status }] = await consultar<{ status: string }>('SELECT "status" FROM "Acao" WHERE "id" = $1', [acaoId])
    expect(status).toBe('EM_CURSO_50')
  })

  test('salva o projeto como modelo e cria outro projeto com as datas recalculadas', async ({ page }) => {
    await consultar(
      `INSERT INTO "Acao" ("id","projetoId","numero","descricao","previstoInicio","previstoTermino","updatedAt")
       VALUES ($1,$2,2,'Segunda etapa','2026-03-23','2026-03-27',now())`,
      [crypto.randomUUID(), projetoId],
    )

    await page.goto(`/projetos/${projetoId}`)
    await page.getByRole('link', { name: 'Salvar como modelo' }).click()
    await page.getByLabel('Nome do modelo').fill('Ciclo trimestral')
    await page.getByRole('button', { name: 'Salvar como modelo' }).click()

    await expect(page).toHaveURL(/\/modelos\?salvo=/)
    await expect(page.getByText('Modelo salvo.')).toBeVisible()
    const item = page.getByRole('listitem').filter({ hasText: 'Ciclo trimestral' })
    await expect(item).toContainText('2 ações')

    await item.getByRole('link', { name: 'Usar este modelo' }).click()
    await expect(page.getByText('As 2 ações que o modelo cria')).toBeVisible()
    await page.getByLabel('Nome do projeto').fill('Ciclo do 3º trimestre')
    await page.getByLabel('Data de início do projeto').fill('2026-07-06')
    await page.getByRole('button', { name: 'Criar projeto com as ações do modelo' }).click()

    await expect(page).toHaveURL(/\/projetos\/[^/]+$/)
    await expect(page.getByRole('heading', { name: 'Ciclo do 3º trimestre' })).toBeVisible()
    const acoes = await consultar<{ numero: number; i: string; t: string }>(
      `SELECT a."numero", to_char(a."previstoInicio",'YYYY-MM-DD') AS i, to_char(a."previstoTermino",'YYYY-MM-DD') AS t
       FROM "Acao" a JOIN "Projeto" p ON p."id" = a."projetoId" WHERE p."nome" = 'Ciclo do 3º trimestre' ORDER BY a."numero"`,
    )
    // Origem: 02/03→20/03 (15 úteis) e 23/03→27/03, 15 úteis depois. Em 06/07/2026: 06/07→24/07 e 27/07→31/07.
    expect(acoes).toEqual([
      { numero: 1, i: '2026-07-06', t: '2026-07-24' },
      { numero: 2, i: '2026-07-27', t: '2026-07-31' },
    ])
  })

  test('o modelo some da lista ao excluir, e o Leitor não vê as ações de criar nem excluir', async ({ page }) => {
    await page.goto(`/projetos/${projetoId}/modelo`)
    await page.getByLabel('Nome do modelo').fill('Para excluir')
    await page.getByRole('button', { name: 'Salvar como modelo' }).click()
    await expect(page.getByText('Modelo salvo.')).toBeVisible()

    await consultar(`UPDATE "Colaborador" SET "somenteLeitura" = true WHERE "clerkUserId" = 'user_e2e'`)
    await page.goto('/modelos')
    await expect(page.getByText('Para excluir')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Usar este modelo' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /Excluir o modelo/ })).toHaveCount(0)
    await page.goto(`/projetos/${projetoId}/modelo`)
    await expect(page.getByText('Seu perfil é somente leitura.')).toBeVisible()

    await consultar(`UPDATE "Colaborador" SET "somenteLeitura" = false WHERE "clerkUserId" = 'user_e2e'`)
    await page.goto('/modelos')
    page.once('dialog', (d) => d.accept())
    await page.getByRole('button', { name: 'Excluir o modelo Para excluir' }).click()
    await expect(page.getByText('Nenhum modelo ainda.')).toBeVisible()
  })
})

test.describe('primeiro acesso', () => {
  const novaConta = (context: import('@playwright/test').BrowserContext, usuario: string) =>
    context.addCookies([{ name: 'e2e_user', value: usuario, url: 'http://127.0.0.1:3100' }])

  test('quem entra pelo link de um projeto sem cadastro se cadastra e volta ao projeto', async ({ page, context }) => {
    await novaConta(context, 'user_nova')
    await page.goto(`/projetos/${projetoId}`)

    await expect(page).toHaveURL(new RegExp(`/bem-vindo\\?volta=%2Fprojetos%2F${projetoId}$`))
    await expect(page.getByRole('heading', { name: 'Bem-vindo ao sistema' })).toBeVisible()
    // O conteúdo do projeto não foi servido antes do cadastro.
    await expect(page.getByText('Projeto E2E')).toHaveCount(0)

    await page.getByLabel('Seu nome').fill('Marina Duarte')
    await page.getByRole('button', { name: 'Cadastrar e continuar' }).click()

    await expect(page).toHaveURL(new RegExp(`/projetos/${projetoId}$`))
    await expect(page.getByRole('heading', { name: 'Projeto E2E' })).toBeVisible()
    const [{ nome }] = await consultar<{ nome: string }>(`SELECT "nome" FROM "Colaborador" WHERE "clerkUserId" = 'user_nova'`)
    expect(nome).toBe('Marina Duarte')

    // Já cadastrada, não é desviada de novo.
    await page.goto('/dashboards')
    await expect(page).toHaveURL(/\/dashboards$/)
  })

  test('quem já está na lista (veio da planilha) se vincula pelo cadastro existente, sem duplicar', async ({ page, context }) => {
    await consultar(`INSERT INTO "Colaborador" ("id","nome","updatedAt") VALUES ($1,'Carlos Lima',now())`, [crypto.randomUUID()])
    await novaConta(context, 'user_carlos')
    await page.goto('/')

    await expect(page).toHaveURL(/\/bem-vindo$/)
    await page.getByLabel('Colaborador').selectOption({ label: 'Carlos Lima' })
    await page.getByRole('button', { name: 'Vincular' }).click()

    await expect(page).toHaveURL(/\/$/)
    const linhas = await consultar<{ clerkUserId: string }>(`SELECT "clerkUserId" FROM "Colaborador" WHERE "nome" = 'Carlos Lima'`)
    expect(linhas).toEqual([{ clerkUserId: 'user_carlos' }])
  })

  test('quem já tem cadastro e abre /bem-vindo segue para onde ia', async ({ page }) => {
    await page.goto(`/bem-vindo?volta=${encodeURIComponent('/dashboards')}`)
    await expect(page).toHaveURL(/\/dashboards$/)
  })

  test('o endereço de volta só aceita caminho interno', async ({ page, context }) => {
    await novaConta(context, 'user_nova2')
    await page.goto('/bem-vindo?volta=https%3A%2F%2Fevil.example%2Fx')
    await page.getByLabel('Seu nome').fill('Pessoa Nova')
    await page.getByRole('button', { name: 'Cadastrar e continuar' }).click()
    await expect(page).toHaveURL(/127\.0\.0\.1:3100\/$/)
  })

  test('as telas de entrar e criar conta explicam o acesso e levam o link de volta', async ({ page }) => {
    const volta = `/projetos/${projetoId}`
    await page.goto(`/entrar?redirect_url=${encodeURIComponent(volta)}`)
    await expect(page.getByRole('heading', { name: 'Este conteúdo é restrito à CTCEA' })).toBeVisible()
    await expect(page.getByText('@ctcea.org.br').first()).toBeVisible()
    await expect(page.getByRole('link', { name: 'Criar conta' })).toHaveAttribute('href', `/cadastrar?redirect_url=${encodeURIComponent(volta)}`)

    await page.goto(`/cadastrar?redirect_url=${encodeURIComponent(volta)}`)
    await expect(page.getByRole('heading', { name: 'Criar a sua conta' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Entrar' })).toHaveAttribute('href', `/entrar?redirect_url=${encodeURIComponent(volta)}`)
  })

  test('destino de outro domínio no redirect_url é descartado', async ({ page }) => {
    await page.goto('/entrar?redirect_url=https%3A%2F%2Fevil.example%2Fx')
    await expect(page.getByRole('link', { name: 'Criar conta' })).toHaveAttribute('href', '/cadastrar')
  })
})

test.describe('dependência entre ações', () => {
  test('bloqueia o início, e o líder do projeto libera', async ({ page }) => {
    const [{ id: acaoB }] = await consultar<{ id: string }>(
      `INSERT INTO "Acao" ("id","projetoId","numero","descricao","updatedAt")
       VALUES (gen_random_uuid()::text,$1,2,'Ação dependente',now()) RETURNING "id"`,
      [projetoId],
    )
    await page.goto(`/projetos/${projetoId}/acoes/${acaoB}/editar?aba=dependencias`)

    await page.locator('#dependencia-predecessora').selectOption({ index: 1 })
    await page.getByRole('button', { name: 'Adicionar', exact: true }).click()
    await expect(page.getByRole('link', { name: 'ação 1', exact: true })).toBeVisible()
    await expect(page.getByRole('status').filter({ hasText: 'Bloqueada.' })).toBeVisible()

    // Iniciar é recusado, com o número da predecessora, e nada é gravado.
    await page.locator('#status').selectOption('EM_CURSO_25')
    await page.getByRole('button', { name: 'Salvar alterações' }).click()
    await expect(page.getByText(/depende da ação #1/)).toBeVisible()
    const statusDaB = async () =>
      (await consultar<{ status: string }>('SELECT "status" FROM "Acao" WHERE "id" = $1', [acaoB]))[0].status
    expect(await statusDaB()).toBe('NAO_INICIADO')

    // Ana é a responsável pelo projeto: libera direto, com motivo.
    await page.locator('#liberacao-motivo').fill('O material já chegou; dá para começar')
    await page.getByRole('button', { name: 'Liberar', exact: true }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Liberada pelo líder.' })).toBeVisible()

    await page.locator('#status').selectOption('EM_CURSO_25')
    await page.getByRole('button', { name: 'Salvar alterações' }).click()
    await expect.poll(statusDaB).toBe('EM_CURSO_25')
  })
})

test.describe('manual e tour', () => {
  test('o manual abre, lista as novidades e a busca filtra', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Ajuda e preferências' }).click()
    await page.getByRole('link', { name: 'Manual', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Manual do usuário' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Novidades' })).toBeVisible()

    await page.getByLabel('Buscar no manual').fill('liberar')
    await page.getByRole('button', { name: 'Buscar' }).click()
    await expect(page.getByRole('heading', { name: 'Dependência entre ações e liberação de início' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Modelos de projeto' })).toHaveCount(0)

    await page.getByLabel('Buscar no manual').fill('zzzinexistente')
    await page.getByRole('button', { name: 'Buscar' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Nada encontrado' })).toBeVisible()
  })

  test('o convite do tour aparece uma vez, o tour percorre os passos e Esc sai', async ({ page }) => {
    await page.goto('/')
    const convite = page.getByRole('region', { name: 'Convite para o tour' })
    await expect(convite).toBeVisible()
    await convite.getByRole('button', { name: 'Fazer o tour' }).click()

    const balao = page.getByRole('dialog')
    await expect(balao).toContainText('Passo 1 de')
    await balao.getByRole('button', { name: 'Próximo' }).click()
    await expect(balao).toContainText('Painel')
    await page.keyboard.press('ArrowRight')
    await expect(balao).toContainText('Trabalho')
    await expect(balao).toContainText('Priorização')
    await page.keyboard.press('ArrowLeft')
    await expect(balao).toContainText('Painel')
    await page.keyboard.press('Escape')
    await expect(balao).toHaveCount(0)

    // Visto: recarregar não oferece de novo, mas "Ajuda e preferências" refaz o tour.
    await page.reload()
    await expect(page.getByRole('region', { name: 'Convite para o tour' })).toHaveCount(0)
    await page.getByRole('button', { name: 'Ajuda e preferências' }).click()
    await page.locator('#menu-ajuda').getByRole('button', { name: 'Fazer o tour' }).click()
    await expect(page.getByRole('dialog')).toContainText('Bem-vindo')
  })
})

test.describe('menu por perfil', () => {
  const tornarAdministradora = (clerk: string) =>
    consultar(`UPDATE "Colaborador" SET "administrador" = true WHERE "clerkUserId" = $1`, [clerk])

  test('quem não administra não vê a Administração, nem no menu nem no tour', async ({ page }) => {
    // Existe outro administrador: a conta de teste (Ana) é só Colaboradora.
    await consultar(
      `INSERT INTO "Colaborador" ("id","nome","clerkUserId","administrador","updatedAt")
       VALUES (gen_random_uuid()::text,'Chefe Admin','user_chefe',true,now())`,
    )
    await page.goto('/')
    const menu = page.getByRole('navigation', { name: 'Navegação principal' })
    await menu.getByRole('button', { name: 'Trabalho' }).click()
    await expect(menu.getByRole('link', { name: 'Modelos' })).toBeVisible()
    await expect(menu.getByRole('button', { name: 'Administração' })).toHaveCount(0)
    await expect(menu.getByRole('link', { name: 'Colaboradores' })).toHaveCount(0)

    await page.goto('/administracao')
    await expect(page.getByText('Só administradores acessam esta área.')).toBeVisible()

    await page.getByRole('button', { name: 'Ajuda e preferências' }).click()
    await page.locator('#menu-ajuda').getByRole('button', { name: 'Fazer o tour' }).click()
    await expect(page.getByRole('dialog')).toContainText('Passo 1 de 7')

    // O manual também esconde o que é só do administrador.
    await page.goto('/manual?busca=Administra%C3%A7%C3%A3o')
    await expect(page.getByRole('heading', { name: 'Área de Administração' })).toHaveCount(0)
  })

  test('o administrador vê a área, o menu dela e o passo extra do tour', async ({ page }) => {
    await tornarAdministradora('user_e2e')
    await page.goto('/')
    // O administrador recebe o resumo semanal ao entrar: dispensa o popup.
    await page.getByRole('dialog').getByRole('button', { name: 'Fechar' }).click()
    const menuAdmin = page.getByRole('navigation', { name: 'Navegação principal' })
    await menuAdmin.getByRole('button', { name: 'Administração' }).click()
    // O grupo traz a visão geral e as ferramentas.
    await expect(menuAdmin.getByRole('link', { name: 'Lixeira' })).toBeVisible()
    await menuAdmin.getByRole('link', { name: 'Visão geral' }).click()
    await expect(page).toHaveURL(/\/administracao$/)

    const lista = page.getByRole('main')
    for (const nome of ['Colaboradores', 'Pesos da priorização', 'Resumo semanal', 'Lixeira', 'Painel do sistema', 'Registro de erros']) {
      await expect(lista.getByRole('link', { name: nome, exact: true }).first()).toBeVisible()
    }

    // A barra da administração acompanha as telas dela.
    await page.goto('/colaboradores')
    await expect(page.getByRole('navigation', { name: 'Administração' })).toBeVisible()

    await page.getByRole('button', { name: 'Ajuda e preferências' }).click()
    await page.locator('#menu-ajuda').getByRole('button', { name: 'Fazer o tour' }).click()
    await expect(page.getByRole('dialog')).toContainText('Passo 1 de 8')

    await page.goto('/manual?busca=Administra%C3%A7%C3%A3o')
    await expect(page.getByRole('heading', { name: 'Área de Administração' })).toBeVisible()
  })
})

test.describe('líder do projeto na lista', () => {
  test('o projeto antigo vem com o líder pré-selecionado e o novo grava o id', async ({ page }) => {
    // O semeado tem o responsável digitado ("Ana Souza"): casa com a Ana do cadastro.
    await page.goto(`/projetos/${projetoId}/editar`)
    await expect(page.getByLabel('Responsável (líder do projeto)')).toHaveValue(/^c:/)

    await page.getByRole('button', { name: 'Salvar alterações' }).click()
    await expect(page.getByText('Alterações do projeto')).toBeVisible()
    const [ligado] = await consultar<{ liderId: string | null }>(
      `SELECT "liderId" FROM "Projeto" WHERE "id" = $1`,
      [projetoId],
    )
    expect(ligado.liderId).not.toBeNull()

    await page.goto('/projetos/novo')
    await page.locator('#nome').fill('Projeto com líder da lista')
    await page.getByLabel('Responsável (líder do projeto)').selectOption({ label: 'Ana Souza' })
    await page.getByRole('button', { name: 'Salvar projeto' }).click()
    await expect(page.getByText('criado.')).toBeVisible()
    const [novo] = await consultar<{ liderId: string | null; responsavel: string | null }>(
      `SELECT "liderId","responsavel" FROM "Projeto" WHERE "nome" = 'Projeto com líder da lista'`,
    )
    expect(novo.liderId).not.toBeNull()
    expect(novo.responsavel).toBe('Ana Souza')
  })
})

test.describe('editor de modelos', () => {
  test('cria um modelo do zero, edita, usa e exclui com confirmação', async ({ page }) => {
    await page.goto('/modelos')
    await page.getByRole('link', { name: 'Novo modelo' }).click()

    await page.getByLabel('Nome do modelo *').fill('Rotina de teste')
    await page.getByLabel('Equipe', { exact: true }).fill('STI')
    await page.getByLabel('Descrição da ação 1').fill('Preparar o ambiente')
    await page.getByLabel('Começa no dia').first().fill('0')
    await page.getByLabel('Dura (dias)').first().fill('3')

    await page.getByRole('button', { name: '+ Adicionar ação' }).click()
    // A nova linha já sugere o início logo depois do término da anterior.
    await expect(page.getByLabel('Começa no dia').nth(1)).toHaveValue('3')
    await page.getByLabel('Descrição da ação 2').fill('Executar a rotina')
    await page.getByLabel('Dura (dias)').nth(1).fill('5')
    await expect(page.getByRole('status').filter({ hasText: 'duração total de 8 dias úteis' })).toBeVisible()

    await page.getByRole('button', { name: 'Criar modelo' }).click()
    await expect(page.getByText('Modelo salvo.')).toBeVisible()
    const [modelo] = await consultar<{ id: string; equipe: string | null; criadoPor: string }>(
      `SELECT "id","equipe","criadoPor" FROM "ModeloProjeto" WHERE "nome" = 'Rotina de teste'`,
    )
    expect(modelo.equipe).toBe('STI')
    const acoes = await consultar<{ ordem: number; descricao: string; inicioDiasUteis: number; duracaoDiasUteis: number }>(
      `SELECT "ordem","descricao","inicioDiasUteis","duracaoDiasUteis" FROM "ModeloAcao" WHERE "modeloId" = $1 ORDER BY "ordem"`,
      [modelo.id],
    )
    expect(acoes).toEqual([
      { ordem: 1, descricao: 'Preparar o ambiente', inicioDiasUteis: 0, duracaoDiasUteis: 3 },
      { ordem: 2, descricao: 'Executar a rotina', inicioDiasUteis: 3, duracaoDiasUteis: 5 },
    ])

    // Editar: troca a ordem das ações e renomeia.
    await page.getByRole('link', { name: 'Editar' }).click()
    await page.getByLabel('Nome do modelo *').fill('Rotina de teste (v2)')
    await page.getByRole('button', { name: 'Descer a ação 1' }).click()
    await page.getByRole('button', { name: 'Salvar alterações' }).click()
    await expect(page.getByText('Modelo salvo.')).toBeVisible()
    const depois = await consultar<{ descricao: string }>(
      `SELECT "descricao" FROM "ModeloAcao" WHERE "modeloId" = $1 ORDER BY "ordem"`,
      [modelo.id],
    )
    expect(depois.map((a) => a.descricao)).toEqual(['Executar a rotina', 'Preparar o ambiente'])
    await page.getByText('Ver as ações').click()
    await expect(page.getByText('Executar a rotina')).toBeVisible()

    // Excluir pede confirmação: cancelar não exclui.
    page.once('dialog', (d) => d.dismiss())
    await page.getByRole('button', { name: /Excluir o modelo Rotina de teste/ }).click()
    await expect(page.getByText('Rotina de teste (v2)')).toBeVisible()
    page.once('dialog', (d) => d.accept())
    await page.getByRole('button', { name: /Excluir o modelo Rotina de teste/ }).click()
    await expect(page.getByText('Nenhum modelo ainda.')).toBeVisible()
  })

  test('mostra o erro da linha e não perde o que foi digitado', async ({ page }) => {
    await page.goto('/modelos/novo')
    await page.getByLabel('Nome do modelo *').fill('Com erro')
    await page.getByLabel('Descrição da ação 1').fill('Ação sem duração')
    await page.getByLabel('Dura (dias)').first().fill('')
    await page.getByRole('button', { name: 'Criar modelo' }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'Informe o início e a duração' })).toBeVisible()
    await expect(page.getByLabel('Nome do modelo *')).toHaveValue('Com erro')
    await expect(page.getByLabel('Descrição da ação 1')).toHaveValue('Ação sem duração')
    expect((await consultar(`SELECT 1 FROM "ModeloProjeto"`)).length).toBe(0)
  })
})

test.describe('resumo semanal', () => {
  const tornarAdministradora = () =>
    consultar(`UPDATE "Colaborador" SET "administrador" = true WHERE "clerkUserId" = 'user_e2e'`)

  test('o administrador vê o popup ao entrar, dispensa, e o resumo completo e o sino têm o aviso', async ({ page }) => {
    await tornarAdministradora()
    await page.goto('/')

    const popup = page.getByRole('dialog', { name: 'Resumo da semana' })
    await expect(popup).toBeVisible()
    // A ação semeada (previsto em março) está atrasada, na equipe STI.
    await expect(popup.getByRole('row', { name: /STI/ })).toBeVisible()
    await popup.getByRole('button', { name: 'Fechar' }).click()
    await expect(popup).toHaveCount(0)

    // Dispensado: não volta em outra entrada.
    await page.goto('/projetos')
    await expect(page.getByRole('dialog', { name: 'Resumo da semana' })).toHaveCount(0)

    // A tela completa lista a ação atrasada, com link para ela.
    await page.goto('/resumo-semanal')
    await expect(page.getByRole('heading', { name: 'Resumo semanal' })).toBeVisible()
    await expect(page.getByRole('heading', { name: /Atrasadas \(1\)/ })).toBeVisible()
    await expect(page.getByRole('link', { name: /Projeto E2E · ação 1/ })).toBeVisible()

    // O aviso fica nas notificações, já lido.
    await page.goto('/notificacoes')
    await expect(page.getByText('Resumo semanal', { exact: true }).first()).toBeVisible()
  })

  test('"Ver o resumo completo" abre a tela e some o popup; Esc também dispensa', async ({ page }) => {
    await tornarAdministradora()
    await page.goto('/')
    await page.getByRole('link', { name: 'Ver o resumo completo' }).click()
    await expect(page).toHaveURL(/\/resumo-semanal\?semana=/)
    await expect(page.getByRole('dialog', { name: 'Resumo da semana' })).toHaveCount(0)

    // Já lido ao abrir a tela: na entrada seguinte não há popup.
    await page.goto('/')
    await expect(page.getByRole('dialog', { name: 'Resumo da semana' })).toHaveCount(0)
  })

  test('colaborador não vê o popup nem a tela, e sem administrador ninguém recebe', async ({ page }) => {
    // Sem nenhum administrador (estado inicial): ninguém recebe popup.
    await page.goto('/')
    await expect(page.getByRole('dialog', { name: 'Resumo da semana' })).toHaveCount(0)

    // Com outro administrador, a conta de teste é só Colaboradora.
    await consultar(
      `INSERT INTO "Colaborador" ("id","nome","clerkUserId","administrador","updatedAt")
       VALUES (gen_random_uuid()::text,'Chefe','user_chefe',true,now())`,
    )
    await page.goto('/')
    await expect(page.getByRole('dialog', { name: 'Resumo da semana' })).toHaveCount(0)
    await page.goto('/resumo-semanal')
    await expect(page.getByText('Só administradores acessam o resumo semanal.')).toBeVisible()
  })

  test('Esc dispensa o popup', async ({ page }) => {
    await tornarAdministradora()
    await page.goto('/')
    const popup = page.getByRole('dialog', { name: 'Resumo da semana' })
    await expect(popup).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(popup).toHaveCount(0)
    await page.goto('/projetos')
    await expect(page.getByRole('dialog', { name: 'Resumo da semana' })).toHaveCount(0)
  })
})

test.describe('reunião', () => {
  test('mostra as telas da daily, filtra por equipe e sai com Esc', async ({ page }) => {
    // Uma mudança de data prevista recente, para a tela de replanejadas.
    await consultar(
      `INSERT INTO "HistoricoAlteracao" ("id","acaoId","campo","valorAntigo","valorNovo","alteradoEm","alteradoPor")
       VALUES (gen_random_uuid()::text,$1,'previstoTermino','2026-03-10','2026-03-20',now(),'user_e2e')`,
      [acaoId],
    )
    await page.goto('/reuniao')

    await expect(page.getByRole('heading', { name: 'Panorama' })).toBeVisible()
    await expect(page.getByText('Ações atrasadas')).toBeVisible()
    await expect(page.getByRole('status').filter({ hasText: 'Tela 1 de 6' })).toBeVisible()

    await page.keyboard.press('ArrowRight')
    await expect(page.getByRole('heading', { name: /Atrasadas/ })).toBeVisible()
    await expect(page.getByText('Projeto E2E')).toBeVisible()
    await expect(page.getByText('Ação de partida')).toBeVisible()

    await page.keyboard.press('ArrowRight')
    await expect(page.getByRole('heading', { name: /Vencem nos próximos 7 dias/ })).toBeVisible()
    await expect(page.getByText('Nada vence nos próximos 7 dias.')).toBeVisible()

    await page.keyboard.press('ArrowRight')
    await expect(page.getByRole('heading', { name: /Replanejadas na semana/ })).toBeVisible()
    await expect(page.getByText('término: 10/03 → 20/03')).toBeVisible()
    await expect(page.getByText(/por Ana Souza/)).toBeVisible()

    await page.keyboard.press('ArrowLeft')
    await expect(page.getByRole('heading', { name: /Vencem nos próximos 7 dias/ })).toBeVisible()

    // Equipe: STI tem o projeto; outra equipe não tem nada.
    await page.getByRole('navigation', { name: 'Equipe' }).getByRole('link', { name: 'STI' }).click()
    await expect(page).toHaveURL(/equipe=STI/)
    await page.keyboard.press('ArrowRight')
    await expect(page.getByText('Projeto E2E')).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(page).toHaveURL(/127\.0\.0\.1:3100\/$/)
  })

  test('o Leitor também vê, e equipe inexistente vira todas', async ({ page }) => {
    await consultar(`UPDATE "Colaborador" SET "somenteLeitura" = true WHERE "clerkUserId" = 'user_e2e'`)
    await page.goto('/reuniao?equipe=NaoExiste')
    await expect(page.getByRole('heading', { name: 'Panorama' })).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Equipe' }).getByRole('link', { name: 'Todas as equipes' })).toHaveAttribute('aria-current', 'true')
  })
})

test.describe('riscos e bloqueios', () => {
  test('registra, aparece no projeto e na reunião, e resolver tira da lista de abertos', async ({ page }) => {
    await page.goto(`/projetos/${projetoId}`)
    await expect(page.getByText('Nenhum risco ou bloqueio aberto neste projeto.')).toBeVisible()

    await page.getByRole('link', { name: 'Registrar risco ou bloqueio' }).click()
    await expect(page).toHaveURL(/\/riscos\/novo$/)
    await page.getByRole('radio', { name: /Bloqueio/ }).check()
    await page.getByLabel('Título *').fill('Servidor sem acesso à rede')
    await page.getByLabel('Impacto *').selectOption('ALTO')
    await page.getByLabel('Responsável pelo tratamento').selectOption({ label: 'Ana Souza' })
    await page.getByLabel('Ação afetada').selectOption({ index: 1 })
    await page.getByLabel('Prazo para tratar').fill('2026-03-01')
    await page.getByLabel('Plano de ação (o que será feito)').fill('Abrir chamado com a infraestrutura')
    await page.getByRole('button', { name: 'Registrar' }).click()

    // Volta ao projeto, na seção; prazo no passado = vencido.
    await expect(page).toHaveURL(new RegExp(`/projetos/${projetoId}#riscos`))
    const secao = page.getByRole('region', { name: /Riscos e bloqueios/ })
    await expect(secao.getByText('Servidor sem acesso à rede')).toBeVisible()
    await expect(secao.getByText('(vencido)')).toBeVisible()
    await expect(secao.getByText('Plano: Abrir chamado com a infraestrutura')).toBeVisible()

    // A ação afetada mostra o registro na sua tela.
    await page.goto(`/projetos/${projetoId}/acoes/${acaoId}/editar?aba=riscos`)
    await expect(page.getByRole('link', { name: /Bloqueio: Servidor sem acesso à rede/ })).toBeVisible()

    // Reunião: tela de riscos, e o Panorama conta 1.
    await page.goto('/reuniao')
    await expect(page.getByText('Riscos e bloqueios abertos')).toBeVisible()
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowRight')
    await expect(page.getByRole('heading', { name: /Riscos e bloqueios abertos/ })).toBeVisible()
    await expect(page.getByText('Servidor sem acesso à rede')).toBeVisible()

    // Resolver: sai dos abertos, vai para "Resolvidos ou ocorridos", e o histórico registra.
    await page.goto(`/projetos/${projetoId}`)
    await page.getByRole('link', { name: 'Editar' }).last().click()
    await page.getByLabel('Status').selectOption('RESOLVIDO')
    await page.getByRole('button', { name: 'Salvar alterações' }).click()
    await expect(page.getByText('Nenhum risco ou bloqueio aberto neste projeto.')).toBeVisible()
    await page.getByText(/Resolvidos ou ocorridos/).click()
    await expect(page.getByText('Servidor sem acesso à rede')).toBeVisible()
    await page.getByRole('link', { name: 'Editar' }).last().click()
    await expect(page.getByRole('heading', { name: 'Histórico' })).toBeVisible()
    const mudanca = page.locator('section[aria-labelledby="titulo-historico-risco"] li').first()
    await expect(mudanca).toContainText('Status')
    await expect(mudanca).toContainText('Aberto')
    await expect(mudanca).toContainText('Resolvido')
  })

  test('o Leitor vê os registros, mas não tem como registrar', async ({ page }) => {
    await consultar(
      `INSERT INTO "RiscoProjeto" ("id","projetoId","tipo","titulo","impacto","status","criadoPor","atualizadoEm")
       VALUES (gen_random_uuid()::text,$1,'RISCO','Risco existente','MEDIO','ABERTO','user_outro',now())`,
      [projetoId],
    )
    await consultar(`UPDATE "Colaborador" SET "somenteLeitura" = true WHERE "clerkUserId" = 'user_e2e'`)
    await page.goto(`/projetos/${projetoId}`)
    await expect(page.getByText('Risco existente')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Registrar risco ou bloqueio' })).toHaveCount(0)
    await page.goto(`/projetos/${projetoId}/riscos/novo`)
    await expect(page.getByText('Seu perfil é somente leitura.')).toBeVisible()
  })
})

test.describe('motivo do replanejamento', () => {
  test('mudar a data prevista pede o motivo, grava e aparece no histórico e na reunião', async ({ page }) => {
    await page.goto(`/projetos/${projetoId}/acoes/${acaoId}/editar`)
    // Sem mudar a data, o motivo não aparece.
    await expect(page.getByText('Por que a data prevista mudou?')).toHaveCount(0)

    await page.locator('#previstoTermino').fill('2026-04-10')
    await expect(page.getByText('Por que a data prevista mudou?')).toBeVisible()

    // Sem motivo, não salva.
    await page.getByRole('button', { name: 'Salvar alterações' }).click()
    await expect(page.getByText('Informe o motivo da mudança de data.')).toBeVisible()
    const termino = async () =>
      (await consultar<{ t: string }>(`SELECT to_char("previstoTermino",'YYYY-MM-DD') AS t FROM "Acao" WHERE "id" = $1`, [acaoId]))[0].t
    expect(await termino()).toBe('2026-03-20')

    // "Outro" exige o detalhe; com um motivo da lista, salva.
    await page.getByLabel('Motivo *').selectOption('OUTRO')
    await page.getByRole('button', { name: 'Salvar alterações' }).click()
    await expect(page.getByText('Em "Outro", explique o motivo no detalhe.')).toBeVisible()
    await page.getByLabel('Motivo *').selectOption('DEPENDENCIA_EXTERNA')
    await page.getByLabel(/Detalhe/).fill('Fornecedor atrasou o material')
    await page.getByRole('button', { name: 'Salvar alterações' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Alterações salvas.' })).toBeVisible()
    expect(await termino()).toBe('2026-04-10')

    // Depois de salvar, a base é a nova data: o bloco some até mexer de novo.
    await expect(page.getByText('Por que a data prevista mudou?')).toHaveCount(0)

    // O histórico mostra o motivo, e a reunião também.
    await expect(page.getByText('Motivo: Dependência externa — Fornecedor atrasou o material')).toBeVisible()
    await page.goto('/reuniao')
    for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight')
    await expect(page.getByRole('heading', { name: /Replanejadas na semana/ })).toBeVisible()
    await expect(page.getByText(/Dependência externa — Fornecedor atrasou o material/)).toBeVisible()
  })

  test('criar a primeira data de uma ação não pede motivo', async ({ page }) => {
    const [{ id: semData }] = await consultar<{ id: string }>(
      `INSERT INTO "Acao" ("id","projetoId","numero","descricao","updatedAt")
       VALUES (gen_random_uuid()::text,$1,2,'Sem datas',now()) RETURNING "id"`,
      [projetoId],
    )
    await page.goto(`/projetos/${projetoId}/acoes/${semData}/editar`)
    await page.locator('#previstoInicio').fill('2026-05-04')
    await page.locator('#previstoTermino').fill('2026-05-08')
    await expect(page.getByText('Por que a data prevista mudou?')).toHaveCount(0)
    await page.getByRole('button', { name: 'Salvar alterações' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Alterações salvas.' })).toBeVisible()
  })

  test('o lote que remarca datas pede um motivo só, na confirmação', async ({ page }) => {
    await page.goto(`/projetos/${projetoId}/lote`)
    await page.getByRole('button', { name: 'Marcar todas' }).click()
    await page.getByLabel('Dias úteis').fill('2')
    await page.getByRole('button', { name: 'Ver prévia' }).click()
    await expect(page.getByText(/Por que as datas previstas mudam\?/)).toBeVisible()

    await page.getByRole('button', { name: /Confirmar e gravar/ }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'Informe o motivo da mudança de data.' })).toBeVisible()
    expect((await consultar('SELECT 1 FROM "HistoricoAlteracao"')).length).toBe(0)

    await page.getByLabel('Motivo *').selectOption('PRIORIDADE')
    await page.getByRole('button', { name: /Confirmar e gravar/ }).click()
    await expect(page.getByText(/ação alterada|ações alteradas/)).toBeVisible()
    const [{ motivo }] = await consultar<{ motivo: string | null }>(
      `SELECT "motivo" FROM "HistoricoAlteracao" WHERE "acaoId" = $1 AND "campo" = 'previstoTermino'`,
      [acaoId],
    )
    expect(motivo).toBe('PRIORIDADE')
  })
})

test.describe('lixeira de projetos', () => {
  const tornarAdministradora = () =>
    consultar(`UPDATE "Colaborador" SET "administrador" = true WHERE "clerkUserId" = 'user_e2e'`)

  test('o administrador vê o excluído, restaura com confirmação e o projeto volta à lista', async ({ page }) => {
    await tornarAdministradora()
    await consultar(
      `UPDATE "Projeto" SET "ativo" = false, "excluidoEm" = now(), "excluidoPor" = 'user_e2e' WHERE "id" = $1`,
      [projetoId],
    )
    // Sem o resumo semanal no caminho: dispensa o popup do administrador.
    await page.goto('/')
    await page.getByRole('dialog', { name: 'Resumo da semana' }).getByRole('button', { name: 'Fechar' }).click()
    await expect(page.getByRole('link', { name: 'Projeto E2E' })).toHaveCount(0)

    await page.goto('/administracao/lixeira')
    await expect(page.getByRole('heading', { name: 'Lixeira' })).toBeVisible()
    await expect(page.getByText('Projeto E2E')).toBeVisible()
    await expect(page.getByText(/Excluído em .* por Ana Souza/)).toBeVisible()
    await expect(page.getByText('1 ação')).toBeVisible()

    // Cancelar não restaura.
    page.once('dialog', (d) => d.dismiss())
    await page.getByRole('button', { name: 'Restaurar o projeto Projeto E2E' }).click()
    await expect(page.getByText('Projeto E2E')).toBeVisible()

    page.once('dialog', (d) => d.accept())
    await page.getByRole('button', { name: 'Restaurar o projeto Projeto E2E' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'restaurado.' })).toBeVisible()
    await expect(page.getByText('A lixeira está vazia.')).toBeVisible()

    await page.goto('/projetos')
    await expect(page.getByRole('link', { name: 'Projeto E2E' }).first()).toBeVisible()
    const [{ ativo, restauradoPor }] = await consultar<{ ativo: boolean; restauradoPor: string | null }>(
      `SELECT "ativo","restauradoPor" FROM "Projeto" WHERE "id" = $1`,
      [projetoId],
    )
    expect(ativo).toBe(true)
    expect(restauradoPor).toBe('user_e2e')
  })

  test('projeto excluído antes do registro aparece como "data não registrada"; lixeira vazia avisa', async ({ page }) => {
    await tornarAdministradora()
    await page.goto('/administracao/lixeira')
    await page.getByRole('dialog', { name: 'Resumo da semana' }).getByRole('button', { name: 'Fechar' }).click()
    await expect(page.getByText('A lixeira está vazia.')).toBeVisible()

    await consultar(`UPDATE "Projeto" SET "ativo" = false WHERE "id" = $1`, [projetoId])
    await page.goto('/administracao/lixeira')
    await expect(page.getByText(/data não registrada/)).toBeVisible()
  })

  test('quem não é administrador não acessa a lixeira', async ({ page }) => {
    await consultar(
      `INSERT INTO "Colaborador" ("id","nome","clerkUserId","administrador","updatedAt")
       VALUES (gen_random_uuid()::text,'Chefe','user_chefe',true,now())`,
    )
    await consultar(`UPDATE "Projeto" SET "ativo" = false WHERE "id" = $1`, [projetoId])
    await page.goto('/administracao/lixeira')
    await expect(page.getByText('Só administradores acessam a lixeira.')).toBeVisible()
    await expect(page.getByText('Projeto E2E')).toHaveCount(0)
  })
})

test.describe('links e anexos da ação', () => {
  test('adiciona, abre em outra aba, edita, remove e mostra o indicador no projeto', async ({ page }) => {
    await page.goto(`/projetos/${projetoId}/acoes/${acaoId}/editar?aba=links`)
    await expect(page.getByText('Nenhum link nesta ação.')).toBeVisible()

    // Endereço perigoso é recusado, e o que foi digitado não se perde.
    await page.getByLabel('Título *', { exact: true }).first().fill('Ata do kickoff')
    await page.getByLabel('Endereço (link) *').fill('javascript:alert(1)')
    await page.getByRole('button', { name: 'Adicionar link' }).click()
    await expect(page.getByText(/começando com https/)).toBeVisible()
    await expect(page.getByLabel('Título *', { exact: true }).first()).toHaveValue('Ata do kickoff')

    await page.getByLabel('Endereço (link) *').fill('https://ctcea.sharepoint.com/sites/x/ata.pdf')
    await page.locator('#link-novo-tipo').selectOption('ATA')
    await page.getByRole('button', { name: 'Adicionar link' }).click()

    const link = page.getByRole('link', { name: /Ata do kickoff/ })
    await expect(link).toBeVisible()
    await expect(link).toHaveAttribute('href', 'https://ctcea.sharepoint.com/sites/x/ata.pdf')
    await expect(link).toHaveAttribute('target', '_blank')
    await expect(link).toHaveAttribute('rel', /noopener/)
    await expect(page.getByText('ctcea.sharepoint.com', { exact: true })).toBeVisible()
    // O formulário recomeçou vazio.
    await expect(page.locator('#link-novo-titulo')).toHaveValue('')

    // O histórico registra (está noutra aba do contexto da ação).
    await page.getByRole('tab', { name: /Histórico/ }).click()
    await expect(page.getByText('Ata: Ata do kickoff (ctcea.sharepoint.com)')).toBeVisible()

    // O projeto mostra o indicador.
    await page.goto(`/projetos/${projetoId}`)
    await expect(page.getByText('· 1 link')).toBeVisible()

    // Editar.
    await page.goto(`/projetos/${projetoId}/acoes/${acaoId}/editar?aba=links`)
    await page.getByRole('button', { name: 'Editar', exact: true }).click()
    await page.locator('input[name="titulo"]').first().fill('Contrato assinado')
    await page.getByRole('button', { name: 'Salvar', exact: true }).click()
    await expect(page.getByRole('link', { name: /Contrato assinado/ })).toBeVisible()

    // Remover: cancelar não remove, confirmar remove.
    page.once('dialog', (d) => d.dismiss())
    await page.getByRole('button', { name: /Remover o link Contrato assinado/ }).click()
    await expect(page.getByRole('link', { name: /Contrato assinado/ })).toBeVisible()
    page.once('dialog', (d) => d.accept())
    await page.getByRole('button', { name: /Remover o link Contrato assinado/ }).click()
    await expect(page.getByText('Nenhum link nesta ação.')).toBeVisible()
  })

  test('o Leitor vê e abre os links, mas não tem como mexer', async ({ page }) => {
    await consultar(
      `INSERT INTO "LinkAcao" ("id","acaoId","titulo","url","tipo","criadoPor","atualizadoEm")
       VALUES (gen_random_uuid()::text,$1,'Planilha de apoio','https://x.com/p','PLANILHA','user_outro',now())`,
      [acaoId],
    )
    await consultar(`UPDATE "Colaborador" SET "somenteLeitura" = true WHERE "clerkUserId" = 'user_e2e'`)
    await page.goto(`/projetos/${projetoId}/acoes/${acaoId}/editar?aba=links`)
    await expect(page.getByRole('link', { name: /Planilha de apoio/ })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Adicionar link' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Editar', exact: true })).toHaveCount(0)
  })
})

test.describe('dashboards no celular e no tablet', () => {
  const ABAS = ['', 'gestao', 'panorama', 'distribuicao', 'prazos', 'tempo', 'qualidade', 'wins', 'auditoria', 'todas']
  const TELAS = [
    { nome: 'celular', largura: 390, altura: 844 },
    { nome: 'tablet', largura: 768, altura: 1024 },
  ]

  for (const tela of TELAS) {
    test(`nenhuma aba estoura a largura no ${tela.nome}`, async ({ page }) => {
      await page.setViewportSize({ width: tela.largura, height: tela.altura })
      for (const aba of ABAS) {
        await page.goto(`/dashboards${aba ? `?aba=${aba}` : ''}`)
        await expect(page.getByRole('heading', { level: 1, name: 'Dashboards' })).toBeVisible()
        const sobra = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
        expect(sobra, `aba "${aba || 'panorama'}" no ${tela.nome} rola para o lado`).toBeLessThanOrEqual(0)
      }
    })
  }

  test('no celular: menu em botão, filtros recolhidos e tabela em cartões', async ({ page }) => {
    await consultar(
      `INSERT INTO "Acao" ("id","projetoId","numero","descricao","previstoInicio","previstoTermino","updatedAt")
       VALUES (gen_random_uuid()::text,$1,2,'Outra atrasada','2026-02-02','2026-02-10',now())`,
      [projetoId],
    )
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/dashboards?aba=prazos')

    // Menu: o menu em linha some e o botão abre a grade; escolher uma tela fecha.
    await expect(page.getByRole('navigation', { name: 'Navegação principal' })).toHaveCount(0)
    await page.getByRole('button', { name: 'Menu' }).click()
    const menu = page.getByRole('navigation', { name: 'Navegação principal' })
    await expect(menu.getByRole('link', { name: 'Reunião' })).toBeVisible()
    await menu.getByRole('link', { name: 'Projetos', exact: true }).click()
    await expect(page).toHaveURL(/\/projetos$/)
    await expect(page.getByRole('navigation', { name: 'Navegação principal' })).toHaveCount(0)

    // Filtros: recolhidos até apertar o botão.
    await page.goto('/dashboards?aba=prazos&equipe=STI')
    await expect(page.getByRole('button', { name: /Filtros/ })).toContainText('1 ativo')
    await expect(page.getByLabel('Equipe', { exact: true })).toBeHidden()
    await page.getByRole('button', { name: /Filtros/ }).click()
    await expect(page.getByLabel('Equipe', { exact: true })).toBeVisible()

    // Tabela vira cartões, cada valor com o nome da sua coluna.
    const celula = page.getByRole('cell').filter({ hasText: 'Outra atrasada' }).first()
    await expect(celula).toHaveAttribute('data-rotulo', 'Ação')
    await expect(celula).toBeVisible()
    await expect(page.locator('thead').first()).not.toBeInViewport()
  })

  test('no computador: menu em linha, filtros à vista e tabela normal', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/dashboards?aba=prazos')
    await expect(page.getByRole('button', { name: 'Menu' })).toBeHidden()
    const menuLargo = page.getByRole('navigation', { name: 'Navegação principal' })
    await menuLargo.getByRole('button', { name: 'Trabalho' }).click()
    await expect(menuLargo.getByRole('link', { name: 'Projetos', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: /Filtros/ })).toBeHidden()
    await expect(page.getByLabel('Equipe', { exact: true })).toBeVisible()
    await expect(page.locator('thead th', { hasText: 'Ação' }).first()).toBeVisible()
  })
})

test.describe('dashboards: relatórios de gestão', () => {
  test('o semáforo cruza atraso e risco; o mapa, a idade do atraso, os riscos e o ritmo aparecem', async ({ page }) => {
    // A ação semeada (STI, previsto em março) está atrasada: a equipe é crítica.
    // Um risco de impacto alto aberto e vencido reforça; e uma conclusão recente alimenta o ritmo.
    await consultar(
      `INSERT INTO "RiscoProjeto" ("id","projetoId","tipo","titulo","impacto","status","prazo","criadoPor","atualizadoEm")
       VALUES (gen_random_uuid()::text,$1,'BLOQUEIO','Servidor sem rede','ALTO','ABERTO','2026-01-10','x',now())`,
      [projetoId],
    )
    await consultar(
      `INSERT INTO "Acao" ("id","projetoId","numero","descricao","status","previstoTermino","realizadoInicio","realizadoTermino","updatedAt")
       VALUES (gen_random_uuid()::text,$1,2,'Entregue agora','CONCLUIDO',now(),now() - interval '3 days',now(),now())`,
      [projetoId],
    )
    await page.goto('/dashboards')

    // Semáforo: a palavra aparece junto da cor, e a razão da cor é dita.
    const semaforo = page.locator('#semaforo-equipes')
    await expect(semaforo.getByRole('heading', { name: 'STI' })).toBeVisible()
    await expect(semaforo.getByText('Crítica', { exact: true }).first()).toBeVisible()
    await expect(semaforo.locator('li').getByText(/risco de impacto alto com prazo vencido/)).toBeVisible()
    await expect(semaforo.locator('li').getByText(/das ações abertas estão atrasadas/)).toBeVisible()

    // Mapa de calor: a equipe STI tem 1 projeto atrasado.
    const mapa = page.locator('#mapa-calor-status')
    await expect(mapa.getByRole('row', { name: /STI/ })).toBeVisible()
    await expect(mapa.getByRole('columnheader', { name: 'Atrasado' })).toBeVisible()

    // Riscos por equipe: 1 bloqueio de impacto alto, prazo vencido.
    const riscos = page.locator('#riscos-por-equipe')
    await expect(riscos.getByText(/1 bloqueio/)).toBeVisible()
    await expect(riscos.getByText(/1 com prazo vencido/)).toBeVisible()

    // Ritmo: a conclusão desta semana entra no texto de resumo.
    await expect(page.locator('#ritmo-de-entrega').getByRole('status')).toContainText('1 ações concluídas')

    // Prioridade × atraso: sem avaliação na matriz, o relatório diz como preencher.
    await expect(page.locator('#prioridade-x-atraso').getByText(/Nenhum projeto avaliado/)).toBeVisible()

    // Idade do atraso (aba Prazos): a ação de março está na faixa "Mais de 90 dias".
    await page.getByRole('link', { name: /^Prazos/ }).click()
    const idade = page.locator('#idade-do-atraso')
    await expect(idade.getByText('Mais de 90 dias').first()).toBeVisible()
    await expect(idade.getByText('STI')).toBeVisible()
  })

  test('com a avaliação na matriz, o projeto de alto benefício atrasado aparece como crítico', async ({ page }) => {
    await consultar(
      `INSERT INTO "AvaliacaoProjeto" ("id","projetoId","beneficioCompromissos","beneficioValorTecnologico","beneficioClima","beneficioGovernanca","beneficioEficiencia","esforcoOrcamento","esforcoDuracao","esforcoCapacidadeEquipe","esforcoResistencia","esforcoComplexidade","gravidade","urgencia","tendencia","updatedAt")
       VALUES (gen_random_uuid()::text,$1,9,9,9,9,9,0,0,0,0,0,3,3,3,now())`,
      [projetoId],
    )
    await page.goto('/dashboards')
    const secao = page.locator('#prioridade-x-atraso')
    await expect(secao.getByRole('img', { name: /Projetos por benefício e esforço/ })).toBeVisible()
    await expect(secao.getByText('alto benefício atrasado')).toBeVisible()
    await expect(secao.getByRole('link', { name: 'Projeto E2E' })).toBeVisible()
  })

  test('replanejamentos por motivo e equipe aparecem na aba Auditoria', async ({ page }) => {
    await consultar(
      `INSERT INTO "HistoricoAlteracao" ("id","acaoId","campo","valorAntigo","valorNovo","alteradoEm","alteradoPor","motivo")
       VALUES (gen_random_uuid()::text,$1,'previstoTermino','2026-03-10','2026-03-20',now(),'user_e2e','RECURSOS')`,
      [acaoId],
    )
    await page.goto('/dashboards?aba=auditoria')
    const secao = page.locator('#motivos-por-equipe')
    await expect(secao.getByRole('row', { name: /Falta de pessoas ou de recursos/ })).toBeVisible()
    await expect(secao.getByRole('columnheader', { name: 'STI' })).toBeVisible()
  })
})

test.describe('guia dos relatórios', () => {
  test('o manual traz o guia de cada relatório e a busca o encontra', async ({ page }) => {
    await page.goto('/manual')
    await expect(page.getByRole('link', { name: /Guia dos relatórios dos Dashboards \(\d+\)/ })).toBeVisible()
    const guia = page.locator('#guia-relatorios')
    await expect(guia.getByRole('heading', { name: 'Semáforo por equipe', level: 4 })).toBeVisible()
    await expect(guia.getByRole('heading', { name: 'Maiores atrasos', level: 4 })).toBeVisible()
    await expect(guia.getByRole('heading', { name: 'Alterações recentes', level: 4 })).toBeVisible()
    await expect(guia.getByRole('heading', { name: 'Como ler', level: 5 }).first()).toBeVisible()
    await expect(guia.getByRole('link', { name: 'Abrir este relatório' }).first()).toBeVisible()

    // A busca acha pela regra escrita no guia.
    await page.getByLabel('Buscar no manual').fill('hachurado')
    await page.getByRole('button', { name: 'Buscar' }).click()
    await expect(page.locator('#guia-wins-conclusao')).toBeVisible()
    await expect(page.locator('#guia-semaforo-equipes')).toHaveCount(0)
  })

  test('cada relatório tem o "Como ler" recolhido na tela, com o link para o guia', async ({ page }) => {
    await page.goto('/dashboards?aba=prazos')
    const secao = page.locator('#ranking-atrasos')
    const resumo = secao.getByText('Como ler este relatório')
    await expect(resumo).toBeVisible()
    await expect(secao.getByText('De onde vem:')).toBeHidden()
    await resumo.click()
    await expect(secao.getByText('De onde vem:')).toBeVisible()
    await expect(secao.getByText(/dias úteis, sem fins de semana/)).toBeVisible()
    await secao.getByRole('link', { name: 'Ver no Guia dos relatórios do manual' }).click()
    await expect(page).toHaveURL(/\/manual#guia-ranking-atrasos$/)
    await expect(page.locator('#guia-ranking-atrasos')).toBeVisible()
  })
})

test.describe('cabeçalho em grupos', () => {
  test('numa linha só em tela larga, com grupos que abrem, destacam a página e fecham', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/')
    // Sem a faixa de convite do tour, que é uma segunda linha de propósito.
    await page.getByRole('button', { name: 'Agora não' }).click()
    const cabecalho = page.locator('header')
    // Altura de uma linha de menu (antes quebrava em duas).
    expect((await cabecalho.boundingBox())!.height).toBeLessThan(70)

    const menu = page.getByRole('navigation', { name: 'Navegação principal' })
    await expect(menu.getByRole('link', { name: 'Painel' })).toHaveAttribute('aria-current', 'page')
    await expect(menu.getByRole('link', { name: 'Projetos' })).toHaveCount(0) // fechado: só o botão do grupo

    // Abre, mostra os itens do grupo e escolhe: a lista fecha e o grupo da página fica destacado.
    await menu.getByRole('button', { name: 'Trabalho' }).click()
    await expect(menu.getByRole('button', { name: 'Trabalho' })).toHaveAttribute('aria-expanded', 'true')
    for (const nome of ['Projetos', 'Priorização', 'Modelos']) await expect(menu.getByRole('link', { name: nome, exact: true })).toBeVisible()
    await menu.getByRole('link', { name: 'Projetos', exact: true }).click()
    await expect(page).toHaveURL(/\/projetos$/)
    await expect(menu.getByRole('link', { name: 'Projetos' })).toHaveCount(0)
    await expect(menu.getByRole('button', { name: 'Trabalho' })).toHaveClass(/font-semibold/)
    await expect(menu.getByRole('button', { name: 'Análise' })).not.toHaveClass(/font-semibold/)

    // Esc e clique fora fecham; abrir outro grupo troca.
    await menu.getByRole('button', { name: 'Pessoas' }).click()
    await expect(menu.getByRole('link', { name: 'Minhas ações' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(menu.getByRole('link', { name: 'Minhas ações' })).toHaveCount(0)
    await menu.getByRole('button', { name: 'Pessoas' }).click()
    await menu.getByRole('button', { name: 'Análise' }).click()
    await expect(menu.getByRole('link', { name: 'Reunião' })).toBeVisible()
    await expect(menu.getByRole('link', { name: 'Minhas ações' })).toHaveCount(0)
    await page.locator('main').click({ position: { x: 5, y: 5 } })
    await expect(menu.getByRole('link', { name: 'Reunião' })).toHaveCount(0)
  })

  test('"Ajuda e preferências" reúne Manual, tour e tema; o tema troca de verdade', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('link', { name: 'Manual', exact: true })).toHaveCount(0) // não está mais solto no cabeçalho
    await page.getByRole('button', { name: 'Ajuda e preferências' }).click()
    await expect(page.getByRole('link', { name: 'Manual', exact: true })).toBeVisible()
    await expect(page.locator('#menu-ajuda').getByRole('button', { name: 'Fazer o tour' })).toBeVisible()

    await page.getByRole('radio', { name: 'Escuro' }).click()
    await expect(page.locator('html')).toHaveClass(/dark/)
    await page.getByRole('radio', { name: 'Claro' }).click()
    await expect(page.locator('html')).not.toHaveClass(/dark/)
  })

  test('o botão de tema no cabeçalho alterna claro e escuro com um clique', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Mudar para o tema escuro' }).click()
    await expect(page.locator('html')).toHaveClass(/dark/)
    await page.getByRole('button', { name: 'Mudar para o tema claro' }).click()
    await expect(page.locator('html')).not.toHaveClass(/dark/)
  })

  test('no celular o menu em botão traz os grupos, com o item da página destacado', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/dashboards')
    await page.getByRole('button', { name: 'Menu' }).click()
    const menu = page.getByRole('navigation', { name: 'Navegação principal' })
    for (const grupo of ['Trabalho', 'Pessoas', 'Análise']) await expect(menu.getByText(grupo, { exact: true })).toBeVisible()
    await expect(menu.getByRole('link', { name: 'Dashboards' })).toHaveAttribute('aria-current', 'page')
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0)
  })
})

test.describe('Gantt: setas, risco e hoje', () => {
  test('desenha a seta de dependência, o losango do risco e as barras na mesma régua', async ({ page }) => {
    const [{ id: projeto }] = await consultar<{ id: string }>(`SELECT "id" FROM "Projeto" WHERE "nome" = 'Projeto E2E'`)
    const [{ id: primeira }] = await consultar<{ id: string }>(`SELECT "id" FROM "Acao" WHERE "projetoId" = $1`, [projeto])
    await consultar(
      `INSERT INTO "Acao" ("id","projetoId","numero","descricao","previstoInicio","previstoTermino","realizadoInicio","realizadoTermino","updatedAt")
       VALUES ('gantt-b',$1,2,'Segunda etapa','2026-03-23','2026-04-10','2026-03-25','2026-04-02',now())`,
      [projeto],
    )
    await consultar(`INSERT INTO "DependenciaAcao" ("id","acaoId","predecessoraId") VALUES ('gantt-d','gantt-b',$1)`, [primeira])
    await consultar(
      `INSERT INTO "RiscoProjeto" ("id","projetoId","acaoId","tipo","titulo","impacto","status","prazo","criadoPor","atualizadoEm")
       VALUES ('gantt-r',$1,'gantt-b','RISCO','Fornecedor atrasa','ALTO','ABERTO','2026-03-25','x',now())`,
      [projeto],
    )
    await consultar(`UPDATE "Acao" SET "status" = 'EM_CURSO_50' WHERE "id" = $1`, [primeira])
    await page.goto(`/projetos/${projeto}`)
    const fechar = page.getByRole('button', { name: 'Fechar' })
    if (await fechar.isVisible()) await fechar.click()
    // Vai até a janela de março de 2026, por mês.
    await page.getByLabel('Exibir por').selectOption({ index: 0 })
    for (let i = 0; i < 12; i++) {
      const rotulo = (await page.locator('section span.font-display').first().textContent()) ?? ''
      if (/mar/i.test(rotulo)) break
      await page.getByRole('button', { name: 'Período anterior' }).click()
    }
    await expect(page.locator('svg path[stroke="currentColor"]').first()).toBeVisible() // a seta
    await expect(page.locator('[title^="Risco (impacto alto): Fornecedor atrasa"]')).toBeVisible() // o losango
    // Ação em curso sem data realizada: progresso estimado hachurado.
    await expect(page.locator('[title^="Progresso estimado"]')).toHaveCount(1)
    // O Realizado fica POR CIMA do Previsto: o centro vertical dele está dentro da faixa do previsto.
    const previsto = (await page.locator('[title="Previsto"], [title="Previsto — em atraso"]').nth(1).boundingBox())!
    const realizado = (await page.locator('[title="Realizado"]').first().boundingBox())!
    expect(realizado.y).toBeGreaterThan(previsto.y)
    expect(realizado.y + realizado.height).toBeLessThan(previsto.y + previsto.height)
    expect(realizado.x).toBeGreaterThanOrEqual(previsto.x)
  })
})

test.describe('tela da ação em duas colunas', () => {
  test('formulário à esquerda, contexto em abas à direita, com teclado e contagens', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto(`/projetos/${projetoId}/acoes/${acaoId}/editar`)
    const abas = page.getByRole('tablist', { name: 'Contexto da ação' })
    for (const nome of ['Histórico', 'Comentários', 'Links', 'Dependências']) await expect(abas.getByRole('tab', { name: new RegExp(nome) })).toBeVisible()
    // Lado a lado: o painel do contexto começa à direita do formulário.
    const form = (await page.locator('form').first().boundingBox())!
    const painel = (await abas.boundingBox())!
    expect(painel.x).toBeGreaterThan(form.x + form.width - 1)

    // Histórico é a aba de partida; as setas trocam de aba e só um painel fica visível.
    await expect(abas.getByRole('tab', { name: /Histórico/ })).toHaveAttribute('aria-selected', 'true')
    await abas.getByRole('tab', { name: /Histórico/ }).focus()
    await page.keyboard.press('ArrowRight')
    await expect(abas.getByRole('tab', { name: /Comentários/ })).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByRole('tabpanel')).toHaveCount(await page.getByRole('tabpanel', { includeHidden: false }).count())
    await expect(page.getByRole('heading', { name: /^Comentários/ })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Histórico de alterações' })).toBeHidden()

    // O rascunho de um comentário sobrevive à troca de aba.
    await page.locator('textarea').first().fill('rascunho que não pode sumir')
    await page.keyboard.press('End')
    await abas.getByRole('tab', { name: /Dependências/ }).click()
    await abas.getByRole('tab', { name: /Comentários/ }).click()
    await expect(page.locator('textarea').first()).toHaveValue('rascunho que não pode sumir')

    // `?aba=` abre direto na aba pedida; aba desconhecida cai no histórico.
    await page.goto(`/projetos/${projetoId}/acoes/${acaoId}/editar?aba=links`)
    await expect(abas.getByRole('tab', { name: /Links/ })).toHaveAttribute('aria-selected', 'true')
    await page.goto(`/projetos/${projetoId}/acoes/${acaoId}/editar?aba=xyz`)
    await expect(abas.getByRole('tab', { name: /Histórico/ })).toHaveAttribute('aria-selected', 'true')

    // No celular empilha, sem rolagem lateral.
    await page.setViewportSize({ width: 390, height: 844 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0)
  })
})

test.describe('identidade: a semana CTCEA', () => {
  test('o número da semana aparece no Card WIN, na Reunião e no cabeçalho do Gantt', async ({ page }) => {
    await page.goto('/wins')
    const selo = page.locator('[data-selo-semana]')
    await expect(selo).toBeVisible()
    await expect(selo).toContainText(/seg \d{2}\/\d{2} a sex \d{2}\/\d{2}/)

    await page.goto('/reuniao')
    await expect(page.getByTitle('Semana do calendário da CTCEA')).toHaveText(/^S\d+$/)

    await page.goto(`/projetos/${projetoId}`)
    await page.getByLabel('Exibir por').selectOption({ index: 0 })
    await expect(page.locator('[title^="Semana "][title$="calendário da CTCEA"]').first()).toHaveText(/^S\d+$/)
  })
})

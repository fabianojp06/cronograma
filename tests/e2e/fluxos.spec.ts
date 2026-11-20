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
  await page.goto(`/projetos/${projetoId}/acoes/${acaoId}/editar`)
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
    await page.goto(`/projetos/${projetoId}/acoes/${acaoId}/editar`)
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

    await page.goto(`/projetos/${projetoId}/acoes/${acaoId}/editar`)
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
    await page.getByRole('link', { name: 'Meus projetos' }).click()
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
  test('abre no panorama, mostra o resumo do que pede atenção e só as seções da aba', async ({ page }) => {
    await page.goto('/dashboards')

    const resumo = page.getByRole('region', { name: 'O que pede atenção' })
    await expect(resumo.getByText('Ações atrasadas')).toBeVisible()
    await expect(resumo.getByText('WINs para promover')).toBeVisible()
    // A ação semeada tem prazo em março: está atrasada.
    await expect(resumo.getByRole('link', { name: /Ações atrasadas/ })).toContainText('1')

    await expect(page.getByRole('link', { name: /^Panorama/ })).toHaveAttribute('aria-current', 'page')
    await expect(page.getByRole('heading', { name: 'Panorama geral' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Maiores atrasos' })).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Alterações recentes' })).toHaveCount(0)
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

  test('"Todas" junta tudo numa página (para imprimir) e aba inválida cai no panorama', async ({ page }) => {
    await page.goto('/dashboards?aba=todas')
    await expect(page.getByRole('heading', { name: 'Panorama geral' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Maiores atrasos' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Alterações recentes' })).toBeVisible()

    await page.goto('/dashboards?aba=nao-existe')
    await expect(page.getByRole('heading', { name: 'Panorama geral' })).toBeVisible()
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
    await page.goto(`/projetos/${projetoId}/acoes/${acaoB}/editar`)

    await page.locator('#dependencia-predecessora').selectOption({ index: 1 })
    await page.getByRole('button', { name: 'Adicionar' }).click()
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

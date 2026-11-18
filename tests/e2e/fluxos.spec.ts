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
  await page.goto('/dashboards')

  await page.locator('#de').fill('2026-03-01')
  await page.locator('#ate').fill('2026-03-14')
  await page.getByRole('button', { name: 'Filtrar' }).click()

  await expect(page).toHaveURL(/de=2026-03-01/)
  await expect(page).toHaveURL(/ate=2026-03-14/)
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

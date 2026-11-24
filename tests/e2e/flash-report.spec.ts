/**
 * Flash Report: a tela semanal do projeto. As datas do cenário são relativas ao
 * dia real, para que a semana escolhida (a corrente) caia no meio da janela.
 */

import { expect, test } from '@playwright/test'

import { consultar, encerrarBanco, limparBanco } from './banco'

const id = () => crypto.randomUUID()

/** Data (aaaa-mm-dd) a `n` dias de hoje, na mesma noção da tela (`inicioDeHojeUTC`). */
function dia(n: number): string {
  const agora = new Date()
  const d = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), agora.getUTCDate() + n))
  return d.toISOString().slice(0, 10)
}

let projetoId: string
let projetoVazioId: string

async function acao(
  projeto: string,
  numero: number,
  descricao: string,
  status: string,
  inicio: number,
  termino: number,
  macroetapa: string | null,
  realizadoTermino: number | null = null,
): Promise<string> {
  const acaoId = id()
  await consultar(
    `INSERT INTO "Acao" ("id","projetoId","numero","descricao","status","previstoInicio","previstoTermino","realizadoTermino","macroetapaId","updatedAt")
     VALUES ($1,$2,$3,$4,$5::"StatusAcao",$6,$7,$8,$9,now())`,
    [acaoId, projeto, numero, descricao, status, dia(inicio), dia(termino), realizadoTermino === null ? null : dia(realizadoTermino), macroetapa],
  )
  return acaoId
}

test.beforeEach(async () => {
  await limparBanco()
  projetoId = id()
  projetoVazioId = id()
  // A conta de teste precisa ter cadastro de colaborador, senão cai em /bem-vindo.
  await consultar(
    `INSERT INTO "Colaborador" ("id","nome","email","clerkUserId","updatedAt")
     VALUES ($1,'Ana Souza','ana@exemplo.org','user_e2e',now())`,
    [id()],
  )
  await consultar(
    `INSERT INTO "Projeto" ("id","nome","equipe","cliente","objetivo","updatedAt")
     VALUES ($1,'Plataforma Digital E2E','STI','DIREX','Implantar o novo fluxo de portfólio.',now())`,
    [projetoId],
  )
  await consultar(
    `INSERT INTO "Projeto" ("id","nome","updatedAt") VALUES ($1,'Projeto sem ações',now())`,
    [projetoVazioId],
  )
  const m1 = id()
  const m2 = id()
  for (const [mid, nome, ordem] of [[m1, 'Iniciação', 1], [m2, 'Desenvolvimento', 2]] as const) {
    await consultar(
      `INSERT INTO "Macroetapa" ("id","projetoId","nome","ordem","updatedAt") VALUES ($1,$2,$3,$4,now())`,
      [mid, projetoId, nome, ordem],
    )
  }
  await acao(projetoId, 1, 'Validar fluxos de aprovação', 'CONCLUIDO', -21, -8, m1, -8)
  await acao(projetoId, 2, 'Carga histórica de contratos', 'CONCLUIDO', -14, -3, m1, -3)
  const a3 = await acao(projetoId, 3, 'Construir módulo de portfólio', 'EM_CURSO_50', -10, 7, m2)
  await acao(projetoId, 4, 'Ajustar conector de faturamento', 'NAO_INICIADO', -5, -1, m2)
  const a5 = await acao(projetoId, 5, 'Testes integrados', 'NAO_INICIADO', 1, 14, m2)
  await acao(projetoId, 6, 'Plano de comunicação', 'NAO_INICIADO', 0, 21, null)
  await consultar(
    `INSERT INTO "DependenciaAcao" ("id","acaoId","predecessoraId") VALUES ($1,$2,$3)`,
    [id(), a5, a3],
  )
  await consultar(
    `INSERT INTO "RiscoProjeto" ("id","projetoId","tipo","titulo","impacto","status","prazo","plano","criadoPor","pedeAjuda","atualizadoEm")
     VALUES ($1,$2,'BLOQUEIO','Liberação de acessos VPN para consultores','ALTO','ABERTO',$3,'Escalar chamado junto à Diretoria de TI','user_e2e',true,now())`,
    [id(), projetoId, dia(5)],
  )
  await consultar(
    `INSERT INTO "RiscoProjeto" ("id","projetoId","tipo","titulo","impacto","status","prazo","criadoPor","pedeAjuda","atualizadoEm")
     VALUES ($1,$2,'RISCO','Atraso do fornecedor de licenças','ALTO','ABERTO',$3,'user_e2e',false,now())`,
    [id(), projetoId, dia(-2)],
  )
})

test.afterAll(async () => {
  await encerrarBanco()
})

test('mostra cabeçalho, macroetapas, riscos, alertas e pedido de ajuda', async ({ page }) => {
  await page.goto(`/projetos/${projetoId}/flash-report`)

  await expect(page.getByRole('heading', { level: 1 })).toContainText('Plataforma Digital E2E')
  await expect(page.getByText('Flash Report', { exact: true }).first()).toBeVisible()
  await expect(page.locator('[data-selo-semana]')).toBeVisible()
  await expect(page.getByTestId('farol')).toContainText(/Atrasado|Atenção|Em dia|Adiantado/)
  // Uma data só: o desvio do farol é o mesmo número do "Desvio" do cabeçalho.
  const numero = (t: string) => Number((/[−+-]?\d+(?:,\d)?/.exec(t)?.[0] ?? 'x').replace('−', '-').replace(',', '.'))
  const doFarol = await page.getByTestId('farol').locator('span', { hasText: /p\.p\./ }).first().innerText()
  const doCabecalho = await page.getByText('Desvio', { exact: true }).locator('xpath=following-sibling::dd').innerText()
  expect(numero(doFarol)).toBe(numero(doCabecalho))
  await expect(page.getByText('DIREX')).toBeVisible()
  await expect(page.getByText('Implantar o novo fluxo de portfólio.')).toBeVisible()

  const gantt = page.getByTestId('gantt-macro')
  for (const nome of ['Iniciação', 'Desenvolvimento', 'Sem macroetapa']) {
    await expect(gantt.getByRole('row').filter({ hasText: nome })).toContainText(/\d+,\d%/)
  }
  await expect(gantt.getByRole('row').filter({ hasText: 'Total consolidado' })).toContainText(/\d+,\d%/)

  await expect(page.getByText('Decorrido, sem avanço (ou semana sem foto do histórico)')).toBeVisible()

  await expect(page.getByRole('region', { name: 'Pedido de ajuda e decisões' })).toContainText(
    'Liberação de acessos VPN para consultores',
  )
  const alertas = page.getByRole('region', { name: 'Alertas e pontos de atenção' })
  await expect(alertas).toContainText('ação atrasada')
  await expect(alertas).toContainText('bloqueada por dependência')
  await expect(alertas).toContainText('prazo vencido')
  await expect(page.getByRole('region', { name: 'Principais riscos mapeados' })).toContainText('Alto')
  await expect(page.getByTestId('curva-avanco')).toBeVisible()
})

test('modelo DMAIC: botão cria as fases, e o relatório mostra fase atual e descrição', async ({ page }) => {
  await page.goto(`/projetos/${projetoVazioId}`)
  await page.getByRole('button', { name: 'Usar modelo DMAIC' }).click()
  await expect(page.getByText('Fases do DMAIC criadas.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Usar modelo DMAIC' })).toHaveCount(0)
  await expect(page.getByText('Formaliza o problema, o escopo').first()).toBeVisible()

  // Projeto do cenário: vincula as ações às fases pelo banco e confere o relatório.
  await page.goto(`/projetos/${projetoId}`)
  await page.getByRole('button', { name: 'Usar modelo DMAIC' }).click()
  await expect(page.getByText(/criadas|criada\./).first()).toBeVisible()
  const fases = await consultar<{ id: string; nome: string }>(`SELECT "id","nome" FROM "Macroetapa" WHERE "projetoId"=$1 AND "nome" LIKE '_ – %'`, [projetoId])
  const idDe = (letra: string) => fases.find((f) => f.nome.startsWith(letra))!.id
  await consultar(`UPDATE "Acao" SET "macroetapaId"=$1 WHERE "projetoId"=$2 AND "numero" IN (1,2)`, [idDe('D'), projetoId])
  await consultar(`UPDATE "Acao" SET "macroetapaId"=$1 WHERE "projetoId"=$2 AND "numero" IN (3,4)`, [idDe('M'), projetoId])
  await consultar(`UPDATE "Acao" SET "macroetapaId"=$1 WHERE "projetoId"=$2 AND "numero" = 5`, [idDe('I'), projetoId])

  await page.goto(`/projetos/${projetoId}/flash-report`)
  await expect(page.getByTestId('fase-atual')).toContainText('M – Medir')
  const gantt = page.getByTestId('gantt-macro')
  await expect(gantt.getByRole('row').filter({ hasText: 'I – Melhorar' })).toContainText(/\d+,\d%/)
  await page.getByText('O que é cada macroetapa').click()
  await expect(page.getByTestId('descricoes-macro')).toContainText('Mede como o processo está hoje')
})

test('Gantt do projeto: período por mês, trimestre, semestre e ano', async ({ page }) => {
  await page.goto(`/projetos/${projetoId}`)
  const seletor = page.getByLabel('Exibir por')
  await expect(seletor.locator('option')).toHaveText(['Mês', 'Trimestre', 'Semestre', 'Ano'])
  const rotulo = page.locator('section span.font-display').first()
  const ano = String(new Date().getUTCFullYear())

  await seletor.selectOption({ label: 'Ano' })
  await expect(rotulo).toHaveText(new RegExp(`^(${ano}|${Number(ano) - 1}|${Number(ano) + 1})$`))
  await seletor.selectOption({ label: 'Semestre' })
  await expect(rotulo).toHaveText(/^[12]º sem\/\d{2}$/)
  await seletor.selectOption({ label: 'Trimestre' })
  await expect(rotulo).toHaveText(/^[1-4]º tri\/\d{2}$/)
  await seletor.selectOption({ label: 'Mês' })
  await expect(rotulo).toHaveText(/^[a-z]{3}\/\d{2}$/)

  // O ano é a grade mais larga: rola dentro do quadro, nunca a página inteira.
  await page.setViewportSize({ width: 390, height: 900 })
  await seletor.selectOption({ label: 'Ano' })
  const { scroll, janela } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, janela: window.innerWidth }))
  expect(scroll).toBeLessThanOrEqual(janela)
})

test('semana inválida abre a semana corrente', async ({ page }) => {
  const resposta = await page.goto(`/projetos/${projetoId}/flash-report?semana=2026-99`)
  expect(resposta?.status()).toBe(200)
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Plataforma Digital E2E')
  await expect(page.locator('[data-selo-semana]')).toBeVisible()
})

test('navega para a semana anterior e volta', async ({ page }) => {
  await page.goto(`/projetos/${projetoId}/flash-report`)
  await page.getByRole('link', { name: /Semana anterior/ }).click()
  await expect(page).toHaveURL(/semana=\d{4}-\d{2}/)
  await expect(page.getByRole('link', { name: /Semana seguinte/ })).toBeVisible()
})

// As ações do cenário foram criadas agora, mas o projeto começa 3 semanas antes: é o caso de um
// projeto vindo da planilha. A semana de hoje é confiável; só as anteriores ao registro não são.
const AVISO_REGISTRO = /anterior ao início do registro/

test('projeto importado: a semana atual não traz aviso de registro, uma semana antiga traz', async ({ page }) => {
  await page.goto(`/projetos/${projetoId}/flash-report`)
  await expect(page.locator('[data-selo-semana]')).toBeVisible()
  await expect(page.getByText(AVISO_REGISTRO)).toHaveCount(0)

  // Volta até a primeira semana da janela do projeto, esperando cada navegação terminar
  // pela posição "S03 / 08" do cabeçalho (nunca pela existência do link, que corre com a página).
  const posicao = async () => {
    const m = /S(\d{2}) \/ (\d{2})/.exec(await page.locator('body').innerText())
    return Number(m?.[1] ?? 0)
  }
  let atual = await posicao()
  expect(atual).toBeGreaterThan(1)
  while (atual > 1) {
    await page.getByRole('link', { name: /Semana anterior/ }).click()
    atual -= 1
    await expect(page.getByText(new RegExp(`S${String(atual).padStart(2, '0')} / \\d{2}`)).first()).toBeVisible()
  }
  await expect(page.getByText(AVISO_REGISTRO)).toBeVisible()
})

test('semana anterior ao registro mantém o previsto da curva (o plano), sem zerar', async ({ page }) => {
  await page.goto(`/projetos/${projetoId}/flash-report`)
  const previsto = page.getByTestId('curva-avanco').getByRole('row', { name: /^Previsto/ }).getByRole('cell')
  // A 2ª semana da janela é anterior ao registro e já tem ação planejada em andamento.
  await expect(previsto.nth(1)).not.toHaveText('0%')
  const realizado = page.getByTestId('curva-avanco').getByRole('row', { name: /^Realizado/ }).getByRole('cell')
  // Do realizado dessas semanas o sistema não sabe nada: sem dado, não zero.
  await expect(realizado.nth(1)).toHaveText('—')
})

test('projeto sem ações mostra o aviso e não dá erro', async ({ page }) => {
  const resposta = await page.goto(`/projetos/${projetoVazioId}/flash-report`)
  expect(resposta?.status()).toBe(200)
  await expect(page.getByRole('status').filter({ hasText: 'Nenhuma ação com datas previstas' })).toBeVisible()
  await expect(page.getByTestId('curva-avanco')).toHaveCount(0)
})

test('projeto inexistente dá 404', async ({ page }) => {
  const resposta = await page.goto(`/projetos/${id()}/flash-report`)
  expect(resposta?.status()).toBe(404)
})

for (const largura of [390, 768]) {
  test(`não rola a página de lado a ${largura} px`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 })
    await page.goto(`/projetos/${projetoId}/flash-report`)
    await expect(page.getByTestId('gantt-macro')).toBeVisible()
    await expect(page.getByTestId('curva-avanco').getByText('role o gráfico de lado')).toBeVisible()
    const { scroll, janela } = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      janela: window.innerWidth,
    }))
    expect(scroll).toBeLessThanOrEqual(janela)
  })
}

test('impressão: sem cortes laterais, controles escondidos, rodapé e descrições visíveis', async ({ page }) => {
  await page.setViewportSize({ width: 1123, height: 794 })
  await page.goto(`/projetos/${projetoId}/flash-report`)
  await expect(page.getByTestId('gantt-macro')).toBeVisible()
  await page.emulateMedia({ media: 'print' })

  await expect(page.getByTestId('rodape-impressao')).toContainText('Plataforma Digital E2E')
  await expect(page.getByRole('navigation', { name: 'Navegação do relatório' })).toBeHidden()
  await expect(page.getByTestId('descricoes-macro')).toBeHidden()
  // Nenhuma área rolável (gantt, curva) fica cortada no papel.
  const cortes = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('[data-testid="gantt-macro"], [data-testid="curva-avanco"] > div')].map(
      (e) => e.scrollWidth - e.clientWidth,
    ),
  )
  for (const c of cortes) expect(c).toBeLessThanOrEqual(1)
  const { scroll, janela } = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    janela: window.innerWidth,
  }))
  expect(scroll).toBeLessThanOrEqual(janela)
  if (process.env.PDF_SAIDA) await page.screenshot({ path: process.env.PDF_SAIDA + '.png', fullPage: true })
  if (process.env.PDF_SAIDA) await page.pdf({ path: process.env.PDF_SAIDA, preferCSSPageSize: true, printBackground: true })
})

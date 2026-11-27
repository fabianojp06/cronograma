/**
 * Captura as telas do manual narrado, SÓ contra banco e servidor locais.
 *
 * Pré-requisitos (ver CLAUDE.md, "Manual do Usuário"):
 *   1. banco descartável local e migrations aplicadas (`prisma migrate deploy`);
 *   2. o sistema rodando com o Clerk falso: `E2E_AUTH_FALSA=1 npx next start -p 3101`
 *      (depois de `next build`) apontando para esse banco;
 *   3. `DATABASE_URL` local no comando.
 *
 *   npm run capturar:telas-manual -- primeiros-passos
 *
 * Apaga e recria os dados do banco local para as capturas saírem sempre iguais.
 */
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { chromium, type Page } from '@playwright/test'
import { prisma } from '../src/lib/prisma'
import { dadosSeed } from '../src/lib/seed-dados'

const url = process.env.DATABASE_URL ?? ''
if (!/@(127\.0\.0\.1|localhost)[:/]/.test(url)) {
  console.error('Este script apaga dados: só roda contra banco local.')
  process.exit(1)
}
const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:3101'
const nome = process.argv[2] ?? 'primeiros-passos'
const destino = join('docs', 'Manual do Usuário', 'video', nome, 'telas')
mkdirSync(destino, { recursive: true })

async function semear() {
  for (const t of ['Notificacao', 'ComentarioAcao', 'HistoricoAlteracao', 'Acao', 'Projeto', 'Colaborador']) {
    await prisma.$executeRawUnsafe(`DELETE FROM "${t}"`)
  }
  // A conta "user_e2e" é a pessoa logada; os demais ainda não têm conta (aparecem na lista do primeiro acesso).
  await prisma.colaborador.create({ data: { nome: 'Ana Souza', email: 'ana.souza@ctcea.org.br', clerkUserId: 'user_e2e' } })
  // Um administrador de verdade: sem ele ninguém é restrito e a Ana veria o grupo "Administração".
  await prisma.colaborador.create({ data: { nome: 'Paulo Ribeiro', clerkUserId: 'user_admin', administrador: true } })
  for (const n of ['Carlos Mendes', 'Mariana Lima']) await prisma.colaborador.create({ data: { nome: n } })

  const base = dadosSeed(new Date())
  const extras = [
    { de: 0, referencia: 'PLA-DEP-2026-004', nome: 'Renovação do parque de impressoras', prioridade: 4, equipe: 'GIA', responsavel: 'Carlos Mendes' },
    { de: 1, referencia: 'PLA-DEP-2026-005', nome: 'Revisão da política de acessos', prioridade: null, equipe: 'STI', responsavel: 'Mariana Lima' },
  ]
  const projetos = [
    ...base,
    ...extras.map(({ de, ...e }) => ({ ...base[de], ...e })),
  ]
  for (const { acoes, ...p } of projetos) {
    await prisma.projeto.create({ data: { ...p, acoes: { create: acoes } } })
  }
}

async function foto(pagina: Page, arquivo: string, opcoes: { clip?: { x: number; y: number; width: number; height: number } } = {}) {
  await pagina.screenshot({ path: join(destino, `${arquivo}.jpg`), type: 'jpeg', quality: 82, ...opcoes })
  console.log(`Capturado: ${arquivo}.jpg`)
}

async function main() {
  await semear()
  const navegador = await chromium.launch()
  try {
    const contexto = await navegador.newContext({ viewport: { width: 1280, height: 800 }, locale: 'pt-BR' })
    const pagina = await contexto.newPage()
    await pagina.emulateMedia({ colorScheme: 'light' })

    // 1) Primeiro acesso: conta sem cadastro cai em /bem-vindo.
    await contexto.addCookies([{ name: 'e2e_user', value: 'user_novo', url: BASE }])
    await pagina.goto(`${BASE}/`)
    await pagina.waitForURL(/bem-vindo/)
    await foto(pagina, 'bem-vindo', { clip: { x: 0, y: 0, width: 1280, height: 640 } })

    // 2) Conta cadastrada: painel, lista, menu e ajuda.
    await contexto.addCookies([{ name: 'e2e_user', value: 'user_e2e', url: BASE }])
    await pagina.goto(`${BASE}/`)
    await pagina.waitForSelector('table')
    await foto(pagina, 'painel', { clip: { x: 0, y: 0, width: 1280, height: 720 } })

    await pagina.goto(`${BASE}/projetos`)
    await pagina.waitForSelector('thead th')
    await pagina.locator('table').first().scrollIntoViewIfNeeded()
    await pagina.locator('table').first().screenshot({ path: join(destino, 'lista.jpg'), type: 'jpeg', quality: 82 })
    console.log('Capturado: lista.jpg')

    await pagina.goto(`${BASE}/`)
    await pagina.getByRole('button', { name: 'Trabalho', exact: true }).click()
    await foto(pagina, 'menu', { clip: { x: 0, y: 0, width: 1280, height: 400 } })
    await pagina.keyboard.press('Escape')

    await pagina.getByRole('button', { name: 'Ajuda e preferências' }).click()
    await foto(pagina, 'ajuda', { clip: { x: 860, y: 0, width: 420, height: 280 } })
  } finally {
    await navegador.close()
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

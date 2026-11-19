/**
 * Acesso ao banco do teste de navegador, por `pg` puro.
 *
 * Não usa o cliente Prisma gerado: ele é ESM com `import.meta`, e o carregador
 * do Playwright o trata como CommonJS. SQL direto também deixa claro o que o
 * teste semeia e confere, sem depender das regras do código sob teste.
 */

import { Client } from 'pg'

const url = process.env.DATABASE_URL ?? ''
if (!/@(127\.0\.0\.1|localhost)[:/]/.test(url)) {
  throw new Error('O teste de navegador apaga dados: só roda contra banco local.')
}

let cliente: Client | null = null

async function conexao(): Promise<Client> {
  if (!cliente) {
    cliente = new Client({ connectionString: url })
    await cliente.connect()
  }
  return cliente
}

export async function consultar<T = Record<string, unknown>>(
  sql: string,
  parametros: unknown[] = [],
): Promise<T[]> {
  const { rows } = await (await conexao()).query(sql, parametros)
  return rows as T[]
}

export async function encerrarBanco(): Promise<void> {
  await cliente?.end()
  cliente = null
}

/** Esvazia as tabelas que os testes tocam, na ordem das chaves estrangeiras. */
export async function limparBanco(): Promise<void> {
  for (const tabela of [
    'ComentarioAcao',
    'HistoricoAlteracao',
    'WinSemana',
    'Win',
    'CardSemanal',
    'Acao',
    'Projeto',
    'Colaborador',
  ]) {
    await consultar(`DELETE FROM "${tabela}"`)
  }
}

const id = () => crypto.randomUUID()

export async function semear() {
  const ana = id()
  const projeto = id()
  const acao = id()
  const card = id()
  const win = id()

  await consultar(
    `INSERT INTO "Colaborador" ("id","nome","email","clerkUserId","updatedAt")
     VALUES ($1,'Ana Souza','ana@exemplo.org','user_e2e',now())`,
    [ana],
  )
  await consultar(
    `INSERT INTO "Projeto" ("id","nome","equipe","responsavel","updatedAt")
     VALUES ($1,'Projeto E2E','STI','Ana Souza',now())`,
    [projeto],
  )
  await consultar(
    `INSERT INTO "Acao" ("id","projetoId","numero","descricao","previstoInicio","previstoTermino","updatedAt")
     VALUES ($1,$2,1,'Ação de partida','2026-03-02','2026-03-20',now())`,
    [acao, projeto],
  )
  // Um WIN numa semana de março de 2026 — alimenta o gráfico de conclusão.
  await consultar(
    `INSERT INTO "CardSemanal" ("id","colaboradorId","ano","semana","updatedAt")
     VALUES ($1,$2,2026,10,now())`,
    [card, ana],
  )
  await consultar(
    `INSERT INTO "Win" ("id","colaboradorId","descricao","updatedAt")
     VALUES ($1,$2,'WIN de março',now())`,
    [win, ana],
  )
  await consultar(
    `INSERT INTO "WinSemana" ("id","winId","cardId","ordem","status","updatedAt")
     VALUES ($1,$2,$3,1,'FEITO',now())`,
    [id(), win, card],
  )

  return { projetoId: projeto, acaoId: acao }
}

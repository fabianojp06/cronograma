import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const dirMigrations = path.join(process.cwd(), 'prisma', 'migrations')
const pastas = readdirSync(dirMigrations, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name)
  .sort()

describe('migrations do Prisma', () => {
  it('tem a migration inicial versionada no repositório', () => {
    expect(pastas.length).toBeGreaterThanOrEqual(1)
    expect(pastas[0]).toMatch(/^\d{14}_inicial$/)
  })

  it('a migration inicial cria as 3 tabelas do domínio e o enum StatusAcao', () => {
    const sql = readFileSync(path.join(dirMigrations, pastas[0], 'migration.sql'), 'utf8')
    expect(sql).toContain('CREATE TYPE "StatusAcao"')
    for (const tabela of ['Projeto', 'Acao', 'HistoricoAlteracao']) {
      expect(sql).toContain(`CREATE TABLE "${tabela}"`)
    }
    expect(sql).toContain('CREATE UNIQUE INDEX "Acao_projetoId_numero_key"')
  })
})

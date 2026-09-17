import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { StatusAcao } from '@/generated/prisma/enums'

const schema = readFileSync(path.join(process.cwd(), 'prisma', 'schema.prisma'), 'utf8')

describe('schema Prisma', () => {
  it('expõe o enum StatusAcao com os 5 estágios de progresso', () => {
    expect(Object.values(StatusAcao)).toEqual([
      'NAO_INICIADO',
      'EM_CURSO_25',
      'EM_CURSO_50',
      'EM_CURSO_75',
      'CONCLUIDO',
    ])
  })

  it('declara os models do domínio (Projeto, Acao, HistoricoAlteracao)', () => {
    for (const modelo of ['Projeto', 'Acao', 'HistoricoAlteracao']) {
      expect(schema).toMatch(new RegExp(`^model ${modelo} \{`, 'm'))
    }
  })

  it('mantém a unicidade de numero por projeto em Acao', () => {
    expect(schema).toContain('@@unique([projetoId, numero])')
  })

  it('usa exclusão lógica em Projeto (campo ativo)', () => {
    expect(schema).toMatch(/ativo\s+Boolean\s+@default\(true\)/)
  })
})

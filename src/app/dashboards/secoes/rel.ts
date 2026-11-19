import { RELATORIOS, type Relatorio } from '@/lib/dashboard-catalogo'


/** Relatório do catálogo pelo id — estoura cedo se um id for renomeado. */
export function rel(id: string): Relatorio {
  const relatorio = RELATORIOS.find((item) => item.id === id)
  if (relatorio === undefined) {
    throw new Error(`Relatório "${id}" não existe no catálogo (dashboard-catalogo.ts)`)
  }
  return relatorio
}

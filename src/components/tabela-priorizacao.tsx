import Link from 'next/link'

import { formatarTotal } from '@/lib/matriz-calculo'
import { DESCRICAO_QUADRANTE, type Quadrante } from '@/lib/matriz-criterios'
import type { PontoMatriz } from '@/components/matriz-quadrantes'

/** Traço lateral por quadrante — o mesmo vocabulário visual do resto do sistema. */
const TRACO_QUADRANTE: Record<Quadrante, string> = {
  QUICK_WINS: 'border-realizado',
  ESTRATEGICOS: 'border-previsto',
  VIAVEIS: 'border-textFaint',
  DESCARTAR: 'border-warn',
}

export type LinhaPriorizacao = PontoMatriz & {
  equipe: string | null
  responsavel: string | null
  /** Prioridade manual já cadastrada no Projeto, para comparar com o ranking. */
  prioridadeManual: number | null
}

/**
 * Ranking da matriz. A ordem da tabela é a resposta da ferramenta para
 * "o que fazer primeiro" — por isso a posição aparece como número, e não só
 * como ordem implícita das linhas.
 */
export function TabelaPriorizacao({ linhas }: { linhas: LinhaPriorizacao[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-3xl border-collapse text-sm">
        <thead>
          <tr className="bg-tableHeadBg text-left text-xs uppercase tracking-wide text-textMuted">
            <th className="px-3 py-2 text-right font-semibold">#</th>
            <th className="px-3 py-2 font-semibold">Projeto</th>
            <th className="px-3 py-2 font-semibold">Quadrante</th>
            <th className="px-3 py-2 text-right font-semibold">Benefício</th>
            <th className="px-3 py-2 text-right font-semibold">Esforço</th>
            <th className="px-3 py-2 text-right font-semibold">GUT</th>
            <th className="px-3 py-2 text-right font-semibold">Prioridade</th>
            <th className="px-3 py-2 text-right font-semibold">Prior. cadastrada</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((linha, indice) => {
            const descricao = DESCRICAO_QUADRANTE[linha.quadrante]
            return (
              <tr key={linha.id} className="border-b border-borderSoft bg-surface">
                <td
                  className={`border-l-2 ${TRACO_QUADRANTE[linha.quadrante]} px-3 py-2.5 text-right tabular-nums text-textFaint`}
                >
                  {indice + 1}
                </td>
                <td className="px-3 py-2.5">
                  <Link
                    className="font-medium text-text hover:text-accent"
                    href={`/projetos/${linha.id}`}
                  >
                    {linha.nome}
                  </Link>
                  <span className="block text-xs text-textFaint">
                    {linha.equipe ?? 'Sem equipe'}
                    {linha.responsavel ? ` · ${linha.responsavel}` : ''}
                  </span>
                  <Link
                    className="mt-1 inline-block text-xs text-textMuted hover:text-accent"
                    href={`/priorizacao/${linha.id}`}
                  >
                    Reavaliar
                  </Link>
                </td>
                <td className="px-3 py-2.5 text-textMuted">
                  {descricao.numero}. {descricao.rotulo}
                  <span className="block text-xs text-textFaint">
                    {descricao.recomendacao}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-textMuted">
                  {formatarTotal(linha.beneficio)}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-textMuted">
                  {formatarTotal(linha.esforco)}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-textMuted">
                  {linha.gut}
                </td>
                <td className="px-3 py-2.5 text-right font-medium tabular-nums text-text">
                  {formatarTotal(linha.prioridade)}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-textFaint">
                  {linha.prioridadeManual ?? '—'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

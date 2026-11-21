import Link from 'next/link'
import { TabelaEmpilhavel } from '@/components/tabela-empilhavel'

import type { LinhaDimensao } from '@/lib/dashboard-dimensoes'

/**
 * Tabela de magnitude com barra embutida na linha — a forma do protótipo
 * "Painel Operacional" (barra na própria linha, sem card com sombra).
 *
 * Uma única série (volume de ações), logo **uma única cor**: comparação de
 * magnitude não precisa de paleta categórica, e pintar cada linha de uma cor
 * diferente sugeriria uma identidade que não existe. O atraso é destacado em
 * `warn` porque é status, não série.
 */
export function DashboardBarras({
  linhas,
  maximo,
  rotuloDimensao,
  /** Query string da listagem, ex.: 'equipe' — torna cada linha clicável. */
  filtro,
}: {
  linhas: LinhaDimensao[]
  maximo: number
  rotuloDimensao: string
  filtro?: string
}) {
  return (
    <TabelaEmpilhavel >
      <table className="w-full min-w-2xl border-collapse text-sm">
        <thead>
          <tr className="bg-tableHeadBg text-left text-xs font-semibold text-textMuted">
            <th className="px-3 py-2 font-semibold">{rotuloDimensao}</th>
            <th className="px-3 py-2 font-semibold">Volume de ações</th>
            <th className="px-3 py-2 text-right font-semibold">Projetos</th>
            <th className="px-3 py-2 text-right font-semibold">Concluídas</th>
            <th className="px-3 py-2 text-right font-semibold">Em atraso</th>
            <th className="px-3 py-2 text-right font-semibold">Progresso</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((linha) => {
            const largura = maximo === 0 ? 0 : Math.round((linha.acoes / maximo) * 100)
            const rotulo =
              filtro === undefined ? (
                <span className="font-medium">{linha.chave}</span>
              ) : (
                <Link
                  className="font-medium hover:text-accent"
                  href={`/?${filtro}=${encodeURIComponent(linha.chave)}`}
                >
                  {linha.chave}
                </Link>
              )

            return (
              <tr key={linha.chave} className="border-b border-borderSoft bg-surface">
                <td className="px-3 py-2.5">{rotulo}</td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    {/* Marca fina, extremidade arredondada, ancorada na base. */}
                    <div className="h-1.5 w-40 overflow-hidden rounded-full bg-borderSoft">
                      <div
                        className="h-full rounded-r-full bg-accent"
                        style={{ width: `${largura}%` }}
                      />
                    </div>
                    <span className="tabular-nums text-textMuted">{linha.acoes}</span>
                  </div>
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-textMuted">
                  {linha.projetos}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-textMuted">
                  {linha.acoesConcluidas}
                </td>
                <td
                  className={`px-3 py-2.5 text-right tabular-nums ${
                    linha.acoesAtrasadas > 0 ? 'text-warn' : 'text-textFaint'
                  }`}
                >
                  {linha.acoesAtrasadas}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-textMuted">
                  {linha.percentualConcluido}%
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </TabelaEmpilhavel>
  )
}

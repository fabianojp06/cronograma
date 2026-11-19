import { DashboardSecao } from '@/components/dashboard-secao'
import { totalPendencias, type apurarPendencias } from '@/lib/dashboard-qualidade'
import { rel } from './rel'

export function SecaoQualidade({
  pendencias,
}: {
  pendencias: ReturnType<typeof apurarPendencias>
}) {
  return (
    <>
        <DashboardSecao relatorio={rel('higiene-dados')}>
          <p className="mb-4 text-sm text-textMuted">
            {totalPendencias(pendencias)} ocorrência(s) no recorte atual.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-2xl border-collapse text-sm">
              <thead>
                <tr className="bg-tableHeadBg text-left text-xs uppercase tracking-wide text-textMuted">
                  <th className="px-3 py-2 font-semibold">Pendência</th>
                  <th className="px-3 py-2 font-semibold">Efeito nos números</th>
                  <th className="px-3 py-2 text-right font-semibold">Ocorrências</th>
                </tr>
              </thead>
              <tbody>
                {pendencias.map((linha) => (
                  <tr
                    key={linha.pendencia}
                    className="border-b border-borderSoft bg-surface"
                  >
                    <td
                      className={`border-l-2 px-3 py-2.5 ${
                        linha.quantidade > 0 ? 'border-warn' : 'border-borderSoft'
                      }`}
                    >
                      {linha.rotulo}
                    </td>
                    <td className="px-3 py-2.5 text-textMuted">{linha.efeito}</td>
                    <td
                      className={`px-3 py-2.5 text-right tabular-nums ${
                        linha.quantidade > 0 ? 'text-warn' : 'text-textFaint'
                      }`}
                    >
                      {linha.quantidade}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DashboardSecao>
    </>
  )
}

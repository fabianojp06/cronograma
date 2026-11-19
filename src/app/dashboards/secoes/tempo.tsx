import { DashboardCarga } from '@/components/dashboard-carga'
import { DashboardEvolucao } from '@/components/dashboard-evolucao'
import { DashboardSecao, SemDados } from '@/components/dashboard-secao'
import type { cargaMensal, evolucaoMensal } from '@/lib/dashboard-temporal'
import { rel } from './rel'

export function SecoesTempo({
  evolucao,
  carga,
}: {
  evolucao: ReturnType<typeof evolucaoMensal>
  carga: ReturnType<typeof cargaMensal>
}) {
  return (
    <>
        <DashboardSecao relatorio={rel('evolucao-mensal')}>
          {evolucao.length === 0 ? (
            <SemDados>
              Nenhuma ação com data preenchida — a curva precisa de pelo menos uma data
              prevista ou realizada.
            </SemDados>
          ) : (
            <DashboardEvolucao pontos={evolucao} />
          )}
        </DashboardSecao>

        <DashboardSecao relatorio={rel('carga-mensal')}>
          {carga.length === 0 ? (
            <SemDados>Nenhuma ação com data prevista preenchida.</SemDados>
          ) : (
            <DashboardCarga pontos={carga} />
          )}
        </DashboardSecao>
    </>
  )
}

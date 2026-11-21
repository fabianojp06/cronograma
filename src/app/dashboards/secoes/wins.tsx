import Link from 'next/link'
import { TabelaEmpilhavel } from '@/components/tabela-empilhavel'

import { DashboardSecao, SemDados } from '@/components/dashboard-secao'
import { GraficoWinsSemana } from '@/components/grafico-wins-semana'
import type { taxaDeConclusao, winsReincidentes } from '@/lib/dashboard-wins'
import { rotuloSemana } from '@/lib/semana-ctcea'
import { ROTULO_SITUACAO } from '@/lib/win-promocao'
import { rel } from './rel'

export function SecoesWins({
  conclusaoSemanal,
  reincidentes,
  comPeriodo,
}: {
  conclusaoSemanal: ReturnType<typeof taxaDeConclusao>
  reincidentes: ReturnType<typeof winsReincidentes>
  comPeriodo: boolean
}) {
  return (
    <>
        <DashboardSecao relatorio={rel('wins-conclusao')}>
          {conclusaoSemanal.every((s) => s.total === 0) ? (
            <SemDados>{comPeriodo ? 'Nenhum WIN registrado nas semanas do período.' : 'Nenhum WIN registrado nas últimas 12 semanas.'}</SemDados>
          ) : (
            <>
              <GraficoWinsSemana semanas={conclusaoSemanal} />
              <TabelaEmpilhavel className="mt-4">
                <table className="w-full min-w-2xl border-collapse text-sm">
                  <thead>
                    <tr className="bg-tableHeadBg text-left text-xs font-semibold text-textMuted">
                      <th className="px-3 py-2 font-semibold">Semana</th>
                      <th className="px-3 py-2 text-right font-semibold">WINs</th>
                      <th className="px-3 py-2 text-right font-semibold">Concluídos</th>
                      <th className="px-3 py-2 text-right font-semibold">Promovidos</th>
                      <th className="px-3 py-2 text-right font-semibold">Taxa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {conclusaoSemanal.map((semana) => (
                      <tr
                        key={`${semana.semana.ano}-${semana.semana.semana}`}
                        className="border-b border-borderSoft bg-surface"
                      >
                        <td className="px-3 py-2 tabular-nums">
                          {semana.rotulo}
                          {semana.emCurso ? (
                            <span className="ml-2 text-xs text-textFaint">em curso</span>
                          ) : null}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{semana.total}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{semana.feitos}</td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {semana.promovidos}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {semana.taxa === null ? (
                            <span className="text-textFaint">
                              {semana.motivoSemTaxa === 'TODOS_PROMOVIDOS'
                                ? 'todos promovidos'
                                : '—'}
                            </span>
                          ) : (
                            `${Math.round(semana.taxa * 100)}%`
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TabelaEmpilhavel>
            </>
          )}
        </DashboardSecao>

        <DashboardSecao relatorio={rel('wins-reincidentes')}>
          {reincidentes.length === 0 ? (
            <SemDados>Nenhum WIN apareceu em mais de uma semana.</SemDados>
          ) : (
            <TabelaEmpilhavel >
              <table className="w-full min-w-2xl border-collapse text-sm">
                <thead>
                  <tr className="bg-tableHeadBg text-left text-xs font-semibold text-textMuted">
                    <th className="px-3 py-2 font-semibold">WIN</th>
                    <th className="px-3 py-2 font-semibold">Quem</th>
                    <th className="px-3 py-2 font-semibold">Período</th>
                    <th className="px-3 py-2 font-semibold">Aparições</th>
                    <th className="px-3 py-2 font-semibold">Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {reincidentes.map((win) => (
                    <tr key={win.winId} className="border-b border-borderSoft bg-surface">
                      <td
                        className={`border-l-2 px-3 py-2.5 ${
                          win.situacao === 'DEVE_PROMOVER'
                            ? 'border-warn'
                            : win.situacao === 'PROMOVIDO'
                              ? 'border-realizado'
                              : 'border-borderSoft'
                        }`}
                      >
                        {win.projetoId ? (
                          <Link className="hover:text-accent" href={`/projetos/${win.projetoId}`}>
                            {win.descricao}
                          </Link>
                        ) : (
                          win.descricao
                        )}
                      </td>
                      <td className="px-3 py-2.5">{win.colaborador}</td>
                      <td className="px-3 py-2.5 text-xs text-textMuted">
                        {win.primeiraSemana === null
                          ? 'antes do sistema'
                          : `${rotuloSemana(win.primeiraSemana)} → ${rotuloSemana(win.ultimaSemana!)}`}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="tabular-nums">{win.aparicoes}</span>
                        <span
                          aria-hidden
                          className="ml-2 inline-flex h-1.5 w-16 overflow-hidden rounded-full bg-borderSoft align-middle"
                        >
                          <span
                            className={win.aparicoes >= 3 ? 'bg-warn' : 'bg-previsto'}
                            style={{ width: `${Math.min(100, (win.aparicoes / 3) * 100)}%` }}
                          />
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-textMuted">
                        {ROTULO_SITUACAO[win.situacao]}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TabelaEmpilhavel>
          )}
        </DashboardSecao>
    </>
  )
}

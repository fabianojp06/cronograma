import Link from 'next/link'
import { TabelaEmpilhavel } from '@/components/tabela-empilhavel'

import { DashboardSecao, SemDados } from '@/components/dashboard-secao'
import { BarrasEmpilhadas } from '@/components/barras-empilhadas'
import { FAIXAS_DE_ATRASO, type LinhaIdadeDoAtraso } from '@/lib/dashboard-gestao'
import { formatarDataBR } from '@/lib/formatacao'
import type { proximosVencimentos, rankingAtrasos, resumirAderencia } from '@/lib/dashboard-prazos'
import { rel } from './rel'

export function SecoesPrazos({
  aderencia,
  atrasos,
  janelas,
  idadeAtraso,
}: {
  aderencia: ReturnType<typeof resumirAderencia>
  atrasos: ReturnType<typeof rankingAtrasos>
  janelas: ReturnType<typeof proximosVencimentos>
  idadeAtraso: LinhaIdadeDoAtraso[]
}) {
  const ultimaJanela = janelas[janelas.length - 1]
  return (
    <>
        <DashboardSecao relatorio={rel('aderencia-prazo')}>
          {aderencia.avaliaveis === 0 ? (
            <SemDados>
              Nenhuma ação concluída com data prevista e realizada — sem as duas pontas
              não há aderência a medir.
            </SemDados>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="border-l-2 border-realizado bg-surface py-2 pl-4">
                <p className="text-xs font-medium text-textMuted">
                  Entregues no prazo
                </p>
                <p className="mt-1 font-display text-2xl font-extrabold tabular-nums text-realizado">
                  {aderencia.percentualNoPrazo}%
                </p>
                <p className="text-xs text-textFaint">
                  {aderencia.noPrazo} de {aderencia.avaliaveis} avaliáveis
                </p>
              </div>
              <div className="border-l-2 border-warn bg-surface py-2 pl-4">
                <p className="text-xs font-medium text-textMuted">
                  Entregues com atraso
                </p>
                <p className="mt-1 font-display text-2xl font-extrabold tabular-nums text-warn">
                  {aderencia.comAtraso}
                </p>
                <p className="text-xs text-textFaint">ações concluídas fora do prazo</p>
              </div>
              <div className="border-l-2 border-warn bg-surface py-2 pl-4">
                <p className="text-xs font-medium text-textMuted">
                  Atraso médio
                </p>
                <p className="mt-1 font-display text-2xl font-extrabold tabular-nums">
                  {aderencia.atrasoMedioDiasUteis}
                </p>
                <p className="text-xs text-textFaint">dias úteis, só entre as atrasadas</p>
              </div>
              <div className="border-l-2 border-borderSoft bg-surface py-2 pl-4">
                <p className="text-xs font-medium text-textMuted">
                  Fora da base
                </p>
                <p className="mt-1 font-display text-2xl font-extrabold tabular-nums text-textMuted">
                  {aderencia.naoAvaliaveis}
                </p>
                <p className="text-xs text-textFaint">sem previsto e/ou sem realizado</p>
              </div>
            </div>
          )}
        </DashboardSecao>

        <DashboardSecao relatorio={rel('ranking-atrasos')}>
          {atrasos.length === 0 ? (
            <SemDados>Nenhuma ação em atraso aberto neste recorte.</SemDados>
          ) : (
            <TabelaEmpilhavel >
              <table className="w-full min-w-2xl border-collapse text-sm">
                <thead>
                  <tr className="bg-tableHeadBg text-left text-xs font-semibold text-textMuted">
                    <th className="px-3 py-2 font-semibold">Ação</th>
                    <th className="px-3 py-2 font-semibold">Projeto</th>
                    <th className="px-3 py-2 font-semibold">Responsável</th>
                    <th className="px-3 py-2 font-semibold">Previsto</th>
                    <th className="px-3 py-2 text-right font-semibold">Atraso</th>
                  </tr>
                </thead>
                <tbody>
                  {atrasos.map((linha) => (
                    <tr key={linha.id} className="border-b border-borderSoft bg-surface">
                      <td className="border-l-2 border-warn px-3 py-2.5">
                        <span className="text-textFaint">{linha.numero}.</span>{' '}
                        {linha.descricao}
                      </td>
                      <td className="px-3 py-2.5">
                        <Link
                          className="text-textMuted hover:text-accent"
                          href={`/projetos/${linha.projetoId}`}
                        >
                          {linha.projetoNome}
                        </Link>
                      </td>
                      <td className="px-3 py-2.5 text-textMuted">
                        {linha.responsavel ?? '-'}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums text-textMuted">
                        {formatarDataBR(linha.previstoTermino!)}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-warn">
                        {linha.diasUteisDeAtraso} dia(s) úteis
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TabelaEmpilhavel>
          )}
        </DashboardSecao>

        <DashboardSecao relatorio={rel('idade-do-atraso')}>
          {idadeAtraso.length === 0 ? (
            <SemDados>Nenhuma ação atrasada no recorte atual.</SemDados>
          ) : (
            <BarrasEmpilhadas
              linhas={idadeAtraso.map((l) => ({ rotulo: l.equipe, total: l.total, valores: l.faixas }))}
              series={FAIXAS_DE_ATRASO.map((f, i) => ({ id: f.id, rotulo: f.rotulo, tinta: [15, 25, 35, 45][i] }))}
              unidade="atrasadas"
            />
          )}
        </DashboardSecao>

        <DashboardSecao relatorio={rel('proximos-vencimentos')}>
          <div className="grid gap-4 sm:grid-cols-3">
            {janelas.map((janela) => (
              <div
                key={janela.dias}
                className="border-l-2 border-previsto bg-surface py-2 pl-4"
              >
                <p className="text-xs font-medium text-textMuted">
                  {janela.rotulo}
                </p>
                <p className="mt-1 font-display text-2xl font-extrabold tabular-nums">
                  {janela.acoes.length}
                </p>
                <p className="text-xs text-textFaint">ações a vencer</p>
              </div>
            ))}
          </div>

          {ultimaJanela.acoes.length > 0 ? (
            <ul className="mt-4 divide-y divide-borderSoft border-l-2 border-previsto bg-surface">
              {ultimaJanela.acoes.slice(0, 10).map((acao) => (
                <li
                  key={acao.id}
                  className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-2.5 text-sm"
                >
                  <span>
                    <span className="text-textFaint">{acao.numero}.</span> {acao.descricao}
                    <Link
                      className="ml-2 text-xs text-textMuted hover:text-accent"
                      href={`/projetos/${acao.projetoId}`}
                    >
                      {acao.projetoNome}
                    </Link>
                  </span>
                  <span className="tabular-nums text-textMuted">
                    {formatarDataBR(acao.previstoTermino!)}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </DashboardSecao>
    </>
  )
}

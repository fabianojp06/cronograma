import Link from 'next/link'

import { DashboardSecao, SemDados } from '@/components/dashboard-secao'
import {
  rotularCampo,
  type contarPorCampo,
  type rankingReplanejamentos,
  type RegistroHistorico,
  type resumirAuditoria,
} from '@/lib/dashboard-auditoria'
import { formatarDataBR } from '@/lib/formatacao'
import { rel } from './rel'

export function SecoesAuditoria({
  auditoria,
  replanejamentos,
  registros,
  porCampo,
}: {
  auditoria: ReturnType<typeof resumirAuditoria>
  replanejamentos: ReturnType<typeof rankingReplanejamentos>
  registros: RegistroHistorico[]
  porCampo: ReturnType<typeof contarPorCampo>
}) {
  return (
    <>
        <DashboardSecao relatorio={rel('replanejamentos')}>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="border-l-2 border-accent bg-surface py-2 pl-4">
              <p className="text-xs font-medium uppercase tracking-wide text-textMuted">
                Alterações registradas
              </p>
              <p className="mt-1 font-display text-2xl font-extrabold tabular-nums">
                {auditoria.totalAlteracoes}
              </p>
              <p className="text-xs text-textFaint">últimas 500</p>
            </div>
            <div className="border-l-2 border-warn bg-surface py-2 pl-4">
              <p className="text-xs font-medium uppercase tracking-wide text-textMuted">
                Replanejamentos
              </p>
              <p className="mt-1 font-display text-2xl font-extrabold tabular-nums">
                {auditoria.totalReplanejamentos}
              </p>
              <p className="text-xs text-textFaint">
                em {auditoria.acoesReplanejadas} ação(ões)
              </p>
            </div>
            <div className="border-l-2 border-borderSoft bg-surface py-2 pl-4">
              <p className="text-xs font-medium uppercase tracking-wide text-textMuted">
                Autores distintos
              </p>
              <p className="mt-1 font-display text-2xl font-extrabold tabular-nums">
                {auditoria.autores}
              </p>
              <p className="text-xs text-textFaint">incluindo não identificados</p>
            </div>
          </div>

          {replanejamentos.length === 0 ? (
            <div className="mt-4">
              <SemDados>Nenhuma data prevista foi alterada até agora.</SemDados>
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-2xl border-collapse text-sm">
                <thead>
                  <tr className="bg-tableHeadBg text-left text-xs uppercase tracking-wide text-textMuted">
                    <th className="px-3 py-2 font-semibold">Ação</th>
                    <th className="px-3 py-2 font-semibold">Projeto</th>
                    <th className="px-3 py-2 text-right font-semibold">Vezes</th>
                    <th className="px-3 py-2 font-semibold">Última mudança</th>
                  </tr>
                </thead>
                <tbody>
                  {replanejamentos.map((linha) => (
                    <tr
                      key={linha.acaoId}
                      className="border-b border-borderSoft bg-surface"
                    >
                      <td className="border-l-2 border-warn px-3 py-2.5">
                        <span className="text-textFaint">{linha.acaoNumero}.</span>{' '}
                        {linha.acaoDescricao}
                      </td>
                      <td className="px-3 py-2.5">
                        <Link
                          className="text-textMuted hover:text-accent"
                          href={`/projetos/${linha.projetoId}`}
                        >
                          {linha.projetoNome}
                        </Link>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-warn">
                        {linha.vezes}
                      </td>
                      <td className="px-3 py-2.5 text-textMuted">
                        {linha.ultimoValorAntigo ?? '—'} → {linha.ultimoValorNovo ?? '—'}
                        <span className="block text-xs text-textFaint">
                          {formatarDataBR(linha.ultimaEm)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DashboardSecao>

        <DashboardSecao relatorio={rel('alteracoes-recentes')}>
          {registros.length === 0 ? (
            <SemDados>
              Nenhuma alteração registrada — a trilha de auditoria começa na primeira
              edição de uma ação.
            </SemDados>
          ) : (
            <>
              <ul className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-textMuted">
                {porCampo.map((contagem) => (
                  <li key={contagem.campo}>
                    {contagem.rotulo}:{' '}
                    <span className="tabular-nums text-text">{contagem.quantidade}</span>
                  </li>
                ))}
              </ul>

              <ul className="mt-4 divide-y divide-borderSoft border-l-2 border-accent bg-surface">
                {registros.slice(0, 15).map((registro) => (
                  <li key={registro.id} className="px-4 py-2.5 text-sm">
                    <span className="text-textMuted">{rotularCampo(registro.campo)}</span>{' '}
                    de{' '}
                    <Link
                      className="hover:text-accent"
                      href={`/projetos/${registro.projetoId}`}
                    >
                      {registro.projetoNome}
                    </Link>{' '}
                    <span className="text-textFaint">
                      (ação {registro.acaoNumero}): {registro.valorAntigo ?? '—'} →{' '}
                      {registro.valorNovo ?? '—'}
                    </span>
                    <span className="block text-xs text-textFaint">
                      {formatarDataBR(registro.alteradoEm)} ·{' '}
                      {registro.alteradoPor ?? 'não identificado'}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </DashboardSecao>
    </>
  )
}

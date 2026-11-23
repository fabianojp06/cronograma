import Link from 'next/link'

import { SinalProjeto } from '@/components/sinal-projeto'
import type { Farol } from '@/lib/farol-projeto'
import {
  ROTULO_STATUS_AGREGADO,
  type ResumoProjeto,
  type StatusAgregado,
} from '@/lib/projeto-resumo'

export type LinhaProjeto = {
  id: string
  referencia: string | null
  nome: string
  equipe: string | null
  categoria: string | null
  responsavel: string | null
  prioridade: number | null
  resumo: ResumoProjeto
  /** Só vale se quem montou a linha passou `riscos` e `previstoInicio` das ações; sem eles sai SEM_DADOS. */
  sinal: Farol
}

/** Traço lateral colorido por status — o painel não usa card com sombra. */
export const TRACO_STATUS: Record<StatusAgregado, string> = {
  SEM_ACOES: 'border-borderSoft',
  NAO_INICIADO: 'border-textFaint',
  EM_ANDAMENTO: 'border-previsto',
  ATRASADO: 'border-warn',
  CONCLUIDO: 'border-realizado',
}

export const COR_TEXTO_STATUS: Record<StatusAgregado, string> = {
  SEM_ACOES: 'text-textFaint',
  NAO_INICIADO: 'text-textMuted',
  EM_ANDAMENTO: 'text-previsto',
  ATRASADO: 'text-warn',
  CONCLUIDO: 'text-realizado',
}

export function BarraProgresso({ resumo }: { resumo: ResumoProjeto }) {
  const cor = resumo.status === 'ATRASADO' ? 'bg-warn' : 'bg-realizado'
  return (
    <div className="flex items-center gap-2">
      <div
        className="h-1.5 w-28 overflow-hidden rounded-full bg-borderSoft"
        role="progressbar"
        aria-valuenow={resumo.percentualConcluido}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Progresso do projeto"
      >
        <div
          className={`h-full ${cor}`}
          style={{ width: `${resumo.percentualConcluido}%` }}
        />
      </div>
      <span className="text-xs tabular-nums text-textMuted">
        {resumo.percentualConcluido}%
      </span>
    </div>
  )
}

export function ListaProjetos({
  linhas,
  podeEditar = true,
}: {
  linhas: LinhaProjeto[]
  /** Leitor não vê o atalho de edição; a Server Action recusa de qualquer forma. */
  podeEditar?: boolean
}) {
  if (linhas.length === 0) {
    return (
      <p className="mt-8 border-l-2 border-borderSoft bg-surface py-4 pl-4 text-sm text-textMuted">
        Nenhum projeto encontrado com esses filtros.
      </p>
    )
  }

  return (
    <div className="mt-6 overflow-x-auto">
      <table className="w-full min-w-3xl border-collapse text-sm">
        <thead>
          <tr className="bg-tableHeadBg text-left text-xs font-semibold text-textMuted">
            <th className="px-3 py-2 font-semibold">Projeto</th>
            <th className="px-3 py-2 font-semibold">Equipe</th>
            <th className="px-3 py-2 font-semibold">Categoria</th>
            <th className="px-3 py-2 font-semibold">Responsável</th>
            <th className="px-3 py-2 font-semibold">Status</th>
            <th className="px-3 py-2 font-semibold">Sinal</th>
            <th className="px-3 py-2 font-semibold">Progresso</th>
            <th className="px-3 py-2 text-right font-semibold">Concluídas</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((linha) => (
            <tr
              key={linha.id}
              className="border-b border-borderSoft bg-surface align-middle"
            >
              <td className={`border-l-2 ${TRACO_STATUS[linha.resumo.status]} px-3 py-3`}>
                <Link
                  className="font-medium text-text hover:text-accent"
                  href={`/projetos/${linha.id}`}
                >
                  {linha.nome}
                </Link>
                {linha.referencia ? (
                  <span className="block text-xs text-textFaint">{linha.referencia}</span>
                ) : null}
                {podeEditar ? (
                  <Link
                    className="mt-1 inline-block text-xs text-textMuted hover:text-accent"
                    href={`/projetos/${linha.id}/editar`}
                  >
                    Editar
                  </Link>
                ) : null}
              </td>
              <td className="px-3 py-3 text-textMuted">{linha.equipe ?? '-'}</td>
              <td className="px-3 py-3 text-textMuted">{linha.categoria ?? '-'}</td>
              <td className="px-3 py-3 text-textMuted">{linha.responsavel ?? '-'}</td>
              <td
                className={`px-3 py-3 font-medium ${COR_TEXTO_STATUS[linha.resumo.status]}`}
              >
                {ROTULO_STATUS_AGREGADO[linha.resumo.status]}
                {linha.resumo.acoesAtrasadas > 0 ? (
                  <span className="block text-xs font-normal text-warn">
                    {linha.resumo.acoesAtrasadas} em atraso
                  </span>
                ) : null}
              </td>
              <td className="px-3 py-3">
                <SinalProjeto farol={linha.sinal} />
              </td>
              <td className="px-3 py-3">
                <BarraProgresso resumo={linha.resumo} />
              </td>
              <td className="px-3 py-3 text-right tabular-nums text-textMuted">
                {linha.resumo.acoesConcluidas}/{linha.resumo.totalAcoes}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

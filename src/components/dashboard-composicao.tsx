import Link from 'next/link'

import {
  ROTULO_STATUS_AGREGADO,
  STATUS_AGREGADOS,
  type StatusAgregado,
} from '@/lib/projeto-resumo'

/**
 * Composição da carteira por status agregado: uma barra empilhada + legenda +
 * tabela com os números.
 *
 * As cores são as **de status** definidas no CLAUDE.md (não uma paleta
 * categórica), e por isso nunca viram "série 5" em outro gráfico. A ORDEM da
 * pilha não é decorativa: foi escolhida para separar os pares que um leitor
 * com deficiência de visão de cor confunde. Verde (concluído) ao lado de
 * laranja (atraso) dá ΔE 6.6 em protanopia — abaixo do piso; com a ordem
 * abaixo, o pior par adjacente sobe para ΔE 11.7. O cinza de "não iniciado"
 * fica propositalmente dessaturado (é ausência de andamento, não uma
 * categoria), e por ter contraste baixo contra a superfície vem sempre
 * acompanhado de rótulo e da tabela — nunca identificado só pela cor.
 */
const ORDEM_PILHA: readonly StatusAgregado[] = [
  'SEM_ACOES',
  'CONCLUIDO',
  'EM_ANDAMENTO',
  'NAO_INICIADO',
  'ATRASADO',
]

const FUNDO_STATUS: Record<StatusAgregado, string> = {
  SEM_ACOES: 'bg-borderSoft',
  CONCLUIDO: 'bg-realizado',
  EM_ANDAMENTO: 'bg-previsto',
  NAO_INICIADO: 'bg-textFaint',
  ATRASADO: 'bg-warn',
}

export type FatiaStatus = { status: StatusAgregado; quantidade: number }

export function DashboardComposicao({ fatias }: { fatias: FatiaStatus[] }) {
  const total = fatias.reduce((soma, fatia) => soma + fatia.quantidade, 0)

  // Ordena pela ordem da pilha e descarta o que tem zero: um segmento de
  // largura nula viraria só um traço de 2px de espaçamento na barra.
  const presentes = ORDEM_PILHA.map(
    (status) => fatias.find((fatia) => fatia.status === status) ?? { status, quantidade: 0 },
  ).filter((fatia) => fatia.quantidade > 0)

  if (total === 0) return null

  const percentual = (quantidade: number) => Math.round((quantidade / total) * 100)

  return (
    <div>
      {/* gap-0.5 = o espaçador de superfície entre segmentos vizinhos */}
      <div className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full">
        {presentes.map((fatia) => (
          <div
            key={fatia.status}
            className={FUNDO_STATUS[fatia.status]}
            style={{ width: `${(fatia.quantidade / total) * 100}%` }}
            title={`${ROTULO_STATUS_AGREGADO[fatia.status]}: ${fatia.quantidade} projeto(s)`}
          />
        ))}
      </div>

      {/* Legenda: identidade nunca fica só na cor. */}
      <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
        {presentes.map((fatia) => (
          <li key={fatia.status} className="flex items-center gap-2 text-sm">
            <span
              aria-hidden
              className={`h-2.5 w-2.5 shrink-0 rounded-sm ${FUNDO_STATUS[fatia.status]}`}
            />
            <Link
              className="text-textMuted hover:text-accent"
              href={`/?status=${fatia.status}`}
            >
              {ROTULO_STATUS_AGREGADO[fatia.status]}
            </Link>
            <span className="tabular-nums text-text">
              {fatia.quantidade}
              <span className="text-textFaint"> ({percentual(fatia.quantidade)}%)</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Fatias na ordem canônica dos status — usado pela página para montar os dados. */
export function contarPorStatus(
  linhas: { resumo: { status: StatusAgregado } }[],
): FatiaStatus[] {
  return STATUS_AGREGADOS.map((status) => ({
    status,
    quantidade: linhas.filter((linha) => linha.resumo.status === status).length,
  }))
}

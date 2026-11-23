import Link from 'next/link'

import type { Relatorio } from '@/lib/dashboard-catalogo'
import { GUIA_RELATORIOS } from '@/lib/guia-relatorios'

/**
 * Moldura de um relatório: âncora, título e a pergunta de negócio que ele
 * responde. O `id` vem do catálogo, então o índice e a seção nunca divergem.
 */
export function DashboardSecao({
  relatorio,
  acao,
  children,
}: {
  relatorio: Relatorio
  /** Link opcional no canto (ex.: "ver na listagem"). */
  acao?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section id={relatorio.id} className="scroll-mt-20 rounded-xl border border-border bg-surface p-5 sm:p-6 print:border-0 print:p-0">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-lg font-semibold">{relatorio.titulo}</h3>
        {acao}
      </div>
      <p className="mt-1 text-sm text-textMuted">{relatorio.pergunta}</p>
      <ComoLer id={relatorio.id} />
      <div className="mt-4">{children}</div>
    </section>
  )
}

/** Estado vazio padrão — um relatório sem dado diz por que, não some da tela. */
export function SemDados({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg bg-bg px-4 py-3 text-sm text-textMuted">
      {children}
    </p>
  )
}

/**
 * "Como ler este relatório": recolhido embaixo do título, com o mesmo texto do
 * Guia dos relatórios do manual (`guia-relatorios.ts`, a fonte única). Não
 * entra na impressão.
 */
function ComoLer({ id }: { id: string }) {
  const guia = GUIA_RELATORIOS[id]
  if (!guia) return null
  return (
    <details className="group mt-2 text-sm print:hidden">
      <summary className="inline-flex min-h-8 cursor-pointer items-center text-textMuted hover:text-accent">
        Como ler este relatório
      </summary>
      <div className="mt-2 max-w-3xl space-y-3 rounded-lg bg-bg px-4 py-3">
        <p className="text-text">{guia.mostra}</p>
        <ul className="list-disc space-y-1 pl-5 text-textMuted">
          {guia.comoLer.map((linha) => (
            <li key={linha}>{linha}</li>
          ))}
        </ul>
        <p>
          <strong className="font-medium">De onde vem: </strong>
          <span className="text-textMuted">{guia.deOndeVem}</span>
        </p>
        <p>
          <strong className="font-medium">Quando olhar com cuidado: </strong>
          <span className="text-textMuted">{guia.alerta}</span>
        </p>
        <p className="text-xs">
          <Link className="text-accent hover:underline" href={`/manual#guia-${id}`}>
            Ver no Guia dos relatórios do manual
          </Link>
        </p>
      </div>
    </details>
  )
}

import type { Relatorio } from '@/lib/dashboard-catalogo'

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
    <section id={relatorio.id} className="scroll-mt-20 border-t border-border pt-8">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-lg font-extrabold">{relatorio.titulo}</h3>
        {acao}
      </div>
      <p className="mt-1 text-sm text-textMuted">{relatorio.pergunta}</p>
      <div className="mt-4">{children}</div>
    </section>
  )
}

/** Estado vazio padrão — um relatório sem dado diz por que, não some da tela. */
export function SemDados({ children }: { children: React.ReactNode }) {
  return (
    <p className="border-l-2 border-borderSoft bg-surface py-3 pl-4 text-sm text-textMuted">
      {children}
    </p>
  )
}

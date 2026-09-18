import {
  ROTULO_GRUPO,
  gruposComRelatorios,
  relatoriosDoGrupo,
} from '@/lib/dashboard-catalogo'

/**
 * Índice dos relatórios, agrupado. Âncoras puras (`#id`) — a tela inteira é
 * server-rendered e continua navegável sem JavaScript.
 */
export function DashboardIndice() {
  return (
    <nav
      aria-label="Relatórios disponíveis"
      className="mt-8 grid gap-x-8 gap-y-6 border-y border-border py-6 sm:grid-cols-2 lg:grid-cols-3"
    >
      {gruposComRelatorios().map((grupo) => (
        <div key={grupo}>
          <p className="text-xs font-semibold uppercase tracking-wide text-textFaint">
            {ROTULO_GRUPO[grupo]}
          </p>
          <ul className="mt-2 space-y-1">
            {relatoriosDoGrupo(grupo).map((relatorio) => (
              <li key={relatorio.id}>
                <a
                  className="text-sm text-textMuted hover:text-accent"
                  href={`#${relatorio.id}`}
                >
                  {relatorio.titulo}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  )
}

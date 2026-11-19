import Link from 'next/link'

import type { Pagina } from '@/lib/paginacao'

/**
 * Rodapé de paginação: "26–50 de 53" com Anterior/Próxima e "Ver todos".
 *
 * São links comuns que preservam os demais parâmetros da query (filtros,
 * busca): a tela segue linkável e funciona sem JavaScript. Some quando tudo
 * cabe numa página e ninguém pediu "todas". Na impressão, não aparece.
 */
export function Paginacao({
  pagina,
  rota,
  parametros,
  nome = 'itens',
}: {
  pagina: Pagina<unknown>
  rota: string
  /** Query atual SEM `pagina` — filtros e busca ficam como estão. */
  parametros: Record<string, string>
  /** Plural do que se lista: "projetos", "ações". */
  nome?: string
}) {
  if (pagina.totalPaginas <= 1 && !pagina.todas) return null

  const link = (alvo: number | 'todas') => {
    const q = new URLSearchParams(parametros)
    if (alvo !== 1) q.set('pagina', String(alvo))
    const texto = q.toString()
    return texto === '' ? rota : `${rota}?${texto}`
  }
  const classe = 'rounded-md border border-border px-3 py-1.5 text-sm hover:border-accent'
  const desligado = 'rounded-md border border-borderSoft px-3 py-1.5 text-sm text-textFaint'

  return (
    <nav
      aria-label="Paginação"
      className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-textMuted print:hidden"
    >
      <p role="status">
        {pagina.todas
          ? `Mostrando todos os ${pagina.total} ${nome}.`
          : `${pagina.de}–${pagina.ate} de ${pagina.total} ${nome}`}
      </p>
      <div className="flex items-center gap-2">
        {pagina.todas ? (
          <Link className={classe} href={link(1)}>
            Voltar às páginas
          </Link>
        ) : (
          <>
            {pagina.pagina > 1 ? (
              <Link className={classe} href={link(pagina.pagina - 1)} rel="prev">
                Anterior
              </Link>
            ) : (
              <span className={desligado}>Anterior</span>
            )}
            <span className="tabular-nums">
              Página {pagina.pagina} de {pagina.totalPaginas}
            </span>
            {pagina.pagina < pagina.totalPaginas ? (
              <Link className={classe} href={link(pagina.pagina + 1)} rel="next">
                Próxima
              </Link>
            ) : (
              <span className={desligado}>Próxima</span>
            )}
            <Link className="ml-2 text-accent hover:underline" href={link('todas')}>
              Ver todos
            </Link>
          </>
        )}
      </div>
    </nav>
  )
}

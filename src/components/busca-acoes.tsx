import Link from 'next/link'

/**
 * Busca nas ações de um projeto. Form GET puro (sem JavaScript): enviar volta
 * à primeira página porque o formulário não carrega `pagina`. Mantém a data da
 * "foto" (`em`) quando há uma.
 */
export function BuscaAcoes({
  rota,
  busca,
  em,
}: {
  rota: string
  busca: string | null
  em: string | null
}) {
  return (
    <form action={rota} className="mt-6 flex flex-wrap items-end gap-3 print:hidden" method="get">
      {em !== null ? <input name="em" type="hidden" value={em} /> : null}
      <div className="min-w-64 flex-1">
        <label className="block text-sm font-medium text-textMuted" htmlFor="busca-acoes">
          Buscar nas ações
        </label>
        <input
          className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-accent focus:ring-1 focus:ring-accent"
          defaultValue={busca ?? ''}
          id="busca-acoes"
          name="busca"
          placeholder="Descrição, responsável ou número"
          type="search"
        />
      </div>
      <button
        className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-onAccent"
        type="submit"
      >
        Buscar
      </button>
      {busca !== null ? (
        <Link
          className="text-sm text-textMuted hover:text-text"
          href={em !== null ? `${rota}?em=${em}` : rota}
        >
          Limpar busca
        </Link>
      ) : null}
    </form>
  )
}

import { vincularColaborador } from '@/app/wins/acoes-win'

export type ColaboradorLivre = { id: string; nome: string }

/**
 * Primeira entrada de um usuário: escolher qual colaborador ele é.
 *
 * O vínculo existe porque o nome do colaborador é o que vai para
 * `Projeto.responsavel` quando um WIN for promovido — sem ele, a promoção não
 * saberia de quem é o item.
 */
export function VincularColaborador({ livres }: { livres: ColaboradorLivre[] }) {
  return (
    <div className="mt-8 border-l-2 border-previsto bg-surface p-4">
      <h2 className="font-display text-base font-extrabold">Quem é você?</h2>
      <p className="mt-1 text-sm text-textMuted">
        Sua conta ainda não está vinculada a um colaborador. Escolha seu nome uma
        única vez — é ele que vai para o plano de ação quando um WIN for promovido.
      </p>

      {livres.length === 0 ? (
        <p className="mt-4 text-sm text-warn">
          Não há colaborador disponível para vincular. Peça para cadastrarem seu
          nome antes de usar o card.
        </p>
      ) : (
        <form action={vincularColaborador} className="mt-4 flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs text-textMuted" htmlFor="colaboradorId">
              Colaborador
            </label>
            <select
              className="mt-1 rounded-md border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-accent focus:ring-1 focus:ring-accent"
              id="colaboradorId"
              name="colaboradorId"
              defaultValue=""
            >
              <option value="">Selecione…</option>
              {livres.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>
          <button
            className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-onAccent"
            type="submit"
          >
            Vincular
          </button>
        </form>
      )}
    </div>
  )
}

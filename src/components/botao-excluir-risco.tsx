'use client'

import { excluirRisco } from '@/app/projetos/acoes-risco'

/** Exclui o registro (feito por engano) depois de confirmar. */
export function BotaoExcluirRisco({ id, titulo }: { id: string; titulo: string }) {
  return (
    <form
      action={excluirRisco}
      onSubmit={(e) => {
        if (!window.confirm(`Excluir "${titulo}"? Se ele só foi resolvido, prefira mudar o status: a exclusão apaga também o histórico.`)) e.preventDefault()
      }}
    >
      <input name="riscoId" type="hidden" value={id} />
      <button aria-label={`Excluir o registro ${titulo}`} className="text-textMuted hover:text-warn" type="submit">
        Excluir
      </button>
    </form>
  )
}

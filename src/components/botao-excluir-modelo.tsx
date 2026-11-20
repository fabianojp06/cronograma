'use client'

import { excluirModelo } from '@/app/modelos/acoes-modelo'

/** Exclui o modelo depois de uma confirmação (não há como desfazer). */
export function BotaoExcluirModelo({ id, nome }: { id: string; nome: string }) {
  return (
    <form
      action={excluirModelo}
      onSubmit={(e) => {
        if (
          !window.confirm(
            `Excluir o modelo "${nome}"? Os projetos já criados com ele não mudam, mas o modelo não poderá ser recuperado.`,
          )
        ) {
          e.preventDefault()
        }
      }}
    >
      <input name="modeloId" type="hidden" value={id} />
      <button aria-label={`Excluir o modelo ${nome}`} className="text-textMuted hover:text-warn" type="submit">
        Excluir
      </button>
    </form>
  )
}

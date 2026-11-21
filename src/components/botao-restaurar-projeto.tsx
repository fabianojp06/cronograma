'use client'

import { restaurarProjeto } from '@/app/projetos/acoes-projeto'

/** Restaura o projeto da lixeira depois de confirmar. */
export function BotaoRestaurarProjeto({ id, nome }: { id: string; nome: string }) {
  return (
    <form
      action={restaurarProjeto}
      onSubmit={(e) => {
        if (!window.confirm(`Restaurar o projeto "${nome}"? Ele volta para a lista com todas as ações e o histórico.`)) e.preventDefault()
      }}
    >
      <input name="id" type="hidden" value={id} />
      <button
        aria-label={`Restaurar o projeto ${nome}`}
        className="rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-onAccent"
        type="submit"
      >
        Restaurar
      </button>
    </form>
  )
}

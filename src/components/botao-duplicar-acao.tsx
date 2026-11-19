'use client'

import { useActionState } from 'react'

import { duplicarAcao, type EstadoDuplicar } from '@/app/projetos/acoes-duplicar'
import { Spinner } from '@/components/indicador-envio'

const INICIAL: EstadoDuplicar = {}

/** Cria uma cópia da ação (sem andamento) e abre a edição dela. */
export function BotaoDuplicarAcao({ acaoId }: { acaoId: string }) {
  const [estado, duplicar, pendente] = useActionState(duplicarAcao, INICIAL)
  return (
    <form action={duplicar} className="mt-3" aria-busy={pendente}>
      <input name="id" type="hidden" value={acaoId} />
      <button
        className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm text-textMuted hover:border-accent hover:text-accent disabled:opacity-60"
        disabled={pendente}
        type="submit"
      >
        {pendente ? <Spinner /> : null}
        {pendente ? 'Duplicando…' : 'Duplicar esta ação'}
      </button>
      <span className="ml-3 text-xs text-textFaint">
        A cópia mantém o previsto e o responsável, mas começa como &quot;não iniciada&quot;.
      </span>
      {estado.erro ? (
        <p className="mt-2 text-sm text-warn" role="alert">
          {estado.erro}
        </p>
      ) : null}
    </form>
  )
}

'use client'

import { useActionState } from 'react'

import { removerWinDaSemana } from '@/app/wins/acoes-win'
import { Processando, Spinner } from '@/components/indicador-envio'

/** Tira um WIN da semana. Client só para poder mostrar que está processando. */
export function TirarWin({ registroId, ordem }: { registroId: string; ordem: number }) {
  const [, acao, enviando] = useActionState<null, FormData>(async (_anterior, dados) => {
    await removerWinDaSemana(dados)
    return null
  }, null)

  return (
    <form action={acao}>
      <Processando ativo={enviando} texto="Tirando WIN…" />
      <input type="hidden" name="registroId" value={registroId} />
      <button
        className="inline-flex items-center gap-1.5 text-xs text-textMuted hover:text-warn disabled:opacity-60"
        disabled={enviando}
        type="submit"
      >
        {enviando ? <Spinner className="size-3" /> : null}
        Tirar WIN {String(ordem).padStart(2, '0')} da semana
      </button>
    </form>
  )
}

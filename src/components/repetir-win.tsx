'use client'

import { useActionState } from 'react'

import { repetirWin, type EstadoRepeticao } from '@/app/wins/acoes-win'

/**
 * Traz um WIN da semana anterior para a semana atual.
 *
 * É este botão que faz a regra das 3 semanas funcionar. Redigitar o mesmo
 * texto no formulário cria um `Win` novo, com o contador em zero; só
 * reaproveitando a mesma linha as aparições se somam até a promoção. Por isso
 * o caminho é um botão explícito, e não o reconhecimento do texto: comparar
 * descrições adivinharia o que o usuário quis dizer.
 */
export function RepetirWin({
  winId,
  semana,
  descricao,
}: {
  winId: string
  semana: { ano: number; semana: number }
  descricao: string
}) {
  const [estado, acao, enviando] = useActionState<EstadoRepeticao, FormData>(repetirWin, {})

  return (
    <form action={acao} className="mt-2">
      <input type="hidden" name="winId" value={winId} />
      <input type="hidden" name="ano" value={semana.ano} />
      <input type="hidden" name="semana" value={semana.semana} />
      <button
        className="text-xs font-medium text-accent hover:underline disabled:opacity-60"
        type="submit"
        disabled={enviando}
      >
        {enviando ? 'Repetindo…' : 'Repetir nesta semana'}
      </button>
      <span className="sr-only">{descricao}</span>
      {estado.erroGeral ? (
        <p className="mt-1 text-xs text-warn">{estado.erroGeral}</p>
      ) : null}
    </form>
  )
}

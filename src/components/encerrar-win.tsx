'use client'

import { encerrarWin } from '@/app/wins/acoes-win'

/**
 * Encerra um WIN sem promovê-lo: concluído de vez, ou abandonado.
 *
 * Tirar o WIN da semana (`removerWinDaSemana`) e encerrá-lo são coisas
 * diferentes: o primeiro libera a vaga e o WIN pode voltar na semana seguinte
 * somando aparições; o segundo diz que ele não volta mais. Sem esta ação,
 * `Win.encerradoEm` seria um campo que nada escreve.
 */
export function EncerrarWin({
  winId,
  ordem,
  semana,
}: {
  winId: string
  ordem: number
  semana: { ano: number; semana: number }
}) {
  return (
    <form action={encerrarWin}>
      <input type="hidden" name="winId" value={winId} />
      <input type="hidden" name="ano" value={semana.ano} />
      <input type="hidden" name="semana" value={semana.semana} />
      <button className="text-xs text-textMuted hover:text-warn" type="submit">
        Encerrar WIN {String(ordem).padStart(2, '0')}
      </button>
    </form>
  )
}

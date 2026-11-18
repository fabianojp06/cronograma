'use client'

import { useActionState } from 'react'

import { encerrarWin, type EstadoEncerramento } from '@/app/wins/acoes-win'
import { DESFECHOS_ENCERRAMENTO, ROTULO_DESFECHO } from '@/lib/win-validacao'
import { Processando } from '@/components/indicador-envio'

/**
 * Encerra um WIN sem promovê-lo, **perguntando como ele terminou**.
 *
 * Tirar o WIN da semana (`removerWinDaSemana`) e encerrá-lo são coisas
 * diferentes: o primeiro libera a vaga e o WIN pode voltar somando aparições; o
 * segundo diz que ele não volta.
 *
 * Os dois botões não são cerimônia. Sem a pergunta, o WIN encerrado guarda o
 * status que por acaso tinha — quase sempre PENDENTE — e a taxa de conclusão
 * semanal o conta como fracasso, inclusive quando a pessoa o concluiu.
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
  const [estado, acao, enviando] = useActionState<EstadoEncerramento, FormData>(
    encerrarWin,
    {},
  )

  return (
    <form action={acao} className="flex flex-wrap items-center gap-2">
      <Processando ativo={enviando} texto="Encerrando WIN…" />
      <input type="hidden" name="winId" value={winId} />
      <input type="hidden" name="ano" value={semana.ano} />
      <input type="hidden" name="semana" value={semana.semana} />
      <span className="text-xs text-textMuted">
        Encerrar WIN {String(ordem).padStart(2, '0')}:
      </span>
      {DESFECHOS_ENCERRAMENTO.map((desfecho) => (
        <button
          key={desfecho}
          className="text-xs text-textMuted underline-offset-2 hover:text-accent hover:underline disabled:opacity-60"
          type="submit"
          name="desfecho"
          value={desfecho}
          disabled={enviando}
        >
          {ROTULO_DESFECHO[desfecho]}
        </button>
      ))}
      {estado.erroGeral ? (
        <span className="w-full text-xs text-warn">{estado.erroGeral}</span>
      ) : null}
    </form>
  )
}

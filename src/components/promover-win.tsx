'use client'

import { useActionState, useState } from 'react'

import { promoverWin, type EstadoPromocao } from '@/app/wins/acoes-win'
import {
  DESTINOS_PROMOCAO,
  ROTULO_DESTINO,
  type DestinoPromocao,
} from '@/lib/win-promocao'

export type ProjetoOpcao = { id: string; nome: string }

/**
 * Promoção de um WIN ao plano de ação. O destino é escolhido na hora porque
 * nem todo WIN vira projeto: "Finalização da documentação do módulo de
 * integração" é parte do SGO, e forçar projeto novo fragmentaria a carteira.
 */
export function PromoverWin({
  winId,
  semana,
  descricao,
  projetos,
}: {
  winId: string
  semana: { ano: number; semana: number }
  descricao: string
  projetos: ProjetoOpcao[]
}) {
  const [estado, acao, enviando] = useActionState<EstadoPromocao, FormData>(
    promoverWin,
    {},
  )
  const [destino, setDestino] = useState<DestinoPromocao>('PROJETO')

  if (estado.promovido) {
    return (
      <p className="border-l-2 border-realizado bg-surface py-3 pl-4 text-sm text-realizado">
        Promovido ao plano de ação. O WIN sai do card e o acompanhamento passa a
        ser quinzenal.
      </p>
    )
  }

  return (
    <form action={acao} className="border-l-2 border-warn bg-surface p-4">
      <input type="hidden" name="winId" value={winId} />
      <input type="hidden" name="ano" value={semana.ano} />
      <input type="hidden" name="semana" value={semana.semana} />
      <p className="text-sm font-medium text-warn">
        Este WIN já vem se repetindo há 3 semanas.
      </p>
      <p className="mt-1 text-sm text-textMuted">{descricao}</p>
      <p className="mt-1 text-xs text-textFaint">
        Pela regra do Card WIN, deve virar item do plano de ação e sair do card.
      </p>

      <fieldset className="mt-4">
        <legend className="text-xs font-semibold uppercase tracking-wide text-textMuted">
          Promover como
        </legend>
        <div className="mt-2 space-y-2">
          {DESTINOS_PROMOCAO.map((opcao) => (
            <label key={opcao} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="destino"
                value={opcao}
                checked={destino === opcao}
                onChange={() => setDestino(opcao)}
              />
              {ROTULO_DESTINO[opcao]}
            </label>
          ))}
        </div>
      </fieldset>

      {destino === 'ACAO' ? (
        <div className="mt-3">
          <label className="block text-xs text-textMuted" htmlFor={`projeto-${winId}`}>
            Projeto que vai receber a ação
          </label>
          <select
            className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-accent focus:ring-1 focus:ring-accent"
            id={`projeto-${winId}`}
            name="projetoId"
            defaultValue=""
          >
            <option value="">Selecione…</option>
            {projetos.map((projeto) => (
              <option key={projeto.id} value={projeto.id}>
                {projeto.nome}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {estado.erroGeral ? <p className="mt-3 text-sm text-warn">{estado.erroGeral}</p> : null}

      <button
        className="mt-4 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-onAccent disabled:opacity-60"
        type="submit"
        disabled={enviando}
      >
        {enviando ? 'Promovendo…' : 'Promover ao plano de ação'}
      </button>
    </form>
  )
}

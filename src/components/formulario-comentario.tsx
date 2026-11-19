'use client'

import { useActionState, useEffect, useRef } from 'react'

import { comentarAcao, type EstadoComentario } from '@/app/projetos/acoes-comentario'
import { Spinner } from '@/components/indicador-envio'
import { LIMITE_COMENTARIO } from '@/lib/comentario-validacao'

const ESTADO_INICIAL: EstadoComentario = {}

/** Campo para acrescentar um comentário; limpa e confirma quando salva. */
export function FormularioComentario({ acaoId }: { acaoId: string }) {
  const [estado, enviar, pendente] = useActionState(comentarAcao, ESTADO_INICIAL)
  const campo = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (estado.enviado && campo.current) campo.current.value = ''
  }, [estado])

  return (
    <form action={enviar} aria-busy={pendente} className="mt-4">
      <input name="id" type="hidden" value={acaoId} />
      <label className="block text-sm font-medium text-textMuted" htmlFor="comentario-texto">
        Novo comentário
      </label>
      <textarea
        className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text outline-none placeholder:text-textFaint focus:border-accent focus:ring-1 focus:ring-accent"
        id="comentario-texto"
        maxLength={LIMITE_COMENTARIO}
        name="texto"
        placeholder="Ex.: aguardando retorno do fornecedor"
        ref={campo}
        rows={3}
      />
      {estado.erro ? (
        <p className="mt-1 text-sm text-warn" role="alert">
          {estado.erro}
        </p>
      ) : null}
      {estado.enviado && !pendente ? (
        <p className="mt-1 text-sm text-realizado" role="status">
          Comentário salvo.
        </p>
      ) : null}
      <button
        className="mt-2 inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-onAccent disabled:opacity-60"
        disabled={pendente}
        type="submit"
      >
        {pendente ? <Spinner /> : null}
        {pendente ? 'Salvando…' : 'Comentar'}
      </button>
    </form>
  )
}

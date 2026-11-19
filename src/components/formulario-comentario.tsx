'use client'

import { useActionState, useEffect, useRef } from 'react'

import { comentarAcao, type EstadoComentario } from '@/app/projetos/acoes-comentario'
import { Spinner } from '@/components/indicador-envio'
import { LIMITE_COMENTARIO } from '@/lib/comentario-validacao'

const ESTADO_INICIAL: EstadoComentario = {}

/** Campo para acrescentar um comentário; limpa e confirma quando salva. */
export function FormularioComentario({
  acaoId,
  colaboradores,
  responsavel,
}: {
  acaoId: string
  /** Quem pode ser marcado (ativos, sem quem está comentando). */
  colaboradores: { id: string; nome: string }[]
  /** Nome de quem responde pela ação, avisado em todo comentário. */
  responsavel: string | null
}) {
  const [estado, enviar, pendente] = useActionState(comentarAcao, ESTADO_INICIAL)
  const campo = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (estado.enviado && campo.current) {
      campo.current.value = ''
      // Limpa as marcações: o próximo comentário começa sem avisar ninguém além do responsável.
      campo.current.form
        ?.querySelectorAll<HTMLInputElement>('input[name="avisar"]')
        .forEach((caixa) => {
          caixa.checked = false
        })
    }
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
      <fieldset className="mt-3">
        <legend className="text-sm font-medium text-textMuted">Avisar no sistema</legend>
        <p className="text-xs text-textFaint">
          {responsavel
            ? `${responsavel}, que responde pela ação, é avisado(a) sempre.`
            : 'A ação não tem responsável: ninguém é avisado, a menos que você marque.'}
        </p>
        {colaboradores.length > 0 ? (
          <details className="mt-1">
            <summary className="cursor-pointer text-sm text-accent hover:underline">
              Marcar outras pessoas
            </summary>
            <ul className="mt-2 grid max-h-44 gap-1 overflow-auto sm:grid-cols-2">
              {colaboradores.map((c) => (
                <li key={c.id}>
                  <label className="flex items-center gap-2 text-sm">
                    <input name="avisar" type="checkbox" value={c.id} />
                    {c.nome}
                  </label>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </fieldset>
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

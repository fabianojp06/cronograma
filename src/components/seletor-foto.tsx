'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTransition, type FormEvent } from 'react'

import { Processando, Spinner } from '@/components/indicador-envio'

/**
 * Escolhe o dia da "foto" do projeto. Navega por query string (`?em=aaaa-mm-dd`),
 * como os filtros: a visão fica linkável e é calculada no servidor.
 */
export function SeletorFoto({
  rota,
  em,
  ontem,
}: {
  rota: string
  /** Dia da foto em exibição, ou `null` para o estado atual. */
  em: string | null
  /** Último dia que pode ser escolhido (`aaaa-mm-dd`). */
  ontem: string
}) {
  const router = useRouter()
  const [pending, iniciar] = useTransition()

  function aoEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    const valor = String(new FormData(evento.currentTarget).get('em') ?? '').trim()
    iniciar(() => router.push(valor === '' ? rota : `${rota}?em=${encodeURIComponent(valor)}`))
  }

  return (
    <form
      aria-busy={pending}
      className="mt-4 flex flex-wrap items-end gap-3 print:hidden"
      method="get"
      action={rota}
      onSubmit={aoEnviar}
    >
      <Processando ativo={pending} texto="Reconstruindo o projeto…" />
      <div>
        <label className="block text-sm font-medium text-textMuted" htmlFor="em">
          Ver o projeto em
        </label>
        <input
          className="mt-1 rounded-md border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-accent focus:ring-1 focus:ring-accent"
          id="em"
          name="em"
          type="date"
          max={ontem}
          defaultValue={em ?? ''}
        />
      </div>
      <button
        className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-onAccent disabled:opacity-60"
        type="submit"
        disabled={pending}
      >
        {pending ? <Spinner className="size-3.5" /> : null}
        Ver nesta data
      </button>
      {em !== null ? (
        <Link className="pb-2 text-sm text-accent hover:underline" href={rota}>
          Voltar ao estado atual
        </Link>
      ) : null}
    </form>
  )
}

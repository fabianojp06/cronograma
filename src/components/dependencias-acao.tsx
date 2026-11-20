'use client'

import { useActionState } from 'react'

import {
  adicionarDependencia,
  decidirLiberacao,
  pedirLiberacao,
  type EstadoDependencia,
} from '@/app/projetos/acoes-dependencia'
import { Spinner } from '@/components/indicador-envio'
import { LIMITE_MOTIVO } from '@/lib/dependencia-acao'

const INICIAL: EstadoDependencia = {}

const CAMPO =
  'w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text outline-none placeholder:text-textFaint focus:border-accent focus:ring-1 focus:ring-accent'
const BOTAO =
  'inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm text-textMuted hover:border-accent hover:text-accent disabled:opacity-60'

function Mensagem({ estado }: { estado: EstadoDependencia }) {
  if (estado.erro) {
    return (
      <p className="mt-2 text-sm text-warn" role="alert">
        {estado.erro}
      </p>
    )
  }
  if (estado.ok) {
    return (
      <p className="mt-2 text-sm text-accent" role="status">
        {estado.ok}
      </p>
    )
  }
  return null
}

/** Escolhe uma ação do projeto que precisa terminar antes desta. */
export function AdicionarDependencia({
  acaoId,
  opcoes,
}: {
  acaoId: string
  opcoes: { id: string; rotulo: string }[]
}) {
  const [estado, enviar, pendente] = useActionState(adicionarDependencia, INICIAL)
  if (opcoes.length === 0) return null
  return (
    <form action={enviar} aria-busy={pendente} className="mt-3">
      <input name="id" type="hidden" value={acaoId} />
      <label className="block text-sm font-medium text-textMuted" htmlFor="dependencia-predecessora">
        Esta ação só começa depois de terminar a ação
      </label>
      <div className="mt-1 flex gap-2">
        <select className={CAMPO} defaultValue="" id="dependencia-predecessora" name="predecessoraId">
          <option value="">Escolha…</option>
          {opcoes.map((o) => (
            <option key={o.id} value={o.id}>
              {o.rotulo}
            </option>
          ))}
        </select>
        <button className={BOTAO} disabled={pendente} type="submit">
          {pendente ? <Spinner /> : null}
          Adicionar
        </button>
      </div>
      <Mensagem estado={estado} />
    </form>
  )
}

/** Pedido de liberação (ou liberação direta, quando quem pede é o líder). */
export function PedirLiberacao({ acaoId, ehLider }: { acaoId: string; ehLider: boolean }) {
  const [estado, enviar, pendente] = useActionState(pedirLiberacao, INICIAL)
  return (
    <form action={enviar} aria-busy={pendente} className="mt-3">
      <input name="id" type="hidden" value={acaoId} />
      <label className="block text-sm font-medium text-textMuted" htmlFor="liberacao-motivo">
        {ehLider ? 'Liberar o início agora — motivo' : 'Pedir liberação ao líder — motivo'}
      </label>
      <textarea
        className={`${CAMPO} mt-1`}
        id="liberacao-motivo"
        maxLength={LIMITE_MOTIVO}
        name="motivo"
        placeholder="Ex.: o fornecedor já enviou o material; dá para começar em paralelo"
        rows={2}
      />
      <button className={`${BOTAO} mt-2`} disabled={pendente} type="submit">
        {pendente ? <Spinner /> : null}
        {ehLider ? 'Liberar' : 'Pedir liberação'}
      </button>
      <Mensagem estado={estado} />
    </form>
  )
}

/** O líder aprova ou recusa um pedido pendente. */
export function DecidirLiberacao({ liberacaoId }: { liberacaoId: string }) {
  const [estado, enviar, pendente] = useActionState(decidirLiberacao, INICIAL)
  return (
    <form action={enviar} aria-busy={pendente} className="mt-2">
      <input name="liberacaoId" type="hidden" value={liberacaoId} />
      <label className="sr-only" htmlFor={`just-${liberacaoId}`}>
        Justificativa (obrigatória para recusar)
      </label>
      <input
        className={CAMPO}
        id={`just-${liberacaoId}`}
        maxLength={LIMITE_MOTIVO}
        name="justificativa"
        placeholder="Justificativa (obrigatória para recusar)"
      />
      <div className="mt-2 flex gap-2">
        <button className={BOTAO} disabled={pendente} name="decisao" type="submit" value="aprovar">
          Aprovar
        </button>
        <button className={BOTAO} disabled={pendente} name="decisao" type="submit" value="recusar">
          Recusar
        </button>
      </div>
      <Mensagem estado={estado} />
    </form>
  )
}

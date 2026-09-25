'use client'

import { useActionState, useState } from 'react'

import {
  alternarAtivo,
  renomearColaborador,
  type EstadoAdmin,
} from '@/app/colaboradores/acoes-colaborador'

export type ColaboradorAdmin = {
  id: string
  nome: string
  area: string | null
  ativo: boolean
  vinculado: boolean
  cards: number
  wins: number
  /** Projetos cujo `responsavel` é exatamente este nome. */
  projetos: number
}

const classeCampo =
  'w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm text-text ' +
  'outline-none focus:border-accent focus:ring-1 focus:ring-accent'

export function LinhaColaborador({ colaborador }: { colaborador: ColaboradorAdmin }) {
  const [editando, setEditando] = useState(false)
  const [estadoNome, acaoNome, salvando] = useActionState<EstadoAdmin, FormData>(
    renomearColaborador,
    {},
  )
  const [estadoAtivo, acaoAtivo, alternando] = useActionState<EstadoAdmin, FormData>(
    alternarAtivo,
    {},
  )

  return (
    <li
      className={`border-l-2 bg-surface px-4 py-3 ${colaborador.ativo ? 'border-borderSoft' : 'border-textFaint'}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-64 flex-1">
          {editando ? (
            <form action={acaoNome} className="space-y-2">
              <input type="hidden" name="colaboradorId" value={colaborador.id} />
              <label className="sr-only" htmlFor={`nome-${colaborador.id}`}>
                Nome de {colaborador.nome}
              </label>
              <input
                className={classeCampo}
                id={`nome-${colaborador.id}`}
                name="nome"
                defaultValue={colaborador.nome}
                maxLength={120}
                autoFocus
              />
              {colaborador.projetos > 0 ? (
                <label className="flex items-start gap-2 text-xs text-textMuted">
                  <input
                    type="checkbox"
                    name="propagar"
                    value="sim"
                    defaultChecked
                    className="mt-0.5"
                  />
                  <span>
                    Atualizar também os{' '}
                    <strong className="font-medium text-text">
                      {colaborador.projetos} projeto(s)
                    </strong>{' '}
                    em que este nome é o responsável. Sem isso, o relatório por
                    responsável passa a contar duas pessoas.
                  </span>
                </label>
              ) : null}
              <div className="flex gap-2">
                <button
                  className="rounded-md bg-accent px-2.5 py-1 text-xs font-medium text-onAccent disabled:opacity-60"
                  type="submit"
                  disabled={salvando}
                >
                  {salvando ? 'Salvando…' : 'Salvar'}
                </button>
                <button
                  className="text-xs text-textMuted hover:text-text"
                  type="button"
                  onClick={() => setEditando(false)}
                >
                  Cancelar
                </button>
              </div>
            </form>
          ) : (
            <>
              <p className="font-medium text-text">
                {colaborador.nome}
                {colaborador.ativo ? null : (
                  <span className="ml-2 text-xs font-normal text-textFaint">inativo</span>
                )}
              </p>
              <p className="mt-0.5 text-xs text-textFaint">
                {colaborador.area ?? 'sem área'} ·{' '}
                {colaborador.vinculado ? 'conta vinculada' : 'sem conta'} ·{' '}
                {colaborador.cards} card(s), {colaborador.wins} WIN(s)
                {colaborador.projetos > 0
                  ? `, responsável por ${colaborador.projetos} projeto(s)`
                  : ''}
              </p>
            </>
          )}
        </div>

        <div className="flex items-center gap-3">
          {editando ? null : (
            <button
              className="text-xs text-textMuted hover:text-accent"
              type="button"
              onClick={() => setEditando(true)}
            >
              Renomear
            </button>
          )}
          <form action={acaoAtivo}>
            <input type="hidden" name="colaboradorId" value={colaborador.id} />
            <button
              className={`text-xs disabled:opacity-60 ${colaborador.ativo ? 'text-textMuted hover:text-warn' : 'text-accent hover:underline'}`}
              type="submit"
              disabled={alternando}
            >
              {colaborador.ativo ? 'Desativar' : 'Reativar'}
            </button>
          </form>
        </div>
      </div>

      {[estadoNome, estadoAtivo].map((estado, i) =>
        estado.erroGeral ? (
          <p key={i} className="mt-2 text-xs text-warn">
            {estado.erroGeral}
          </p>
        ) : estado.aviso ? (
          <p key={i} className="mt-2 text-xs text-textMuted">
            {estado.aviso}
          </p>
        ) : null,
      )}
    </li>
  )
}

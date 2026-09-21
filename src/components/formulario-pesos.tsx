'use client'

import Link from 'next/link'
import { useActionState } from 'react'

import { salvarPesos, type EstadoFormularioPesos } from '@/app/priorizacao/acoes-matriz'
import {
  GRUPOS_CRITERIO,
  ROTULO_GRUPO,
  criteriosDoGrupo,
  type GrupoCriterio,
} from '@/lib/matriz-criterios'
import type { PesosCriterios } from '@/lib/matriz-calculo'
import { SOMA_EXIGIDA } from '@/lib/matriz-validacao'

const ESTADO_INICIAL: EstadoFormularioPesos = {}

function Grupo({
  grupo,
  pesos,
  estado,
}: {
  grupo: GrupoCriterio
  pesos: PesosCriterios
  estado: EstadoFormularioPesos
}) {
  return (
    <fieldset className="border-l-2 border-accent pl-4">
      <legend className="text-xs font-semibold uppercase tracking-wide text-textMuted">
        {ROTULO_GRUPO[grupo]}
      </legend>
      <div className="mt-3 space-y-3">
        {criteriosDoGrupo(grupo).map((criterio) => (
          <div key={criterio.id} className="flex items-baseline gap-3">
            <label className="flex-1 text-sm text-text" htmlFor={criterio.id}>
              {criterio.rotulo}
            </label>
            <div>
              <div className="flex items-baseline gap-1">
                <input
                  className="w-20 rounded-md border border-border bg-surface px-2 py-1 text-right text-sm tabular-nums text-text outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                  id={criterio.id}
                  name={criterio.id}
                  type="number"
                  min={0}
                  max={SOMA_EXIGIDA}
                  step={1}
                  defaultValue={pesos[criterio.id]}
                />
                <span className="text-sm text-textFaint">%</span>
              </div>
              {estado.erros?.[criterio.id] ? (
                <p className="mt-1 text-xs text-warn">{estado.erros[criterio.id]}</p>
              ) : null}
            </div>
          </div>
        ))}
      </div>
      {estado.erros?.[grupo] ? (
        <p className="mt-3 text-sm text-warn">{estado.erros[grupo]}</p>
      ) : null}
    </fieldset>
  )
}

export function FormularioPesos({ pesos }: { pesos: PesosCriterios }) {
  const [estado, acao, enviando] = useActionState(salvarPesos, ESTADO_INICIAL)

  return (
    <form action={acao} className="mt-8 space-y-8">
      <div className="grid gap-8 lg:grid-cols-2">
        {GRUPOS_CRITERIO.map((grupo) => (
          <Grupo key={grupo} grupo={grupo} pesos={pesos} estado={estado} />
        ))}
      </div>

      {estado.erroGeral ? (
        <p className="border-l-2 border-warn bg-surface py-2 pl-4 text-sm text-warn">
          {estado.erroGeral}
        </p>
      ) : null}

      {estado.salvo ? (
        <p className="border-l-2 border-realizado bg-surface py-2 pl-4 text-sm text-realizado">
          Pesos salvos. Todos os projetos foram repontuados com a nova distribuição.
        </p>
      ) : null}

      <div className="flex items-center gap-4">
        <button
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-onAccent disabled:opacity-60"
          type="submit"
          disabled={enviando}
        >
          {enviando ? 'Salvando…' : 'Salvar pesos'}
        </button>
        <Link className="text-sm text-textMuted hover:text-accent" href="/priorizacao">
          Voltar para a matriz
        </Link>
      </div>
    </form>
  )
}

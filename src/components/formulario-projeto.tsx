'use client'

import { useActionState } from 'react'

import { criarProjeto, type EstadoFormularioProjeto } from '@/app/projetos/acoes-projeto'
import type { ErrosProjeto } from '@/lib/projeto-validacao'

const ESTADO_INICIAL: EstadoFormularioProjeto = {}

const classeRotulo = 'block text-sm font-medium text-textMuted'
const classeCampo =
  'mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text ' +
  'outline-none placeholder:text-textFaint focus:border-accent focus:ring-1 focus:ring-accent'

function Erro({ mensagem }: { mensagem?: string }) {
  if (!mensagem) return null
  return <p className="mt-1 text-sm text-warn">{mensagem}</p>
}

function Campo({
  nome,
  rotulo,
  erros,
  ...resto
}: {
  nome: keyof ErrosProjeto
  rotulo: string
  erros?: ErrosProjeto
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className={classeRotulo} htmlFor={nome}>
        {rotulo}
      </label>
      <input className={classeCampo} id={nome} name={nome} {...resto} />
      <Erro mensagem={erros?.[nome]} />
    </div>
  )
}

export function FormularioProjeto() {
  const [estado, acao, enviando] = useActionState(criarProjeto, ESTADO_INICIAL)
  const erros = estado.erros

  return (
    <form action={acao} className="mt-8 space-y-6" key={estado.criado?.id}>
      {estado.criado ? (
        <p className="border-l-2 border-accent bg-surface py-2 pl-3 text-sm text-text">
          Projeto <strong>{estado.criado.nome}</strong> criado.
        </p>
      ) : null}

      {estado.erroGeral ? (
        <p className="border-l-2 border-warn bg-surface py-2 pl-3 text-sm text-warn">
          {estado.erroGeral}
        </p>
      ) : null}

      <section className="border-l-2 border-accent pl-4">
        <h2 className="font-display text-base font-bold">Identificação</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Campo
              nome="nome"
              rotulo="Assunto (projeto / iniciativa) *"
              erros={erros}
              required
              maxLength={200}
              placeholder="Ex.: Modernização da rede interna"
            />
          </div>
          <Campo
            nome="referencia"
            rotulo="Referência"
            erros={erros}
            placeholder="Ex.: PLA-DEP-2026-014"
          />
          <Campo
            nome="prioridade"
            rotulo="Prioridade"
            erros={erros}
            type="number"
            min={1}
            step={1}
            placeholder="1"
          />
        </div>
      </section>

      <section className="border-l-2 border-borderSoft pl-4">
        <h2 className="font-display text-base font-bold">Classificação</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Campo nome="equipe" rotulo="Equipe" erros={erros} placeholder="STI" />
          <Campo
            nome="natureza"
            rotulo="Natureza"
            erros={erros}
            placeholder="Desenvolvimento"
          />
          <Campo nome="categoria" rotulo="Categoria" erros={erros} />
        </div>
      </section>

      <section className="border-l-2 border-borderSoft pl-4">
        <h2 className="font-display text-base font-bold">Responsáveis</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Campo nome="responsavel" rotulo="Responsável" erros={erros} />
          <Campo nome="apoio" rotulo="Apoio" erros={erros} />
          <Campo nome="setorEnvolvido" rotulo="Setor envolvido" erros={erros} />
        </div>
      </section>

      <section className="border-l-2 border-borderSoft pl-4">
        <h2 className="font-display text-base font-bold">Comentário</h2>
        <textarea
          className={`${classeCampo} min-h-24`}
          id="comentario"
          name="comentario"
          maxLength={2000}
        />
        <Erro mensagem={erros?.comentario} />
      </section>

      <div className="flex items-center gap-3">
        <button
          className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-onAccent disabled:opacity-60"
          disabled={enviando}
          type="submit"
        >
          {enviando ? 'Salvando…' : 'Salvar projeto'}
        </button>
        <a className="text-sm text-textMuted hover:text-text" href="/projetos">
          Cancelar
        </a>
      </div>
    </form>
  )
}

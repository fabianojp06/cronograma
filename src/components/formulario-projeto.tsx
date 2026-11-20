'use client'

import Link from 'next/link'
import { useActionState } from 'react'

import {
  atualizarProjeto,
  criarProjeto,
  type EstadoFormularioProjeto,
} from '@/app/projetos/acoes-projeto'
import type { ValoresProjeto } from '@/lib/projeto-edicao'
import type { ErrosProjeto } from '@/lib/projeto-validacao'
import { Processando, Spinner } from '@/components/indicador-envio'

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

export type ProjetoEmEdicao = { id: string; valores: ValoresProjeto }

/** O que o select de líder oferece (calculado no servidor por `opcoesDoLider`). */
export type EscolhasDeLider = { opcoes: { valor: string; rotulo: string }[]; selecionado: string }

/**
 * Mesmo formulário para criar e editar: quando `projeto` vem preenchido, o `id`
 * segue em campo oculto e a Server Action passa a ser `atualizarProjeto`.
 */
export function FormularioProjeto({
  projeto,
  lideres,
}: {
  projeto?: ProjetoEmEdicao
  lideres: EscolhasDeLider
}) {
  const editando = projeto !== undefined
  const [estado, acao, enviando] = useActionState(
    editando ? atualizarProjeto : criarProjeto,
    ESTADO_INICIAL,
  )
  const erros = estado.erros
  const valores = projeto?.valores

  return (
    <form action={acao} className="mt-8 space-y-6" key={estado.criado?.id}>
      <Processando ativo={enviando} texto="Salvando projeto…" />
      {projeto ? <input type="hidden" name="id" value={projeto.id} /> : null}

      {estado.criado ? (
        <p className="border-l-2 border-accent bg-surface py-2 pl-3 text-sm text-text">
          Projeto <strong>{estado.criado.nome}</strong> criado.
        </p>
      ) : null}

      {estado.salvo ? (
        <p className="border-l-2 border-accent bg-surface py-2 pl-3 text-sm text-text">
          Alterações do projeto <strong>{estado.salvo.nome}</strong> salvas.
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
            defaultValue={valores?.nome}
              rotulo="Assunto (projeto / iniciativa) *"
              erros={erros}
              required
              maxLength={200}
              placeholder="Ex.: Modernização da rede interna"
            />
          </div>
          <Campo
            nome="referencia"
            defaultValue={valores?.referencia}
            rotulo="Referência"
            erros={erros}
            placeholder="Ex.: PLA-DEP-2026-014"
          />
          <Campo
            nome="prioridade"
            defaultValue={valores?.prioridade}
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
          <Campo
            nome="equipe"
            defaultValue={valores?.equipe}
            rotulo="Equipe"
            erros={erros}
            placeholder="STI"
          />
          <Campo
            nome="natureza"
            defaultValue={valores?.natureza}
            rotulo="Natureza"
            erros={erros}
            placeholder="Desenvolvimento"
          />
          <Campo
            nome="categoria"
            defaultValue={valores?.categoria}
            rotulo="Categoria"
            erros={erros}
          />
        </div>
      </section>

      <section className="border-l-2 border-borderSoft pl-4">
        <h2 className="font-display text-base font-bold">Responsáveis</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <label className="block text-sm font-medium text-textMuted" htmlFor="lider">
              Responsável (líder do projeto)
            </label>
            <select
              className={classeCampo}
              defaultValue={lideres.selecionado}
              id="lider"
              name="lider"
            >
              {lideres.opcoes.map((o) => (
                <option key={o.valor} value={o.valor}>
                  {o.rotulo}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-textFaint">
              Escolha entre os colaboradores. O líder decide as liberações de início de ações.
            </p>
            <Erro mensagem={erros?.responsavel} />
          </div>
          <Campo
            nome="apoio"
            defaultValue={valores?.apoio}
            rotulo="Apoio"
            erros={erros}
          />
          <Campo
            nome="setorEnvolvido"
            defaultValue={valores?.setorEnvolvido}
            rotulo="Setor envolvido"
            erros={erros}
          />
        </div>
      </section>

      <section className="border-l-2 border-borderSoft pl-4">
        <h2 className="font-display text-base font-bold">Comentário</h2>
        <textarea
          className={`${classeCampo} min-h-24`}
          id="comentario"
          name="comentario"
          defaultValue={valores?.comentario}
          maxLength={2000}
        />
        <Erro mensagem={erros?.comentario} />
      </section>

      <div className="flex items-center gap-3">
        <button
          className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-onAccent disabled:opacity-60"
          disabled={enviando}
          type="submit"
        >
          {enviando ? <Spinner /> : null}
          {enviando ? 'Salvando…' : editando ? 'Salvar alterações' : 'Salvar projeto'}
        </button>
        <Link className="text-sm text-textMuted hover:text-text" href="/projetos">
          Cancelar
        </Link>
      </div>
    </form>
  )
}

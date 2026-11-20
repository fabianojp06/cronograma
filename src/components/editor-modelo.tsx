'use client'

import Link from 'next/link'
import { useActionState, useRef, useState } from 'react'

import {
  atualizarModelo,
  criarModelo,
  type EstadoEditorModelo,
} from '@/app/modelos/acoes-modelo'
import { Spinner } from '@/components/indicador-envio'
import { diaDeTerminoDoItem } from '@/lib/modelo-projeto'

const campo =
  'mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-accent focus:ring-1 focus:ring-accent'
const rotulo = 'block text-sm font-medium text-textMuted'
const botaoFraco =
  'rounded-md border border-border px-2 py-1 text-xs text-textMuted hover:border-accent hover:text-accent disabled:opacity-40'

export type LinhaEditor = { descricao: string; inicio: string; duracao: string }

export type ValoresEditorModelo = {
  nome: string
  descricao: string
  equipe: string
  natureza: string
  categoria: string
  apoio: string
  setorEnvolvido: string
  linhas: LinhaEditor[]
}

export const VALORES_EM_BRANCO: ValoresEditorModelo = {
  nome: '',
  descricao: '',
  equipe: '',
  natureza: '',
  categoria: '',
  apoio: '',
  setorEnvolvido: '',
  linhas: [{ descricao: '', inicio: '0', duracao: '5' }],
}

type LinhaComChave = LinhaEditor & { chave: number }

const INICIAL: EstadoEditorModelo = {}

function numero(bruto: string): number | null {
  const t = bruto.trim()
  return /^\d+$/.test(t) ? Number(t) : null
}

/**
 * Editor de modelo de projeto: dados, classificação e a lista de ações com
 * "começa no dia útil N" e "dura N dias úteis". Serve para criar e para editar
 * (`modeloId` + `versao` presentes). Tudo é controlado: o React 19 limpa campos
 * não controlados depois de uma ação com erro, e isso apagaria o que a pessoa
 * digitou.
 */
export function EditorModelo({
  inicial,
  modeloId,
  versao,
}: {
  inicial: ValoresEditorModelo
  modeloId?: string
  versao?: string
}) {
  const editando = modeloId !== undefined
  const [estado, enviar, pendente] = useActionState(editando ? atualizarModelo : criarModelo, INICIAL)

  const proximaChave = useRef(inicial.linhas.length)
  const [valores, setValores] = useState(() => ({
    nome: inicial.nome,
    descricao: inicial.descricao,
    equipe: inicial.equipe,
    natureza: inicial.natureza,
    categoria: inicial.categoria,
    apoio: inicial.apoio,
    setorEnvolvido: inicial.setorEnvolvido,
  }))
  const [linhas, setLinhas] = useState<LinhaComChave[]>(() =>
    inicial.linhas.map((l, i) => ({ ...l, chave: i })),
  )

  const mudar = (nome: keyof typeof valores) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setValores((v) => ({ ...v, [nome]: e.target.value }))

  const mudarLinha = (chave: number, parte: keyof LinhaEditor, valor: string) =>
    setLinhas((ls) => ls.map((l) => (l.chave === chave ? { ...l, [parte]: valor } : l)))

  const mover = (indice: number, delta: -1 | 1) =>
    setLinhas((ls) => {
      const destino = indice + delta
      if (destino < 0 || destino >= ls.length) return ls
      const copia = [...ls]
      ;[copia[indice], copia[destino]] = [copia[destino], copia[indice]]
      return copia
    })

  const acrescentar = () => {
    const ultima = linhas[linhas.length - 1]
    const inicioSugerido = ultima
      ? (() => {
          const fim = diaDeTerminoDoItem({
            inicioDiasUteis: numero(ultima.inicio),
            duracaoDiasUteis: numero(ultima.duracao),
          })
          return fim === null ? '' : String(fim + 1)
        })()
      : '0'
    setLinhas((ls) => [
      ...ls,
      { chave: proximaChave.current++, descricao: '', inicio: inicioSugerido, duracao: '5' },
    ])
  }

  const remover = (chave: number) => setLinhas((ls) => ls.filter((l) => l.chave !== chave))

  const errosPorLinha = new Map((estado.erros ?? []).map((e) => [e.linha, e.erro]))

  const total = linhas.reduce((maior, l) => {
    const fim = diaDeTerminoDoItem({ inicioDiasUteis: numero(l.inicio), duracaoDiasUteis: numero(l.duracao) })
    return fim === null ? maior : Math.max(maior, fim + 1)
  }, 0)

  return (
    <form action={enviar} aria-busy={pendente} className="mt-6 max-w-3xl space-y-8">
      {editando ? <input name="modeloId" type="hidden" value={modeloId} /> : null}
      {versao ? <input name="versao" type="hidden" value={versao} /> : null}

      <section className="space-y-4">
        <div>
          <label className={rotulo} htmlFor="modelo-nome">
            Nome do modelo *
          </label>
          <input className={campo} id="modelo-nome" maxLength={120} name="nome" onChange={mudar('nome')} required value={valores.nome} />
        </div>
        <div>
          <label className={rotulo} htmlFor="modelo-descricao">
            Para que serve (opcional)
          </label>
          <textarea className={campo} id="modelo-descricao" maxLength={1000} name="descricao" onChange={mudar('descricao')} rows={3} value={valores.descricao} />
        </div>
      </section>

      <section>
        <h2 className="font-display text-base font-bold">Classificação (opcional)</h2>
        <p className="text-xs text-textFaint">Vem preenchida nos projetos criados a partir do modelo.</p>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          {(
            [
              ['equipe', 'Equipe'],
              ['natureza', 'Natureza'],
              ['categoria', 'Categoria'],
              ['apoio', 'Apoio'],
              ['setorEnvolvido', 'Setor envolvido'],
            ] as const
          ).map(([nome, texto]) => (
            <div key={nome}>
              <label className={rotulo} htmlFor={`modelo-${nome}`}>
                {texto}
              </label>
              <input className={campo} id={`modelo-${nome}`} maxLength={500} name={nome} onChange={mudar(nome)} value={valores[nome]} />
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="titulo-acoes-modelo">
        <h2 className="font-display text-base font-bold" id="titulo-acoes-modelo">
          Ações do modelo
        </h2>
        <p className="mt-1 text-sm text-textMuted">
          O <strong className="font-medium">início</strong> conta em dias úteis a partir da data de início do
          projeto (0 = no mesmo dia). A <strong className="font-medium">duração</strong> conta o primeiro e o
          último dia. Deixe início e duração em branco para uma ação sem datas.
        </p>

        <ol className="mt-4 space-y-3">
          {linhas.map((l, i) => {
            const fim = diaDeTerminoDoItem({ inicioDiasUteis: numero(l.inicio), duracaoDiasUteis: numero(l.duracao) })
            const erro = errosPorLinha.get(i + 1)
            return (
              <li className="border-l-2 border-borderSoft bg-surface py-2 pl-3 pr-2" key={l.chave}>
                <div className="flex flex-wrap items-end gap-3">
                  <span className="w-6 pb-2 text-sm tabular-nums text-textFaint">{i + 1}.</span>
                  <div className="min-w-[14rem] flex-1">
                    <label className="sr-only" htmlFor={`acao-desc-${l.chave}`}>
                      Descrição da ação {i + 1}
                    </label>
                    <input
                      className={campo}
                      id={`acao-desc-${l.chave}`}
                      maxLength={500}
                      name="acaoDescricao"
                      onChange={(e) => mudarLinha(l.chave, 'descricao', e.target.value)}
                      placeholder="Descrição da ação"
                      value={l.descricao}
                    />
                  </div>
                  <div className="w-24">
                    <label className="block text-xs text-textMuted" htmlFor={`acao-inicio-${l.chave}`}>
                      Começa no dia
                    </label>
                    <input
                      className={campo}
                      id={`acao-inicio-${l.chave}`}
                      inputMode="numeric"
                      name="acaoInicio"
                      onChange={(e) => mudarLinha(l.chave, 'inicio', e.target.value)}
                      value={l.inicio}
                    />
                  </div>
                  <div className="w-24">
                    <label className="block text-xs text-textMuted" htmlFor={`acao-duracao-${l.chave}`}>
                      Dura (dias)
                    </label>
                    <input
                      className={campo}
                      id={`acao-duracao-${l.chave}`}
                      inputMode="numeric"
                      name="acaoDuracao"
                      onChange={(e) => mudarLinha(l.chave, 'duracao', e.target.value)}
                      value={l.duracao}
                    />
                  </div>
                  <div className="flex gap-1 pb-1">
                    <button aria-label={`Subir a ação ${i + 1}`} className={botaoFraco} disabled={i === 0} onClick={() => mover(i, -1)} type="button">
                      ↑
                    </button>
                    <button aria-label={`Descer a ação ${i + 1}`} className={botaoFraco} disabled={i === linhas.length - 1} onClick={() => mover(i, 1)} type="button">
                      ↓
                    </button>
                    <button aria-label={`Remover a ação ${i + 1}`} className={botaoFraco} onClick={() => remover(l.chave)} type="button">
                      Remover
                    </button>
                  </div>
                </div>
                {fim !== null ? (
                  <p className="mt-1 pl-9 text-xs text-textFaint">Termina no dia útil {fim}.</p>
                ) : null}
                {erro ? (
                  <p className="mt-1 pl-9 text-sm text-warn" role="alert">
                    {erro}
                  </p>
                ) : null}
              </li>
            )
          })}
        </ol>

        <div className="mt-3 flex flex-wrap items-center gap-4">
          <button className={botaoFraco} onClick={acrescentar} type="button">
            + Adicionar ação
          </button>
          <span className="text-sm text-textMuted" role="status">
            {linhas.length} {linhas.length === 1 ? 'ação' : 'ações'}
            {total > 0 ? ` · duração total de ${total} dias úteis` : ''}
          </span>
        </div>
      </section>

      {estado.erro ? (
        <p className="border-l-2 border-warn bg-surface py-2 pl-3 text-sm text-warn" role="alert">
          {estado.erro}
        </p>
      ) : null}

      <div className="flex items-center gap-4">
        <button
          className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-onAccent disabled:opacity-60"
          disabled={pendente}
          type="submit"
        >
          {pendente ? <Spinner /> : null}
          {pendente ? 'Salvando…' : editando ? 'Salvar alterações' : 'Criar modelo'}
        </button>
        <Link className="text-sm text-textMuted hover:text-accent" href="/modelos">
          Cancelar
        </Link>
      </div>
    </form>
  )
}

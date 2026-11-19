'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTransition, type FormEvent } from 'react'

import { ROTULO_STATUS_AGREGADO, STATUS_AGREGADOS } from '@/lib/projeto-resumo'
import { Processando, Spinner } from '@/components/indicador-envio'
import { periodoAtivo, type Periodo } from '@/lib/filtro-periodo'
import { algumFiltroAtivo, type FiltrosProjeto } from '@/lib/projeto-filtros'

const classeSelect =
  'mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text ' +
  'outline-none focus:border-accent focus:ring-1 focus:ring-accent'

const classeRotulo = 'block text-sm font-medium text-textMuted'

/**
 * Form com `method="get"`: os filtros viram query string, a tela fica linkável
 * e continua funcionando sem JavaScript — a listagem é um Server Component.
 *
 * Com JavaScript, o envio é interceptado para navegar dentro de uma transição:
 * enquanto a página nova é calculada no servidor (os Dashboards fazem várias
 * consultas), `pending` mostra o spinner no botão e um aviso no centro da tela.
 * Sem isso o clique parecia não ter feito nada.
 */
export function FiltrosProjetos({
  filtros,
  equipes,
  responsaveis,
  categorias,
  acao = '/projetos',
  periodo,
  comBusca = false,
  extras,
}: {
  filtros: FiltrosProjeto
  equipes: string[]
  responsaveis: string[]
  categorias: string[]
  /** Rota que recebe o GET — a mesma tela que renderiza os filtros. */
  acao?: string
  /** Quando presente, mostra os campos De/Até (só os Dashboards usam). */
  periodo?: Periodo
  /** Mostra o campo de busca por texto (painel e listagem; os Dashboards não usam). */
  comBusca?: boolean
  /** Parâmetros que acompanham o envio sem serem campos (ex.: a aba dos Dashboards). */
  extras?: Record<string, string>
}) {
  const router = useRouter()
  const [pending, iniciarTransicao] = useTransition()

  function navegar(destino: string) {
    iniciarTransicao(() => router.push(destino))
  }

  // "Limpar filtros" tira filtros e período, mas fica na mesma aba.
  const extrasTexto = new URLSearchParams(extras ?? {}).toString()
  const destinoSemFiltros = extrasTexto === '' ? acao : `${acao}?${extrasTexto}`

  function aoEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    const dados = new FormData(evento.currentTarget)
    const query = new URLSearchParams()
    for (const [chave, valor] of dados) {
      if (typeof valor === 'string' && valor.trim() !== '') query.set(chave, valor.trim())
    }
    const texto = query.toString()
    navegar(texto === '' ? acao : `${acao}?${texto}`)
  }

  return (
    <form
      aria-busy={pending}
      className="mt-6 border-l-2 border-accent pl-4"
      method="get"
      action={acao}
      onSubmit={aoEnviar}
    >
      <Processando ativo={pending} texto="Atualizando…" />
      {extras
        ? Object.entries(extras).map(([nome, valor]) => (
            <input key={nome} name={nome} type="hidden" value={valor} />
          ))
        : null}
      {comBusca ? (
        <div className="mb-4">
          <label className={classeRotulo} htmlFor="busca">
            Buscar
          </label>
          <input
            className={classeSelect}
            id="busca"
            name="busca"
            type="search"
            placeholder="Nome, referência, equipe, categoria ou responsável"
            defaultValue={filtros.busca ?? ''}
          />
        </div>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className={classeRotulo} htmlFor="equipe">
            Equipe
          </label>
          <select
            className={classeSelect}
            id="equipe"
            name="equipe"
            defaultValue={filtros.equipe ?? ''}
          >
            <option value="">Todas</option>
            {equipes.map((equipe) => (
              <option key={equipe} value={equipe}>
                {equipe}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={classeRotulo} htmlFor="responsavel">
            Responsável
          </label>
          <select
            className={classeSelect}
            id="responsavel"
            name="responsavel"
            defaultValue={filtros.responsavel ?? ''}
          >
            <option value="">Todos</option>
            {responsaveis.map((responsavel) => (
              <option key={responsavel} value={responsavel}>
                {responsavel}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={classeRotulo} htmlFor="categoria">
            Categoria
          </label>
          <select
            className={classeSelect}
            id="categoria"
            name="categoria"
            defaultValue={filtros.categoria ?? ''}
          >
            <option value="">Todas</option>
            {categorias.map((categoria) => (
              <option key={categoria} value={categoria}>
                {categoria}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={classeRotulo} htmlFor="status">
            Status agregado
          </label>
          <select
            className={classeSelect}
            id="status"
            name="status"
            defaultValue={filtros.status ?? ''}
          >
            <option value="">Todos</option>
            {STATUS_AGREGADOS.map((status) => (
              <option key={status} value={status}>
                {ROTULO_STATUS_AGREGADO[status]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {periodo !== undefined ? (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className={classeRotulo} htmlFor="de">
              Período — de
            </label>
            <input
              className={classeSelect}
              id="de"
              name="de"
              type="date"
              defaultValue={periodo.de ?? ''}
            />
          </div>
          <div>
            <label className={classeRotulo} htmlFor="ate">
              Período — até
            </label>
            <input
              className={classeSelect}
              id="ate"
              name="ate"
              type="date"
              defaultValue={periodo.ate ?? ''}
            />
          </div>
          <p className="text-sm text-textMuted sm:col-span-2">
            Considera as ações cujo período <strong className="font-medium">previsto</strong>{' '}
            cruza o intervalo. Ações sem data prevista ficam de fora.
          </p>
        </div>
      ) : null}

      <div className="mt-4 flex items-center gap-3">
        <button
          className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-onAccent disabled:opacity-60"
          disabled={pending}
          type="submit"
        >
          {pending ? <Spinner /> : null}
          {pending ? 'Filtrando…' : 'Filtrar'}
        </button>
        {algumFiltroAtivo(filtros) || (periodo !== undefined && periodoAtivo(periodo)) ? (
          <Link
            className="text-sm text-textMuted hover:text-text"
            href={destinoSemFiltros}
            onClick={(evento) => {
              evento.preventDefault()
              navegar(destinoSemFiltros)
            }}
          >
            Limpar filtros
          </Link>
        ) : null}
      </div>
    </form>
  )
}

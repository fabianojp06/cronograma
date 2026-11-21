'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'

import { descreverMudanca, type Panorama, type Tela } from '@/lib/reuniao'
import type { ItemResumo } from '@/lib/resumo-semanal'

const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

const TRACO = {
  atrasadas: 'border-warn',
  vencendo: 'border-previsto',
  replanejadas: 'border-accent',
  concluidas: 'border-realizado',
} as const

function Indicador({ rotulo, valor, traco }: { rotulo: string; valor: number; traco: string }) {
  return (
    <div className={`border-l-4 ${traco} pl-5`}>
      <p className="text-6xl font-extrabold tabular-nums md:text-8xl">{valor}</p>
      <p className="mt-2 text-xl text-textMuted md:text-2xl">{rotulo}</p>
    </div>
  )
}

function TelaPanorama({ p }: { p: Panorama }) {
  return (
    <div className="grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
      <Indicador rotulo="Projetos ativos" traco="border-borderSoft" valor={p.projetosAtivos} />
      <Indicador rotulo="Ações atrasadas" traco="border-warn" valor={p.atrasadas} />
      <Indicador rotulo="Vencem em 7 dias" traco="border-previsto" valor={p.vencendo} />
      <Indicador rotulo="Replanejadas na semana" traco="border-accent" valor={p.replanejadas} />
      <Indicador rotulo="Concluídas na semana" traco="border-realizado" valor={p.concluidas} />
      <Indicador rotulo="Ações acompanhadas" traco="border-borderSoft" valor={p.acoes} />
    </div>
  )
}

function LinhaDeAcao({ i, detalhe }: { i: ItemResumo; detalhe: string }) {
  return (
    <>
      <p className="text-2xl font-semibold md:text-3xl">
        {i.projetoNome} <span className="text-textFaint">·</span> ação {i.numero}
      </p>
      <p className="text-xl text-textMuted md:text-2xl">{i.descricao}</p>
      <p className="mt-1 text-lg text-textFaint md:text-xl">
        {i.responsavel ?? 'Sem responsável'} · {detalhe}
      </p>
    </>
  )
}

function TelaDeLista({ tela }: { tela: Exclude<Tela, { tipo: 'panorama' }> }) {
  const vazio: Record<typeof tela.tipo, string> = {
    atrasadas: 'Nenhuma ação atrasada.',
    vencendo: 'Nada vence nos próximos 7 dias.',
    replanejadas: 'Nenhuma data foi replanejada na semana.',
    concluidas: 'Nenhuma ação foi concluída na semana.',
  }
  if (tela.itens.length === 0) return <p className="text-3xl text-textMuted md:text-4xl">{vazio[tela.tipo]}</p>

  return (
    <ul className="space-y-6">
      {tela.tipo === 'replanejadas'
        ? tela.itens.map((r) => (
            <li className={`border-l-4 ${TRACO.replanejadas} pl-5`} key={r.acaoId}>
              <LinhaDeAcao
                detalhe={`${r.campo === 'previstoTermino' ? 'término' : 'início'}: ${descreverMudanca(r)}${
                  r.mudancas > 1 ? ` (${r.mudancas} mudanças)` : ''
                }${r.por ? ` · por ${r.por}` : ''}`}
                i={{ acaoId: r.acaoId, projetoId: r.projetoId, projetoNome: r.projetoNome, numero: r.numero, descricao: r.descricao, responsavel: r.responsavel, data: '' }}
              />
            </li>
          ))
        : tela.itens.map((i) => (
            <li className={`border-l-4 ${TRACO[tela.tipo]} pl-5`} key={i.acaoId}>
              <LinhaDeAcao
                detalhe={
                  tela.tipo === 'atrasadas'
                    ? `previsto para ${dm(i.data)} · ${i.diasAtraso} ${i.diasAtraso === 1 ? 'dia' : 'dias'} de atraso`
                    : tela.tipo === 'vencendo'
                      ? `vence em ${dm(i.data)}`
                      : `concluída em ${dm(i.data)}`
                }
                i={i}
              />
            </li>
          ))}
    </ul>
  )
}

/**
 * Apresentação para a daily: telas grandes, uma de cada vez, sobre o cabeçalho
 * do sistema. Setas, espaço ou os botões avançam; F alterna a tela cheia; Esc
 * sai (se a tela cheia estiver ligada, o primeiro Esc é do navegador).
 */
export function ApresentacaoReuniao({
  telas,
  equipes,
  equipeAtual,
  rotuloSemana,
}: {
  telas: Tela[]
  equipes: string[]
  equipeAtual: string | null
  rotuloSemana: string
}) {
  const roteador = useRouter()
  const [indice, setIndice] = useState(0)
  const total = telas.length
  const tela = telas[Math.min(indice, total - 1)]

  const ir = useCallback((novo: number) => setIndice(Math.max(0, Math.min(total - 1, novo))), [total])

  const alternarTelaCheia = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void document.documentElement.requestFullscreen?.()
  }, [])

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const alvo = e.target as HTMLElement | null
      if (alvo && ['INPUT', 'SELECT', 'TEXTAREA'].includes(alvo.tagName)) return
      if (['ArrowRight', 'ArrowDown', 'PageDown', ' '].includes(e.key)) {
        e.preventDefault()
        setIndice((i) => Math.min(total - 1, i + 1))
      } else if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(e.key)) {
        e.preventDefault()
        setIndice((i) => Math.max(0, i - 1))
      } else if (e.key === 'Home') setIndice(0)
      else if (e.key === 'End') setIndice(total - 1)
      else if (e.key === 'f' || e.key === 'F') alternarTelaCheia()
      else if (e.key === 'Escape' && !document.fullscreenElement) roteador.push('/')
    }
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  }, [total, roteador, alternarTelaCheia])

  const linkEquipe = (nome: string | null) => (nome === null ? '/reuniao' : `/reuniao?equipe=${encodeURIComponent(nome)}`)
  const ativo = 'bg-accent text-onAccent'
  const inativo = 'text-textMuted hover:text-accent'

  return (
    <div className="fixed inset-0 z-40 flex flex-col overflow-y-auto bg-bg text-text print:hidden">
      <header className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-border px-6 py-3 text-base">
        <span className="font-display font-extrabold">
          Reunião <span className="font-normal text-textMuted">· {rotuloSemana}</span>
        </span>
        <nav aria-label="Equipe" className="flex flex-wrap items-center gap-1">
          {[null, ...equipes].map((nome) => (
            <Link
              aria-current={nome === equipeAtual ? 'true' : undefined}
              className={`rounded-md px-3 py-1 ${nome === equipeAtual ? ativo : inativo}`}
              href={linkEquipe(nome)}
              key={nome ?? 'todas'}
            >
              {nome ?? 'Todas as equipes'}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-4">
          <button className={inativo} onClick={alternarTelaCheia} type="button">
            Tela cheia (F)
          </button>
          <Link className={inativo} href="/">
            Sair (Esc)
          </Link>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-8 py-10">
        <p className="text-lg font-medium uppercase tracking-wide text-accent md:text-xl">
          {equipeAtual ?? 'Todas as equipes'}
        </p>
        <h1 className="mt-2 font-display text-4xl font-extrabold md:text-6xl">
          {tela.titulo}
          {tela.tipo !== 'panorama' ? (
            <span className="ml-4 text-2xl font-normal text-textFaint md:text-3xl">
              {tela.total} {tela.total === 1 ? 'ação' : 'ações'}
              {tela.paginas > 1 ? ` · ${tela.pagina}/${tela.paginas}` : ''}
            </span>
          ) : null}
        </h1>
        <div aria-live="polite" className="mt-10">
          {tela.tipo === 'panorama' ? <TelaPanorama p={tela.panorama} /> : <TelaDeLista tela={tela} />}
        </div>
      </main>

      <footer className="flex items-center justify-between gap-4 border-t border-border px-6 py-3 text-base">
        <button className={`${inativo} disabled:opacity-40`} disabled={indice === 0} onClick={() => ir(indice - 1)} type="button">
          ← Anterior
        </button>
        <p className="text-textMuted tabular-nums" role="status">
          Tela {indice + 1} de {total}
        </p>
        <button className={`${inativo} disabled:opacity-40`} disabled={indice === total - 1} onClick={() => ir(indice + 1)} type="button">
          Próxima →
        </button>
      </footer>
    </div>
  )
}

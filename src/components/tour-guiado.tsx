'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useRef, useSyncExternalStore } from 'react'

import {
  CHAVE_TOUR_VISTO,
  PASSOS_TOUR,
  passosDoTour,
  posicionarBalao,
  type PassoTour,
  type Retangulo,
} from '@/lib/tour'

type EstadoTour = { indice: number; alvo: Retangulo | null; tela: { largura: number; altura: number } } | null

/**
 * O tour é um store externo ao React: o botão "Tour" (no meio do menu) e o
 * balão (no nível do cabeçalho) são componentes distintos e conversam por aqui.
 */
let estado: EstadoTour = null
/** Os passos do perfil de quem abriu o tour. */
let passos: readonly PassoTour[] = PASSOS_TOUR
const ouvintes = new Set<() => void>()
const notificar = () => ouvintes.forEach((o) => o())

function assinar(aoMudar: () => void) {
  ouvintes.add(aoMudar)
  window.addEventListener('storage', aoMudar)
  return () => {
    ouvintes.delete(aoMudar)
    window.removeEventListener('storage', aoMudar)
  }
}

/** Já viu (fez ou dispensou) neste navegador? */
function jaViu(): boolean {
  try {
    return localStorage.getItem(CHAVE_TOUR_VISTO) === '1'
  } catch {
    // Sem localStorage não dá para lembrar: não insiste com a oferta.
    return true
  }
}

function marcarVisto() {
  try {
    localStorage.setItem(CHAVE_TOUR_VISTO, '1')
  } catch {
    // Só deixa de lembrar.
  }
  notificar()
}

const LARGURA_BALAO = 340
const ALTURA_BALAO = 190

function medir(alvo: string | null): Retangulo | null {
  if (alvo === null) return null
  const el = document.querySelector<HTMLElement>(`[data-tour="${alvo}"]`)
  if (!el) return null
  el.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  const r = el.getBoundingClientRect()
  if (r.width === 0 && r.height === 0) return null
  return { top: r.top, left: r.left, width: r.width, height: r.height }
}

function fechar() {
  estado = null
  marcarVisto()
}

function abrir(doPerfil: readonly PassoTour[]) {
  passos = doPerfil
  ir(0)
}

function ir(novo: number) {
  if (novo < 0) return
  if (novo >= passos.length) {
    fechar()
    return
  }
  estado = {
    indice: novo,
    alvo: medir(passos[novo].alvo),
    tela: { largura: window.innerWidth, altura: window.innerHeight },
  }
  notificar()
}

const instantaneoEstado = () => estado

/** Botão "Tour" do cabeçalho. */
export function BotaoTour({ administrador }: { administrador: boolean }) {
  return (
    <button
      className="text-sm text-textMuted hover:text-accent"
      onClick={() => abrir(passosDoTour(administrador))}
      type="button"
    >
      Tour
    </button>
  )
}

/**
 * Convite de primeira visita (uma faixa DENTRO do cabeçalho, que não cobre
 * nada da página) e o tour em si: um balão sobre um destaque (sombra enorme ao
 * redor do alvo). Sem biblioteca. Esc sai; as setas avançam e voltam.
 */
export function TourGuiado({ administrador }: { administrador: boolean }) {
  const caminho = usePathname()
  const visto = useSyncExternalStore(assinar, jaViu, () => true)
  const atual = useSyncExternalStore(assinar, instantaneoEstado, () => null)
  const botaoProximo = useRef<HTMLButtonElement>(null)
  const indice = atual?.indice ?? 0
  const aberto = atual !== null

  useEffect(() => {
    if (aberto) botaoProximo.current?.focus()
  }, [aberto, indice])

  useEffect(() => {
    if (!aberto) return
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') fechar()
      else if (e.key === 'ArrowRight') ir(indice + 1)
      else if (e.key === 'ArrowLeft') ir(indice - 1)
    }
    const aoRedimensionar = () => ir(indice)
    window.addEventListener('keydown', aoTeclar)
    window.addEventListener('resize', aoRedimensionar)
    return () => {
      window.removeEventListener('keydown', aoTeclar)
      window.removeEventListener('resize', aoRedimensionar)
    }
  }, [aberto, indice])

  const emTelaDeCadastro = /^\/(bem-vindo|entrar|cadastrar|acesso-negado)/.test(caminho)
  const passo = passos[indice] ?? PASSOS_TOUR[0]
  const posicao = posicionarBalao(
    atual?.alvo ?? null,
    atual?.tela ?? { largura: 1024, altura: 768 },
    { largura: LARGURA_BALAO, altura: ALTURA_BALAO },
  )

  return (
    <>
      {!visto && !aberto && !emTelaDeCadastro ? (
        <div
          aria-label="Convite para o tour"
          className="order-last flex w-full flex-wrap items-center gap-x-4 gap-y-2 border-t border-borderSoft pt-2 text-sm print:hidden"
          role="region"
        >
          <span>
            <strong className="font-medium text-text">Primeira vez por aqui?</strong>{' '}
            <span className="text-textMuted">Um tour de 1 minuto mostra onde fica cada coisa.</span>
          </span>
          <button
            className="rounded-md bg-accent px-3 py-1 text-sm font-medium text-onAccent"
            onClick={() => abrir(passosDoTour(administrador))}
            type="button"
          >
            Fazer o tour
          </button>
          <button className="text-textMuted hover:text-accent" onClick={marcarVisto} type="button">
            Agora não
          </button>
        </div>
      ) : null}

      {atual ? (
        <div className="fixed inset-0 z-50 print:hidden">
          {/* Fundo que absorve o clique. */}
          <div aria-hidden className="absolute inset-0" onClick={fechar} />
          {atual.alvo ? (
            <div
              aria-hidden
              className="pointer-events-none absolute rounded-md ring-2 ring-accent"
              style={{
                top: atual.alvo.top - 4,
                left: atual.alvo.left - 6,
                width: atual.alvo.width + 12,
                height: atual.alvo.height + 8,
                boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)',
              }}
            />
          ) : (
            <div aria-hidden className="pointer-events-none absolute inset-0 bg-black/55" />
          )}
          <div
            aria-labelledby="tour-titulo"
            aria-modal="true"
            className="absolute rounded-md border border-border bg-surface p-4 text-sm shadow-xl"
            role="dialog"
            style={{ top: posicao.top, left: posicao.left, width: LARGURA_BALAO, maxWidth: 'calc(100vw - 24px)' }}
          >
            <p className="text-xs text-textFaint tabular-nums">
              Passo {indice + 1} de {passos.length}
            </p>
            <h2 className="mt-1 font-display text-base font-bold" id="tour-titulo">
              {passo.titulo}
            </h2>
            <p className="mt-1 text-textMuted">{passo.texto}</p>
            <div className="mt-4 flex items-center gap-3">
              <button
                className="text-textMuted hover:text-accent disabled:opacity-40"
                disabled={indice === 0}
                onClick={() => ir(indice - 1)}
                type="button"
              >
                Voltar
              </button>
              <button
                className="rounded-md bg-accent px-3 py-1.5 font-medium text-onAccent"
                onClick={() => ir(indice + 1)}
                ref={botaoProximo}
                type="button"
              >
                {indice === passos.length - 1 ? 'Concluir' : 'Próximo'}
              </button>
              <button className="ml-auto text-textFaint hover:text-warn" onClick={fechar} type="button">
                Sair
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

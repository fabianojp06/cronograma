'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

import { dispensarResumo } from '@/app/resumo-semanal/acoes-resumo'

export type LinhaPopup = { equipe: string; atrasadas: number; vencendo: number; concluidas: number }

export type DadosPopup = {
  rotuloSemana: string
  frase: string
  semana: string
  vazio: boolean
  equipes: LinhaPopup[]
  equipesOcultas: number
}

/** Telas em que um popup atrapalharia (cadastro) ou repetiria o que a pessoa já está vendo. */
const SEM_POPUP = /^\/(resumo-semanal|bem-vindo|entrar|cadastrar|acesso-negado)/

/**
 * Popup do resumo semanal, na primeira entrada do administrador depois da foto
 * da segunda-feira. "Fechar" (ou Esc) marca o aviso como lido; "Ver o resumo
 * completo" leva à tela. Reaparece em outra entrada enquanto não for dispensado.
 */
export function PopupResumoSemanal({ dados }: { dados: DadosPopup }) {
  const caminho = usePathname()
  const [aberto, setAberto] = useState(true)
  const formulario = useRef<HTMLFormElement>(null)
  const botaoFechar = useRef<HTMLButtonElement>(null)
  const visivel = aberto && !SEM_POPUP.test(caminho)

  useEffect(() => {
    if (!visivel) return
    botaoFechar.current?.focus()
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') formulario.current?.requestSubmit()
    }
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  }, [visivel])

  if (!visivel) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/55 p-4 print:hidden sm:items-center">
      <div
        aria-labelledby="popup-resumo-titulo"
        aria-modal="true"
        className="w-full max-w-lg rounded-md border border-border bg-surface p-5 text-sm shadow-xl"
        role="dialog"
      >
        <p className="text-xs font-medium text-accent">{dados.rotuloSemana}</p>
        <h2 className="mt-1 font-display text-lg font-extrabold" id="popup-resumo-titulo">
          Resumo da semana
        </h2>
        <p className="mt-1 text-textMuted">{dados.frase}</p>

        {dados.vazio ? null : (
          <table className="mt-4 w-full text-left">
            <thead>
              <tr className="text-xs text-textFaint">
                <th className="pb-1 font-medium" scope="col">Equipe</th>
                <th className="pb-1 text-right font-medium" scope="col">Atrasadas</th>
                <th className="pb-1 text-right font-medium" scope="col">Vencem em 7 dias</th>
                <th className="pb-1 text-right font-medium" scope="col">Concluídas</th>
              </tr>
            </thead>
            <tbody>
              {dados.equipes.map((e) => (
                <tr className="border-t border-borderSoft" key={e.equipe}>
                  <th className="py-1 pr-2 font-medium" scope="row">{e.equipe}</th>
                  <td className={`py-1 text-right tabular-nums ${e.atrasadas > 0 ? 'font-bold text-warn' : 'text-textMuted'}`}>{e.atrasadas}</td>
                  <td className="py-1 text-right tabular-nums text-textMuted">{e.vencendo}</td>
                  <td className="py-1 text-right tabular-nums text-textMuted">{e.concluidas}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {dados.equipesOcultas > 0 ? (
          <p className="mt-1 text-xs text-textFaint">e mais {dados.equipesOcultas} {dados.equipesOcultas === 1 ? 'equipe' : 'equipes'} no resumo completo.</p>
        ) : null}

        <form action={dispensarResumo} className="mt-5 flex flex-wrap items-center gap-4" onSubmit={() => setAberto(false)} ref={formulario}>
          <Link
            className="rounded-md bg-accent px-3 py-1.5 font-semibold text-onAccent"
            href={`/resumo-semanal?semana=${dados.semana}`}
            onClick={() => setAberto(false)}
          >
            Ver o resumo completo
          </Link>
          <button className="text-textMuted hover:text-accent" ref={botaoFechar} type="submit">
            Fechar
          </button>
        </form>
      </div>
    </div>
  )
}

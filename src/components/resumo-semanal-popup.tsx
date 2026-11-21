import { auth } from '@clerk/nextjs/server'

import { PopupResumoSemanal, type DadosPopup } from '@/components/popup-resumo-semanal'
import { resumoPendenteDe } from '@/lib/resumo-servidor'
import { frasePrincipal, resumoVazio, rotuloDaSemana } from '@/lib/resumo-semanal'

const MAXIMO_EQUIPES_NO_POPUP = 6

/**
 * Popup do resumo semanal para o administrador que ainda não o viu. Fica no
 * layout: roda em toda entrada, mas só faz alguma coisa para administrador de
 * verdade (`resumoPendenteDe` decide e nunca lança).
 */
export async function ResumoSemanalPopup() {
  const { userId } = await auth()
  if (!userId) return null
  const pendente = await resumoPendenteDe(userId)
  if (!pendente) return null

  const c = pendente.conteudo
  const dados: DadosPopup = {
    rotuloSemana: rotuloDaSemana(c.semana),
    frase: frasePrincipal(c),
    semana: c.semana,
    vazio: resumoVazio(c),
    equipes: c.equipes.slice(0, MAXIMO_EQUIPES_NO_POPUP).map((e) => ({
      equipe: e.equipe,
      atrasadas: e.atrasadas.total,
      vencendo: e.vencendo.total,
      concluidas: e.concluidas.total,
    })),
    equipesOcultas: Math.max(0, c.equipes.length - MAXIMO_EQUIPES_NO_POPUP),
  }
  return <PopupResumoSemanal dados={dados} />
}

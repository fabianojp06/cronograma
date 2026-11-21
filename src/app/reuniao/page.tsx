import { ApresentacaoReuniao } from '@/components/apresentacao-reuniao'
import { lerEquipe, montarTelas } from '@/lib/reuniao'
import { carregarReuniao } from '@/lib/reuniao-servidor'
import { rotuloDaSemana, semanaDisponivel } from '@/lib/resumo-semanal'

export const metadata = { title: 'Reunião — Cronograma CTCEA' }
export const dynamic = 'force-dynamic'

export default async function ReuniaoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const parametros = await searchParams
  // Duas leituras: a primeira só para saber quais equipes existem e validar a pedida.
  const todas = await carregarReuniao(null)
  const equipe = lerEquipe(parametros.equipe, todas.equipes)
  const dados = equipe === null ? todas : await carregarReuniao(equipe)

  const telas = montarTelas({
    acoes: dados.acoes,
    replanejadas: dados.replanejadas,
    riscos: dados.riscos,
    projetosAtivos: dados.projetosAtivos,
    hoje: dados.hoje,
  })

  return (
    <ApresentacaoReuniao
      equipeAtual={equipe}
      equipes={dados.equipes}
      rotuloSemana={rotuloDaSemana(semanaDisponivel(new Date()))}
      telas={telas}
    />
  )
}

import Link from 'next/link'
import { notFound } from 'next/navigation'

import {
  AlertasEPontos,
  AtividadesRealizadas,
  AvisosFlash,
  PedidoDeAjuda,
  PrincipaisRiscos,
  ProximasAtividades,
} from '@/components/flash-report/blocos-flash'
import { BotaoImprimir } from '@/components/flash-report/botao-imprimir'
import { CabecalhoFlash } from '@/components/flash-report/cabecalho-flash'
import { CurvaAvanco } from '@/components/flash-report/curva-avanco'
import { GanttMacro } from '@/components/flash-report/gantt-macro'
import { carregarFlashReport } from '@/lib/flash-report-servidor'
import { chaveSemana, rotuloSemana } from '@/lib/semana-ctcea'
import { inicioDeHojeUTC } from '@/lib/data-hoje'

export const metadata = { title: 'Flash Report — Cronograma CTCEA' }

/** A4 paisagem, numa folha só quando der; o resto (cabeçalho global, controles) some por `print:hidden`. */
const ESTILO_IMPRESSAO = '@page { size: A4 landscape; margin: 8mm } @media print { .flash-impressao { zoom: 0.7 } }'

export default async function FlashReportPage({
  params,
  searchParams,
}: PageProps<'/projetos/[id]/flash-report'>) {
  const { id } = await params
  const { semana: bruto } = await searchParams
  const semanaParam = Array.isArray(bruto) ? bruto[0] : bruto
  const agora = new Date()
  const dados = await carregarFlashReport(id, semanaParam, agora)
  if (!dados) notFound()

  const { relatorio, cabecalho, semana, semanaAnterior, semanaSeguinte, temMacroetapas } = dados
  const hoje = inicioDeHojeUTC(agora)
  const rota = `/projetos/${cabecalho.id}/flash-report`
  const link = 'text-accent hover:underline'

  return (
    <main className="flash-impressao mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
      <style>{ESTILO_IMPRESSAO}</style>

      <nav aria-label="Navegação do relatório" className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm print:hidden">
        <Link className={link} href={`/projetos/${cabecalho.id}`}>Voltar ao projeto</Link>
        <span className="text-textFaint" aria-hidden="true">|</span>
        {semanaAnterior ? (
          <Link className={link} href={`${rota}?semana=${chaveSemana(semanaAnterior)}`}>
            ← Semana anterior ({rotuloSemana(semanaAnterior)})
          </Link>
        ) : (
          <span className="text-textFaint">Primeira semana do projeto</span>
        )}
        {semanaSeguinte ? (
          <Link className={link} href={`${rota}?semana=${chaveSemana(semanaSeguinte)}`}>
            Semana seguinte ({rotuloSemana(semanaSeguinte)}) →
          </Link>
        ) : (
          <span className="text-textFaint">Última semana disponível</span>
        )}
        <span className="ml-auto"><BotaoImprimir /></span>
      </nav>

      <CabecalhoFlash
        cliente={cabecalho.cliente}
        lider={cabecalho.lider}
        nome={cabecalho.nome}
        objetivo={cabecalho.objetivo}
        referencia={cabecalho.referencia}
        relatorio={relatorio}
        semana={semana}
      />
      <AvisosFlash avisos={relatorio.avisos} />

      {relatorio.totalSemanas > 0 ? (
        <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] print:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <GanttMacro projetoId={cabecalho.id} relatorio={relatorio} temMacroetapas={temMacroetapas} />
          <CurvaAvanco curva={relatorio.curva} escolhida={relatorio.semanaDoProjeto} />
        </div>
      ) : null}

      <div className="mt-8 grid grid-cols-[minmax(0,1fr)] gap-8 md:grid-cols-2 print:grid-cols-2">
        <AtividadesRealizadas relatorio={relatorio} />
        <PrincipaisRiscos hoje={hoje} riscos={relatorio.riscos} />
        <ProximasAtividades relatorio={relatorio} />
        <AlertasEPontos alertas={relatorio.alertas} />
      </div>

      <div className="mt-8">
        <PedidoDeAjuda pedidos={relatorio.pedidosDeAjuda} />
      </div>

      <details className="mt-8 text-sm print:hidden">
        <summary className="cursor-pointer font-medium text-accent">Como ler este relatório</summary>
        <div className="mt-2 max-w-3xl space-y-2 text-textMuted">
          <p>
            <strong className="font-medium text-text">Avanço físico</strong> é a média, ponderada pelos dias úteis
            previstos de cada ação, do percentual de cada uma: o previsto pela posição de hoje entre o início e o
            término previstos, o realizado pelo status (não iniciada 0%, em curso 25, 50 ou 75%, concluída 100%).
            Por isso ele difere do percentual de ações concluídas do painel, que conta ações e não dias.
          </p>
          <p>
            <strong className="font-medium text-text">Farol</strong>: desvio é realizado menos previsto, em pontos
            percentuais. Atrasado a partir de −10, atenção a partir de −3, em dia até +3, adiantado acima. Risco de
            impacto alto com prazo vencido piora o farol em um nível.
          </p>
          <p>
            <strong className="font-medium text-text">Semana</strong> é a semana do calendário da CTCEA (domingo a
            sábado). Semanas passadas usam a foto reconstruída do histórico de alterações (avanço, farol e alerta de
            desvio das macroetapas); os alertas de ações atrasadas e bloqueadas, os riscos e as próximas atividades
            mostram sempre a situação de hoje.
          </p>
        </div>
      </details>
    </main>
  )
}

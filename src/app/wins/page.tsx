import Link from 'next/link'
import { auth } from '@clerk/nextjs/server'

import { CardWin, type LinhaWin } from '@/components/card-win'
import { EncerrarWin } from '@/components/encerrar-win'
import { PromoverWin } from '@/components/promover-win'
import { RepetirWin } from '@/components/repetir-win'
import { TirarWin } from '@/components/tirar-win'
import { VincularColaborador } from '@/components/vincular-colaborador'
import { inicioDeHojeUTC } from '@/lib/data-hoje'
import { formatarDataBR } from '@/lib/formatacao'
import { prisma } from '@/lib/prisma'
import {
  chaveSemana,
  ehSemanaValida,
  periodoDaSemana,
  rotuloSemana,
  semanaAnterior,
  semanaDe,
  semanaSeguinte,
  type SemanaCtcea,
} from '@/lib/semana-ctcea'
import { contarAparicoesAte, deveSerPromovido } from '@/lib/win-promocao'
import { ROTULO_STATUS_WIN } from '@/lib/win-validacao'
import { DesfechoWin } from '@/generated/prisma/enums'

export const metadata = { title: 'Card WIN — Cronograma CTCEA' }

const iso = (data: Date) => data.toISOString().slice(0, 10)

/** Lê ?ano= e ?semana= da URL; fora disso, a semana de hoje. */
function semanaDaUrl(
  params: Record<string, string | string[] | undefined>,
  hoje: Date,
): SemanaCtcea {
  const ler = (chave: string) => {
    const bruto = params[chave]
    const valor = Array.isArray(bruto) ? bruto[0] : bruto
    return typeof valor === 'string' ? Number(valor) : Number.NaN
  }

  const candidata = { ano: ler('ano'), semana: ler('semana') }
  return Number.isInteger(candidata.ano) && ehSemanaValida(candidata)
    ? candidata
    : semanaDe(hoje)
}

export default async function WinsPage({ searchParams }: PageProps<'/wins'>) {
  const { userId } = await auth()
  const hoje = inicioDeHojeUTC()
  const semana = semanaDaUrl(await searchParams, hoje)
  const anterior = semanaAnterior(semana)
  const periodo = periodoDaSemana(semana)

  const colaborador =
    userId === null
      ? null
      : await prisma.colaborador.findFirst({
          where: { clerkUserId: userId, ativo: true },
          select: { id: true, nome: true, area: true },
        })

  if (!colaborador) {
    // As sugestões vêm dos responsáveis que o plano de ação já conhece: é a
    // mesma grafia que volta para lá quando um WIN é promovido, e divergir
    // partiria a pessoa em duas no relatório por responsável.
    const [livres, responsaveis] = await Promise.all([
      prisma.colaborador.findMany({
        where: { clerkUserId: null, ativo: true },
        orderBy: { nome: 'asc' },
        select: { id: true, nome: true },
      }),
      prisma.projeto.findMany({
        where: { ativo: true, responsavel: { not: null } },
        distinct: ['responsavel'],
        orderBy: { responsavel: 'asc' },
        select: { responsavel: true },
      }),
    ])
    const sugestoes = responsaveis
      .map((p) => p.responsavel)
      .filter((n): n is string => n !== null && n.trim() !== '')
    return (
      <main className="mx-auto w-full max-w-4xl px-6 py-12">
        <h1 className="font-display text-2xl font-extrabold">Card WIN</h1>
        <VincularColaborador livres={livres} sugestoes={sugestoes} />
      </main>
    )
  }

  const [cardAtual, cardAnterior, projetos] = await Promise.all([
    prisma.cardSemanal.findUnique({
      where: {
        colaboradorId_ano_semana: {
          colaboradorId: colaborador.id,
          ano: semana.ano,
          semana: semana.semana,
        },
      },
      select: {
        area: true,
        atividade: true,
        alertaRiscos: true,
        pedidoAjuda: true,
        registros: {
          // Só o que está no card: promovido e encerrado viram histórico, e o
          // índice parcial já liberou a posição para outro WIN.
          where: { desfecho: DesfechoWin.NO_CARD },
          orderBy: { ordem: 'asc' },
          select: {
            id: true,
            ordem: true,
            prazo: true,
            status: true,
            win: {
              select: {
                id: true,
                descricao: true,
                suporte: true,
                aparicoesAnteriores: true,
                promovidoEm: true,
                encerradoEm: true,
                // As semanas de cada aparição, e não a contagem global: o
                // contador precisa refletir a semana que está sendo exibida.
                registros: {
                  select: { card: { select: { ano: true, semana: true } } },
                },
              },
            },
          },
        },
      },
    }),
    // O bloco "semana anterior" é CONSULTA, nunca cópia. Era a duplicação
    // manual desse bloco que fazia a planilha divergir de si mesma.
    prisma.cardSemanal.findUnique({
      where: {
        colaboradorId_ano_semana: {
          colaboradorId: colaborador.id,
          ano: anterior.ano,
          semana: anterior.semana,
        },
      },
      select: {
        registros: {
          // Só o que está no card: promovido e encerrado viram histórico, e o
          // índice parcial já liberou a posição para outro WIN.
          where: { desfecho: DesfechoWin.NO_CARD },
          orderBy: { ordem: 'asc' },
          select: {
            id: true,
            ordem: true,
            prazo: true,
            status: true,
            win: {
              select: {
                id: true,
                descricao: true,
                suporte: true,
                promovidoEm: true,
                encerradoEm: true,
              },
            },
          },
        },
      },
    }),
    prisma.projeto.findMany({
      where: { ativo: true },
      orderBy: { nome: 'asc' },
      select: { id: true, nome: true },
    }),
  ])

  const registrosDoCard = cardAtual?.registros ?? []
  type RegistroDoCard = (typeof registrosDoCard)[number]

  /** Contagem congelada na semana exibida — ver `contarAparicoesAte`. */
  const aparicoesNaSemana = (registro: RegistroDoCard) =>
    contarAparicoesAte(
      registro.win.aparicoesAnteriores,
      registro.win.registros.map((r) => r.card),
      semana,
    )

  const contavelDe = (registro: RegistroDoCard) => ({
    aparicoesAnteriores: 0,
    registros: aparicoesNaSemana(registro),
    promovidoEm: registro.win.promovidoEm,
    encerradoEm: registro.win.encerradoEm,
  })

  const linhas: LinhaWin[] = registrosDoCard.map((registro) => ({
    registroId: registro.id,
    winId: registro.win.id,
    ordem: registro.ordem,
    descricao: registro.win.descricao,
    suporte: registro.win.suporte,
    prazoIso: registro.prazo === null ? null : iso(registro.prazo),
    status: registro.status,
    aparicoes: aparicoesNaSemana(registro),
    // O componente recebe a contagem já resolvida para a semana exibida, e por
    // isso não precisa somar nada de novo.
    aparicoesAnteriores: 0,
    registros: aparicoesNaSemana(registro),
    promovidoEm: registro.win.promovidoEm?.toISOString() ?? null,
    encerradoEm: registro.win.encerradoEm?.toISOString() ?? null,
  }))

  const paraPromover = registrosDoCard.filter((registro) =>
    deveSerPromovido(contavelDe(registro)),
  )

  /**
   * Um WIN da semana anterior só pode ser repetido se ainda estiver em aberto
   * e não estiver já na semana atual. Promovido virou item do plano de ação;
   * encerrado foi dado por terminado — trazer qualquer um de volta desfaria
   * silenciosamente uma decisão que já foi tomada.
   */
  const jaNaSemana = new Set(registrosDoCard.map((registro) => registro.win.id))
  const repetiveis = new Set(
    (cardAnterior?.registros ?? [])
      .filter(
        (registro) =>
          registro.win.promovidoEm === null &&
          registro.win.encerradoEm === null &&
          !jaNaSemana.has(registro.win.id),
      )
      .map((registro) => registro.win.id),
  )

  const linkSemana = (alvo: SemanaCtcea) => `/wins?ano=${alvo.ano}&semana=${alvo.semana}`

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-12">
      <p className="text-sm font-medium uppercase tracking-wide text-accent">
        {colaborador.nome}
      </p>
      <h1 className="mt-2 font-display text-2xl font-extrabold">
        Card WIN — {rotuloSemana(semana)}
      </h1>
      <p className="mt-1 text-sm text-textMuted">
        {formatarDataBR(periodo.inicio)} a {formatarDataBR(periodo.fim)} · What&apos;s
        Important Now
      </p>

      <nav className="mt-4 flex items-center gap-4 text-sm">
        <Link className="text-textMuted hover:text-accent" href={linkSemana(anterior)}>
          ← {rotuloSemana(anterior)}
        </Link>
        <Link className="text-textMuted hover:text-accent" href="/wins">
          Semana atual
        </Link>
        <Link
          className="text-textMuted hover:text-accent"
          href={linkSemana(semanaSeguinte(semana))}
        >
          {rotuloSemana(semanaSeguinte(semana))} →
        </Link>
      </nav>

      {paraPromover.length > 0 ? (
        <section className="mt-8 space-y-4">
          {paraPromover.map((registro) => (
            <PromoverWin
              key={registro.win.id}
              winId={registro.win.id}
              semana={semana}
              descricao={registro.win.descricao}
              projetos={projetos}
            />
          ))}
        </section>
      ) : null}

      <section className="mt-8">
        <h2 className="font-display text-lg font-extrabold">WINs da semana</h2>
        <p className="mt-1 text-sm text-textMuted">
          No máximo três. É o método: obrigar a escolher é o que faz o card valer.
        </p>
        <div className="mt-4">
          <CardWin
            linhas={linhas}
            semana={semana}
            periodo={{ inicioIso: iso(periodo.inicio), fimIso: iso(periodo.fim) }}
            cabecalho={{
              area: cardAtual?.area ?? colaborador.area,
              atividade: cardAtual?.atividade ?? null,
              alertaRiscos: cardAtual?.alertaRiscos ?? null,
              pedidoAjuda: cardAtual?.pedidoAjuda ?? null,
            }}
          />
        </div>
        {linhas.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {linhas.map((linha) => (
              <div key={linha.registroId} className="flex items-center gap-2">
                <TirarWin registroId={linha.registroId ?? ''} ordem={linha.ordem} />
                {linha.winId && linha.promovidoEm === null && linha.encerradoEm === null ? (
                  <>
                    <span className="text-xs text-textFaint">·</span>
                    <EncerrarWin winId={linha.winId} ordem={linha.ordem} semana={semana} />
                  </>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <section className="mt-10 border-t border-border pt-8">
        <h2 className="font-display text-lg font-extrabold">
          WINs da semana anterior — {rotuloSemana(anterior)}
        </h2>
        <p className="mt-1 text-sm text-textMuted">
          Gerado a partir do card daquela semana. Não é cópia: nada aqui pode
          divergir do que foi registrado. Um WIN que continua aberto se traz
          para cá por <strong className="font-medium">Repetir nesta semana</strong> —
          é assim que ele soma as três aparições que disparam a promoção.
          Redigitá-lo no formulário começaria a contagem do zero.
        </p>
        {(cardAnterior?.registros ?? []).length === 0 ? (
          <p className="mt-4 border-l-2 border-borderSoft bg-surface py-3 pl-4 text-sm text-textMuted">
            Nenhum card registrado em {rotuloSemana(anterior)}.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-borderSoft border-l-2 border-borderSoft bg-surface">
            {(cardAnterior?.registros ?? []).map((registro) => (
              <li key={registro.id} className="px-4 py-3 text-sm">
                <span className="text-textFaint">
                  WIN {String(registro.ordem).padStart(2, '0')}
                </span>{' '}
                {registro.win.descricao}
                <span className="mt-1 block text-xs text-textFaint">
                  {registro.win.suporte ? `Suporte: ${registro.win.suporte} · ` : ''}
                  {registro.prazo ? `Prazo: ${formatarDataBR(registro.prazo)} · ` : ''}
                  {ROTULO_STATUS_WIN[registro.status]}
                </span>
                {repetiveis.has(registro.win.id) ? (
                  <RepetirWin
                    winId={registro.win.id}
                    semana={semana}
                    descricao={registro.win.descricao}
                  />
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="mt-10 border-t border-border pt-6 text-xs text-textFaint">
        Chave da semana: {chaveSemana(semana)}. O calendário é o da CTCEA (semana
        começa no domingo, semana 1 de 2026 em 28/12/2025) — não é a semana ISO.
      </p>
    </main>
  )
}

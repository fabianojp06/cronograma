import Link from 'next/link'

import { auth } from '@clerk/nextjs/server'

import { ROTULOS_STATUS, type StatusAcao } from '@/lib/acao-validacao'
import { inicioDeHojeUTC } from '@/lib/data-hoje'
import { formatarDataBR } from '@/lib/formatacao'
import {
  classificarMinhasAcoes,
  type AcaoClassificada,
} from '@/lib/minhas-acoes'
import { prisma } from '@/lib/prisma'

export const metadata = { title: 'Minhas ações — Cronograma CTCEA' }

/** Quantas concluídas mostrar: a lista inteira só esconderia o que está aberto. */
const MAX_CONCLUIDAS = 10

function Linha({ acao, atrasada }: { acao: AcaoClassificada; atrasada?: boolean }) {
  const nomeProjeto = acao.projeto.referencia
    ? `${acao.projeto.referencia} — ${acao.projeto.nome}`
    : acao.projeto.nome
  return (
    <li
      className={`border-l-2 bg-surface px-4 py-3 ${atrasada ? 'border-warn' : 'border-borderSoft'}`}
    >
      <Link
        className="font-medium text-text hover:text-accent"
        href={`/projetos/${acao.projetoId}/acoes/${acao.id}/editar`}
      >
        Ação {acao.numero}: {acao.descricao}
      </Link>
      <p className="mt-0.5 text-xs text-textFaint">
        <Link className="hover:text-accent" href={`/projetos/${acao.projetoId}`}>
          {nomeProjeto}
        </Link>
        {' · '}
        {ROTULOS_STATUS[acao.status as StatusAcao]}
        {' · '}
        {acao.previstoTermino ? `prazo ${formatarDataBR(acao.previstoTermino)}` : 'sem prazo'}
        {atrasada ? (
          <span className="text-warn">
            {' '}
            — {acao.diasDeAtraso === 1 ? '1 dia' : `${acao.diasDeAtraso} dias`} de atraso
          </span>
        ) : null}
      </p>
    </li>
  )
}

function Grupo({
  titulo,
  acoes,
  atrasada,
  vazio,
  total = acoes.length,
}: {
  titulo: string
  acoes: AcaoClassificada[]
  atrasada?: boolean
  vazio: string
  /** Total real, quando a lista mostrada é um recorte dela. */
  total?: number
}) {
  return (
    <section className="mt-10">
      <h2 className="font-display text-lg font-bold">
        {titulo} <span className="text-sm font-normal text-textFaint">({total})</span>
      </h2>
      {acoes.length === 0 ? (
        <p className="mt-2 text-sm text-textMuted">{vazio}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {acoes.map((a) => (
            <Linha key={a.id} acao={a} atrasada={atrasada} />
          ))}
        </ul>
      )}
    </section>
  )
}

export default async function MinhasAcoesPage() {
  const { userId } = await auth()
  const colaborador =
    userId === null
      ? null
      : await prisma.colaborador.findFirst({
          where: { clerkUserId: userId, ativo: true },
          select: { id: true, nome: true },
        })

  if (!colaborador) {
    return (
      <main className="mx-auto w-full max-w-4xl px-6 py-12">
        <h1 className="font-display text-2xl font-extrabold">Minhas ações</h1>
        <p className="mt-4 max-w-2xl text-sm text-textMuted">
          Sua conta ainda não está ligada a um colaborador, então não sei quais ações são
          suas. Escolha seu nome em{' '}
          <Link className="text-accent hover:underline" href="/wins">
            Card WIN
          </Link>{' '}
          e volte aqui.
        </p>
      </main>
    )
  }

  const acoes = await prisma.acao.findMany({
    where: { responsavelId: colaborador.id, projeto: { ativo: true } },
    select: {
      id: true,
      projetoId: true,
      numero: true,
      descricao: true,
      status: true,
      previstoInicio: true,
      previstoTermino: true,
      realizadoTermino: true,
      projeto: { select: { nome: true, referencia: true } },
    },
  })
  const grupos = classificarMinhasAcoes(acoes, inicioDeHojeUTC())

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-12">
      <p className="text-sm font-medium text-accent">
        {colaborador.nome}
      </p>
      <h1 className="mt-2 font-display text-2xl font-extrabold">Minhas ações</h1>
      <p className="mt-2 max-w-3xl text-sm text-textMuted">
        As ações dos projetos ativos em que você é o responsável. A que está atrasada é a
        que passou do prazo previsto sem ser concluída — a mesma regra do painel.
      </p>

      <Grupo
        titulo="Atrasadas"
        acoes={grupos.atrasadas}
        atrasada
        vazio="Nenhuma ação atrasada."
      />
      <Grupo
        titulo="Em aberto"
        acoes={grupos.emAberto}
        vazio="Nenhuma ação em aberto."
      />
      <Grupo
        titulo="Concluídas"
        acoes={grupos.concluidas.slice(0, MAX_CONCLUIDAS)}
        vazio="Nenhuma ação concluída ainda."
        total={grupos.concluidas.length}
      />
      {grupos.concluidas.length > MAX_CONCLUIDAS ? (
        <p className="mt-2 text-xs text-textFaint">
          Mostrando as {MAX_CONCLUIDAS} concluídas mais recentes, de{' '}
          {grupos.concluidas.length}.
        </p>
      ) : null}
    </main>
  )
}

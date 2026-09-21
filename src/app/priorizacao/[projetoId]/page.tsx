import Link from 'next/link'
import { notFound } from 'next/navigation'

import {
  FormularioAvaliacao,
  type ValoresAvaliacao,
} from '@/components/formulario-avaliacao'
import { MatrizQuadrantes, type PontoMatriz } from '@/components/matriz-quadrantes'
import {
  calcularAvaliacao,
  formatarTotal,
  ordenarPorPrioridade,
  type Avaliacao,
} from '@/lib/matriz-calculo'
import { DESCRICAO_QUADRANTE } from '@/lib/matriz-criterios'
import { montarPesos } from '@/lib/matriz-validacao'
import { formatarDataBR } from '@/lib/formatacao'
import { prisma } from '@/lib/prisma'

export const metadata = { title: 'Avaliar projeto — Cronograma CTCEA' }

export default async function AvaliarProjetoPage({
  params,
}: PageProps<'/priorizacao/[projetoId]'>) {
  const { projetoId } = await params

  const [projeto, linhasPeso, carteira] = await Promise.all([
    prisma.projeto.findFirst({
      where: { id: projetoId, ativo: true },
      select: {
        id: true,
        nome: true,
        referencia: true,
        equipe: true,
        responsavel: true,
        avaliacao: true,
      },
    }),
    prisma.pesoCriterio.findMany({ select: { criterio: true, peso: true } }),
    prisma.projeto.findMany({
      where: { ativo: true, avaliacao: { isNot: null } },
      select: { id: true, nome: true, avaliacao: true },
    }),
  ])

  if (!projeto) notFound()

  const pesos = montarPesos(linhasPeso)

  // A carteira inteira entra no plano para dar contexto; o projeto desta
  // página é o destacado e os demais ficam esmaecidos.
  const pontos: PontoMatriz[] = ordenarPorPrioridade(
    carteira.map((p) => ({
      projeto: p,
      resultado: calcularAvaliacao(p.avaliacao as unknown as Avaliacao, pesos),
    })),
  ).map(({ projeto: p, resultado: r }, indice) => ({
    id: p.id,
    nome: p.nome,
    posicao: indice + 1,
    beneficio: r.beneficio,
    esforco: r.esforco,
    gut: r.gut,
    prioridade: r.prioridade,
    quadrante: r.quadrante,
  }))
  const posicaoNoRanking = pontos.find((p) => p.id === projeto.id)?.posicao ?? null
  const avaliacao = projeto.avaliacao
  const resultado =
    avaliacao === null
      ? null
      : calcularAvaliacao(avaliacao as unknown as Avaliacao, pesos)

  const valores: ValoresAvaliacao =
    avaliacao === null ? null : (avaliacao as unknown as ValoresAvaliacao)

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-12">
      <p className="text-sm font-medium uppercase tracking-wide text-accent">
        {projeto.referencia ?? 'Matriz de Priorização'}
      </p>
      <h1 className="mt-2 font-display text-2xl font-extrabold">{projeto.nome}</h1>

      <div className="mt-4 flex flex-wrap gap-x-8 gap-y-2 text-sm text-textMuted">
        {projeto.equipe !== null && <span>Equipe: {projeto.equipe}</span>}
        {projeto.responsavel !== null && <span>Líder: {projeto.responsavel}</span>}
        <Link className="hover:text-accent" href={`/projetos/${projeto.id}`}>
          Ver cronograma do projeto
        </Link>
      </div>

      {resultado !== null && avaliacao !== null ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="border-l-2 border-realizado bg-surface py-2 pl-4">
            <p className="text-xs font-medium uppercase tracking-wide text-textMuted">
              Benefício
            </p>
            <p className="mt-1 font-display text-2xl font-extrabold tabular-nums">
              {formatarTotal(resultado.beneficio)}
            </p>
          </div>
          <div className="border-l-2 border-warn bg-surface py-2 pl-4">
            <p className="text-xs font-medium uppercase tracking-wide text-textMuted">
              Esforço
            </p>
            <p className="mt-1 font-display text-2xl font-extrabold tabular-nums">
              {formatarTotal(resultado.esforco)}
            </p>
          </div>
          <div className="border-l-2 border-previsto bg-surface py-2 pl-4">
            <p className="text-xs font-medium uppercase tracking-wide text-textMuted">
              GUT
            </p>
            <p className="mt-1 font-display text-2xl font-extrabold tabular-nums">
              {resultado.gut}
            </p>
          </div>
          <div className="border-l-2 border-accent bg-surface py-2 pl-4">
            <p className="text-xs font-medium uppercase tracking-wide text-textMuted">
              Prioridade
            </p>
            <p className="mt-1 font-display text-2xl font-extrabold tabular-nums text-accent">
              {formatarTotal(resultado.prioridade)}
            </p>
          </div>
          <div className="border-l-2 border-borderSoft bg-surface py-2 pl-4">
            <p className="text-xs font-medium uppercase tracking-wide text-textMuted">
              Quadrante
            </p>
            <p className="mt-1 font-display text-base font-extrabold">
              {DESCRICAO_QUADRANTE[resultado.quadrante].rotulo}
            </p>
            <p className="text-xs text-textFaint">
              {DESCRICAO_QUADRANTE[resultado.quadrante].recomendacao}
            </p>
          </div>
        </div>
      ) : (
        <p className="mt-8 border-l-2 border-borderSoft bg-surface py-3 pl-4 text-sm text-textMuted">
          Projeto ainda não avaliado. Os totais aparecem assim que as notas forem
          salvas.
        </p>
      )}

      {avaliacao !== null ? (
        <p className="mt-4 text-xs text-textFaint">
          Última avaliação em {formatarDataBR(avaliacao.updatedAt)}.
        </p>
      ) : null}

      {posicaoNoRanking !== null ? (
        <section className="mt-10 border-t border-border pt-8">
          <h2 className="font-display text-lg font-extrabold">Posição na matriz</h2>
          <p className="mt-1 text-sm text-textMuted">
            Este projeto é o <strong className="text-text">{posicaoNoRanking}º</strong> de{' '}
            {pontos.length} no ranking. Os demais projetos avaliados aparecem
            esmaecidos, para comparação.
          </p>
          <div className="mt-4">
            <MatrizQuadrantes pontos={pontos} destaqueId={projeto.id} />
          </div>
        </section>
      ) : null}

      <FormularioAvaliacao
        projetoId={projeto.id}
        projetoNome={projeto.nome}
        valores={valores}
      />
    </main>
  )
}

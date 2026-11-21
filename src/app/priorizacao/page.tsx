import Link from 'next/link'

import {
  MatrizQuadrantes,
  type PontoMatriz,
} from '@/components/matriz-quadrantes'
import {
  TabelaPriorizacao,
  type LinhaPriorizacao,
} from '@/components/tabela-priorizacao'
import {
  calcularAvaliacao,
  ordenarPorPrioridade,
  type Avaliacao,
} from '@/lib/matriz-calculo'
import {
  DESCRICAO_QUADRANTE,
  QUADRANTES,
  type Quadrante,
} from '@/lib/matriz-criterios'
import { montarPesos, pesosSaoPadrao } from '@/lib/matriz-validacao'
import { prisma } from '@/lib/prisma'

export const metadata = { title: 'Matriz de Priorização — Cronograma CTCEA' }

/**
 * Matriz de Priorização (Benefício x Esforço ponderado por GUT).
 *
 * Substitui a planilha homônima da CTCEA. Os totais não vêm do banco: são
 * calculados aqui a partir das notas e dos pesos vigentes, porque mudar um
 * peso tem de repontuar a carteira inteira na hora.
 */
export default async function PriorizacaoPage({
  searchParams,
}: PageProps<'/priorizacao'>) {
  const { projeto: projetoParam } = await searchParams
  const destaqueId = typeof projetoParam === 'string' && projetoParam !== '' ? projetoParam : null

  const [projetos, linhasPeso] = await Promise.all([
    prisma.projeto.findMany({
      where: { ativo: true },
      orderBy: [{ nome: 'asc' }],
      select: {
        id: true,
        nome: true,
        equipe: true,
        responsavel: true,
        prioridade: true,
        avaliacao: true,
      },
    }),
    prisma.pesoCriterio.findMany({ select: { criterio: true, peso: true } }),
  ])

  const pesos = montarPesos(linhasPeso)

  const avaliados = projetos.filter((projeto) => projeto.avaliacao !== null)
  const naoAvaliados = projetos.filter((projeto) => projeto.avaliacao === null)

  const linhas: LinhaPriorizacao[] = ordenarPorPrioridade(
    avaliados.map((projeto) => ({
      projeto,
      resultado: calcularAvaliacao(projeto.avaliacao as unknown as Avaliacao, pesos),
    })),
  ).map(({ projeto, resultado }, indice) => ({
    id: projeto.id,
    posicao: indice + 1,
    nome: projeto.nome,
    equipe: projeto.equipe,
    responsavel: projeto.responsavel,
    prioridadeManual: projeto.prioridade,
    ...resultado,
  }))

  const pontos: PontoMatriz[] = linhas.map((linha) => ({
    id: linha.id,
    nome: linha.nome,
    posicao: linha.posicao,
    beneficio: linha.beneficio,
    esforco: linha.esforco,
    gut: linha.gut,
    prioridade: linha.prioridade,
    quadrante: linha.quadrante,
  }))

  const porQuadrante = (quadrante: Quadrante) =>
    linhas.filter((linha) => linha.quadrante === quadrante).length

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-12">
      <p className="text-sm font-medium text-accent">
        Cronograma CTCEA
      </p>
      <h1 className="mt-2 font-display text-2xl font-extrabold">
        Matriz de Priorização
      </h1>
      <p className="mt-2 max-w-3xl text-sm text-textMuted">
        Benefício × Esforço ponderado por GUT. Cada projeto recebe nota de 0 a 9 em
        dez critérios e um GUT de 1 a 5 por fator; a prioridade é{' '}
        <span className="whitespace-nowrap">(Benefício × GUT) ÷ Esforço</span>.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        <Link className="text-textMuted hover:text-accent" href="/priorizacao/pesos">
          Ajustar pesos dos critérios
        </Link>
        {!pesosSaoPadrao(pesos) ? (
          <span className="border-l-2 border-previsto pl-3 text-xs text-textMuted">
            Os pesos foram ajustados e não são mais os 20% da planilha original.
          </span>
        ) : null}
      </div>

      {linhas.length === 0 ? (
        <div className="mt-10 border-l-2 border-borderSoft bg-surface py-4 pl-4">
          <p className="text-sm text-textMuted">
            Nenhum projeto avaliado ainda. A matriz precisa de pelo menos uma
            avaliação para posicionar alguém no plano.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {QUADRANTES.map((quadrante) => {
              const descricao = DESCRICAO_QUADRANTE[quadrante]
              return (
                <div
                  key={quadrante}
                  className="border-l-2 border-accent bg-surface py-2 pl-4"
                >
                  <p className="text-xs font-medium text-textMuted">
                    {descricao.numero}. {descricao.rotulo}
                  </p>
                  <p className="mt-1 font-display text-2xl font-extrabold tabular-nums">
                    {porQuadrante(quadrante)}
                  </p>
                  <p className="text-xs text-textFaint">{descricao.descricao}</p>
                </div>
              )
            })}
          </div>

          <section id="matriz" className="mt-10 scroll-mt-20 border-t border-border pt-8">
            <h2 className="font-display text-lg font-extrabold">
              Posicionamento dos projetos
            </h2>
            <p className="mt-1 text-sm text-textMuted">
              Onde cada projeto cai no plano Esforço × Benefício. O número do ponto é
              o mesmo “#” do ranking abaixo.
            </p>
            <div className="mt-4">
              <MatrizQuadrantes
                pontos={pontos}
                destaqueId={destaqueId}
                hrefDestaque={(id) => (id ? `/priorizacao?projeto=${id}#matriz` : '/priorizacao#matriz')}
              />
            </div>
          </section>

          <section className="mt-10 border-t border-border pt-8">
            <h2 className="font-display text-lg font-extrabold">
              Ranking por prioridade
            </h2>
            <p className="mt-1 text-sm text-textMuted">
              A ordem em que a matriz recomenda atacar os projetos. A última coluna
              mostra a prioridade cadastrada no projeto, para comparação — a matriz
              recomenda, não sobrescreve.
            </p>
            <div className="mt-4">
              <TabelaPriorizacao linhas={linhas} destaqueId={destaqueId} />
            </div>
          </section>
        </>
      )}

      <section className="mt-10 border-t border-border pt-8">
        <h2 className="font-display text-lg font-extrabold">
          Projetos ainda não avaliados
        </h2>
        <p className="mt-1 text-sm text-textMuted">
          {naoAvaliados.length === 0
            ? 'Todos os projetos ativos já foram avaliados.'
            : `${naoAvaliados.length} projeto(s) ativo(s) fora da matriz. Enquanto não forem avaliados, não disputam prioridade.`}
        </p>
        {naoAvaliados.length > 0 ? (
          <ul className="mt-4 divide-y divide-borderSoft border-l-2 border-borderSoft bg-surface">
            {naoAvaliados.map((projeto) => (
              <li
                key={projeto.id}
                className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-2.5 text-sm"
              >
                <span>
                  {projeto.nome}
                  <span className="ml-2 text-xs text-textFaint">
                    {projeto.equipe ?? 'Sem equipe'}
                  </span>
                </span>
                <Link
                  className="text-xs text-accent hover:underline"
                  href={`/priorizacao/${projeto.id}`}
                >
                  Avaliar
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </main>
  )
}

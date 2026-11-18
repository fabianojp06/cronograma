/**
 * Mede o custo de servidor da tela `/dashboards` em escalas crescentes de dados.
 *
 * Mede o que a página faz antes de renderizar — a consulta ao banco e a
 * agregação em memória —, que é onde o tempo cresce com a carteira. Não mede a
 * renderização React nem a rede.
 *
 * **Só roda contra banco local.** Semeia dezenas de milhares de linhas e as
 * apaga: apontado para produção, destruiria dados reais. Por isso recusa
 * qualquer `DATABASE_URL` que não seja localhost.
 *
 * Uso (banco descartável, ver CLAUDE.md):
 *   DATABASE_URL=postgresql://postgres:teste@127.0.0.1:57432/cronograma \
 *     npx tsx scripts/medir-dashboards.ts
 */

import { PrismaPg } from '@prisma/adapter-pg'

import { PrismaClient } from '../src/generated/prisma/client'
import { agruparPorDimensao, DIMENSOES } from '../src/lib/dashboard-dimensoes'
import { apurarPendencias } from '../src/lib/dashboard-qualidade'
import {
  proximosVencimentos,
  rankingAtrasos,
  resumirAderencia,
} from '../src/lib/dashboard-prazos'
import { cargaMensal, evolucaoMensal } from '../src/lib/dashboard-temporal'
import { resumirPainel } from '../src/lib/painel-consolidado'
import { montarLinhas } from '../src/lib/projetos-listagem'

const url = process.env.DATABASE_URL ?? ''
if (!/@(127\.0\.0\.1|localhost)[:/]/.test(url)) {
  console.error('Recusado: este script apaga dados e só roda contra banco local.')
  process.exit(1)
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) })

const ESCALAS = [
  { projetos: 20, acoesPorProjeto: 15 },
  { projetos: 100, acoesPorProjeto: 20 },
  { projetos: 300, acoesPorProjeto: 30 },
  { projetos: 1000, acoesPorProjeto: 30 },
]
const STATUS = ['NAO_INICIADO', 'EM_CURSO_25', 'EM_CURSO_50', 'EM_CURSO_75', 'CONCLUIDO'] as const
const EQUIPES = ['STI', 'GIA', 'GRH', 'JUR', 'FIN', 'OPS']
const REPETICOES = 5

const hoje = new Date()
hoje.setUTCHours(0, 0, 0, 0)

function dia(deslocamento: number): Date {
  return new Date(hoje.getTime() + deslocamento * 86_400_000)
}

async function semear(projetos: number, acoesPorProjeto: number) {
  await prisma.historicoAlteracao.deleteMany()
  await prisma.acao.deleteMany()
  await prisma.projeto.deleteMany()

  await prisma.projeto.createMany({
    data: Array.from({ length: projetos }, (_, i) => ({
      id: `p${i}`,
      nome: `Projeto ${i}`,
      referencia: `REF-${i}`,
      equipe: EQUIPES[i % EQUIPES.length],
      natureza: i % 2 ? 'Melhoria' : 'Manutenção',
      categoria: `Categoria ${i % 8}`,
      responsavel: `Pessoa ${i % 25}`,
      prioridade: (i % 5) + 1,
    })),
  })

  const acoes = []
  for (let p = 0; p < projetos; p++) {
    for (let n = 1; n <= acoesPorProjeto; n++) {
      const inicio = -180 + ((p * 7 + n * 13) % 360)
      const status = STATUS[(p + n) % STATUS.length]
      acoes.push({
        projetoId: `p${p}`,
        numero: n,
        descricao: `Ação ${n} do projeto ${p}`,
        status,
        previstoInicio: dia(inicio),
        previstoTermino: dia(inicio + 20),
        realizadoInicio: status === 'NAO_INICIADO' ? null : dia(inicio + 1),
        realizadoTermino: status === 'CONCLUIDO' ? dia(inicio + 25) : null,
      })
    }
  }
  // createMany em lotes: o Postgres limita os parâmetros por comando.
  for (let i = 0; i < acoes.length; i += 2000) {
    await prisma.acao.createMany({ data: acoes.slice(i, i + 2000) })
  }

  const alvos = await prisma.acao.findMany({ take: 500, select: { id: true } })
  await prisma.historicoAlteracao.createMany({
    data: alvos.map((a, i) => ({
      acaoId: a.id,
      campo: i % 2 ? 'status' : 'previstoTermino',
      valorAntigo: 'a',
      valorNovo: 'b',
    })),
  })
}

/** Mesmas consultas de `src/app/dashboards/page.tsx` — manter em sincronia. */
function consultar() {
  return Promise.all([
    prisma.projeto.findMany({
      where: { ativo: true },
      orderBy: [{ prioridade: 'asc' }, { nome: 'asc' }],
      select: {
        id: true,
        referencia: true,
        nome: true,
        equipe: true,
        natureza: true,
        categoria: true,
        responsavel: true,
        prioridade: true,
        acoes: {
          orderBy: { numero: 'asc' },
          select: {
            id: true,
            numero: true,
            descricao: true,
            status: true,
            previstoInicio: true,
            previstoTermino: true,
            realizadoInicio: true,
            realizadoTermino: true,
          },
        },
      },
    }),
    prisma.projeto.findMany({
      where: { ativo: true },
      select: { equipe: true, categoria: true, responsavel: true },
    }),
    prisma.historicoAlteracao.findMany({
      orderBy: { alteradoEm: 'desc' },
      take: 500,
      select: {
        id: true,
        campo: true,
        valorAntigo: true,
        valorNovo: true,
        alteradoEm: true,
        alteradoPor: true,
        acao: {
          select: {
            id: true,
            numero: true,
            descricao: true,
            projeto: { select: { id: true, nome: true } },
          },
        },
      },
    }),
  ])
}

type Projetos = Awaited<ReturnType<typeof consultar>>[0]

function agregar(projetos: Projetos) {
  const linhas = montarLinhas(projetos as never, hoje)
  resumirPainel(linhas)
  const acoes = projetos.flatMap((projeto) =>
    projeto.acoes.map((acao) => ({
      ...acao,
      projetoId: projeto.id,
      projetoNome: projeto.nome,
      equipe: projeto.equipe,
      responsavel: projeto.responsavel,
    })),
  )
  for (const dimensao of DIMENSOES) {
    agruparPorDimensao(
      linhas.map((l, i) => ({ ...projetos[i], resumo: l.resumo })) as never,
      dimensao,
    )
  }
  resumirAderencia(acoes as never)
  rankingAtrasos(acoes as never, hoje)
  proximosVencimentos(acoes as never, hoje)
  evolucaoMensal(acoes as never, hoje)
  cargaMensal(acoes as never)
  apurarPendencias(
    projetos.map((p) => ({
      id: p.id,
      nome: p.nome,
      equipe: p.equipe,
      responsavel: p.responsavel,
      totalAcoes: p.acoes.length,
    })) as never,
    acoes as never,
  )
}

const mediana = (valores: number[]) => [...valores].sort((a, b) => a - b)[Math.floor(valores.length / 2)]

async function principal() {
  console.log('projetos  ações   consulta(ms)  agregação(ms)  total(ms)')
  for (const { projetos, acoesPorProjeto } of ESCALAS) {
    await semear(projetos, acoesPorProjeto)
    const consultas: number[] = []
    const agregacoes: number[] = []
    for (let i = 0; i < REPETICOES + 1; i++) {
      const t0 = performance.now()
      const [lista] = await consultar()
      const t1 = performance.now()
      agregar(lista)
      const t2 = performance.now()
      if (i > 0) {
        // a primeira rodada aquece o pool e o JIT; não representa o uso normal
        consultas.push(t1 - t0)
        agregacoes.push(t2 - t1)
      }
    }
    const c = mediana(consultas)
    const a = mediana(agregacoes)
    console.log(
      `${String(projetos).padStart(8)}  ${String(projetos * acoesPorProjeto).padStart(6)}  ` +
        `${c.toFixed(0).padStart(12)}  ${a.toFixed(0).padStart(13)}  ${(c + a).toFixed(0).padStart(9)}`,
    )
  }

  await prisma.historicoAlteracao.deleteMany()
  await prisma.acao.deleteMany()
  await prisma.projeto.deleteMany()
  await prisma.$disconnect()
}

principal().catch((erro) => {
  console.error(erro)
  process.exit(1)
})

import { NextResponse } from 'next/server'

import { auth } from '@clerk/nextjs/server'

import { inicioDeHojeUTC } from '@/lib/data-hoje'
import {
  ehRelatorioExportavel,
  nomeDoArquivo,
  tabelaDeAcoes,
  tabelaDeProjetos,
  type TabelaExportacao,
} from '@/lib/exportacao'
import { gerarXlsx } from '@/lib/exportacao-xlsx'
import { prisma } from '@/lib/prisma'
import {
  filtrarPorBusca,
  filtrarPorSinal,
  filtrarPorStatus,
  lerFiltros,
  ORDEM_PADRAO_PROJETOS,
  ordenarLinhas,
  whereProjetoAtivo,
} from '@/lib/projeto-filtros'
import { montarLinhas } from '@/lib/projetos-listagem'
import { registrarFalha } from '@/lib/registrar-erro'

export const dynamic = 'force-dynamic'

const TIPO_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

async function montarTabela(
  relatorio: 'projetos' | 'acoes' | 'atrasadas',
  busca: URLSearchParams,
  hoje: Date,
): Promise<TabelaExportacao> {
  if (relatorio === 'projetos') {
    // Os mesmos filtros e a mesma consulta do painel: o arquivo é o que a tela mostra.
    const filtros = lerFiltros(busca)
    const projetos = await prisma.projeto.findMany({
      where: whereProjetoAtivo(filtros),
      orderBy: ORDEM_PADRAO_PROJETOS,
      select: {
        id: true,
        referencia: true,
        nome: true,
        equipe: true,
        categoria: true,
        responsavel: true,
        prioridade: true,
        acoes: {
          select: { status: true, previstoInicio: true, previstoTermino: true, realizadoTermino: true },
        },
        riscos: {
          where: { status: { in: ['ABERTO', 'EM_TRATAMENTO'] } },
          select: { impacto: true, status: true, prazo: true },
        },
      },
    })
    return tabelaDeProjetos(
      ordenarLinhas(
        filtrarPorBusca(
          filtrarPorSinal(filtrarPorStatus(montarLinhas(projetos, hoje), filtros), filtros),
          filtros,
        ),
        filtros,
      ),
    )
  }

  const acoes = await prisma.acao.findMany({
    where: { projeto: { ativo: true } },
    orderBy: [{ projeto: { nome: 'asc' } }, { numero: 'asc' }],
    select: {
      numero: true,
      descricao: true,
      status: true,
      previstoInicio: true,
      previstoTermino: true,
      realizadoInicio: true,
      realizadoTermino: true,
      projeto: { select: { nome: true, referencia: true, equipe: true } },
      responsavel: { select: { nome: true } },
    },
  })
  return tabelaDeAcoes(acoes, hoje, relatorio === 'atrasadas')
}

export async function GET(
  requisicao: Request,
  { params }: { params: Promise<{ relatorio: string }> },
) {
  // O proxy já exige login; conferir aqui de novo mantém a rota fechada mesmo
  // se alguém a liberar por engano em `ROTAS_PUBLICAS`.
  const { userId } = await auth()
  if (userId === null) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })

  const { relatorio } = await params
  if (!ehRelatorioExportavel(relatorio)) {
    return NextResponse.json({ erro: 'Relatório desconhecido' }, { status: 404 })
  }

  try {
    const hoje = inicioDeHojeUTC()
    const tabela = await montarTabela(relatorio, new URL(requisicao.url).searchParams, hoje)
    const arquivo = await gerarXlsx(tabela)
    return new NextResponse(new Uint8Array(arquivo), {
      headers: {
        'Content-Type': TIPO_XLSX,
        'Content-Disposition': `attachment; filename="${nomeDoArquivo(tabela, hoje)}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (erro) {
    await registrarFalha(`Falha ao exportar ${relatorio}`, erro)
    return NextResponse.json({ erro: 'Falha ao gerar o arquivo' }, { status: 500 })
  }
}

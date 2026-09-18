import { basename } from 'node:path'
import 'dotenv/config'
/**
 * Conferência pós-importação (roda FORA da aplicação): relê a planilha original
 * e compara com o que está gravado no banco — projeto a projeto e ação a ação.
 *
 *   npm run validar:importacao -- ./PLA-DEP-2026-001.xlsx
 *   npm run validar:importacao -- ./CRO-DEP-2026-001.xlsx --cro-dep
 *
 * É o passo seguinte ao `importar:pla-dep --gravar` / `importar:cro-dep
 * --gravar`: o relatório impresso aqui é o que vai para o Log de decisões do
 * PROGRESS.md. **Não grava nada** — só lê.
 *
 * Sai com código 1 quando há divergência, para que rodar isto dentro de um
 * pipeline falhe em vez de passar despercebido.
 *
 * Mesma divisão dos scripts de importação: a regra de conferência vive em
 * `src/lib/validacao-importacao.ts` (pura, coberta por teste) e aqui só há E/S.
 */
import { readFileSync } from 'node:fs'
import * as XLSX from 'xlsx'
import { prisma } from '../src/lib/prisma'
import {
  type Celula,
  importarCroDep,
  importarPlanilha,
} from '../src/lib/importacao-planilha'
import { chaveProjeto, validarImportacao } from '../src/lib/validacao-importacao'

function lerMatriz(caminho: string, aba?: string): { matriz: Celula[][]; aba: string } {
  const planilha = XLSX.read(readFileSync(caminho), { cellDates: true })
  const nome = aba ?? planilha.SheetNames[0]
  const folha = planilha.Sheets[nome]
  if (!folha) {
    throw new Error(
      `Aba "${nome}" não encontrada. Abas disponíveis: ${planilha.SheetNames.join(', ')}`,
    )
  }
  const matriz = XLSX.utils.sheet_to_json<Celula[]>(folha, {
    header: 1,
    raw: true,
    defval: null,
    blankrows: true,
  })
  return { matriz, aba: nome }
}

function opcao(argumentos: string[], nome: string): string | undefined {
  return argumentos.find((a) => a.startsWith(`--${nome}=`))?.split('=').slice(1).join('=')
}

async function main(): Promise<number> {
  const argumentos = process.argv.slice(2)
  const caminho = argumentos.find((a) => !a.startsWith('--'))
  const croDep = argumentos.includes('--cro-dep')

  if (!caminho) {
    console.error(
      'Uso: npm run validar:importacao -- <caminho.xlsx> [--cro-dep] [--aba=Nome] [--nome=...] [--referencia=...]',
    )
    return 1
  }

  const { matriz, aba } = lerMatriz(caminho, opcao(argumentos, 'aba'))
  const resultado = croDep
    ? importarCroDep(matriz, {
        nome: opcao(argumentos, 'nome'),
        referencia: opcao(argumentos, 'referencia'),
      })
    : importarPlanilha(matriz, { prefixoItem: basename(caminho).replace(/\.xlsx$/i, '') })

  // Só os projetos que esta planilha representa entram na conferência: o banco
  // pode ter projetos criados pela aplicação ou vindos da outra planilha, e
  // acusá-los como "excedentes" seria ruído.
  const chaves = new Set(resultado.projetos.map(chaveProjeto))
  const noBanco = await prisma.projeto.findMany({
    where: { ativo: true },
    select: {
      referencia: true,
      nome: true,
      acoes: { select: { numero: true, descricao: true }, orderBy: { numero: 'asc' } },
    },
    orderBy: { nome: 'asc' },
  })

  const relatorio = validarImportacao(
    resultado,
    noBanco.filter((p) => chaves.has(chaveProjeto(p))),
    matriz.length,
  )

  console.log(`Arquivo: ${caminho} (aba "${aba}")`)
  console.log(`Linhas na aba: ${matriz.length} | cabeçalho na linha ${resultado.linhaCabecalho}`)
  console.log(relatorio.resumo)

  if (resultado.avisos.length > 0) {
    console.log(`\nAvisos de mapeamento (${resultado.avisos.length}):`)
    for (const aviso of resultado.avisos) console.log(`  ! ${aviso}`)
  }

  return relatorio.ok ? 0 : 1
}

main()
  .then(async (codigo) => {
    await prisma.$disconnect()
    process.exit(codigo)
  })
  .catch(async (erro) => {
    console.error(erro)
    await prisma.$disconnect()
    process.exit(1)
  })

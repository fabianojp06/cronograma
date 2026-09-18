import { basename } from 'node:path'
import 'dotenv/config'
/**
 * Importação única (roda FORA da aplicação) da planilha PLA-DEP-2026-001.xlsx
 * para o schema do sistema.
 *
 *   npm run importar:pla-dep -- ./PLA-DEP-2026-001.xlsx            # simulação
 *   npm run importar:pla-dep -- ./PLA-DEP-2026-001.xlsx --gravar   # grava
 *
 * Por padrão **não grava**: imprime o relatório de conferência (linhas da
 * planilha × registros que seriam criados, mais os avisos) para o operador
 * revisar antes. `--gravar` é o passo consciente.
 *
 * Toda a regra de mapeamento vive em `src/lib/importacao-planilha.ts`, que é
 * pura e coberta por teste; aqui só há E/S: ler o .xlsx, chamar o Prisma e
 * relatar. Um projeto já importado (mesma `referencia`) é **substituído**, para
 * que reimportar depois de corrigir a planilha não duplique nada.
 */
import { readFileSync } from 'node:fs'
import * as XLSX from 'xlsx'
import { prisma } from '../src/lib/prisma'
import {
  type Celula,
  importarPlanilha,
  totaisImportacao,
} from '../src/lib/importacao-planilha'

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

async function main() {
  const argumentos = process.argv.slice(2)
  const caminho = argumentos.find((a) => !a.startsWith('--'))
  const gravar = argumentos.includes('--gravar')
  const aba = argumentos.find((a) => a.startsWith('--aba='))?.split('=')[1]

  if (!caminho) {
    console.error('Uso: npm run importar:pla-dep -- <caminho.xlsx> [--aba=Nome] [--gravar]')
    process.exit(1)
  }

  const { matriz, aba: abaLida } = lerMatriz(caminho, aba)
  const resultado = importarPlanilha(matriz, { prefixoItem: basename(caminho).replace(/\.xlsx$/i, '') })
  const totais = totaisImportacao(resultado)

  console.log(`Arquivo: ${caminho} (aba "${abaLida}")`)
  console.log(`Linhas na aba: ${matriz.length} | cabeçalho na linha ${resultado.linhaCabecalho}`)
  console.log(`Linhas de dados lidas: ${resultado.linhasLidas} | ignoradas: ${resultado.linhasIgnoradas}`)
  console.log(`Projetos mapeados: ${totais.projetos} | Ações mapeadas: ${totais.acoes}`)

  for (const projeto of resultado.projetos) {
    console.log(`  - ${projeto.referencia ?? 's/ ref'} — ${projeto.nome} (${projeto.acoes.length} ações)`)
  }

  if (resultado.avisos.length > 0) {
    console.log(`\nAvisos (${resultado.avisos.length}):`)
    for (const aviso of resultado.avisos) console.log(`  ! ${aviso}`)
  }

  if (!gravar) {
    console.log('\nSimulação — nada foi gravado. Rode de novo com --gravar para importar.')
    return
  }

  let projetosCriados = 0
  let acoesCriadas = 0

  for (const { acoes, ...projeto } of resultado.projetos) {
    if (projeto.referencia) {
      await prisma.projeto.deleteMany({ where: { referencia: projeto.referencia } })
    }

    const criado = await prisma.projeto.create({
      data: { ...projeto, acoes: { create: acoes } },
      include: { acoes: true },
    })

    projetosCriados += 1
    acoesCriadas += criado.acoes.length
  }

  console.log(`\nGravado: ${projetosCriados} projetos e ${acoesCriadas} ações.`)
  console.log(
    acoesCriadas === totais.acoes
      ? 'Conferência OK: ações gravadas = ações mapeadas na planilha.'
      : `ATENÇÃO: mapeadas ${totais.acoes} ações, gravadas ${acoesCriadas}.`,
  )
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (erro) => {
    console.error(erro)
    await prisma.$disconnect()
    process.exit(1)
  })

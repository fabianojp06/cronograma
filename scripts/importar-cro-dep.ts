import 'dotenv/config'
/**
 * Importação única (roda FORA da aplicação) da planilha CRO-DEP-2026-001.xlsx —
 * o cronograma detalhado de **um** projeto — para o schema do sistema.
 *
 *   npm run importar:cro-dep -- ./CRO-DEP-2026-001.xlsx             # simulação
 *   npm run importar:cro-dep -- ./CRO-DEP-2026-001.xlsx --gravar    # grava
 *
 * Nome e referência saem das linhas de título da planilha; `--nome=` e
 * `--referencia=` sobrescrevem quando o título não é confiável.
 *
 * Mesma divisão do `importar-pla-dep.ts`: a regra vive em
 * `src/lib/importacao-planilha.ts` (pura, coberta por teste) e aqui só há E/S.
 * Simula por padrão; `--gravar` é o passo consciente. Projeto com a mesma
 * `referencia` é substituído, então reimportar não duplica.
 */
import { readFileSync } from 'node:fs'
import * as XLSX from 'xlsx'
import { prisma } from '../src/lib/prisma'
import {
  type Celula,
  importarCroDep,
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

function opcao(argumentos: string[], nome: string): string | undefined {
  return argumentos.find((a) => a.startsWith(`--${nome}=`))?.split('=').slice(1).join('=')
}

async function main() {
  const argumentos = process.argv.slice(2)
  const caminho = argumentos.find((a) => !a.startsWith('--'))
  const gravar = argumentos.includes('--gravar')

  if (!caminho) {
    console.error(
      'Uso: npm run importar:cro-dep -- <caminho.xlsx> [--aba=Nome] [--nome=...] [--referencia=...] [--gravar]',
    )
    process.exit(1)
  }

  const { matriz, aba: abaLida } = lerMatriz(caminho, opcao(argumentos, 'aba'))
  const resultado = importarCroDep(matriz, {
    nome: opcao(argumentos, 'nome'),
    referencia: opcao(argumentos, 'referencia'),
  })
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

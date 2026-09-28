/**
 * Conferência pós-importação do Card WIN (roda FORA da aplicação): relê a
 * planilha e compara com o que está gravado.
 *
 *   npm run validar:card-win -- ./dados/CARD_WIN.xlsx --ano 2026 \
 *     --colaborador "Fabiano Santos Garcia"
 *
 * Mesmos argumentos do importador, lidos pelo mesmo módulo — conferir com
 * parâmetros diferentes dos que gravaram olharia para outro card.
 *
 * **Não grava nada.** Sai com 1 quando há ERRO, para que rodar isto num
 * pipeline falhe em vez de passar despercebido; AVISO não derruba.
 *
 * A regra vive em `src/lib/validacao-card-win.ts`, pura e coberta por teste;
 * aqui só há E/S.
 */

import { createRequire } from 'node:module'

import { prisma } from '../src/lib/prisma'
import { lerAba, prepararImportacao, type AbaSemana, type CardLido } from '../src/lib/importacao-card-win'
import { semanaDe } from '../src/lib/semana-ctcea'
import { encontrarPorNome } from '../src/lib/colaborador-validacao'
import { lerArgumentos } from '../src/lib/argumentos-importacao'
import { conferirImportacao } from '../src/lib/validacao-card-win'

const require = createRequire(import.meta.url)

const USO =
  'Uso: npm run validar:card-win -- <arquivo.xlsx> [--semana N] [--ano AAAA] ' +
  '[--colaborador "Nome no cadastro"]'

const leitura = lerArgumentos(process.argv.slice(2).filter((a) => a !== '--gravar'))
if (!leitura.ok) {
  console.error(leitura.erro)
  console.error(USO)
  process.exit(1)
}

const { arquivo, semana: semanaPedida, ano: anoPedido, colaborador: colaboradorPedido } =
  leitura.valores

if (!arquivo) {
  console.error(USO)
  process.exit(1)
}

/** Serial do Excel para Date em UTC — mesma convenção do importador. */
function dataDoSerial(serial: number | null): Date | null {
  if (serial === null) return null
  return new Date(Date.UTC(1899, 11, 30) + serial * 86_400_000)
}

const XLSX = require('xlsx')
const wb = XLSX.readFile(arquivo)

const abas: AbaSemana[] = wb.SheetNames.filter((n: string) => /^S\d+$/.test(n)).map(
  (nome: string) => {
    const ws = wb.Sheets[nome]
    const celulas: Record<string, string> = {}
    for (const ref of Object.keys(ws)) {
      if (ref.startsWith('!')) continue
      const v = ws[ref].v
      if (v !== undefined && v !== null) celulas[ref] = String(v)
    }
    return { nome, celulas }
  },
)

const cards = abas.map(lerAba).filter((c): c is CardLido => c !== null)
const semanaAlvo = semanaPedida ?? Math.max(...cards.map((c) => c.semana))
const resumo = prepararImportacao(cards, semanaAlvo)
const cardOriginal = cards.find((c) => c.semana === semanaAlvo)

if (!resumo || !cardOriginal) {
  console.error(`Semana ${semanaAlvo} não existe no arquivo.`)
  process.exit(1)
}

const primeiroPrazo = cardOriginal.wins.map((w) => dataDoSerial(w.prazoSerial)).find(Boolean)
const ano = anoPedido ?? (primeiroPrazo ? semanaDe(primeiroPrazo).ano : null)
if (ano === null) {
  console.error(`Nenhum WIN da semana ${semanaAlvo} tem prazo; informe --ano 2026.`)
  process.exit(1)
}

async function conferir() {
  const colaboradores = await prisma.colaborador.findMany({
    select: {
      id: true,
      nome: true,
      area: true,
      clerkUserId: true,
      _count: { select: { cards: true } },
    },
  })
  const lista = colaboradores.map((c) => ({
    id: c.id,
    nome: c.nome,
    area: c.area,
    clerkUserId: c.clerkUserId,
    cards: c._count.cards,
  }))

  // O alvo é quem `--colaborador` nomeia; sem a flag, quem a planilha nomeia —
  // a MESMA resolução que o importador fez.
  const nomeParaResolver = colaboradorPedido ?? resumo!.colaborador
  const alvo = nomeParaResolver ? encontrarPorNome(lista, nomeParaResolver) : undefined

  const card = alvo
    ? await prisma.cardSemanal.findUnique({
        where: {
          colaboradorId_ano_semana: { colaboradorId: alvo.id, ano: ano!, semana: semanaAlvo },
        },
        select: {
          area: true,
          atividade: true,
          registros: {
            select: {
              ordem: true,
              status: true,
              desfecho: true,
              win: { select: { descricao: true, suporte: true, aparicoesAnteriores: true } },
            },
          },
        },
      })
    : null

  const divergencias = conferirImportacao({
    nomeNaPlanilha: resumo!.colaborador,
    areaNaPlanilha: cardOriginal!.area,
    atividadeNaPlanilha: cardOriginal!.atividade,
    ano: ano!,
    semana: semanaAlvo,
    winsEsperados: resumo!.wins.map((w) => ({
      ordem: w.ordem,
      descricao: w.descricao,
      suporte: w.suporte,
      status: w.status,
      aparicoesAnteriores: w.aparicoesAnteriores,
    })),
    colaboradores: lista,
    idAlvo: alvo?.id ?? null,
    cardGravado: card ? { area: card.area, atividade: card.atividade } : null,
    winsGravados: (card?.registros ?? []).map((w) => ({
      ordem: w.ordem,
      descricao: w.win.descricao,
      suporte: w.win.suporte,
      status: w.status,
      aparicoesAnteriores: w.win.aparicoesAnteriores,
      desfecho: w.desfecho,
    })),
  })

  console.log(`Arquivo: ${arquivo}`)
  console.log(`Conferindo ${ano}/S${semanaAlvo} — planilha diz "${resumo!.colaborador ?? '—'}"`)
  console.log(`Cadastro alvo: ${alvo ? `"${alvo.nome}"` : '(nenhum)'}`)
  console.log(`Colaboradores no banco: ${lista.length}`)
  console.log()

  const erros = divergencias.filter((d) => d.gravidade === 'ERRO')
  const avisos = divergencias.filter((d) => d.gravidade === 'AVISO')

  for (const d of erros) console.log(`  ERRO  ${d.mensagem}`)
  for (const d of avisos) console.log(`  aviso ${d.mensagem}`)

  if (divergencias.length === 0) {
    console.log('Tudo confere: pessoa, card, WINs, status e contador de aparições.')
  }

  console.log(`\n${erros.length} erro(s), ${avisos.length} aviso(s).`)
  if (erros.length > 0) process.exitCode = 1
}

conferir()
  .then(() => prisma.$disconnect())
  .catch(async (erro) => {
    console.error(erro)
    await prisma.$disconnect()
    process.exit(1)
  })

/**
 * Importa uma semana do arquivo `CARD WIN Semanal` para o sistema.
 *
 *   npm run importar:card-win -- <arquivo.xlsx> [--semana 39] [--gravar]
 *
 * Sem `--gravar` é simulação: mostra o que faria e não toca no banco. O padrão
 * é a semana mais recente encontrada no arquivo.
 *
 * Só a semana alvo é importada — decisão registrada no PROGRESS.md. As semanas
 * anteriores servem apenas para semear `aparicoesAnteriores`, de modo que um
 * WIN que já vinha se repetindo entre no sistema com o contador certo e a
 * regra das 3 semanas dispare no primeiro dia, em vez de recomeçar do zero.
 */

import { createRequire } from 'node:module'

import { prisma } from '../src/lib/prisma'
import {
  lerAba,
  prepararImportacao,
  type AbaSemana,
  type CardLido,
} from '../src/lib/importacao-card-win'
import { semanaDe } from '../src/lib/semana-ctcea'
import { StatusWin } from '../src/generated/prisma/enums'

const require = createRequire(import.meta.url)

const argumentos = process.argv.slice(2)
const arquivo = argumentos.find((a) => !a.startsWith('--'))
const gravar = argumentos.includes('--gravar')
const semanaPedida = (() => {
  const i = argumentos.indexOf('--semana')
  return i >= 0 ? Number(argumentos[i + 1]) : null
})()

if (!arquivo) {
  console.error('Uso: npm run importar:card-win -- <arquivo.xlsx> [--semana N] [--gravar]')
  process.exit(1)
}

/** Serial do Excel para Date em UTC — mesma convenção do resto do sistema. */
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

const cards = abas
  .map(lerAba)
  .filter((c): c is CardLido => c !== null)
  .sort((a, b) => a.semana - b.semana)

if (cards.length === 0) {
  console.error('Nenhuma aba de semana encontrada no arquivo.')
  process.exit(1)
}

const semanaAlvo = semanaPedida ?? cards[cards.length - 1].semana
const resumo = prepararImportacao(cards, semanaAlvo)

if (!resumo) {
  console.error(`Semana ${semanaAlvo} não existe no arquivo.`)
  process.exit(1)
}

// O `process.exit` acima já garante que não é nulo, mas o TypeScript não
// enxerga isso através da fronteira da função de gravação.
const importacao = resumo

const cardOriginal = cards.find((c) => c.semana === semanaAlvo)!
// O ano vem do prazo de algum WIN; sem prazo, do relógio.
const primeiroPrazo = cardOriginal.wins.map((w) => dataDoSerial(w.prazoSerial)).find(Boolean)
const { ano } = semanaDe(primeiroPrazo ?? new Date())

console.log(`Arquivo: ${arquivo}`)
console.log(`Semanas no arquivo: ${cards.map((c) => c.semana).join(', ')}`)
console.log(`\nImportando semana ${semanaAlvo} de ${ano} — ${resumo.colaborador}`)
console.log(`Área: ${cardOriginal.area ?? '—'} | Atividade: ${cardOriginal.atividade ?? '—'}`)
console.log()

for (const win of resumo.wins) {
  const marca = win.aparicoesTotais >= 3 ? '  <-- JÁ DEVE SER PROMOVIDO' : ''
  console.log(`WIN 0${win.ordem}: ${win.descricao}`)
  console.log(
    `         suporte=${win.suporte ?? '—'} | status=${win.status} | ` +
      `aparições=${win.aparicoesTotais} (${win.aparicoesAnteriores} antes do sistema)${marca}`,
  )
}

if (!gravar) {
  console.log('\n(simulação — nada foi gravado; use --gravar para aplicar)')
  process.exit(0)
}

async function gravarNoBanco() {
  const nomeColaborador = importacao.colaborador
  if (!nomeColaborador) {
    console.error('A aba não informa o colaborador; não dá para gravar.')
    process.exit(1)
  }

  const colaborador = await prisma.colaborador.upsert({
    where: { nome: nomeColaborador },
    create: { nome: nomeColaborador, area: cardOriginal.area },
    update: { area: cardOriginal.area },
    select: { id: true },
  })

  const card = await prisma.cardSemanal.upsert({
    where: {
      colaboradorId_ano_semana: { colaboradorId: colaborador.id, ano, semana: semanaAlvo },
    },
    create: {
      colaboradorId: colaborador.id,
      ano,
      semana: semanaAlvo,
      area: cardOriginal.area,
      atividade: cardOriginal.atividade,
      alertaRiscos: cardOriginal.alertaRiscos,
      pedidoAjuda: cardOriginal.pedidoAjuda,
    },
    update: {
      area: cardOriginal.area,
      atividade: cardOriginal.atividade,
      alertaRiscos: cardOriginal.alertaRiscos,
      pedidoAjuda: cardOriginal.pedidoAjuda,
    },
    select: { id: true },
  })

  // Importar de novo não pode duplicar: a semana é reescrita.
  await prisma.winSemana.deleteMany({ where: { cardId: card.id } })

  for (const [indice, win] of importacao.wins.entries()) {
    const original = cardOriginal.wins[indice]
    const criado = await prisma.win.create({
      data: {
        colaboradorId: colaborador.id,
        descricao: win.descricao,
        suporte: win.suporte,
        aparicoesAnteriores: win.aparicoesAnteriores,
      },
      select: { id: true },
    })
    await prisma.winSemana.create({
      data: {
        winId: criado.id,
        cardId: card.id,
        ordem: win.ordem,
        prazo: dataDoSerial(original.prazoSerial),
        status: win.status as StatusWin,
      },
    })
  }

  console.log(`\nGravado: 1 card, ${importacao.wins.length} WINs.`)
}

gravarNoBanco()
  .then(() => prisma.$disconnect())
  .catch(async (erro) => {
    console.error(erro)
    await prisma.$disconnect()
    process.exit(1)
  })

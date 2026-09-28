/**
 * Importa uma semana do arquivo `CARD WIN Semanal` para o sistema.
 *
 *   npm run importar:card-win -- <arquivo.xlsx> [--semana 39] [--ano 2026] [--gravar]
 *
 * `--colaborador="Nome no cadastro"` manda a planilha para um cadastro que já
 * existe, quando a grafia dos dois lados difere além de acento e caixa (ex.:
 * planilha "Fabiano Garcia", cadastro "Fabiano Santos Garcia"). Sem ele, o
 * importador criaria uma segunda pessoa — ver `gravarNoBanco`.
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
  chaveDeComparacao,
  prepararImportacao,
  type AbaSemana,
  type CardLido,
} from '../src/lib/importacao-card-win'
import { semanaDe } from '../src/lib/semana-ctcea'
import { encontrarPorNome } from '../src/lib/colaborador-validacao'
import { DesfechoWin, StatusWin } from '../src/generated/prisma/enums'

const require = createRequire(import.meta.url)

const argumentos = process.argv.slice(2)
const gravar = argumentos.includes('--gravar')

/**
 * Lê os argumentos posicionalmente, pulando os sinalizadores **e** o valor que
 * `--semana` consome. Um `find(a => !a.startsWith('--'))` ingênuo pegaria o
 * "39" de `--semana 39` como se fosse o nome do arquivo.
 */
const { arquivo, semanaPedida, anoPedido, colaboradorPedido } = (() => {
  let arquivo: string | undefined
  let semanaPedida: number | null = null
  let anoPedido: number | null = null
  let colaboradorPedido: string | null = null

  const inteiro = (bruto: string | undefined, sinalizador: string, exemplo: string) => {
    const valor = Number(bruto)
    if (!Number.isInteger(valor)) {
      console.error(`${sinalizador} precisa de um número inteiro. Ex.: ${sinalizador} ${exemplo}`)
      process.exit(1)
    }
    return valor
  }

  for (let i = 0; i < argumentos.length; i += 1) {
    const atual = argumentos[i]
    if (atual === '--semana') {
      semanaPedida = inteiro(argumentos[i + 1], '--semana', '39')
      i += 1
      continue
    }
    if (atual === '--ano') {
      anoPedido = inteiro(argumentos[i + 1], '--ano', '2026')
      i += 1
      continue
    }
    if (atual.startsWith('--colaborador=')) {
      colaboradorPedido = atual.slice('--colaborador='.length).trim() || null
      continue
    }
    if (atual.startsWith('--')) continue
    arquivo ??= atual
  }
  return { arquivo, semanaPedida, anoPedido, colaboradorPedido }
})()

if (!arquivo) {
  console.error(
    'Uso: npm run importar:card-win -- <arquivo.xlsx> [--semana N] [--ano AAAA] ' +
      '[--colaborador="Nome no cadastro"] [--gravar]',
  )
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

/**
 * O ano vem de `--ano`, ou do prazo de algum WIN da própria aba.
 *
 * Não cai para o relógio: a planilha não nomeia o ano em lugar nenhum, e uma
 * aba sem prazo importada em janeiro gravaria a semana 52 sob o ano novo —
 * fora do card certo e fora da contagem de aparições, sem erro nenhum. Melhor
 * parar e pedir `--ano` do que gravar no ano errado.
 */
const primeiroPrazo = cardOriginal.wins.map((w) => dataDoSerial(w.prazoSerial)).find(Boolean)
const anoDeduzido = anoPedido ?? (primeiroPrazo ? semanaDe(primeiroPrazo).ano : null)
if (anoDeduzido === null) {
  console.error(
    `Nenhum WIN da semana ${semanaAlvo} tem prazo, então o ano não pode ser deduzido.\n` +
      'Informe explicitamente: --ano 2026',
  )
  process.exit(1)
}

// Como acontece com `resumo` acima, o `process.exit` já garante que não é
// nulo, mas o TypeScript não enxerga isso dentro da função de gravação.
const ano = anoDeduzido

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

  // Reconhece a pessoa pela MESMA chave que o auto-cadastro da tela usa (sem
  // acento nem caixa), e não por igualdade exata de `nome`.
  //
  // Com igualdade exata a proteção seria unidirecional: a tela reconheceria o
  // que o importador criou, mas não o contrário. Quem se cadastrasse como
  // "Fabiano Jose" num banco zerado — onde não há `Projeto` ainda, logo nenhuma
  // sugestão de grafia — ganharia uma SEGUNDA linha `Colaborador` quando a
  // planilha com "Fabiano José" fosse importada: os cards iriam para a linha
  // nova, a conta do Clerk ficaria na antiga, e o relatório por responsável
  // passaria a contar duas pessoas.
  const cadastrados = await prisma.colaborador.findMany({
    select: { id: true, nome: true },
  })

  // `--colaborador=` diz, explicitamente, em qual cadastro esta planilha entra.
  //
  // `chaveDoNome` cobre acento e caixa, e só isso. Um nome do meio a mais —
  // planilha "Fabiano Garcia", cadastro "Fabiano Santos Garcia" — não casa, e
  // sem uma saída o importador criaria uma SEGUNDA pessoa: os cards novos num
  // lado, a conta do Clerk e os projetos no outro, e o relatório por
  // responsável contando dois. As duas alternativas custavam uma grafia (ou o
  // cadastro é renomeado, ou a planilha é editada a cada versão nova), e
  // nenhuma das duas está errada — por isso quem decide é uma pessoa, uma vez,
  // por argumento, e não o script adivinhando por sobrenome em comum.
  const existente = colaboradorPedido
    ? encontrarPorNome(cadastrados, colaboradorPedido)
    : encontrarPorNome(cadastrados, nomeColaborador)

  if (colaboradorPedido && !existente) {
    console.error(
      `Não há colaborador cadastrado como "${colaboradorPedido}".\n` +
        `Cadastrados: ${cadastrados.map((c) => `"${c.nome}"`).join(', ') || '(nenhum)'}`,
    )
    process.exit(1)
  }

  if (existente && existente.nome !== nomeColaborador) {
    // Não renomeia por conta própria: o nome pode já ter ido para
    // `Projeto.responsavel` numa promoção. Avisa para um humano decidir.
    console.log(
      `  (a planilha diz "${nomeColaborador}" e o cadastro diz "${existente.nome}" — ` +
        `${colaboradorPedido ? 'unificados por --colaborador' : 'é a mesma pessoa'}; ` +
        'o cadastro foi mantido)',
    )
  }

  const colaborador = existente
    ? await prisma.colaborador.update({
        where: { id: existente.id },
        data: { area: cardOriginal.area },
        select: { id: true },
      })
    : await prisma.colaborador.create({
        data: { nome: nomeColaborador, area: cardOriginal.area },
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

  // Importar de novo não pode duplicar nem desfazer promoção.
  //
  // Um WIN já promovido não é recriado: recriá-lo devolveria ao card algo que
  // já virou item do plano de ação, e a promoção seguinte criaria um Projeto
  // duplicado. E os WINs que ficam sem nenhuma aparição depois da limpeza são
  // apagados, senão cada reimportação deixaria órfãos acumulando no banco.
  // Só as linhas que ainda estão NO CARD são substituídas.
  //
  // Sem o filtro, reimportar uma semana apagaria as aparições promovidas e
  // encerradas — exatamente o histórico que a migration `wins_desfecho_da_aparicao`
  // existe para preservar, e que os relatórios de recorrência leem.
  const registrosAntigos = await prisma.winSemana.findMany({
    where: { cardId: card.id, desfecho: DesfechoWin.NO_CARD },
    select: { winId: true },
  })
  await prisma.winSemana.deleteMany({
    where: { cardId: card.id, desfecho: DesfechoWin.NO_CARD },
  })

  const orfaos = await prisma.win.findMany({
    where: {
      id: { in: registrosAntigos.map((r) => r.winId) },
      registros: { none: {} },
      promovidoEm: null,
      // `encerradoEm` faltava aqui: sem ele, um WIN encerrado que tenha perdido
      // sua última aparição seria apagado de vez pela varredura de órfãos.
      encerradoEm: null,
    },
    select: { id: true },
  })
  if (orfaos.length > 0) {
    await prisma.win.deleteMany({ where: { id: { in: orfaos.map((o) => o.id) } } })
    console.log(`  (${orfaos.length} WIN(s) órfão(s) da importação anterior removido(s))`)
  }

  // WINs que já saíram de cena não voltam por reimportação.
  //
  // `encerradoEm` faz parte desta lista tanto quanto `promovidoEm`: sem ele, o
  // laço abaixo recriaria o WIN encerrado como um `Win` novo, com uma linha
  // `NO_CARD` na mesma `ordem` — o índice único parcial permite, porque a
  // linha encerrada não ocupa mais a vaga. A semana ficaria com 4 aparições
  // num card de 3, e `/wins` mostraria 3 enquanto `/dashboards` contaria 4.
  const jaResolvidos = await prisma.win.findMany({
    where: {
      colaboradorId: colaborador.id,
      OR: [{ promovidoEm: { not: null } }, { encerradoEm: { not: null } }],
    },
    select: { descricao: true },
  })
  const chavesResolvidas = new Set(
    jaResolvidos.map((w) => chaveDeComparacao(w.descricao)),
  )

  let pulados = 0
  for (const [indice, win] of importacao.wins.entries()) {
    if (chavesResolvidas.has(chaveDeComparacao(win.descricao))) {
      console.log(`  (WIN 0${win.ordem} já foi promovido ou encerrado; não será recriado)`)
      pulados += 1
      continue
    }
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

  console.log(`\nGravado: 1 card, ${importacao.wins.length - pulados} WINs.`)
}

gravarNoBanco()
  .then(() => prisma.$disconnect())
  .catch(async (erro) => {
    console.error(erro)
    await prisma.$disconnect()
    process.exit(1)
  })

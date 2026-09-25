'use server'

import { auth } from '@clerk/nextjs/server'
import { revalidatePath } from 'next/cache'

import { prisma } from '@/lib/prisma'
import { proximoNumero } from '@/lib/acao-validacao'
import { ehSemanaValida, type SemanaCtcea } from '@/lib/semana-ctcea'

/** Faixa de anos aceita — protege contra ano absurdo vindo de POST forjado. */
const ANO_MINIMO = 2020
const ANO_MAXIMO = 2100
import {
  validarPromocao,
  type DestinoPromocao,
  type PedidoPromocao,
  MENSAGEM_ERRO_PROMOCAO,
} from '@/lib/win-promocao'
import {
  podeAdicionarWin,
  validarCard,
  validarWin,
  MENSAGEM_ERRO_LIMITE,
  type ErrosCard,
  type ErrosWin,
} from '@/lib/win-validacao'

export type EstadoWin = {
  salvo?: true
  erros?: ErrosWin
  erroGeral?: string
}

export type EstadoCard = {
  salvo?: true
  erros?: ErrosCard
  erroGeral?: string
}

/**
 * Lê ano/semana de campos ocultos do formulário.
 *
 * Confere que os campos existem como texto antes de converter: `Number(null)`
 * é 0, então um POST sem os campos passaria como a "semana 0 do ano 0" e
 * criaria um `CardSemanal` que nenhuma tela consegue abrir de novo. E valida
 * contra o calendário — semana 99 não existe.
 */
function lerSemana(formData: FormData): SemanaCtcea | null {
  const anoBruto = formData.get('ano')
  const semanaBruta = formData.get('semana')
  if (typeof anoBruto !== 'string' || typeof semanaBruta !== 'string') return null

  const ano = Number(anoBruto)
  const semana = Number(semanaBruta)
  if (!Number.isInteger(ano) || !Number.isInteger(semana)) return null
  if (ano < ANO_MINIMO || ano > ANO_MAXIMO) return null

  const candidata = { ano, semana }
  return ehSemanaValida(candidata) ? candidata : null
}

/**
 * Colaborador do usuário logado. Devolve `null` quando a conta ainda não está
 * vinculada — caso legítimo, porque um colaborador pode existir antes de ter
 * conta (a aba Referências já listava quatro pessoas).
 */
async function colaboradorDoUsuario(userId: string) {
  return prisma.colaborador.findFirst({
    where: { clerkUserId: userId, ativo: true },
    select: { id: true, nome: true, area: true },
  })
}

/** Garante o card da semana, criando-o vazio na primeira gravação. */
async function garantirCard(colaboradorId: string, semana: SemanaCtcea, area: string | null) {
  return prisma.cardSemanal.upsert({
    where: {
      colaboradorId_ano_semana: {
        colaboradorId,
        ano: semana.ano,
        semana: semana.semana,
      },
    },
    create: { colaboradorId, ano: semana.ano, semana: semana.semana, area },
    update: {},
    select: { id: true },
  })
}

/**
 * Cria um WIN novo na semana, ou acrescenta um WIN já existente (que veio
 * repetindo) à semana atual.
 *
 * O limite de 3 é verificado aqui e garantido pelo banco por duas vias:
 * `@@unique([cardId, ordem])` impede duas linhas na mesma posição, e a CHECK
 * `WinSemana_ordem_entre_1_e_3` limita a posição a 1–3. A unicidade sozinha
 * não bastaria: ela não limita o valor de `ordem`.
 */
export async function salvarWin(
  _anterior: EstadoWin,
  formData: FormData,
): Promise<EstadoWin> {
  const { userId } = await auth()
  if (!userId) return { erroGeral: 'Sessão expirada. Entre novamente.' }

  const semana = lerSemana(formData)
  if (!semana) return { erroGeral: 'Semana não identificada. Recarregue a página.' }

  const validacao = validarWin(formData, semana)
  if (!validacao.ok) return { erros: validacao.erros }

  try {
    const colaborador = await colaboradorDoUsuario(userId)
    if (!colaborador) {
      return { erroGeral: 'Sua conta ainda não está vinculada a um colaborador.' }
    }

    const card = await garantirCard(colaborador.id, semana, colaborador.area)
    const registroId = formData.get('registroId')

    // Edição de um WIN que já está na semana.
    if (typeof registroId === 'string' && registroId !== '') {
      const registro = await prisma.winSemana.findFirst({
        where: { id: registroId, cardId: card.id },
        select: { winId: true },
      })
      if (!registro) return { erroGeral: 'WIN não encontrado nesta semana.' }

      await prisma.$transaction([
        prisma.win.update({
          where: { id: registro.winId },
          data: {
            descricao: validacao.dados.descricao,
            suporte: validacao.dados.suporte,
          },
        }),
        prisma.winSemana.update({
          where: { id: registroId },
          data: { prazo: validacao.dados.prazo, status: validacao.dados.status },
        }),
      ])

      revalidatePath('/wins')
      return { salvo: true }
    }

    // WIN novo na semana — confere a vaga antes de gravar.
    const ocupadas = await prisma.winSemana.findMany({
      where: { cardId: card.id },
      select: { ordem: true },
    })
    const ordem = Number(formData.get('ordem'))
    const vaga = podeAdicionarWin(
      ocupadas.map((o) => o.ordem),
      ordem,
    )
    if (!vaga.ok) return { erroGeral: MENSAGEM_ERRO_LIMITE[vaga.erro] }

    // `winId` presente = o WIN veio repetindo de uma semana anterior; é ele
    // que carrega o contador da regra das 3 semanas.
    const winExistente = formData.get('winId')

    // O `winId` vem do formulário, então precisa ser conferido contra o dono
    // antes de qualquer escrita: sem isto, um POST forjado reescreveria o WIN
    // de outro colaborador e o penduraria no card de quem enviou.
    if (typeof winExistente === 'string' && winExistente !== '') {
      const doDono = await prisma.win.findFirst({
        where: { id: winExistente, colaboradorId: colaborador.id },
        select: { id: true },
      })
      if (!doDono) return { erroGeral: 'WIN não encontrado.' }
    }

    await prisma.$transaction(async (tx) => {
      let winId: string
      if (typeof winExistente === 'string' && winExistente !== '') {
        const win = await tx.win.update({
          where: { id: winExistente, colaboradorId: colaborador.id },
          data: {
            descricao: validacao.dados.descricao,
            suporte: validacao.dados.suporte,
          },
          select: { id: true },
        })
        winId = win.id
      } else {
        const win = await tx.win.create({
          data: {
            colaboradorId: colaborador.id,
            descricao: validacao.dados.descricao,
            suporte: validacao.dados.suporte,
          },
          select: { id: true },
        })
        winId = win.id
      }

      await tx.winSemana.create({
        data: {
          winId,
          cardId: card.id,
          ordem,
          prazo: validacao.dados.prazo,
          status: validacao.dados.status,
        },
      })
    })
  } catch (erro) {
    console.error('Falha ao salvar WIN', erro)
    return { erroGeral: 'Não foi possível salvar o WIN. Tente novamente.' }
  }

  revalidatePath('/wins')
  return { salvo: true }
}

/** Tira o WIN da semana (libera a posição); o WIN em si continua existindo. */
export async function removerWinDaSemana(formData: FormData): Promise<void> {
  const { userId } = await auth()
  if (!userId) return

  const registroId = formData.get('registroId')
  if (typeof registroId !== 'string' || registroId === '') return

  const colaborador = await colaboradorDoUsuario(userId)
  if (!colaborador) return

  // O `where` amarra o registro ao colaborador logado: ninguém apaga o WIN de
  // outra pessoa mandando um id qualquer.
  await prisma.winSemana.deleteMany({
    where: { id: registroId, card: { colaboradorId: colaborador.id } },
  })

  revalidatePath('/wins')
}

export type EstadoPromocao = {
  promovido?: { destino: DestinoPromocao; projetoId: string; acaoId: string | null }
  erroGeral?: string
}

/**
 * Promove um WIN ao plano de ação — o elo que a planilha pede no rodapé e que
 * ninguém executava.
 *
 * O destino é escolhido na hora: projeto novo, ou ação dentro de um projeto
 * que já existe. Tudo numa transação: um WIN marcado como promovido sem o
 * registro correspondente no plano seria pior do que não promover.
 */
export async function promoverWin(
  _anterior: EstadoPromocao,
  formData: FormData,
): Promise<EstadoPromocao> {
  const { userId } = await auth()
  if (!userId) return { erroGeral: 'Sessão expirada. Entre novamente.' }

  const winId = formData.get('winId')
  if (typeof winId !== 'string' || winId === '') {
    return { erroGeral: 'WIN não identificado. Recarregue a página.' }
  }

  const destinoBruto = String(formData.get('destino') ?? '')
  const projetoEscolhido = String(formData.get('projetoId') ?? '').trim()
  const pedido: PedidoPromocao = {
    destino: destinoBruto as DestinoPromocao,
    projetoId: projetoEscolhido === '' ? null : projetoEscolhido,
  }

  try {
    const colaborador = await colaboradorDoUsuario(userId)
    if (!colaborador) {
      return { erroGeral: 'Sua conta ainda não está vinculada a um colaborador.' }
    }

    const win = await prisma.win.findFirst({
      where: { id: winId, colaboradorId: colaborador.id },
      select: { id: true, descricao: true, suporte: true, promovidoEm: true },
    })
    if (!win) return { erroGeral: 'WIN não encontrado.' }

    const validacao = validarPromocao(win, pedido)
    if (!validacao.ok) return { erroGeral: MENSAGEM_ERRO_PROMOCAO[validacao.erro] }

    // `Colaborador.area` é a área da GIA (AGP/APD/ACT) e NÃO é o mesmo
    // vocabulário de `Projeto.equipe` (STI/GIA/GRH). Gravar uma na outra
    // inventaria equipes no relatório "por equipe" do dashboard, então a área
    // vai para o comentário e a equipe fica em branco para alguém preencher.
    const comentario =
      `Promovido do Card WIN de ${colaborador.nome} pela regra das 3 semanas.` +
      (colaborador.area ? ` Área: ${colaborador.area}.` : '') +
      (win.suporte ? ` Suporte: ${win.suporte}.` : '')

    const resultado = await prisma.$transaction(async (tx) => {
      if (pedido.destino === 'PROJETO') {
        const projeto = await tx.projeto.create({
          data: {
            nome: win.descricao,
            responsavel: colaborador.nome,
            comentario,
          },
          select: { id: true },
        })
        await tx.win.update({
          where: { id: win.id },
          data: { promovidoEm: new Date(), projetoId: projeto.id },
        })
        return { projetoId: projeto.id, acaoId: null }
      }

      const projeto = await tx.projeto.findFirst({
        where: { id: pedido.projetoId!, ativo: true },
        select: { id: true },
      })
      if (!projeto) throw new Error('PROJETO_INEXISTENTE')

      const ultima = await tx.acao.findFirst({
        where: { projetoId: projeto.id },
        orderBy: { numero: 'desc' },
        select: { numero: true },
      })

      const acao = await tx.acao.create({
        data: {
          projetoId: projeto.id,
          numero: proximoNumero(ultima?.numero),
          descricao: win.descricao,
        },
        select: { id: true },
      })
      await tx.win.update({
        where: { id: win.id },
        data: { promovidoEm: new Date(), projetoId: projeto.id, acaoId: acao.id },
      })
      return { projetoId: projeto.id, acaoId: acao.id }
    })

    revalidatePath('/wins')
    revalidatePath('/projetos')
    revalidatePath('/')
    return { promovido: { destino: pedido.destino, ...resultado } }
  } catch (erro) {
    if (erro instanceof Error && erro.message === 'PROJETO_INEXISTENTE') {
      return { erroGeral: 'Projeto não encontrado ou excluído.' }
    }
    console.error('Falha ao promover WIN', erro)
    return { erroGeral: 'Não foi possível promover o WIN. Tente novamente.' }
  }
}

/** Salva o cabeçalho do card: área, atividade, riscos e pedido de ajuda. */
export async function salvarCard(
  _anterior: EstadoCard,
  formData: FormData,
): Promise<EstadoCard> {
  const { userId } = await auth()
  if (!userId) return { erroGeral: 'Sessão expirada. Entre novamente.' }

  const semana = lerSemana(formData)
  if (!semana) return { erroGeral: 'Semana não identificada. Recarregue a página.' }

  const validacao = validarCard(formData)
  if (!validacao.ok) return { erros: validacao.erros }

  try {
    const colaborador = await colaboradorDoUsuario(userId)
    if (!colaborador) {
      return { erroGeral: 'Sua conta ainda não está vinculada a um colaborador.' }
    }

    await prisma.cardSemanal.upsert({
      where: {
        colaboradorId_ano_semana: {
          colaboradorId: colaborador.id,
          ano: semana.ano,
          semana: semana.semana,
        },
      },
      create: { colaboradorId: colaborador.id, ...semana, ...validacao.dados },
      update: validacao.dados,
    })
  } catch (erro) {
    console.error('Falha ao salvar card', erro)
    return { erroGeral: 'Não foi possível salvar o card. Tente novamente.' }
  }

  revalidatePath('/wins')
  return { salvo: true }
}

/** Vincula a conta logada a um colaborador — feito uma vez por pessoa. */
export async function vincularColaborador(formData: FormData): Promise<void> {
  const { userId } = await auth()
  if (!userId) return

  const colaboradorId = formData.get('colaboradorId')
  if (typeof colaboradorId !== 'string' || colaboradorId === '') return

  try {
    // Uma conta só pode estar em um colaborador: `clerkUserId` é único no
    // banco, e sem esta checagem um usuário cujo colaborador foi desativado
    // veria o formulário de novo e o `updateMany` estouraria com P2002 —
    // exceção não tratada saindo de uma Server Action.
    const jaVinculado = await prisma.colaborador.findFirst({
      where: { clerkUserId: userId },
      select: { id: true },
    })
    if (jaVinculado) return

    // Só vincula colaborador que ainda não tem dono: duas contas apontando
    // para a mesma pessoa embaralhariam os cards.
    await prisma.colaborador.updateMany({
      where: { id: colaboradorId, clerkUserId: null, ativo: true },
      data: { clerkUserId: userId },
    })
  } catch (erro) {
    console.error('Falha ao vincular colaborador', erro)
    return
  }

  revalidatePath('/wins')
}

'use server'

import { auth } from '@clerk/nextjs/server'
import { revalidatePath } from 'next/cache'

import { prisma } from '@/lib/prisma'
import { proximoNumero, refazerNaColisao } from '@/lib/acao-validacao'
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
  chaveDoNome,
  MENSAGEM_ERRO_NOME,
  validarNomeColaborador,
} from '@/lib/colaborador-validacao'
import {
  podeAdicionarWin,
  proximaOrdemLivre,
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

    // Este caminho cria SEMPRE um `Win` novo, com o contador zerado — é um WIN
    // que aparece pela primeira vez.
    //
    // Continuar um WIN de semanas anteriores é `repetirWin`, e não redigitar o
    // mesmo texto aqui: só reaproveitando a mesma linha `Win` as aparições se
    // acumulam e a regra das 3 semanas chega a disparar.
    await prisma.$transaction(async (tx) => {
      const win = await tx.win.create({
        data: {
          colaboradorId: colaborador.id,
          descricao: validacao.dados.descricao,
          suporte: validacao.dados.suporte,
        },
        select: { id: true },
      })

      await tx.winSemana.create({
        data: {
          winId: win.id,
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

/**
 * Tira o WIN da semana e libera a posição.
 *
 * O `Win` em si sobrevive **enquanto ainda aparecer em alguma semana** — é ele
 * que carrega as aparições, e apagá-lo zeraria a contagem de um WIN que
 * continua no histórico. Mas se esta era a última aparição, e ele nunca foi
 * promovido, o que sobra é uma linha invisível que nenhuma tela alcança:
 * mantê-la só acumularia lixo no banco a cada correção de digitação. O
 * importador já faz essa mesma limpeza; o caminho interativo não fazia.
 */
export async function removerWinDaSemana(formData: FormData): Promise<void> {
  const { userId } = await auth()
  if (!userId) return

  const registroId = formData.get('registroId')
  if (typeof registroId !== 'string' || registroId === '') return

  try {
    const colaborador = await colaboradorDoUsuario(userId)
    if (!colaborador) return

    // O `where` amarra o registro ao colaborador logado: ninguém apaga o WIN
    // de outra pessoa mandando um id qualquer.
    const registro = await prisma.winSemana.findFirst({
      where: { id: registroId, card: { colaboradorId: colaborador.id } },
      select: { id: true, winId: true },
    })
    if (!registro) return

    await prisma.$transaction(async (tx) => {
      await tx.winSemana.delete({ where: { id: registro.id } })
      await tx.win.deleteMany({
        where: {
          id: registro.winId,
          registros: { none: {} },
          promovidoEm: null,
          aparicoesAnteriores: 0,
        },
      })
    })
  } catch (erro) {
    console.error('Falha ao remover WIN da semana', erro)
    return
  }

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

  // A semana diz de qual card o WIN sai. Sem ela não daria para tirá-lo de uma
  // semana sem apagar as outras — que são o histórico.
  const semana = lerSemana(formData)
  if (!semana) return { erroGeral: 'Semana não identificada. Recarregue a página.' }

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

    // `refazerNaColisao` envolve a transação INTEIRA, e não o `create` por
    // dentro dela. No Postgres a violação de constraint aborta a transação: a
    // consulta seguinte falharia com "current transaction is aborted", não com
    // P2002, e um laço por dentro transformaria uma colisão recuperável na
    // falha da promoção inteira. Refeita de fora, a tentativa começa numa
    // transação limpa e já enxerga a linha concorrente.
    const resultado = await refazerNaColisao(() =>
      prisma.$transaction(async (tx) => {
        /**
         * Tira o WIN do card **da semana em que a promoção aconteceu**, como
         * manda o rodapé da planilha ("após 3 semanas, o WIN é retirado").
         *
         * Só dessa semana: as aparições anteriores registram o que foi de fato
         * comprometido nas semanas passadas, e é delas que vivem o bloco
         * "semana anterior" e a contagem de recorrência. Apagá-las reescreveria
         * o passado para arrumar o presente.
         */
        const tirarDoCard = () =>
          tx.winSemana.deleteMany({
            where: {
              winId: win.id,
              card: {
                colaboradorId: colaborador.id,
                ano: semana.ano,
                semana: semana.semana,
              },
            },
          })

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
          await tirarDoCard()
          return { projetoId: projeto.id, acaoId: null }
        }

        const projeto = await tx.projeto.findFirst({
          where: { id: pedido.projetoId!, ativo: true },
          select: { id: true },
        })
        if (!projeto) throw new Error('PROJETO_INEXISTENTE')

        // Lê o maior número e grava. Se outra criação tomar o número nesse
        // intervalo, `@@unique([projetoId, numero])` rejeita e a transação
        // inteira é refeita pelo `refazerNaColisao` acima.
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
        await tirarDoCard()
        return { projetoId: projeto.id, acaoId: acao.id }
      }),
    )

    if (!resultado) {
      return { erroGeral: 'Não foi possível numerar a ação. Tente novamente.' }
    }

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
export type EstadoVinculo = { erroGeral?: string }

export async function vincularColaborador(
  _anterior: EstadoVinculo,
  formData: FormData,
): Promise<EstadoVinculo> {
  const { userId } = await auth()
  if (!userId) return { erroGeral: 'Sessão expirada. Entre novamente.' }

  const colaboradorId = formData.get('colaboradorId')
  if (typeof colaboradorId !== 'string' || colaboradorId === '') {
    return { erroGeral: 'Escolha seu nome na lista.' }
  }

  try {
    // Uma conta só pode estar em um colaborador: `clerkUserId` é único no
    // banco, e sem esta checagem um usuário cujo colaborador foi desativado
    // veria o formulário de novo e o `updateMany` estouraria com P2002 —
    // exceção não tratada saindo de uma Server Action.
    const jaVinculado = await prisma.colaborador.findFirst({
      where: { clerkUserId: userId },
      select: { id: true },
    })
    if (jaVinculado) {
      revalidatePath('/wins')
      return {}
    }

    // Só vincula colaborador que ainda não tem dono: duas contas apontando
    // para a mesma pessoa embaralhariam os cards.
    //
    // O `count` precisa ser conferido. A lista foi montada quando a página
    // renderizou, e entre aquilo e o envio o colaborador pode ter sido tomado
    // por outra conta ou desativado. Ignorando o `count`, o `updateMany` não
    // faz nada e o usuário volta para o mesmo "Quem é você?" sem erro e sem
    // saída — um beco sem aviso nenhum.
    const { count } = await prisma.colaborador.updateMany({
      where: { id: colaboradorId, clerkUserId: null, ativo: true },
      data: { clerkUserId: userId },
    })
    if (count === 0) {
      return {
        erroGeral:
          'Esse colaborador não está mais disponível — pode ter sido vinculado a ' +
          'outra conta ou desativado. Atualize a página e escolha de novo.',
      }
    }
  } catch (erro) {
    console.error('Falha ao vincular colaborador', erro)
    return { erroGeral: 'Não foi possível vincular. Tente novamente.' }
  }

  revalidatePath('/wins')
  return {}
}

export type EstadoRepeticao = { erroGeral?: string }

/**
 * Traz para a semana atual um WIN que veio de antes — é o caminho que faz a
 * regra das 3 semanas existir de verdade.
 *
 * Sem ele, redigitar o mesmo assunto criaria um `Win` novo com o contador
 * zerado e a regra só valeria para WINs importados da planilha. O WIN precisa
 * ser o MESMO registro para carregar as aparições.
 */
export async function repetirWin(
  _anterior: EstadoRepeticao,
  formData: FormData,
): Promise<EstadoRepeticao> {
  const { userId } = await auth()
  if (!userId) return { erroGeral: 'Sessão expirada. Entre novamente.' }

  const semana = lerSemana(formData)
  if (!semana) return { erroGeral: 'Semana não identificada. Recarregue a página.' }

  const winId = formData.get('winId')
  if (typeof winId !== 'string' || winId === '') {
    return { erroGeral: 'WIN não identificado.' }
  }

  try {
    const colaborador = await colaboradorDoUsuario(userId)
    if (!colaborador) {
      return { erroGeral: 'Sua conta ainda não está vinculada a um colaborador.' }
    }

    const win = await prisma.win.findFirst({
      where: {
        id: winId,
        colaboradorId: colaborador.id,
        promovidoEm: null,
        encerradoEm: null,
      },
      select: { id: true },
    })
    if (!win) return { erroGeral: 'WIN não encontrado ou já encerrado.' }

    const card = await garantirCard(colaborador.id, semana, colaborador.area)

    const ocupadas = await prisma.winSemana.findMany({
      where: { cardId: card.id },
      select: { ordem: true, winId: true },
    })
    if (ocupadas.some((o) => o.winId === win.id)) {
      return { erroGeral: 'Este WIN já está na semana.' }
    }

    const ordem = proximaOrdemLivre(ocupadas.map((o) => o.ordem))
    if (ordem === null) return { erroGeral: MENSAGEM_ERRO_LIMITE.LIMITE_ATINGIDO }

    await prisma.winSemana.create({ data: { winId: win.id, cardId: card.id, ordem } })
  } catch (erro) {
    console.error('Falha ao repetir WIN', erro)
    return { erroGeral: 'Não foi possível repetir o WIN. Tente novamente.' }
  }

  revalidatePath('/wins')
  return {}
}

/**
 * Encerra um WIN sem promover — concluído de vez, ou abandonado.
 *
 * Existe para que a mensagem do limite ("conclua, encerre ou tire um deles")
 * corresponda a algo real, e para que `Win.encerradoEm` deixe de ser um campo
 * que nada escreve.
 *
 * Libera a vaga **só da semana informada**, pela mesma razão da promoção: as
 * aparições anteriores são o que foi de fato comprometido naquelas semanas.
 * Encerrar um WIN na S39 não pode apagá-lo dos cards da S37 e da S38.
 */
export async function encerrarWin(formData: FormData): Promise<void> {
  const { userId } = await auth()
  if (!userId) return

  const winId = formData.get('winId')
  if (typeof winId !== 'string' || winId === '') return

  const semana = lerSemana(formData)
  if (!semana) return

  try {
    const colaborador = await colaboradorDoUsuario(userId)
    if (!colaborador) return

    const win = await prisma.win.findFirst({
      where: { id: winId, colaboradorId: colaborador.id, promovidoEm: null },
      select: { id: true },
    })
    if (!win) return

    await prisma.$transaction([
      prisma.win.update({ where: { id: win.id }, data: { encerradoEm: new Date() } }),
      prisma.winSemana.deleteMany({
        where: {
          winId: win.id,
          card: {
            colaboradorId: colaborador.id,
            ano: semana.ano,
            semana: semana.semana,
          },
        },
      }),
    ])
  } catch (erro) {
    console.error('Falha ao encerrar WIN', erro)
    return
  }

  revalidatePath('/wins')
}

export type EstadoCadastroColaborador = { erroGeral?: string }

/**
 * Cadastra o próprio nome como colaborador e já vincula a conta.
 *
 * Sem isto o sistema tinha uma porta trancada: a única coisa que criava um
 * `Colaborador` era o script de importação, então num banco recém-migrado a
 * lista de nomes vinha vazia e ninguém conseguia passar da tela "Quem é você?"
 * — nem para cadastrar o primeiro WIN.
 *
 * Deixar cada um se cadastrar é seguro aqui porque o Clerk já decide quem
 * consegue entrar, e o cadastro é restrito: quem chega nesta tela é alguém da
 * CTCEA que já passou pela autenticação.
 */
export async function cadastrarColaborador(
  _anterior: EstadoCadastroColaborador,
  formData: FormData,
): Promise<EstadoCadastroColaborador> {
  const { userId } = await auth()
  if (!userId) return { erroGeral: 'Sessão expirada. Entre novamente.' }

  const validacao = validarNomeColaborador(formData.get('nome'))
  if (!validacao.ok) return { erroGeral: MENSAGEM_ERRO_NOME[validacao.erro] }
  const { nome } = validacao

  try {
    // Uma conta só pode estar em um colaborador — `clerkUserId` é único.
    const jaVinculado = await prisma.colaborador.findFirst({
      where: { clerkUserId: userId },
      select: { id: true },
    })
    if (jaVinculado) {
      revalidatePath('/wins')
      return {}
    }

    // `nome` é único no banco, e o importador pode já ter criado esta pessoa.
    // Comparar por chave (sem acento nem caixa) evita que "fabiano jose"
    // esbarre no índice único do "Fabiano José" que já existe — o que daria
    // um erro de banco no lugar de simplesmente reconhecer a pessoa.
    const existentes = await prisma.colaborador.findMany({
      select: { id: true, nome: true, clerkUserId: true, ativo: true },
    })
    const chave = chaveDoNome(nome)
    const mesmaPessoa = existentes.find((c) => chaveDoNome(c.nome) === chave)

    if (mesmaPessoa) {
      if (mesmaPessoa.clerkUserId !== null) {
        return { erroGeral: `"${mesmaPessoa.nome}" já está vinculado a outra conta.` }
      }
      if (!mesmaPessoa.ativo) {
        return {
          erroGeral:
            `"${mesmaPessoa.nome}" está desativado. Peça para reativarem antes de usar o card.`,
        }
      }
      // Vincula o cadastro que já existia, em vez de criar um duplicado.
      const { count } = await prisma.colaborador.updateMany({
        where: { id: mesmaPessoa.id, clerkUserId: null, ativo: true },
        data: { clerkUserId: userId },
      })
      if (count === 0) {
        return { erroGeral: 'Esse nome acabou de ser vinculado a outra conta. Tente de novo.' }
      }
      revalidatePath('/wins')
      return {}
    }

    await prisma.colaborador.create({ data: { nome, clerkUserId: userId } })
  } catch (erro) {
    console.error('Falha ao cadastrar colaborador', erro)
    return { erroGeral: 'Não foi possível cadastrar. Tente novamente.' }
  }

  revalidatePath('/wins')
  return {}
}

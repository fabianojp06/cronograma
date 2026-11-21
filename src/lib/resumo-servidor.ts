import { StatusAcao } from '../generated/prisma/enums'
import { prisma } from './prisma'
import { registrarFalha } from './registrar-erro'
import {
  DIA_MS,
  JANELA_DIAS,
  hojeEmBrasilia,
  lerConteudo,
  montarResumo,
  semanaDisponivel,
  type AcaoParaResumo,
  type ConteudoResumo,
} from './resumo-semanal'

export const MOTIVO_RESUMO_SEMANAL = 'RESUMO_SEMANAL'

export type ResumoGravado = { id: string; semana: string; geradoEm: Date; conteudo: ConteudoResumo }

/** Os administradores ATIVOS com colaborador: quem recebe o resumo (sem e-mail por enquanto). */
async function administradoresAtivos(): Promise<{ id: string }[]> {
  return prisma.colaborador.findMany({
    where: { ativo: true, administrador: true },
    select: { id: true },
  })
}

export async function lerAcoesParaResumo(hoje: Date): Promise<AcaoParaResumo[]> {
  const inicioJanela = new Date(hoje.getTime() - JANELA_DIAS * DIA_MS)
  const fimJanela = new Date(hoje.getTime() + JANELA_DIAS * DIA_MS)
  // Só o que pode entrar no resumo: concluída na janela (pelo término realizado
  // ou, sem ele, pelo histórico), ou não concluída com término até o fim da janela.
  const acoes = await prisma.acao.findMany({
    where: {
      projeto: { ativo: true },
      OR: [
        { realizadoTermino: { gte: inicioJanela, lte: fimJanela } },
        { status: StatusAcao.CONCLUIDO, realizadoTermino: null, updatedAt: { gte: inicioJanela } },
        { status: { not: StatusAcao.CONCLUIDO }, realizadoTermino: null, previstoTermino: { lte: fimJanela } },
      ],
    },
    select: {
      id: true,
      projetoId: true,
      numero: true,
      descricao: true,
      status: true,
      previstoTermino: true,
      realizadoTermino: true,
      projeto: { select: { nome: true, equipe: true } },
      responsavel: { select: { nome: true } },
      historico: {
        where: { campo: 'status', valorNovo: StatusAcao.CONCLUIDO },
        orderBy: { alteradoEm: 'desc' },
        take: 1,
        select: { alteradoEm: true },
      },
    },
  })
  return acoes.map((a) => ({
    id: a.id,
    projetoId: a.projetoId,
    projetoNome: a.projeto.nome,
    equipe: a.projeto.equipe,
    numero: a.numero,
    descricao: a.descricao,
    responsavel: a.responsavel?.nome ?? null,
    status: a.status,
    previstoTermino: a.previstoTermino,
    realizadoTermino: a.realizadoTermino,
    concluidoEm: a.historico[0] ? hojeEmBrasilia(a.historico[0].alteradoEm) : null,
  }))
}

/**
 * Garante o resumo da semana disponível: se ainda não existe, tira a foto agora
 * e avisa os administradores. Chamado pelo agendador (segunda, 8h de Brasília)
 * E, como rede de segurança, por quem entra no sistema depois desse horário —
 * um cron perdido não pode deixar a semana sem resumo. Seguro de chamar várias
 * vezes: a semana é única, e uma corrida entre duas chamadas termina com UM resumo.
 */
export async function garantirResumoDaSemana(agora: Date = new Date()): Promise<ResumoGravado | null> {
  const semana = semanaDisponivel(agora)

  const existente = await prisma.resumoSemanal.findUnique({ where: { semana } })
  if (existente) {
    const conteudo = lerConteudo(existente.conteudo)
    return conteudo ? { id: existente.id, semana, geradoEm: existente.geradoEm, conteudo } : null
  }

  const conteudo = montarResumo(await lerAcoesParaResumo(hojeEmBrasilia(agora)), hojeEmBrasilia(agora), semana)

  let criado: { id: string; geradoEm: Date }
  try {
    criado = await prisma.resumoSemanal.create({
      data: { semana, conteudo: JSON.parse(JSON.stringify(conteudo)) },
      select: { id: true, geradoEm: true },
    })
  } catch (erro) {
    // Duas entradas ao mesmo tempo: a outra venceu a corrida; vale o que ela gravou.
    const vencedor = await prisma.resumoSemanal.findUnique({ where: { semana } })
    if (!vencedor) throw erro
    const c = lerConteudo(vencedor.conteudo)
    return c ? { id: vencedor.id, semana, geradoEm: vencedor.geradoEm, conteudo: c } : null
  }

  const admins = await administradoresAtivos()
  if (admins.length > 0) {
    await prisma.notificacao.createMany({
      data: admins.map((a) => ({ destinatarioId: a.id, resumoId: criado.id, motivo: MOTIVO_RESUMO_SEMANAL })),
      skipDuplicates: true,
    })
  }
  return { id: criado.id, semana, geradoEm: criado.geradoEm, conteudo }
}

/**
 * Garante o aviso do resumo para UM administrador (quem foi promovido depois da
 * foto também recebe o da semana). Idempotente: o par (pessoa, resumo) é único,
 * e aviso já lido não volta.
 */
export async function garantirAvisoDoResumo(colaboradorId: string, resumoId: string): Promise<void> {
  await prisma.notificacao.createMany({
    data: [{ destinatarioId: colaboradorId, resumoId, motivo: MOTIVO_RESUMO_SEMANAL }],
    skipDuplicates: true,
  })
}

export type ResumoParaPopup = {
  notificacaoId: string
  resumoId: string
  conteudo: ConteudoResumo
}

/**
 * O resumo que o administrador ainda não viu, para o popup da entrada. Só
 * ADMINISTRADOR DE VERDADE (no estado "ainda não há administrador" ninguém
 * recebe: um popup para todos em toda página seria ruído). Nunca lança: o
 * popup é conveniência e não pode derrubar a página.
 */
export async function resumoPendenteDe(
  clerkUserId: string,
  agora: Date = new Date(),
): Promise<ResumoParaPopup | null> {
  try {
    const eu = await prisma.colaborador.findFirst({
      where: { clerkUserId, ativo: true, administrador: true },
      select: { id: true },
    })
    if (!eu) return null

    // Leituras baratas primeiro: a foto da semana quase sempre já existe, e o
    // aviso do administrador também. Só escreve quando falta algo.
    const semana = semanaDisponivel(agora)
    let resumoId = (await prisma.resumoSemanal.findUnique({ where: { semana }, select: { id: true } }))?.id
    if (!resumoId) resumoId = (await garantirResumoDaSemana(agora))?.id
    if (resumoId) {
      const tem = await prisma.notificacao.findUnique({
        where: { destinatarioId_resumoId: { destinatarioId: eu.id, resumoId } },
        select: { id: true },
      })
      if (!tem) await garantirAvisoDoResumo(eu.id, resumoId)
    }

    const aviso = await prisma.notificacao.findFirst({
      where: { destinatarioId: eu.id, motivo: MOTIVO_RESUMO_SEMANAL, lida: false },
      orderBy: { criadoEm: 'desc' },
      select: { id: true, resumoId: true, resumo: { select: { conteudo: true } } },
    })
    const conteudo = lerConteudo(aviso?.resumo?.conteudo)
    if (!aviso || !aviso.resumoId || !conteudo) return null
    return { notificacaoId: aviso.id, resumoId: aviso.resumoId, conteudo }
  } catch (erro) {
    await registrarFalha('Falha ao preparar o resumo semanal', erro)
    return null
  }
}

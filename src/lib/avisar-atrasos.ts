/**
 * Busca as ações atrasadas e manda um e-mail por responsável. Roda pelo cron da
 * Vercel (`/api/cron/atrasos`), uma vez por semana.
 *
 * Um e-mail por PESSOA, com a lista — não um por ação: quem tem cinco ações
 * atrasadas receberia cinco mensagens e passaria a ignorar todas.
 */

import { StatusAcao } from '../generated/prisma/enums'
import { configuracaoEmail } from './email-config'
import { agruparAtrasos, montarAvisoAtrasos } from './email-atrasos'
import { enviarEmail } from './enviar-email'
import { inicioDeHojeUTC } from './data-hoje'
import { prisma } from './prisma'

export type ResumoAvisos = {
  /** Pessoas com pelo menos uma ação atrasada e e-mail cadastrado. */
  destinatarios: number
  enviados: number
  falhas: number
  /** Ações atrasadas com responsável SEM e-mail: ninguém foi avisado. */
  semEmail: number
  /** Ações atrasadas sem responsável: não há a quem avisar. */
  semResponsavel: number
}

export async function avisarAtrasos(agora: Date = new Date()): Promise<ResumoAvisos> {
  const hoje = inicioDeHojeUTC(agora)

  const acoes = await prisma.acao.findMany({
    where: {
      projeto: { ativo: true },
      status: { not: StatusAcao.CONCLUIDO },
      realizadoTermino: null,
      previstoTermino: { lt: hoje },
    },
    select: {
      id: true,
      projetoId: true,
      numero: true,
      descricao: true,
      status: true,
      previstoTermino: true,
      realizadoTermino: true,
      projeto: { select: { nome: true, referencia: true } },
      responsavel: { select: { id: true, nome: true, email: true, ativo: true } },
    },
  })

  // Colaborador desativado saiu da operação: avisá-lo seria ruído. A ação dele
  // segue aparecendo no painel, que é onde alguém decide a quem passá-la.
  const ativas = acoes.filter((a) => a.responsavel === null || a.responsavel.ativo)
  const grupos = agruparAtrasos(ativas, hoje)
  const comResponsavel = ativas.filter((a) => a.responsavel !== null)

  const resumo: ResumoAvisos = {
    destinatarios: grupos.length,
    enviados: 0,
    falhas: 0,
    semEmail: comResponsavel.filter((a) => !a.responsavel?.email).length,
    semResponsavel: ativas.length - comResponsavel.length,
  }

  const { urlBase } = configuracaoEmail(process.env)
  for (const grupo of grupos) {
    const resultado = await enviarEmail(grupo.email, montarAvisoAtrasos(grupo, urlBase))
    if (resultado.enviado) resumo.enviados += 1
    else resumo.falhas += 1
  }
  return resumo
}

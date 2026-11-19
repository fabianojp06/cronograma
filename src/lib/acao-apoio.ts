/**
 * Apoio das Server Actions de ação (`projetos/acoes-acao.ts`): conferência do
 * responsável, aviso por e-mail, leitura da versão e estado auditável.
 *
 * Mora aqui porque um arquivo `'use server'` só pode exportar funções
 * assíncronas — e porque separa "o que a ação faz" de "como ela confere".
 */

import { registrarFalha } from '@/lib/registrar-erro'
import { prisma } from '@/lib/prisma'
import { urlBaseDoSistema } from '@/lib/email-config'
import {
  mensagemDoAviso,
  montarAvisoResponsavel,
  type MotivoAviso,
} from '@/lib/email-responsavel'
import { enviarEmail } from '@/lib/enviar-email'
import {
  CAMPOS_AUDITADOS,
  serializarValor,
  type EstadoAuditado,
} from '@/lib/acao-historico'

export const MENSAGEM_RESPONSAVEL_INVALIDO =
  'Escolha um colaborador ativo da lista, ou deixe sem responsável.'

/**
 * Confere o responsável escolhido e devolve o nome dele, que é o que entra no
 * histórico. Só colaborador ATIVO pode ser escolhido — com uma exceção: o
 * responsável que a ação JÁ tem. Se ele foi desativado depois, salvar a ação
 * sem mexer nesse campo não pode virar erro, nem apagá-lo em silêncio.
 *
 * `undefined` (campo ausente) não consulta nada: não há o que conferir.
 */
export async function conferirResponsavel(
  responsavelId: string | null | undefined,
  idAtual: string | null = null,
): Promise<
  { ok: true; nome: string | null | undefined; email: string | null } | { ok: false }
> {
  if (responsavelId === undefined) return { ok: true, nome: undefined, email: null }
  if (responsavelId === null) return { ok: true, nome: null, email: null }

  const colaborador = await prisma.colaborador.findUnique({
    where: { id: responsavelId },
    select: { nome: true, ativo: true, email: true },
  })
  if (!colaborador) return { ok: false }
  if (!colaborador.ativo && responsavelId !== idAtual) return { ok: false }
  return { ok: true, nome: colaborador.nome, email: colaborador.email }
}

/**
 * Avisa o responsável por e-mail e devolve a frase para a tela.
 *
 * Roda **depois** de a ação estar salva e nunca derruba a gravação: um erro
 * aqui viraria "Não foi possível salvar" sobre uma ação que foi salva.
 */
export async function avisarResponsavel(entrada: {
  motivo: MotivoAviso
  responsavel: { nome: string; email: string | null }
  acao: {
    id: string
    numero: number
    descricao: string
    previstoInicio: Date | null
    previstoTermino: Date | null
  }
  projeto: { id: string; nome: string; referencia: string | null }
}): Promise<string> {
  const { responsavel, acao, projeto } = entrada
  try {
    if (!responsavel.email) return mensagemDoAviso(responsavel, null)

    const urlBase = urlBaseDoSistema(process.env)
    const mensagem = montarAvisoResponsavel({
      motivo: entrada.motivo,
      responsavel: responsavel.nome,
      acao: {
        numero: acao.numero,
        descricao: acao.descricao,
        previstoInicio: serializarValor(acao.previstoInicio),
        previstoTermino: serializarValor(acao.previstoTermino),
      },
      projeto: { nome: projeto.nome, referencia: projeto.referencia },
      link: urlBase ? `${urlBase}/projetos/${projeto.id}/acoes/${acao.id}/editar` : null,
    })
    return mensagemDoAviso(responsavel, await enviarEmail(responsavel.email, mensagem))
  } catch (erro) {
    await registrarFalha('Falha ao avisar o responsável', erro)
    return mensagemDoAviso(responsavel, { enviado: false, motivo: 'FALHA_NO_ENVIO' })
  }
}

export const MENSAGEM_CONFLITO_EDICAO =
  'Esta ação foi alterada por outra pessoa depois que você abriu a tela, e o que ela salvou ' +
  'não foi sobrescrito. Recarregue a ação para ver a versão atual e refaça a sua alteração.'

/**
 * Versão (`updatedAt`) que o formulário de edição viu. Ausente ou ilegível =
 * sem conferência: uma aba aberta antes desta versão não manda o campo, e
 * recusar tudo o que não traz a versão travaria quem já estava editando.
 */
export function lerVersao(formData: FormData): Date | undefined {
  const bruto = formData.get('versao')
  if (typeof bruto !== 'string' || bruto === '') return undefined
  const data = new Date(bruto)
  return Number.isNaN(data.getTime()) ? undefined : data
}

type CampoColuna = Exclude<(typeof CAMPOS_AUDITADOS)[number], 'responsavel'>

/**
 * `select` com o estado auditável da Ação — base do "valor antigo". O
 * responsável vem pela relação, porque o histórico grava o nome dele.
 */
export const SELECAO_AUDITADA = {
  ...(Object.fromEntries(
    CAMPOS_AUDITADOS.filter((campo) => campo !== 'responsavel').map((campo) => [campo, true]),
  ) as { [C in CampoColuna]: true }),
  responsavelId: true,
  responsavel: { select: { nome: true } },
} as const

/** Achata o que `SELECAO_AUDITADA` trouxe para o formato que o histórico compara. */
export function estadoAuditado(atual: {
  [C in CampoColuna]: Date | string | null
} & { responsavel: { nome: string } | null }): EstadoAuditado {
  const { responsavel, ...colunas } = atual
  return {
    status: colunas.status,
    previstoInicio: colunas.previstoInicio,
    previstoTermino: colunas.previstoTermino,
    realizadoInicio: colunas.realizadoInicio,
    realizadoTermino: colunas.realizadoTermino,
    responsavel: responsavel?.nome ?? null,
  }
}

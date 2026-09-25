'use server'

import { auth } from '@clerk/nextjs/server'
import { revalidatePath } from 'next/cache'

import { prisma } from '@/lib/prisma'
import {
  MENSAGEM_ERRO_ADMIN,
  podeDesativar,
  validarRenomear,
} from '@/lib/colaborador-admin'

export type EstadoAdmin = { erroGeral?: string; aviso?: string }

/** Quem está pedindo — usado só para impedir a auto-desativação. */
async function colaboradorDoUsuario(userId: string) {
  return prisma.colaborador.findFirst({
    where: { clerkUserId: userId },
    select: { id: true },
  })
}

function lerId(formData: FormData, campo: string): string | null {
  const bruto = formData.get(campo)
  return typeof bruto === 'string' && bruto !== '' ? bruto : null
}

/**
 * Renomeia um colaborador, opcionalmente levando o nome novo para o plano de ação.
 *
 * `Colaborador.nome` é copiado para `Projeto.responsavel` a cada promoção de
 * WIN. Renomear só aqui deixaria os projetos antigos com a grafia velha, e o
 * relatório por responsável passaria a contar duas pessoas — o mesmo defeito
 * que o auto-cadastro veio evitar, chegando pela outra ponta.
 *
 * A propagação é **escolha de quem renomeia**, não automática: corrigir um erro
 * de digitação quer levar junto; trocar o nome de alguém que mudou de sobrenome
 * pode não querer reescrever o histórico. A tela mostra quantos projetos serão
 * afetados antes de decidir.
 *
 * O `comentario` do projeto também cita o nome ("Promovido do Card WIN de
 * Fulano…"), mas em prosa e como registro do que aconteceu na época. Não é
 * reescrito.
 */
export async function renomearColaborador(
  _anterior: EstadoAdmin,
  formData: FormData,
): Promise<EstadoAdmin> {
  const { userId } = await auth()
  if (!userId) return { erroGeral: 'Sessão expirada. Entre novamente.' }

  const id = lerId(formData, 'colaboradorId')
  if (!id) return { erroGeral: MENSAGEM_ERRO_ADMIN.NAO_ENCONTRADO }

  const propagar = formData.get('propagar') === 'sim'

  try {
    const cadastrados = await prisma.colaborador.findMany({
      select: { id: true, nome: true },
    })
    const validacao = validarRenomear(cadastrados, id, formData.get('nome'))
    if (!validacao.ok) return { erroGeral: MENSAGEM_ERRO_ADMIN[validacao.erro] }
    if (!validacao.mudou) return { aviso: 'O nome já era esse.' }

    const nomeAntigo = cadastrados.find((c) => c.id === id)!.nome

    const afetados = await prisma.$transaction(async (tx) => {
      await tx.colaborador.update({ where: { id }, data: { nome: validacao.nome } })
      if (!propagar) return 0
      const { count } = await tx.projeto.updateMany({
        where: { responsavel: nomeAntigo },
        data: { responsavel: validacao.nome },
      })
      return count
    })

    revalidatePath('/colaboradores')
    revalidatePath('/wins')
    if (afetados > 0) {
      revalidatePath('/')
      revalidatePath('/dashboards')
      return {
        aviso: `Nome alterado, e ${afetados} projeto(s) tiveram o responsável atualizado.`,
      }
    }
    return { aviso: 'Nome alterado.' }
  } catch (erro) {
    console.error('Falha ao renomear colaborador', erro)
    return { erroGeral: 'Não foi possível renomear. Tente novamente.' }
  }
}

/**
 * Desativa ou reativa um colaborador.
 *
 * Desativar **não apaga nada**: os cards e os WINs continuam no histórico, e a
 * tela de equipe segue mostrando o que a pessoa comprometeu nas semanas em que
 * esteve — esconder isso reescreveria o passado. O que muda é que ela deixa de
 * ser cobrada na lista de "quem falta" e de aparecer para vínculo.
 *
 * O `clerkUserId` **não é solto**: se fosse, a conta poderia se cadastrar de
 * novo com outro nome e o histórico da pessoa ficaria órfão. Reativar devolve
 * o acesso exatamente como era.
 */
export async function alternarAtivo(
  _anterior: EstadoAdmin,
  formData: FormData,
): Promise<EstadoAdmin> {
  const { userId } = await auth()
  if (!userId) return { erroGeral: 'Sessão expirada. Entre novamente.' }

  const id = lerId(formData, 'colaboradorId')
  if (!id) return { erroGeral: MENSAGEM_ERRO_ADMIN.NAO_ENCONTRADO }

  try {
    const alvo = await prisma.colaborador.findUnique({
      where: { id },
      select: { id: true, nome: true, ativo: true },
    })
    if (!alvo) return { erroGeral: MENSAGEM_ERRO_ADMIN.NAO_ENCONTRADO }

    if (alvo.ativo) {
      const quemPede = await colaboradorDoUsuario(userId)
      const permissao = podeDesativar(id, quemPede?.id ?? null)
      if (!permissao.ok) return { erroGeral: MENSAGEM_ERRO_ADMIN[permissao.erro] }
    }

    await prisma.colaborador.update({ where: { id }, data: { ativo: !alvo.ativo } })

    revalidatePath('/colaboradores')
    revalidatePath('/wins')
    revalidatePath('/wins/equipe')
    return {
      aviso: alvo.ativo
        ? `${alvo.nome} foi desativado. O histórico dele continua nos cards.`
        : `${alvo.nome} voltou a ficar ativo.`,
    }
  } catch (erro) {
    console.error('Falha ao alternar colaborador', erro)
    return { erroGeral: 'Não foi possível alterar. Tente novamente.' }
  }
}

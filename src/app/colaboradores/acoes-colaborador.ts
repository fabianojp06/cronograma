'use server'

import { auth } from '@clerk/nextjs/server'
import { revalidatePath } from 'next/cache'

import { prisma } from '@/lib/prisma'
import {
  lerAcaoAtivo,
  MENSAGEM_ERRO_ADMIN,
  podeDesativar,
  projetosADivergir,
  validarRenomear,
} from '@/lib/colaborador-admin'

export type EstadoAdmin = { erroGeral?: string; aviso?: string }

function lerId(formData: FormData, campo: string): string | null {
  const bruto = formData.get(campo)
  return typeof bruto === 'string' && bruto !== '' ? bruto : null
}

/**
 * Renomeia um colaborador e/ou alinha `Projeto.responsavel` com o nome dele.
 *
 * `Colaborador.nome` é copiado para `Projeto.responsavel` a cada promoção de
 * WIN, e renomear só de um lado parte a pessoa em duas no relatório por
 * responsável — o mesmo defeito que o auto-cadastro evita, vindo pela outra
 * ponta.
 *
 * **As duas coisas são independentes.** Propagar não precisa de uma mudança de
 * nome para acontecer: quem desmarcou a caixa uma vez precisa poder voltar e
 * alinhar depois, e há divergência que nasce sem ninguém renomear nada — a
 * planilha importada com uma grafia, o cadastro com outra. Amarrar a
 * propagação à renomeação deixaria essa divergência sem conserto pela tela.
 *
 * **A identidade é por `chaveDoNome`**, não por igualdade exata: a divergência
 * que a tela cura é justamente a que um `where` exato não enxerga.
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

    const nomeAntigo = cadastrados.find((c) => c.id === id)!.nome

    const { renomeado, projetos } = await prisma.$transaction(async (tx) => {
      if (validacao.mudou) {
        await tx.colaborador.update({ where: { id }, data: { nome: validacao.nome } })
      }
      if (!propagar) return { renomeado: validacao.mudou, projetos: 0 }

      // Busca por chave: o alvo é toda grafia da MESMA pessoa, incluindo a
      // antiga. Sem `ativo` no filtro — um projeto excluído logicamente pode
      // ser restaurado, e voltaria com a grafia velha.
      const candidatos = await tx.projeto.findMany({
        where: { responsavel: { not: null } },
        select: { id: true, responsavel: true },
      })
      const alvos = [
        ...new Set([
          ...projetosADivergir(candidatos, validacao.nome).map((p) => p.id),
          ...projetosADivergir(candidatos, nomeAntigo).map((p) => p.id),
        ]),
      ]
      if (alvos.length === 0) return { renomeado: validacao.mudou, projetos: 0 }

      const { count } = await tx.projeto.updateMany({
        where: { id: { in: alvos } },
        data: { responsavel: validacao.nome },
      })
      return { renomeado: validacao.mudou, projetos: count }
    })

    revalidatePath('/colaboradores')
    revalidatePath('/wins')
    revalidatePath('/wins/equipe')
    if (projetos > 0) {
      // O nome aparece no painel, na lista de projetos, em cada projeto e nos
      // relatórios — todos precisam ser revalidados, não só o painel.
      revalidatePath('/')
      revalidatePath('/projetos', 'layout')
      revalidatePath('/dashboards')
    } else if (renomeado) {
      // Mesmo sem tocar em projeto, o nome é impresso nos relatórios de WIN.
      revalidatePath('/dashboards')
    }

    if (!renomeado && projetos === 0) {
      return { aviso: 'Nada a alterar: o nome já era esse e nenhum projeto divergia.' }
    }
    if (!renomeado) {
      return { aviso: `${projetos} projeto(s) tiveram o responsável alinhado ao cadastro.` }
    }
    return {
      aviso:
        projetos > 0
          ? `Nome alterado, e ${projetos} projeto(s) tiveram o responsável atualizado.`
          : 'Nome alterado.',
    }
  } catch (erro) {
    console.error('Falha ao renomear colaborador', erro)
    return { erroGeral: 'Não foi possível renomear. Tente novamente.' }
  }
}

/**
 * Desativa ou reativa um colaborador, **pela intenção que foi clicada**.
 *
 * Ler `ativo` e negar parece equivalente, mas não é: entre a página renderizar
 * e o clique chegar, outra pessoa pode ter mexido. Negar o que se lê faria um
 * clique em "Desativar" reativar alguém, e ainda relatar "voltou a ficar
 * ativo". O `updateMany` condicional devolve `count = 0` nesse caso, e o
 * usuário é avisado em vez de receber o oposto do que pediu — mesmo padrão de
 * `vincularColaborador`.
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

  const acao = lerAcaoAtivo(formData.get('acao'))
  if (!acao) return { erroGeral: MENSAGEM_ERRO_ADMIN.NAO_ENCONTRADO }
  const desativando = acao === 'desativar'

  try {
    const alvo = await prisma.colaborador.findUnique({
      where: { id },
      select: { nome: true },
    })
    if (!alvo) return { erroGeral: MENSAGEM_ERRO_ADMIN.NAO_ENCONTRADO }

    if (desativando) {
      const quemPede = await prisma.colaborador.findFirst({
        where: { clerkUserId: userId },
        select: { id: true },
      })
      const permissao = podeDesativar(id, quemPede?.id ?? null)
      if (!permissao.ok) return { erroGeral: MENSAGEM_ERRO_ADMIN[permissao.erro] }
    }

    // O `where` carrega o estado esperado: se ele já mudou, nada é escrito.
    const { count } = await prisma.colaborador.updateMany({
      where: { id, ativo: desativando },
      data: { ativo: !desativando },
    })
    if (count === 0) return { erroGeral: MENSAGEM_ERRO_ADMIN.ESTADO_MUDOU }

    revalidatePath('/colaboradores')
    revalidatePath('/wins')
    revalidatePath('/wins/equipe')
    return {
      aviso: desativando
        ? `${alvo.nome} foi desativado. O histórico dele continua nos cards.`
        : `${alvo.nome} voltou a ficar ativo.`,
    }
  } catch (erro) {
    console.error('Falha ao alternar colaborador', erro)
    return { erroGeral: 'Não foi possível alterar. Tente novamente.' }
  }
}

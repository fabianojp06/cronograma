'use server'

import { auth } from '@clerk/nextjs/server'
import { revalidatePath } from 'next/cache'

import { registrarFalha } from '@/lib/registrar-erro'
import { prisma } from '@/lib/prisma'
import {
  MENSAGEM_ERRO_ADMINISTRADOR,
  MENSAGEM_ERRO_PERFIL,
  MENSAGEM_SEM_PERMISSAO,
  podeDeixarDeSerAdministrador,
  podePromoverAAdministrador,
  podeTornarLeitor,
} from '@/lib/administracao'
import { contaPodeAdministrar } from '@/lib/administracao-servidor'
import {
  lerAcaoAtivo,
  MENSAGEM_ERRO_ADMIN,
  podeDesativar,
  projetosADivergir,
  validarArea,
  validarEmail,
  validarRenomear,
} from '@/lib/colaborador-admin'

export type EstadoAdmin = { erroGeral?: string; aviso?: string }

function lerId(formData: FormData, campo: string): string | null {
  const bruto = formData.get(campo)
  return typeof bruto === 'string' && bruto !== '' ? bruto : null
}

/**
 * Salva os dados de um colaborador: nome, área, e/ou o alinhamento de
 * `Projeto.responsavel` com o nome dele.
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
 *
 * **A área vai junto porque é o mesmo formulário, mas não propaga para nada.**
 * `Colaborador.area` só serve de padrão ao abrir um card NOVO; os cards já
 * gravados guardam a área que valia na semana deles, e reescrevê-los apagaria
 * o registro de quem mudou de área no meio do ano. Quem se cadastra pela tela
 * nasce sem área — este é o único lugar do sistema que preenche esse campo
 * fora da importação.
 *
 * **O e-mail segue a mesma regra da área** (ausente não mexe, vazio remove) e
 * também não propaga: é para onde vão as notificações de responsável por ação.
 * Quem fez login já o recebe do Clerk; quem veio da planilha só o ganha aqui.
 */
export async function salvarColaborador(
  _anterior: EstadoAdmin,
  formData: FormData,
): Promise<EstadoAdmin> {
  const { userId } = await auth()
  if (!userId) return { erroGeral: 'Sessão expirada. Entre novamente.' }

  if (!(await contaPodeAdministrar(userId))) return { erroGeral: MENSAGEM_SEM_PERMISSAO }

  const id = lerId(formData, 'colaboradorId')
  if (!id) return { erroGeral: MENSAGEM_ERRO_ADMIN.NAO_ENCONTRADO }

  const propagar = formData.get('propagar') === 'sim'

  try {
    const cadastrados = await prisma.colaborador.findMany({
      select: { id: true, nome: true, area: true, email: true },
    })
    const validacao = validarRenomear(cadastrados, id, formData.get('nome'))
    if (!validacao.ok) return { erroGeral: MENSAGEM_ERRO_ADMIN[validacao.erro] }

    const area = validarArea(formData.get('area'))
    if (!area.ok) return { erroGeral: MENSAGEM_ERRO_ADMIN[area.erro] }

    const email = validarEmail(formData.get('email'))
    if (!email.ok) return { erroGeral: MENSAGEM_ERRO_ADMIN[email.erro] }

    const atual = cadastrados.find((c) => c.id === id)!
    const nomeAntigo = atual.nome
    // `undefined` quer dizer "o formulário não trouxe o campo" — nem mudou,
    // nem vai para o `update` (o Prisma pula colunas `undefined`).
    const areaMudou = area.area !== undefined && area.area !== atual.area
    const emailMudou = email.email !== undefined && email.email !== atual.email

    const { renomeado, projetos } = await prisma.$transaction(async (tx) => {
      if (validacao.mudou || areaMudou || emailMudou) {
        await tx.colaborador.update({
          where: { id },
          data: { nome: validacao.nome, area: area.area, email: email.email },
        })
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
      // A área não entra aqui: ela não aparece em relatório nenhum, só serve
      // de padrão ao abrir um card novo — e `/wins` já foi revalidada acima.
      revalidatePath('/dashboards')
    }

    // O aviso é montado por composição, e não por uma árvore de condições: são
    // mudanças independentes, e enumerar as combinações daria um ramo para cada
    // uma delas para dizer a mesma coisa.
    const feitas: string[] = []
    if (renomeado) feitas.push('Nome alterado')
    if (areaMudou) {
      feitas.push(area.area === null ? 'Área removida' : `Área definida como "${area.area}"`)
    }
    if (emailMudou) {
      feitas.push(email.email === null ? 'E-mail removido' : `E-mail definido como ${email.email}`)
    }
    if (projetos > 0) {
      feitas.push(`${projetos} projeto(s) com o responsável alinhado ao cadastro`)
    }

    if (feitas.length === 0) {
      return { aviso: 'Nada a alterar: os dados já eram esses e nenhum projeto divergia.' }
    }
    return { aviso: `${feitas.join('; ')}.` }
  } catch (erro) {
    // A ação salva nome E área: dizer "renomear" mandaria quem só mexeu na
    // área procurar o problema no campo errado.
    await registrarFalha('Falha ao salvar colaborador', erro)
    return { erroGeral: 'Não foi possível salvar. Tente novamente.' }
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

  if (!(await contaPodeAdministrar(userId))) return { erroGeral: MENSAGEM_SEM_PERMISSAO }

  const id = lerId(formData, 'colaboradorId')
  if (!id) return { erroGeral: MENSAGEM_ERRO_ADMIN.NAO_ENCONTRADO }

  const acao = lerAcaoAtivo(formData.get('acao'))
  if (!acao) return { erroGeral: MENSAGEM_ERRO_ADMIN.NAO_ENCONTRADO }
  const desativando = acao === 'desativar'

  try {
    const alvo = await prisma.colaborador.findUnique({
      where: { id },
      select: { nome: true, administrador: true, ativo: true },
    })
    if (!alvo) return { erroGeral: MENSAGEM_ERRO_ADMIN.NAO_ENCONTRADO }

    if (desativando) {
      const totalAdmins = await prisma.colaborador.count({
        where: { administrador: true, ativo: true },
      })
      const ultimo = podeDeixarDeSerAdministrador(alvo, totalAdmins)
      if (!ultimo.ok) return { erroGeral: MENSAGEM_ERRO_ADMINISTRADOR[ultimo.erro] }

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
    await registrarFalha('Falha ao alternar colaborador', erro)
    return { erroGeral: 'Não foi possível alterar. Tente novamente.' }
  }
}

/**
 * Promove ou remove o papel de administrador, **pela intenção clicada** (mesmo
 * motivo de `alternarAtivo`: negar o que se leu inverteria o pedido se outra
 * pessoa mexeu no meio).
 *
 * Só administrador mexe — e, enquanto não existe nenhum, qualquer conta, que é
 * como a primeira pessoa é promovida. Quem promove OUTRA pessoa nesse estado
 * liga a restrição e deixa de poder administrar; a tela avisa isso.
 *
 * Só colaborador ativo pode ser promovido, e o último administrador não pode
 * ser removido: voltaria ao "todos podem" sem ninguém ter decidido isso.
 */
export async function alternarAdministrador(
  _anterior: EstadoAdmin,
  formData: FormData,
): Promise<EstadoAdmin> {
  const { userId } = await auth()
  if (!userId) return { erroGeral: 'Sessão expirada. Entre novamente.' }
  if (!(await contaPodeAdministrar(userId))) return { erroGeral: MENSAGEM_SEM_PERMISSAO }

  const id = lerId(formData, 'colaboradorId')
  if (!id) return { erroGeral: MENSAGEM_ERRO_ADMIN.NAO_ENCONTRADO }

  const intencao = formData.get('acao')
  if (intencao !== 'promover' && intencao !== 'remover') {
    return { erroGeral: MENSAGEM_ERRO_ADMIN.NAO_ENCONTRADO }
  }
  const promovendo = intencao === 'promover'

  try {
    const alvo = await prisma.colaborador.findUnique({
      where: { id },
      select: { nome: true, ativo: true, administrador: true, somenteLeitura: true },
    })
    if (!alvo) return { erroGeral: MENSAGEM_ERRO_ADMIN.NAO_ENCONTRADO }

    if (promovendo) {
      const perfil = podePromoverAAdministrador(alvo)
      if (!perfil.ok) return { erroGeral: MENSAGEM_ERRO_PERFIL[perfil.erro] }
      if (!alvo.ativo) {
        return { erroGeral: 'Só um colaborador ativo pode ser administrador.' }
      }
    } else {
      const totalAdmins = await prisma.colaborador.count({
        where: { administrador: true, ativo: true },
      })
      const ultimo = podeDeixarDeSerAdministrador(alvo, totalAdmins)
      if (!ultimo.ok) return { erroGeral: MENSAGEM_ERRO_ADMINISTRADOR[ultimo.erro] }
    }

    const { count } = await prisma.colaborador.updateMany({
      where: { id, administrador: !promovendo },
      data: { administrador: promovendo },
    })
    if (count === 0) return { erroGeral: MENSAGEM_ERRO_ADMIN.ESTADO_MUDOU }

    revalidatePath('/colaboradores')
    revalidatePath('/priorizacao/pesos')
    revalidatePath('/projetos', 'layout')
    return {
      aviso: promovendo
        ? `${alvo.nome} agora é administrador.`
        : `${alvo.nome} deixou de ser administrador.`,
    }
  } catch (erro) {
    await registrarFalha('Falha ao alternar administrador', erro)
    return { erroGeral: 'Não foi possível alterar. Tente novamente.' }
  }
}

/**
 * Define o perfil de leitura de um colaborador: `leitor` (só consulta e exporta)
 * ou `colaborador` (volta a editar). Só administrador.
 *
 * Age pela INTENÇÃO clicada, como desativar e promover. Administrador não vira
 * leitor, e a regra mora na ação — a tela esconde o botão, mas uma Server Action
 * é um POST que qualquer conta consegue forjar. Vale para quem ainda não tem
 * conta ligada: o perfil fica na linha do cadastro e vale quando a pessoa entrar.
 */
export async function alternarLeitor(
  _anterior: EstadoAdmin,
  formData: FormData,
): Promise<EstadoAdmin> {
  const { userId } = await auth()
  if (!userId) return { erroGeral: 'Sessão expirada. Entre novamente.' }
  if (!(await contaPodeAdministrar(userId))) return { erroGeral: MENSAGEM_SEM_PERMISSAO }

  const id = lerId(formData, 'colaboradorId')
  if (!id) return { erroGeral: MENSAGEM_ERRO_ADMIN.NAO_ENCONTRADO }

  const intencao = formData.get('acao')
  if (intencao !== 'tornar-leitor' && intencao !== 'tornar-colaborador') {
    return { erroGeral: MENSAGEM_ERRO_ADMIN.NAO_ENCONTRADO }
  }
  const tornandoLeitor = intencao === 'tornar-leitor'

  try {
    const alvo = await prisma.colaborador.findUnique({
      where: { id },
      select: { nome: true, administrador: true },
    })
    if (!alvo) return { erroGeral: MENSAGEM_ERRO_ADMIN.NAO_ENCONTRADO }

    if (tornandoLeitor) {
      const perfil = podeTornarLeitor(alvo)
      if (!perfil.ok) return { erroGeral: MENSAGEM_ERRO_PERFIL[perfil.erro] }
    }

    // `administrador: false` na condição fecha a corrida com uma promoção feita
    // entre a leitura e a gravação.
    const { count } = await prisma.colaborador.updateMany({
      where: {
        id,
        somenteLeitura: !tornandoLeitor,
        ...(tornandoLeitor ? { administrador: false } : {}),
      },
      data: { somenteLeitura: tornandoLeitor },
    })
    if (count === 0) return { erroGeral: MENSAGEM_ERRO_ADMIN.ESTADO_MUDOU }

    revalidatePath('/colaboradores')
    revalidatePath('/', 'layout')
    return {
      aviso: tornandoLeitor
        ? `${alvo.nome} agora é leitor: só consulta e exporta.`
        : `${alvo.nome} voltou a ser colaborador e pode editar.`,
    }
  } catch (erro) {
    await registrarFalha('Falha ao alternar perfil de leitura', erro)
    return { erroGeral: 'Não foi possível alterar. Tente novamente.' }
  }
}

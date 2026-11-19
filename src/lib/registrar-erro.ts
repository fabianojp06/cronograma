import {
  destinatariosDeAlerta,
  deveAlertar,
  JANELA_ALERTA_MS,
  montarAlertaErro,
} from '@/lib/monitoramento'
import {
  deveRegistrar,
  descreverErro,
  limiteDeRetencao,
  MAX_MENSAGEM,
} from '@/lib/registro-erro'

type Contexto = { rota?: string | null; digest?: string | null }

let ultimaLimpeza = 0
const INTERVALO_LIMPEZA_MS = 60 * 60 * 1000

/** Apaga os registros que passaram da retenção; devolve quantos. */
export async function apagarRegistrosAntigos(agora: Date = new Date()): Promise<number> {
  const { prisma } = await import('@/lib/prisma')
  const { count } = await prisma.registroErro.deleteMany({
    where: { criadoEm: { lt: limiteDeRetencao(agora) } },
  })
  return count
}

/**
 * Avisa por e-mail quem administra. Nunca lança (roda dentro do tratamento de
 * outro erro) e usa origens próprias, que não geram alerta, para não entrar em laço.
 */
async function alertarAdministradores(
  origem: string,
  mensagem: string,
  rota: string | null,
): Promise<void> {
  try {
    const { prisma } = await import('@/lib/prisma')
    const { enviarEmail } = await import('@/lib/enviar-email')
    const { urlBaseDoSistema } = await import('@/lib/email-config')
    const administradores = await prisma.colaborador.findMany({
      where: { administrador: true, ativo: true },
      select: { email: true },
    })
    const destinos = destinatariosDeAlerta(
      process.env,
      administradores.map((a) => a.email),
    )
    const aviso = montarAlertaErro({
      origem,
      mensagem,
      rota,
      urlBase: urlBaseDoSistema(process.env),
    })
    for (const destino of destinos) await enviarEmail(destino, aviso)
  } catch (falha) {
    console.error('Falha ao enviar o alerta de erro', falha)
  }
}

/**
 * Registra uma falha: sempre no log (como o `console.error` que isto
 * substitui) e, em produção, também no banco, onde o administrador a consulta
 * depois que o log da Vercel — que guarda 1 hora — já tiver sumido.
 *
 * **Nunca lança.** Quem chama está dentro de um `catch` tratando outro erro; se
 * o registro falhasse também, trocaria a mensagem amigável da tela por um erro
 * 500. O Prisma é importado sob demanda: fora de produção (e nos testes
 * unitários) o banco nem é tocado.
 */
export async function registrarFalha(
  origem: string,
  erro: unknown,
  contexto: Contexto = {},
): Promise<void> {
  console.error(origem, erro)
  if (!deveRegistrar(process.env)) return
  try {
    const { prisma } = await import('@/lib/prisma')
    const { mensagem, detalhe } = descreverErro(erro)
    // Antes de gravar: a pergunta é "já houve outra desta origem na última hora?".
    const recente = await prisma.registroErro.findFirst({
      where: {
        origem: origem.slice(0, MAX_MENSAGEM),
        criadoEm: { gte: new Date(Date.now() - JANELA_ALERTA_MS) },
      },
      select: { id: true },
    })
    await prisma.registroErro.create({
      data: {
        origem: origem.slice(0, MAX_MENSAGEM),
        mensagem,
        detalhe,
        rota: contexto.rota ?? null,
        digest: contexto.digest ?? null,
      },
    })

    if (deveAlertar(origem, recente !== null)) {
      await alertarAdministradores(origem, mensagem, contexto.rota ?? null)
    }

    // Retenção sem agendador: limpa de vez em quando, por quem registra.
    const agora = Date.now()
    if (agora - ultimaLimpeza > INTERVALO_LIMPEZA_MS) {
      ultimaLimpeza = agora
      await apagarRegistrosAntigos(new Date(agora))
    }
  } catch (falha) {
    console.error('Não foi possível gravar o registro de erro', falha)
  }
}

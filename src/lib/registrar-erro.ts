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
    await prisma.registroErro.create({
      data: {
        origem: origem.slice(0, MAX_MENSAGEM),
        mensagem,
        detalhe,
        rota: contexto.rota ?? null,
        digest: contexto.digest ?? null,
      },
    })

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

import { prisma } from '@/lib/prisma'
import { RETENCAO_EXECUCOES_DIAS } from '@/lib/monitoramento'

/**
 * Guarda o resultado de uma execução agendada, para o painel do sistema
 * responder "rodou? o que fez?" depois que o log da Vercel (1 hora) sumiu.
 * Nunca lança: registrar não pode derrubar a tarefa. Poda o que passou da retenção.
 */
export async function gravarExecucaoCron(nome: string, ok: boolean, resumo: string): Promise<void> {
  try {
    await prisma.execucaoCron.create({ data: { nome, ok, resumo: resumo.slice(0, 1000) } })
    await prisma.execucaoCron.deleteMany({
      where: { executadoEm: { lt: new Date(Date.now() - RETENCAO_EXECUCOES_DIAS * 86_400_000) } },
    })
  } catch (erro) {
    console.error('Não foi possível gravar a execução do cron', erro)
  }
}

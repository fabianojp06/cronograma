import { NextResponse } from 'next/server'

import { autorizarCron } from '@/lib/autorizacao-cron'
import { avisarAtrasos } from '@/lib/avisar-atrasos'
import { gravarExecucaoCron } from '@/lib/execucao-cron'
import { garantirResumoDaSemana } from '@/lib/resumo-servidor'
import { frasePrincipal } from '@/lib/resumo-semanal'
import { registrarFalha } from '@/lib/registrar-erro'

// Cron não pode servir resposta guardada.
export const dynamic = 'force-dynamic'

export async function GET(requisicao: Request) {
  const acesso = autorizarCron(requisicao.headers.get('authorization'), process.env.CRON_SECRET)
  if (acesso === 'sem-segredo') {
    return NextResponse.json({ erro: 'CRON_SECRET não configurado' }, { status: 503 })
  }
  if (acesso === 'negado') return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })

  // O resumo semanal dos administradores (aviso no sistema) sai na mesma
  // execução, mas num bloco à parte: um não pode derrubar o outro.
  try {
    const resumoSemanal = await garantirResumoDaSemana()
    await gravarExecucaoCron(
      'resumo-semanal',
      true,
      resumoSemanal ? `${resumoSemanal.semana}: ${frasePrincipal(resumoSemanal.conteudo)}` : 'sem resumo',
    )
  } catch (erro) {
    await gravarExecucaoCron('resumo-semanal', false, erro instanceof Error ? erro.message : 'falha')
    await registrarFalha('Falha ao gerar o resumo semanal', erro)
  }

  try {
    const resumo = await avisarAtrasos()
    await gravarExecucaoCron('atrasos', true, JSON.stringify(resumo))
    return NextResponse.json(resumo)
  } catch (erro) {
    await gravarExecucaoCron('atrasos', false, erro instanceof Error ? erro.message : 'falha')
    await registrarFalha('Falha no aviso semanal de ações atrasadas', erro)
    return NextResponse.json({ erro: 'Falha ao avisar' }, { status: 500 })
  }
}

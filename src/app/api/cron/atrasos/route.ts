import { NextResponse } from 'next/server'

import { autorizarCron } from '@/lib/autorizacao-cron'
import { avisarAtrasos } from '@/lib/avisar-atrasos'
import { registrarFalha } from '@/lib/registrar-erro'

// Cron não pode servir resposta guardada.
export const dynamic = 'force-dynamic'

export async function GET(requisicao: Request) {
  const acesso = autorizarCron(requisicao.headers.get('authorization'), process.env.CRON_SECRET)
  if (acesso === 'sem-segredo') {
    return NextResponse.json({ erro: 'CRON_SECRET não configurado' }, { status: 503 })
  }
  if (acesso === 'negado') return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })

  try {
    return NextResponse.json(await avisarAtrasos())
  } catch (erro) {
    await registrarFalha('Falha no aviso semanal de ações atrasadas', erro)
    return NextResponse.json({ erro: 'Falha ao avisar' }, { status: 500 })
  }
}

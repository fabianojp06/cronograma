import { NextResponse } from 'next/server'

import { corpoDaSaude, statusDaSaude } from '@/lib/monitoramento'
import { medirBanco } from '@/lib/saude-banco'

// Verificação de saúde não pode ser servida de cache.
export const dynamic = 'force-dynamic'

/**
 * Pública de propósito (um verificador externo consulta sem login) e por isso
 * mínima: só "ok" ou "fora" e o tempo do banco. Detalhe de configuração vive
 * no painel do administrador.
 */
export async function GET() {
  const banco = await medirBanco()
  return NextResponse.json(corpoDaSaude(banco), {
    status: statusDaSaude(banco),
    headers: { 'Cache-Control': 'no-store' },
  })
}

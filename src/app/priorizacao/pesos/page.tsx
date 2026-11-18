import Link from 'next/link'

import { auth } from '@clerk/nextjs/server'

import { FormularioPesos } from '@/components/formulario-pesos'
import { montarPesos, pesosSaoPadrao } from '@/lib/matriz-validacao'
import { contaPodeAdministrar } from '@/lib/administracao-servidor'
import { prisma } from '@/lib/prisma'

export const metadata = { title: 'Pesos dos critérios — Cronograma CTCEA' }

export default async function PesosPage() {
  const linhas = await prisma.pesoCriterio.findMany({
    select: { criterio: true, peso: true },
  })
  const pesos = montarPesos(linhas)
  const { userId } = await auth()
  const podeEditar = userId !== null && (await contaPodeAdministrar(userId))

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-12">
      <p className="text-sm font-medium uppercase tracking-wide text-accent">
        Matriz de Priorização
      </p>
      <h1 className="mt-2 font-display text-2xl font-extrabold">
        Pesos dos critérios
      </h1>
      <p className="mt-2 max-w-3xl text-sm text-textMuted">
        Quanto cada critério vale dentro do seu grupo. Os pesos de Benefício
        precisam somar 100%, e os de Esforço também — é a mesma conferência que a
        planilha faz. Mudar um peso repontua todos os projetos avaliados.
      </p>

      <p className="mt-4 text-sm">
        {pesosSaoPadrao(pesos) ? (
          <span className="text-textFaint">
            Configuração atual: 20% em cada critério, como na planilha original.
          </span>
        ) : (
          <span className="border-l-2 border-previsto pl-3 text-textMuted">
            Os pesos foram ajustados e não são mais os 20% da planilha original.
          </span>
        )}
      </p>

      {podeEditar ? (
        <FormularioPesos pesos={pesos} />
      ) : (
        <p className="mt-8 border-l-2 border-borderSoft bg-surface py-3 pl-4 text-sm text-textMuted">
          Só administradores editam os pesos. Peça a um administrador (Colaboradores
          mostra quem são).
        </p>
      )}

      <p className="mt-10 border-t border-border pt-6 text-sm text-textMuted">
        O GUT não tem peso configurável: ele é o produto G × U × T. A planilha
        original exibe &quot;33%&quot; ao lado dos três fatores, mas nenhuma fórmula
        dela usa esse número —{' '}
        <Link className="hover:text-accent" href="/priorizacao">
          voltar para a matriz
        </Link>
        .
      </p>
    </main>
  )
}

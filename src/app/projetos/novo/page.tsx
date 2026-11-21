import Link from 'next/link'

import { AvisoSomenteLeitura } from '@/components/aviso-somente-leitura'
import { sessaoPodeEditar } from '@/lib/administracao-servidor'
import { FormularioProjeto } from '@/components/formulario-projeto'
import { opcoesDoLider } from '@/lib/lider-projeto'
import { prisma } from '@/lib/prisma'

export const metadata = { title: 'Novo projeto — Cronograma CTCEA' }

export default async function NovoProjetoPage() {
  const podeEditar = await sessaoPodeEditar()
  const lideres = opcoesDoLider(
    await prisma.colaborador.findMany({
      orderBy: { nome: 'asc' },
      select: { id: true, nome: true, ativo: true },
    }),
    { liderId: null, responsavel: null },
  )
  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-12">
      <p className="text-sm font-medium text-accent">
        Plano de ação
      </p>
      <h1 className="mt-2 font-display text-2xl font-extrabold">Novo projeto</h1>
      <p className="mt-2 text-sm text-textMuted">
        Apenas o assunto é obrigatório. As ações e as datas são cadastradas depois,
        dentro do projeto.
      </p>
      {podeEditar ? (
        <>
          <p className="mt-3 text-sm text-textMuted">
            Projeto parecido com outro que já existe?{' '}
            <Link className="text-accent hover:underline" href="/modelos">
              Comece de um modelo
            </Link>{' '}
            e as ações já vêm prontas.
          </p>
          <FormularioProjeto lideres={lideres} />
        </>
      ) : (
        <AvisoSomenteLeitura voltarPara="/projetos" rotuloVoltar="Voltar para a listagem" />
      )}
    </main>
  )
}

import { AvisoSomenteLeitura } from '@/components/aviso-somente-leitura'
import { sessaoPodeEditar } from '@/lib/administracao-servidor'
import { FormularioProjeto } from '@/components/formulario-projeto'

export const metadata = { title: 'Novo projeto — Cronograma CTCEA' }

export default async function NovoProjetoPage() {
  const podeEditar = await sessaoPodeEditar()
  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-12">
      <p className="text-sm font-medium uppercase tracking-wide text-accent">
        Plano de ação
      </p>
      <h1 className="mt-2 font-display text-2xl font-extrabold">Novo projeto</h1>
      <p className="mt-2 text-sm text-textMuted">
        Apenas o assunto é obrigatório. As ações e as datas são cadastradas depois,
        dentro do projeto.
      </p>
      {podeEditar ? (
        <FormularioProjeto />
      ) : (
        <AvisoSomenteLeitura voltarPara="/projetos" rotuloVoltar="Voltar para a listagem" />
      )}
    </main>
  )
}

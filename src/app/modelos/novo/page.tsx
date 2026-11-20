import { AvisoSomenteLeitura } from '@/components/aviso-somente-leitura'
import { EditorModelo, VALORES_EM_BRANCO } from '@/components/editor-modelo'
import { sessaoPodeEditar } from '@/lib/administracao-servidor'

export const metadata = { title: 'Novo modelo — Cronograma CTCEA' }
export const dynamic = 'force-dynamic'

export default async function NovoModeloPage() {
  const podeEditar = await sessaoPodeEditar()
  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-12">
      <p className="text-sm font-medium uppercase tracking-wide text-accent">Modelos</p>
      <h1 className="mt-2 font-display text-2xl font-extrabold">Novo modelo</h1>
      <p className="mt-2 max-w-2xl text-sm text-textMuted">
        Monte o esqueleto de um projeto que se repete: as ações, em ordem, com quando começam e
        quanto duram. Quem usar o modelo informa só a data de início e as pessoas.
      </p>
      {podeEditar ? (
        <EditorModelo inicial={VALORES_EM_BRANCO} />
      ) : (
        <AvisoSomenteLeitura voltarPara="/modelos" rotuloVoltar="Voltar para os modelos" />
      )}
    </main>
  )
}

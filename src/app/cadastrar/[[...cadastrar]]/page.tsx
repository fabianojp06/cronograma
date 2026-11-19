import { SignUp } from '@clerk/nextjs'

import { PainelDeAcesso } from '@/components/painel-de-acesso'

export const metadata = { title: 'Criar conta — Cronograma CTCEA' }

export default async function PaginaCadastrar({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const bruto = (await searchParams).redirect_url
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-6 py-12">
      <PainelDeAcesso modo="cadastrar" redirectUrl={Array.isArray(bruto) ? bruto[0] : bruto} />
      <SignUp />
    </main>
  )
}

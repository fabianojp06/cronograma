import { SignUp } from '@clerk/nextjs'

export const metadata = { title: 'Criar conta — Cronograma CTCEA' }

export default function PaginaCadastrar() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <SignUp />
    </main>
  )
}

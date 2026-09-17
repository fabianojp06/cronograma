import { SignIn } from '@clerk/nextjs'

export const metadata = { title: 'Entrar — Cronograma CTCEA' }

export default function PaginaEntrar() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <SignIn />
    </main>
  )
}

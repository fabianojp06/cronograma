/**
 * Substituto de `@clerk/nextjs` (componentes) SÓ para o teste de navegador.
 * Ver `clerk-servidor.ts` para o porquê.
 */
import type { ReactNode } from 'react'

if (process.env.VERCEL) {
  throw new Error('Autenticação falsa de teste carregada na Vercel — remova E2E_AUTH_FALSA.')
}

export function ClerkProvider({ children }: { children: ReactNode }) {
  return <>{children}</>
}

/** O usuário de teste está sempre autenticado. */
export function Show({ when, children }: { when: string; children: ReactNode }) {
  return when === 'signed-in' ? <>{children}</> : null
}

export function SignInButton({ children }: { children?: ReactNode }) {
  return <>{children}</>
}

export function UserButton() {
  return <span aria-label="Usuário de teste" />
}

export function SignIn() {
  return null
}

export function SignUp() {
  return null
}

export function SignOutButton({ children }: { children?: ReactNode }) {
  return <>{children}</>
}

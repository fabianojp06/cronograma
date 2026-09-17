import Link from "next/link";
import { Show, SignInButton, UserButton } from "@clerk/nextjs";

/** Barra superior fixa: identidade do sistema + menu do usuário autenticado. */
export function Cabecalho() {
  return (
    <header className="flex items-center justify-between border-b border-border bg-surface px-6 py-3">
      <Link href="/" className="font-display text-sm font-extrabold tracking-tight">
        CTCEA <span className="text-accent">Cronograma</span>
      </Link>
      <Show when="signed-in">
        <UserButton />
      </Show>
      <Show when="signed-out">
        <SignInButton mode="modal">
          <button className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-onAccent">
            Entrar
          </button>
        </SignInButton>
      </Show>
    </header>
  );
}

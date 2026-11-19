import Link from "next/link";
import { Show, SignInButton, UserButton } from "@clerk/nextjs";

import { AlternadorTema } from "@/components/alternador-tema";

/**
 * Itens do menu principal. Ficam aqui, num array, para que o cabeçalho não
 * precise ser reescrito a cada tela nova — e para a ordem ser explícita.
 */
const MENU = [
  { href: "/", rotulo: "Painel" },
  { href: "/projetos", rotulo: "Projetos" },
  { href: "/dashboards", rotulo: "Dashboards" },
  { href: "/priorizacao", rotulo: "Priorização" },
  { href: "/minhas-acoes", rotulo: "Minhas ações" },
  { href: "/wins", rotulo: "Card WIN" },
  { href: "/wins/equipe", rotulo: "Equipe" },
  { href: "/colaboradores", rotulo: "Colaboradores" },
] as const;

/** Barra superior fixa: identidade do sistema, menu e sessão do usuário. */
export function Cabecalho() {
  return (
    <header className="print:hidden flex flex-wrap items-center gap-x-8 gap-y-2 border-b border-border bg-surface px-6 py-3">
      <Link href="/" className="font-display text-sm font-extrabold tracking-tight">
        CTCEA <span className="text-accent">Cronograma</span>
      </Link>

      {/* O menu só faz sentido com sessão — as telas de domínio são fechadas. */}
      <Show when="signed-in">
        <nav aria-label="Navegação principal" className="flex items-center gap-6">
          {MENU.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm text-textMuted hover:text-accent"
            >
              {item.rotulo}
            </Link>
          ))}
        </nav>
      </Show>

      <div className="ml-auto flex items-center gap-4">
        {/* Fora do <Show>: a escolha de tema vale também na tela de login. */}
        <AlternadorTema />
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
      </div>
    </header>
  );
}

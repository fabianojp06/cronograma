import Link from "next/link";
import { Show, SignInButton, UserButton } from "@clerk/nextjs";

import { AlternadorTema } from "@/components/alternador-tema";
import { SinoNotificacoes } from "@/components/sino-notificacoes";
import { BotaoTour, TourGuiado } from "@/components/tour-guiado";
import { alvoDoMenu, MENU } from "@/lib/menu";

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
              data-tour={alvoDoMenu(item.href)}
              className="text-sm text-textMuted hover:text-accent"
            >
              {item.rotulo}
            </Link>
          ))}
        </nav>
      </Show>

      <div className="ml-auto flex items-center gap-4">
        {/* Fora do <Show>: a escolha de tema vale também na tela de login. */}
        <span data-tour="tema" className="inline-flex">
          <AlternadorTema />
        </span>
        <Show when="signed-in">
          <Link
            href="/manual"
            data-tour="manual"
            className="text-sm text-textMuted hover:text-accent"
          >
            Manual
          </Link>
          <BotaoTour />
          <span data-tour="sino" className="inline-flex">
            <SinoNotificacoes />
          </span>
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

      <Show when="signed-in">
        <TourGuiado />
      </Show>
    </header>
  );
}

import Link from "next/link";
import { Show, SignInButton, UserButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";

import { AlternadorTema } from "@/components/alternador-tema";
import { SinoNotificacoes } from "@/components/sino-notificacoes";
import { BotaoTour, TourGuiado } from "@/components/tour-guiado";
import { contaPodeAdministrar } from "@/lib/administracao-servidor";
import { alvoDoMenu, MENU, ROTA_ADMINISTRACAO } from "@/lib/menu";

/**
 * O item "Administração" só aparece para quem administra. Se a consulta falhar,
 * esconde: o cabeçalho de toda página não pode cair por causa disso, e a
 * permissão de verdade continua nas telas e nas Server Actions.
 */
async function sessaoAdministra(): Promise<boolean> {
  try {
    const { userId } = await auth();
    return userId !== null && (await contaPodeAdministrar(userId));
  } catch {
    return false;
  }
}

/** Barra superior fixa: identidade do sistema, menu e sessão do usuário. */
export async function Cabecalho() {
  const administrador = await sessaoAdministra();
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
          {administrador ? (
            <Link
              href={ROTA_ADMINISTRACAO}
              data-tour="administracao"
              className="rounded-md border border-border px-2 py-0.5 text-sm text-textMuted hover:border-accent hover:text-accent"
            >
              Administração
            </Link>
          ) : null}
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
          <BotaoTour administrador={administrador} />
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
        <TourGuiado administrador={administrador} />
      </Show>
    </header>
  );
}

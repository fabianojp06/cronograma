import Link from "next/link";
import { Show, SignInButton, UserButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";

import { AlternadorTema, BotaoTema } from "@/components/alternador-tema";
import { SinoNotificacoes } from "@/components/sino-notificacoes";
import { MenuAjuda } from "@/components/menu-ajuda";
import { MenuCelular } from "@/components/menu-celular";
import { NavegacaoPrincipal } from "@/components/navegacao-principal";
import { TourGuiado } from "@/components/tour-guiado";
import { contaPodeAdministrar } from "@/lib/administracao-servidor";
import { GRUPO_ADMINISTRACAO, GRUPOS_DO_MENU } from "@/lib/menu";

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
  // Os grupos do menu; a Administração só entra para quem administra.
  const grupos = administrador ? [...GRUPOS_DO_MENU, GRUPO_ADMINISTRACAO] : GRUPOS_DO_MENU;
  return (
    <header className="relative print:hidden flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border bg-surface px-4 py-2 sm:px-6 lg:gap-x-6">
      <Link href="/" className="font-display text-sm font-extrabold tracking-tight">
        CTCEA <span className="text-accent">Cronograma</span>
      </Link>

      {/* O menu só faz sentido com sessão — as telas de domínio são fechadas. */}
      <Show when="signed-in">
        <MenuCelular grupos={grupos} />
        <NavegacaoPrincipal grupos={grupos} />
      </Show>

      <div className="ml-auto flex items-center gap-2">
        <Show when="signed-in">
          <span data-tour="sino" className="inline-flex">
            <SinoNotificacoes />
          </span>
          <BotaoTema />
          <MenuAjuda administrador={administrador} />
          <UserButton />
        </Show>
        <Show when="signed-out">
          {/* Fora da sessão o tema continua à mão (a tela de login também o respeita). */}
          <AlternadorTema />
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

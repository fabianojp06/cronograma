import type { Metadata } from "next";
import { Manrope, Public_Sans } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { ptBR } from "@clerk/localizations";
import "./globals.css";
import { Cabecalho } from "@/components/cabecalho";
import { SCRIPT_TEMA } from "@/lib/tema";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

const publicSans = Public_Sans({
  variable: "--font-public-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Cronograma CTCEA",
  description:
    "Acompanhamento de projetos e ações da CTCEA — plano de ação consolidado e cronograma detalhado por projeto.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <ClerkProvider
      localization={ptBR}
      signInUrl="/entrar"
      signUpUrl="/cadastrar"
      // Cores por CSS variable, não por valor fixo: assim a UI do Clerk
      // (modal de login, UserButton) troca junto com o tema, sem precisar de
      // um provider client só para isso. Os valores vivem em globals.css.
      appearance={{
        variables: {
          colorPrimary: "var(--accent)",
          colorPrimaryForeground: "var(--on-accent)",
          colorBackground: "var(--surface)",
          colorForeground: "var(--text)",
          colorMutedForeground: "var(--text-muted)",
          colorMuted: "var(--border-soft)",
          colorBorder: "var(--border)",
          colorInput: "var(--surface)",
          colorInputForeground: "var(--text)",
          colorRing: "var(--accent)",
          colorDanger: "var(--warn)",
        },
      }}
    >
      {/* `suppressHydrationWarning`: o script abaixo altera a classe e o
          `color-scheme` do <html> antes do React hidratar, então o atributo
          que o cliente encontra difere do que veio do servidor — de propósito. */}
      <html
        lang="pt-BR"
        className={`${manrope.variable} ${publicSans.variable} h-full antialiased`}
        suppressHydrationWarning
      >
        <head>
          {/* Aplica o tema guardado ANTES da primeira pintura. Sem isto, quem
              usa tema escuro veria um flash branco a cada navegação. */}
          <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA }} />
        </head>
        <body className="min-h-full flex flex-col bg-bg text-text">
          <Cabecalho />
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}

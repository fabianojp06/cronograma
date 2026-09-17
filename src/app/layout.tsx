import type { Metadata } from "next";
import { Manrope, Public_Sans } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { ptBR } from "@clerk/localizations";
import "./globals.css";
import { Cabecalho } from "@/components/cabecalho";

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
      appearance={{ variables: { colorPrimary: "#0F766E" } }}
    >
      <html
        lang="pt-BR"
        className={`${manrope.variable} ${publicSans.variable} h-full antialiased`}
      >
        <body className="min-h-full flex flex-col bg-bg text-text">
          <Cabecalho />
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}

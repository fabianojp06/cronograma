import type { NextConfig } from "next";

/**
 * `E2E_AUTH_FALSA=1` troca o Clerk por um falso (tests/e2e/falso) para o teste
 * de navegador poder entrar sem conta. Só o teste liga isso; os módulos falsos
 * recusam carregar na Vercel.
 */
const authFalsa = process.env.E2E_AUTH_FALSA === "1";

const nextConfig: NextConfig = {
  ...(authFalsa
    ? {
        turbopack: {
          resolveAlias: {
            "@clerk/nextjs/server": "./tests/e2e/falso/clerk-servidor.ts",
            "@clerk/nextjs": "./tests/e2e/falso/clerk-cliente.tsx",
          },
        },
      }
    : {}),
};

export default nextConfig;

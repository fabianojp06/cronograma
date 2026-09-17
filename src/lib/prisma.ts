import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@/generated/prisma/client'

// Em desenvolvimento o hot-reload do Next recria os módulos a cada alteração;
// guardamos a instância no globalThis para não abrir um pool novo a cada reload.
const globalParaPrisma = globalThis as unknown as { prisma?: PrismaClient }

function criarPrisma() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
  return new PrismaClient({ adapter })
}

export const prisma = globalParaPrisma.prisma ?? criarPrisma()

if (process.env.NODE_ENV !== 'production') {
  globalParaPrisma.prisma = prisma
}

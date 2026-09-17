import 'dotenv/config'
/**
 * Seed do banco: 3 projetos de exemplo com 5 ações cada.
 * Idempotente — cada projeto é identificado pela `referencia` e recriado.
 * Rodar com: npm run db:seed
 */
import { prisma } from '../src/lib/prisma'
import { dadosSeed } from '../src/lib/seed-dados'

async function main() {
  const projetos = dadosSeed(new Date())

  for (const { acoes, ...projeto } of projetos) {
    // Remove a versão anterior deste projeto de exemplo (as Ações caem por cascade).
    await prisma.projeto.deleteMany({ where: { referencia: projeto.referencia } })

    const criado = await prisma.projeto.create({
      data: { ...projeto, acoes: { create: acoes } },
      include: { acoes: true },
    })

    console.log(
      `Projeto "${criado.nome}" (${criado.referencia}) criado com ${criado.acoes.length} ações.`,
    )
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (erro) => {
    console.error(erro)
    await prisma.$disconnect()
    process.exit(1)
  })

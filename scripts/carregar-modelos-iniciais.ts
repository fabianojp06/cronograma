import 'dotenv/config'
/**
 * Carrega os modelos de projeto iniciais (`src/lib/modelos-iniciais.ts`).
 *
 *   npm run carregar:modelos             # simulação: só diz o que faria
 *   npm run carregar:modelos -- --gravar # grava
 *
 * Por padrão NÃO grava. Roda contra o banco do `DATABASE_URL` (a produção, se
 * for o caso): quem roda escolhe o banco, e a URL nunca vai para o código nem
 * para o resultado impresso. É seguro rodar de novo: modelo cujo nome já existe
 * é PULADO, nunca sobrescrito (alguém pode ter excluído e recriado o seu).
 * Os modelos nascem como "criados pelo sistema": só administrador os exclui.
 */
import { prisma } from '../src/lib/prisma'
import { CRIADO_POR_SISTEMA, MODELOS_INICIAIS } from '../src/lib/modelos-iniciais'

async function main() {
  const gravar = process.argv.includes('--gravar')
  console.log(gravar ? 'Modo: GRAVAR' : 'Modo: simulação (use --gravar para gravar)')

  let criados = 0
  let pulados = 0
  for (const modelo of MODELOS_INICIAIS) {
    const existente = await prisma.modeloProjeto.findUnique({
      where: { nome: modelo.nome },
      select: { id: true },
    })
    if (existente) {
      console.log(`  pula   ${modelo.nome} (já existe)`)
      pulados += 1
      continue
    }
    console.log(
      `  ${gravar ? 'cria  ' : 'criaria'} ${modelo.nome}: ${modelo.itens.length} ações, ${modelo.diasUteisTotais} dias úteis`,
    )
    if (gravar) {
      await prisma.modeloProjeto.create({
        data: {
          nome: modelo.nome,
          descricao: modelo.descricao,
          criadoPor: CRIADO_POR_SISTEMA,
          acoes: { create: modelo.itens },
        },
      })
    }
    criados += 1
  }
  console.log(`${gravar ? 'Criados' : 'Seriam criados'}: ${criados}. Já existiam: ${pulados}.`)
}

main()
  .catch((erro) => {
    console.error('Falhou:', erro instanceof Error ? erro.message : erro)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())

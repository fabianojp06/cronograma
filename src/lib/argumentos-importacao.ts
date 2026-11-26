/**
 * Leitura dos argumentos de linha de comando dos scripts de importação.
 *
 * Vive aqui, puro e coberto por teste, por um motivo concreto: a primeira
 * versão de `--colaborador` só aceitava a forma `--colaborador=Nome`, enquanto
 * `--semana` e `--ano`, logo acima dela no mesmo laço, aceitavam a forma com
 * espaço. Quem escrevesse `--colaborador "Mariana Santos Garcia"` — a forma que
 * os vizinhos ensinam — tinha o sinalizador descartado em silêncio: o token
 * `--colaborador` caía no `continue` dos sinalizadores desconhecidos e o nome
 * era engolido pelo `arquivo ??=`, que já estava preenchido.
 *
 * O resultado não era um erro, era pior: a importação seguia com o nome da
 * planilha, criava a SEGUNDA pessoa que a flag existe para evitar, e imprimia
 * "Gravado: 1 card, 3 WINs" como se tudo tivesse dado certo.
 *
 * Daí as duas regras deste módulo: **toda forma que um sinalizador vizinho
 * aceita, todos aceitam**, e **valor faltando é erro, nunca omissão**.
 */

/** Sinalizadores que consomem um valor, com o tipo que esperam. */
const COM_VALOR = {
  '--semana': { tipo: 'inteiro', exemplo: '39' },
  '--ano': { tipo: 'inteiro', exemplo: '2026' },
  '--colaborador': { tipo: 'texto', exemplo: '"Mariana Santos Garcia"' },
} as const

type Sinalizador = keyof typeof COM_VALOR

export type ArgumentosImportacao = {
  arquivo: string | null
  semana: number | null
  ano: number | null
  colaborador: string | null
  gravar: boolean
}

export function lerArgumentos(
  argumentos: readonly string[],
): { ok: true; valores: ArgumentosImportacao } | { ok: false; erro: string } {
  const valores: ArgumentosImportacao = {
    arquivo: null,
    semana: null,
    ano: null,
    colaborador: null,
    gravar: false,
  }

  for (let i = 0; i < argumentos.length; i += 1) {
    const atual = argumentos[i]

    if (atual === '--gravar') {
      valores.gravar = true
      continue
    }

    // As duas formas, para todos: `--x=valor` e `--x valor`.
    const comIgual = atual.indexOf('=')
    const nome = comIgual === -1 ? atual : atual.slice(0, comIgual)

    if (nome in COM_VALOR) {
      const sinalizador = nome as Sinalizador
      const { tipo, exemplo } = COM_VALOR[sinalizador]

      let bruto: string | undefined
      if (comIgual === -1) {
        bruto = argumentos[i + 1]
        // Um sinalizador não serve de valor para outro: sem esta guarda,
        // `--colaborador --gravar` gravaria a pessoa chamada "--gravar".
        if (bruto !== undefined && bruto.startsWith('--')) bruto = undefined
        else i += 1
      } else {
        bruto = atual.slice(comIgual + 1)
      }

      const valor = bruto?.trim() ?? ''
      if (valor === '') {
        return { ok: false, erro: `${sinalizador} precisa de um valor. Ex.: ${sinalizador} ${exemplo}` }
      }

      if (tipo === 'inteiro') {
        const numero = Number(valor)
        if (!Number.isInteger(numero)) {
          return {
            ok: false,
            erro: `${sinalizador} precisa de um número inteiro. Ex.: ${sinalizador} ${exemplo}`,
          }
        }
        if (sinalizador === '--semana') valores.semana = numero
        else valores.ano = numero
      } else {
        valores.colaborador = valor
      }
      continue
    }

    // Sinalizador desconhecido é erro, e não silêncio: um `--colaborator`
    // com erro de digitação seria ignorado, e a importação criaria a pessoa
    // duplicada relatando sucesso.
    if (atual.startsWith('--')) {
      return { ok: false, erro: `Sinalizador desconhecido: ${atual}` }
    }

    if (valores.arquivo !== null) {
      return { ok: false, erro: `Só um arquivo por vez. Recebi também: ${atual}` }
    }
    valores.arquivo = atual
  }

  return { ok: true, valores }
}

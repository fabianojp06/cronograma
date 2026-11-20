/**
 * Líder do projeto escolhido numa lista — módulo puro.
 *
 * O formulário do projeto deixou de ter um campo de texto para o responsável: a
 * pessoa escolhe um colaborador, e o sistema grava o `liderId` E copia o nome
 * para `Projeto.responsavel` (que os relatórios agrupam). Assim a grafia nunca
 * diverge do cadastro, e as liberações de início não dependem de digitar igual.
 *
 * Valores do `<select name="lider">`: `''` (sem líder), `c:<id>` (colaborador) e
 * `t` (manter o texto que já estava, de um projeto antigo cujo nome não casa
 * com ninguém do cadastro).
 */

import { chaveDoNome } from './colaborador-validacao'

export type EscolhaLider =
  | { tipo: 'ausente' }
  | { tipo: 'nenhum' }
  | { tipo: 'manter' }
  | { tipo: 'colaborador'; id: string }

/** Lê o `lider` do formulário. Campo ausente (aba antiga): `ausente` — não mexe. */
export function lerEscolhaLider(formData: FormData): EscolhaLider {
  const bruto = formData.get('lider')
  if (typeof bruto !== 'string') return { tipo: 'ausente' }
  const valor = bruto.trim()
  if (valor === '') return { tipo: 'nenhum' }
  if (valor === 't') return { tipo: 'manter' }
  if (valor.startsWith('c:') && valor.length > 2) return { tipo: 'colaborador', id: valor.slice(2) }
  return { tipo: 'nenhum' }
}

export type OpcaoLider = { valor: string; rotulo: string }

export type ColaboradorDaLista = { id: string; nome: string; ativo: boolean }

/**
 * Opções do select e a selecionada. Regras:
 * - só colaborador ativo é oferecido — exceto o líder atual, mantido como
 *   "(inativo)" para salvar outro campo não o apagar;
 * - sem `liderId`, o nome em `responsavel` é casado por `chaveDoNome` e vem
 *   pré-selecionado (salvar o projeto já o liga);
 * - nome que não casa com ninguém vira a opção `t`, para não se perder.
 */
export function opcoesDoLider(
  colaboradores: readonly ColaboradorDaLista[],
  atual: { liderId: string | null; responsavel: string | null },
): { opcoes: OpcaoLider[]; selecionado: string } {
  const opcoes: OpcaoLider[] = [{ valor: '', rotulo: 'Sem líder definido' }]
  const textoAtual = atual.responsavel?.trim() || null

  let selecionado = ''
  const porId = new Map(colaboradores.map((c) => [c.id, c]))

  if (atual.liderId && porId.has(atual.liderId)) {
    selecionado = `c:${atual.liderId}`
  } else if (textoAtual) {
    const chave = chaveDoNome(textoAtual)
    const igual = colaboradores.find((c) => c.ativo && chaveDoNome(c.nome) === chave)
    if (igual) selecionado = `c:${igual.id}`
    else {
      opcoes.push({ valor: 't', rotulo: `${textoAtual} (texto antigo, fora do cadastro)` })
      selecionado = 't'
    }
  }

  for (const c of colaboradores) {
    if (!c.ativo && c.id !== atual.liderId) continue
    opcoes.push({ valor: `c:${c.id}`, rotulo: c.ativo ? c.nome : `${c.nome} (inativo)` })
  }
  return { opcoes, selecionado }
}

export type ResolucaoLider =
  | { ok: true; alterar: false }
  | { ok: true; alterar: true; liderId: string | null; responsavel: string | null }
  | { ok: false; erro: string }

/**
 * O que gravar a partir da escolha. `ausente` e `manter` não alteram nada (e o
 * texto antigo segue). `colaborador` exige que a pessoa exista e esteja ativa,
 * salvo se já era o líder gravado.
 */
export function resolverLider(
  escolha: EscolhaLider,
  colaboradorEscolhido: { id: string; nome: string; ativo: boolean } | null,
  liderIdAtual: string | null,
): ResolucaoLider {
  switch (escolha.tipo) {
    case 'ausente':
    case 'manter':
      return { ok: true, alterar: false }
    case 'nenhum':
      return { ok: true, alterar: true, liderId: null, responsavel: null }
    case 'colaborador':
      if (!colaboradorEscolhido || (!colaboradorEscolhido.ativo && escolha.id !== liderIdAtual)) {
        return { ok: false, erro: 'Escolha um líder da lista (a pessoa não está ativa no cadastro).' }
      }
      return {
        ok: true,
        alterar: true,
        liderId: colaboradorEscolhido.id,
        responsavel: colaboradorEscolhido.nome,
      }
  }
}

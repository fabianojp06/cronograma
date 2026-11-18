"use client";

import Link from "next/link";
import { useActionState } from "react";

import {
  criarAcao,
  type EstadoFormularioAcao,
} from "@/app/projetos/acoes-acao";
import { JanelaSucessoAcao } from "@/components/janela-sucesso-acao";
import {
  ROTULOS_STATUS,
  STATUS_ACAO,
  type ErrosAcao,
} from "@/lib/acao-validacao";

const ESTADO_INICIAL: EstadoFormularioAcao = {};

const classeRotulo = "block text-sm font-medium text-textMuted";
const classeCampo =
  "mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text " +
  "outline-none placeholder:text-textFaint focus:border-accent focus:ring-1 focus:ring-accent";

function Erro({ mensagem }: { mensagem?: string }) {
  if (!mensagem) return null;
  return <p className="mt-1 text-sm text-warn">{mensagem}</p>;
}

function CampoData({
  nome,
  rotulo,
  erros,
}: {
  nome: keyof ErrosAcao;
  rotulo: string;
  erros?: ErrosAcao;
}) {
  return (
    <div>
      <label className={classeRotulo} htmlFor={nome}>
        {rotulo}
      </label>
      <input className={classeCampo} id={nome} name={nome} type="date" />
      <Erro mensagem={erros?.[nome]} />
    </div>
  );
}

/**
 * Formulário de criação de Ação. O `numero` não aparece: é sequencial e
 * atribuído pela Server Action dentro do projeto.
 */
export function FormularioAcao({ projetoId }: { projetoId: string }) {
  const [estado, acao, enviando] = useActionState(criarAcao, ESTADO_INICIAL);
  const erros = estado.erros;

  return (
    <>
      <JanelaSucessoAcao criada={estado.criada} projetoId={projetoId} />
      <form action={acao} className="mt-8 space-y-6" key={estado.criada?.id}>
        <input type="hidden" name="id" value={projetoId} />

        {estado.erroGeral ? (
          <p className="border-l-2 border-warn bg-surface py-2 pl-3 text-sm text-warn">
            {estado.erroGeral}
          </p>
        ) : null}

        <section className="border-l-2 border-accent pl-4">
          <h2 className="font-display text-base font-bold">Ação</h2>
          <div className="mt-4 space-y-4">
            <div>
              <label className={classeRotulo} htmlFor="descricao">
                Descrição *
              </label>
              <textarea
                className={`${classeCampo} min-h-20`}
                id="descricao"
                name="descricao"
                maxLength={500}
                required
                placeholder="Ex.: Levantar inventário dos switches"
              />
              <Erro mensagem={erros?.descricao} />
            </div>
            <div className="sm:max-w-xs">
              <label className={classeRotulo} htmlFor="status">
                Status
              </label>
              <select
                className={classeCampo}
                id="status"
                name="status"
                defaultValue="NAO_INICIADO"
              >
                {STATUS_ACAO.map((status) => (
                  <option key={status} value={status}>
                    {ROTULOS_STATUS[status]}
                  </option>
                ))}
              </select>
              <Erro mensagem={erros?.status} />
            </div>
          </div>
        </section>

        <section className="border-l-2 border-previsto pl-4">
          <h2 className="font-display text-base font-bold">Previsto</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <CampoData
              nome="previstoInicio"
              rotulo="Início previsto"
              erros={erros}
            />
            <CampoData
              nome="previstoTermino"
              rotulo="Término previsto"
              erros={erros}
            />
          </div>
        </section>

        <section className="border-l-2 border-realizado pl-4">
          <h2 className="font-display text-base font-bold">Realizado</h2>
          <p className="mt-1 text-sm text-textMuted">
            Opcional na criação — normalmente preenchido conforme a ação avança.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <CampoData
              nome="realizadoInicio"
              rotulo="Início realizado"
              erros={erros}
            />
            <CampoData
              nome="realizadoTermino"
              rotulo="Término realizado"
              erros={erros}
            />
          </div>
        </section>

        <div className="flex items-center gap-3">
          <button
            aria-busy={enviando}
            className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-onAccent disabled:opacity-60"
            disabled={enviando}
            type="submit"
          >
            {enviando ? (
              <span
                aria-hidden="true"
                className="size-4 animate-spin rounded-full border-2 border-onAccent/40 border-t-onAccent"
              />
            ) : null}
            {enviando ? "Salvando…" : "Salvar ação"}
          </button>
          <Link
            className="text-sm text-textMuted hover:text-text"
            href="/projetos"
          >
            Cancelar
          </Link>
        </div>
      </form>
    </>
  );
}

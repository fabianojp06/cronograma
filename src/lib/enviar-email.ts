/**
 * Envio de e-mail pela API HTTP do Resend — só `fetch`, sem SDK: é uma única
 * chamada, e uma dependência a mais não compraria nada.
 *
 * **Nunca lança.** O aviso é consequência de salvar a ação, não condição: se o
 * Resend estiver fora do ar, a ação continua salva e quem salvou é avisado de
 * que o e-mail não saiu. Por isso o resultado diz o que aconteceu em vez de
 * estourar uma exceção dentro da Server Action.
 */

import { configuracaoEmail, type MotivoSemEnvio } from './email-config'
import type { MensagemEmail } from './email-responsavel'
import { registrarFalha } from './registrar-erro'

export type ResultadoEnvio =
  | { enviado: true }
  | { enviado: false; motivo: MotivoSemEnvio | 'FALHA_NO_ENVIO' }

/** Tempo máximo de espera: a Server Action segura a resposta da tela enquanto isso. */
const TEMPO_LIMITE_MS = 8000

export async function enviarEmail(
  para: string,
  mensagem: MensagemEmail,
  env: Record<string, string | undefined> = process.env,
  buscar: typeof fetch = fetch,
): Promise<ResultadoEnvio> {
  const config = configuracaoEmail(env)
  if (!config.ativo) return { enviado: false, motivo: config.motivo }

  try {
    const resposta = await buscar('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.chave}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: config.remetente,
        to: [para],
        subject: mensagem.assunto,
        text: mensagem.texto,
        html: mensagem.html,
      }),
      signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
    })
    if (!resposta.ok) {
      // O corpo traz o motivo (domínio não verificado, chave inválida…); vai
      // para o log da Vercel, não para a tela.
      await registrarFalha(
        'Resend recusou o e-mail',
        new Error(`HTTP ${resposta.status}: ${await resposta.text()}`),
      )
      return { enviado: false, motivo: 'FALHA_NO_ENVIO' }
    }
    return { enviado: true }
  } catch (erro) {
    await registrarFalha('Falha ao enviar e-mail', erro)
    return { enviado: false, motivo: 'FALHA_NO_ENVIO' }
  }
}

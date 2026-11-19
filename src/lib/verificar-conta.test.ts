import { beforeEach, describe, expect, it, vi } from 'vitest'

const clerk = vi.hoisted(() => ({
  getUser: vi.fn(),
}))
vi.mock('@clerk/nextjs/server', () => ({
  clerkClient: async () => ({ users: { getUser: clerk.getUser } }),
}))

const { verificarConta } = await import('./verificar-conta')

function usuario(emails: { id: string; emailAddress: string; verificado?: boolean }[], principal: string) {
  return {
    primaryEmailAddressId: principal,
    emailAddresses: emails.map((e) => ({
      id: e.id,
      emailAddress: e.emailAddress,
      verification: { status: e.verificado === false ? 'unverified' : 'verified' },
    })),
  }
}

let contador = 0
const novaConta = () => `user_${++contador}`

beforeEach(() => {
  clerk.getUser.mockReset()
  vi.unstubAllEnvs()
})

describe('verificarConta', () => {
  it('autoriza o e-mail principal verificado do domínio', async () => {
    clerk.getUser.mockResolvedValue(usuario([{ id: 'a', emailAddress: 'ana@ctcea.org.br' }], 'a'))
    expect(await verificarConta(novaConta())).toBe('autorizada')
  })

  it('nega e-mail de fora, ainda que haja um ctcea.org.br secundário', async () => {
    clerk.getUser.mockResolvedValue(
      usuario(
        [
          { id: 'a', emailAddress: 'ana@gmail.com' },
          { id: 'b', emailAddress: 'ana@ctcea.org.br' },
        ],
        'a',
      ),
    )
    expect(await verificarConta(novaConta())).toBe('dominio')
  })

  it('nega o e-mail do domínio que não foi verificado', async () => {
    clerk.getUser.mockResolvedValue(
      usuario([{ id: 'a', emailAddress: 'ana@ctcea.org.br', verificado: false }], 'a'),
    )
    expect(await verificarConta(novaConta())).toBe('dominio')
  })

  it('nega conta sem e-mail principal', async () => {
    clerk.getUser.mockResolvedValue(usuario([], 'x'))
    expect(await verificarConta(novaConta())).toBe('dominio')
  })

  it('a exceção por endereço libera quem foi listado, e só ele', async () => {
    vi.stubEnv('EMAILS_EXCECAO', 'dono@gmail.com')
    clerk.getUser.mockResolvedValue(usuario([{ id: 'a', emailAddress: 'dono@gmail.com' }], 'a'))
    expect(await verificarConta(novaConta())).toBe('autorizada')
    clerk.getUser.mockResolvedValue(usuario([{ id: 'a', emailAddress: 'outro@gmail.com' }], 'a'))
    expect(await verificarConta(novaConta())).toBe('dominio')
  })

  it('guarda o resultado por alguns minutos e depois consulta de novo', async () => {
    const conta = novaConta()
    clerk.getUser.mockResolvedValue(usuario([{ id: 'a', emailAddress: 'ana@ctcea.org.br' }], 'a'))
    const t0 = 1_000_000
    await verificarConta(conta, t0)
    await verificarConta(conta, t0 + 60_000)
    expect(clerk.getUser).toHaveBeenCalledTimes(1)

    await verificarConta(conta, t0 + 11 * 60_000)
    expect(clerk.getUser).toHaveBeenCalledTimes(2)
  })

  it('a negativa vale menos tempo, para quem corrigiu o e-mail entrar logo', async () => {
    const conta = novaConta()
    clerk.getUser.mockResolvedValue(usuario([{ id: 'a', emailAddress: 'ana@gmail.com' }], 'a'))
    const t0 = 2_000_000
    expect(await verificarConta(conta, t0)).toBe('dominio')

    clerk.getUser.mockResolvedValue(usuario([{ id: 'a', emailAddress: 'ana@ctcea.org.br' }], 'a'))
    expect(await verificarConta(conta, t0 + 61_000)).toBe('autorizada')
  })

  it('falha do Clerk nega ("verificacao") e não fica guardada', async () => {
    const conta = novaConta()
    clerk.getUser.mockRejectedValueOnce(new Error('Clerk fora do ar'))
    expect(await verificarConta(conta)).toBe('verificacao')

    clerk.getUser.mockResolvedValue(usuario([{ id: 'a', emailAddress: 'ana@ctcea.org.br' }], 'a'))
    expect(await verificarConta(conta)).toBe('autorizada')
  })
})

import { resolveSpecialistInstructions } from '@/mastra/agents/resolve-instructions'

jest.mock('@/mastra/lib/supabase-admin', () => ({
  supabaseAdmin: {
    from: jest.fn(),
  },
}))

import { supabaseAdmin } from '@/mastra/lib/supabase-admin'

const mockFrom = supabaseAdmin.from as jest.Mock

function buildChain(result: { data: unknown; error: unknown }) {
  const chain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(result),
  }
  mockFrom.mockReturnValue(chain)
  return chain
}

describe('resolveSpecialistInstructions', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns sharedGuidelines concatenated with DB content', async () => {
    buildChain({
      data: { current_prompt_version: { content: 'Você é um cardiologista.' } },
      error: null,
    })

    const result = await resolveSpecialistInstructions('cardiology')

    expect(result).toContain('Você é um cardiologista.')
    expect(result).toContain('SEGUNDA OPINIÃO')
    expect(result.indexOf('SEGUNDA OPINIÃO')).toBeLessThan(result.indexOf('Você é um cardiologista.'))
  })

  it('throws when supabase returns an error', async () => {
    buildChain({ data: null, error: { message: 'not found' } })

    await expect(resolveSpecialistInstructions('unknown')).rejects.toThrow('not found')
  })

  it('throws when current_prompt_version is null', async () => {
    buildChain({ data: { current_prompt_version: null }, error: null })

    await expect(resolveSpecialistInstructions('cardiology')).rejects.toThrow(
      'sem versão ativa',
    )
  })
})
